// Agentic corpus retrieval for the chat endpoint.
//
// Instead of loading the full training-data/ corpus into every request, the
// chat system prompt carries only the always-needed core (reference/) plus a
// manifest of what else exists. The model pulls the rest on demand through
// the search_corpus / read_corpus_file tools backed by this module. This
// keeps the system prompt byte-stable (so prompt caching keeps hitting) while
// the retrieved content flows in through tool results instead.
//
// Ranking blends two signals, both local (no external services): lexical
// term scoring — debate material is jargon-dense ("court clog", "Leibler
// 23", "link turn"), which exact matching handles well — plus cosine
// similarity from the embedding index (scripts/corpus-index.json, built by
// scripts/build-index.mjs), which catches paraphrases lexical matching
// misses. The semantic side is optional: with no index built, search is
// lexical-only.

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..");
const TRAINING_DATA = path.join(ROOT, "training-data");

// reference/ is always loaded inline in the system prompt (methodology,
// factor weights, judge paradigms — needed on nearly every turn). Everything
// else is retrieved on demand.
export const CORE_DIRS = new Set(["reference"]);

const SNIPPET_RADIUS = 300; // chars of context around a match
const MAX_SNIPPETS_PER_FILE = 3;
const DEFAULT_READ_LENGTH = 40000; // chars per read_corpus_file call
const MAX_READ_LENGTH = 60000;

// Words too generic to score on — everything else, including short debate
// jargon ("k", "da", "cx", "1ar"), counts.
const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "of", "to", "in", "on", "for", "with",
  "is", "are", "was", "be", "that", "this", "it", "as", "at", "by", "from",
  "what", "how", "about", "any", "their", "there",
]);

function isOnDemand(relPath) {
  return !CORE_DIRS.has(relPath.split("/")[0]);
}

// Walks training-data/ and returns sorted POSIX-style relative paths.
// Sorted so downstream output (manifest, prompt text) is deterministic —
// nondeterministic ordering would silently break prompt-cache prefixes.
export async function listCorpusPaths(dir = TRAINING_DATA, prefix = "") {
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const files = [];
  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    const relPath = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      files.push(...(await listCorpusPaths(path.join(dir, entry.name), relPath)));
    } else if (entry.isFile()) {
      files.push(relPath);
    }
  }
  return files.sort();
}

// Resolves a corpus-relative path safely; rejects traversal outside
// training-data/. Returns the absolute path or throws.
function resolveCorpusPath(relPath) {
  if (typeof relPath !== "string" || !relPath.trim()) {
    throw new Error("path is required");
  }
  const abs = path.resolve(TRAINING_DATA, ...relPath.split("/"));
  if (abs !== TRAINING_DATA && !abs.startsWith(TRAINING_DATA + path.sep)) {
    throw new Error(`Invalid corpus path: ${relPath}`);
  }
  return abs;
}

// mtime-keyed content cache. buildCorpusManifest() (system-prompt build, runs
// on EVERY chat turn before the first token) and searchCorpus() (per search)
// both read every on-demand corpus file; without this they re-read the whole
// corpus from disk each time, adding avoidable I/O straight onto TTFT. Keyed on
// mtimeMs so it self-heals when ingest — or a manual edit in dev — changes a
// file: a stat is cheap, the re-read only happens when the file actually moved.
const fileCache = new Map(); // relPath -> { mtimeMs, content }

async function readCorpusFileRaw(relPath) {
  const abs = resolveCorpusPath(relPath);
  let mtimeMs;
  try {
    ({ mtimeMs } = await fs.stat(abs));
  } catch (err) {
    fileCache.delete(relPath); // deleted/renamed — drop any stale entry
    throw err;
  }
  const cached = fileCache.get(relPath);
  if (cached && cached.mtimeMs === mtimeMs) return cached.content;
  const content = await fs.readFile(abs, "utf8");
  fileCache.set(relPath, { mtimeMs, content });
  return content;
}

// Minimal frontmatter reader: pulls title/tags/description out of a leading
// `--- ... ---` block if present. Not a YAML parser — just enough for the
// ingest pipeline's simple key: value lines.
function parseFrontmatter(content) {
  const meta = { title: "", tags: [], description: "" };
  if (!content.startsWith("---")) return meta;
  const end = content.indexOf("\n---", 3);
  if (end === -1) return meta;
  for (const line of content.slice(3, end).split("\n")) {
    const m = line.match(/^(\w+):\s*(.+)$/);
    if (!m) continue;
    const [, key, rawValue] = m;
    const value = rawValue.trim();
    if (key === "title") meta.title = value;
    else if (key === "description") meta.description = value;
    else if (key === "tags") {
      meta.tags = value
        .replace(/^\[|\]$/g, "")
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
    }
  }
  return meta;
}

/**
 * Manifest of the on-demand corpus: path, title, tags, size. Included in the
 * chat system prompt so the model knows what it can retrieve without any of
 * the content being loaded up front.
 */
export async function buildCorpusManifest() {
  const relPaths = (await listCorpusPaths()).filter(isOnDemand);
  const manifest = [];
  for (const relPath of relPaths) {
    let content = "";
    try {
      content = await readCorpusFileRaw(relPath);
    } catch {
      continue;
    }
    const meta = parseFrontmatter(content);
    manifest.push({
      path: relPath,
      title: meta.title,
      tags: meta.tags,
      sizeChars: content.length,
    });
  }
  return manifest;
}

function tokenizeQuery(query) {
  return [
    ...new Set(
      (query || "")
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((t) => t && !STOPWORDS.has(t))
    ),
  ];
}

// Collects up to MAX_SNIPPETS_PER_FILE non-overlapping snippets around the
// earliest term matches, each tagged with its char offset so the model can
// follow up with a targeted read_corpus_file(offset).
function extractSnippets(content, lowerContent, terms) {
  const positions = [];
  for (const term of terms) {
    let idx = lowerContent.indexOf(term);
    let found = 0;
    while (idx !== -1 && found < 5) {
      positions.push(idx);
      found++;
      idx = lowerContent.indexOf(term, idx + term.length);
    }
  }
  positions.sort((a, b) => a - b);

  const snippets = [];
  let lastEnd = -1;
  for (const pos of positions) {
    if (snippets.length >= MAX_SNIPPETS_PER_FILE) break;
    if (pos <= lastEnd) continue; // overlaps the previous snippet
    const start = Math.max(0, pos - SNIPPET_RADIUS);
    const end = Math.min(content.length, pos + SNIPPET_RADIUS);
    snippets.push({
      offset: start,
      text: (start > 0 ? "…" : "") + content.slice(start, end).replace(/\s+/g, " ").trim() + (end < content.length ? "…" : ""),
    });
    lastEnd = end;
  }
  return snippets;
}

/**
 * Lexical search across the on-demand corpus. Returns scored files with
 * snippets: [{path, title, score, sizeChars, snippets: [{offset, text}]}].
 *
 * Scoring is index-driven: for each query term, look up which files contain
 * it (a Map lookup) instead of scanning every file's full text. Content is
 * only read for the files that actually score — and even then, only the
 * final top `maxResults` need their content for snippet extraction. This
 * replaces an O(all files) scan with O(files matching a query term), which
 * matters once the corpus is thousands of files: the old scan measured
 * 2-6+ seconds per search_corpus call against the real corpus; this brings
 * that down to tens of milliseconds. See corpusIndex.mjs buildLexicalIndex.
 *
 * Falls back to the pre-index full-scan behavior if the lexical index
 * hasn't been built yet (npm run build-index), so nothing breaks on a repo
 * that hasn't rebuilt.
 */
export async function searchCorpus(query, { maxResults = 6 } = {}) {
  const terms = tokenizeQuery(query);

  // Semantic signal from the embedding index (optional — empty map if the
  // index hasn't been built or the model can't load). Dynamic import keeps
  // the corpusSearch <-> corpusIndex dependency one-directional at load time.
  let semantic = new Map();
  let lexicalIndex = null;
  try {
    const corpusIndexMod = await import("./corpusIndex.mjs");
    semantic = await corpusIndexMod.fileSimilarities(query);
    lexicalIndex = await corpusIndexMod.loadLexicalIndex();
  } catch {
    // lexical-only fallback, and/or no lexical index yet — both handled below
  }

  if (terms.length === 0 && semantic.size === 0) return [];

  // Accumulate per-file score using the inverted index: touch only files
  // that actually contain at least one query term, not the whole corpus.
  const fileScores = new Map(); // path -> { score, matchedTerms: Set }
  function bump(relPath, amount, term) {
    if (!fileScores.has(relPath)) fileScores.set(relPath, { score: 0, matchedTerms: new Set() });
    const entry = fileScores.get(relPath);
    entry.score += amount;
    if (term) entry.matchedTerms.add(term);
  }

  if (lexicalIndex) {
    for (const term of terms) {
      for (const relPath of lexicalIndex.header[term] || []) bump(relPath, 5, term);
      for (const [relPath, count] of Object.entries(lexicalIndex.body[term] || {})) {
        bump(relPath, count, term);
      }
    }
    // Reward files matching more distinct terms over one term repeated.
    if (terms.length > 0) {
      for (const entry of fileScores.values()) {
        entry.score *= entry.matchedTerms.size / terms.length;
      }
    }
  }

  // Semantic-only hits (no lexical term matched anywhere) still need a
  // score entry so they aren't dropped from the candidate set.
  for (const relPath of semantic.keys()) {
    if (!fileScores.has(relPath)) fileScores.set(relPath, { score: 0, matchedTerms: new Set() });
  }
  for (const [relPath, sim] of semantic) {
    if (sim.score >= 0.3) bump(relPath, sim.score * 20, null);
  }

  // No lexical index built yet: degrade to the old full-scan so search still
  // works (slower, but correct) until `npm run build-index` runs.
  if (!lexicalIndex && terms.length > 0) {
    const relPaths = (await listCorpusPaths()).filter(isOnDemand);
    for (const relPath of relPaths) {
      let content;
      try {
        content = await readCorpusFileRaw(relPath);
      } catch {
        continue;
      }
      const meta = parseFrontmatter(content);
      const lowerContent = content.toLowerCase();
      const lowerHeader = `${relPath} ${meta.title} ${meta.tags.join(" ")}`.toLowerCase();
      let score = 0;
      const matchedTerms = [];
      for (const term of terms) {
        let termScore = lowerHeader.includes(term) ? 5 : 0;
        let idx = lowerContent.indexOf(term);
        let count = 0;
        while (idx !== -1 && count < 20) {
          count++;
          idx = lowerContent.indexOf(term, idx + term.length);
        }
        termScore += count;
        if (termScore > 0) matchedTerms.push(term);
        score += termScore;
      }
      if (score > 0) score *= matchedTerms.length / terms.length;
      if (score > 0) {
        const entry = fileScores.get(relPath) || { score: 0, matchedTerms: new Set() };
        entry.score += score;
        fileScores.set(relPath, entry);
      }
    }
  }

  const ranked = [...fileScores.entries()]
    .filter(([, e]) => e.score > 0)
    .sort((a, b) => b[1].score - a[1].score)
    .slice(0, maxResults);

  const results = [];
  for (const [relPath, entry] of ranked) {
    let content;
    try {
      content = await readCorpusFileRaw(relPath);
    } catch {
      continue;
    }
    const meta = parseFrontmatter(content);
    const lowerContent = content.toLowerCase();
    let snippets = extractSnippets(content, lowerContent, [...entry.matchedTerms]);
    const sim = semantic.get(relPath);
    if (snippets.length === 0 && sim) {
      const end = Math.min(content.length, sim.offset + 2 * SNIPPET_RADIUS);
      snippets = [{
        offset: sim.offset,
        text: (sim.offset > 0 ? "…" : "") + content.slice(sim.offset, end).replace(/\s+/g, " ").trim() + (end < content.length ? "…" : ""),
      }];
    }
    results.push({
      path: relPath,
      title: meta.title,
      score: Math.round(entry.score * 10) / 10,
      sizeChars: content.length,
      snippets,
    });
  }

  return results;
}

/**
 * Ranged read of a corpus file (chars, not bytes/lines — offsets line up
 * with searchCorpus snippet offsets). Returns {content, offset, length,
 * totalChars, hasMore}.
 */
export async function readCorpusSection(relPath, { offset = 0, length = DEFAULT_READ_LENGTH } = {}) {
  const content = await readCorpusFileRaw(relPath);
  const safeOffset = Math.max(0, Math.min(Number(offset) || 0, content.length));
  const safeLength = Math.max(1, Math.min(Number(length) || DEFAULT_READ_LENGTH, MAX_READ_LENGTH));
  const slice = content.slice(safeOffset, safeOffset + safeLength);
  return {
    content: slice,
    offset: safeOffset,
    length: slice.length,
    totalChars: content.length,
    hasMore: safeOffset + slice.length < content.length,
  };
}
