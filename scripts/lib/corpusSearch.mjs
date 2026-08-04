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

async function readCorpusFileRaw(relPath) {
  return fs.readFile(resolveCorpusPath(relPath), "utf8");
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
 */
export async function searchCorpus(query, { maxResults = 6 } = {}) {
  const terms = tokenizeQuery(query);

  // Semantic signal from the embedding index (optional — empty map if the
  // index hasn't been built or the model can't load). Dynamic import keeps
  // the corpusSearch <-> corpusIndex dependency one-directional at load time.
  let semantic = new Map();
  try {
    const { fileSimilarities } = await import("./corpusIndex.mjs");
    semantic = await fileSimilarities(query);
  } catch {
    // lexical-only fallback
  }

  if (terms.length === 0 && semantic.size === 0) return [];

  const relPaths = (await listCorpusPaths()).filter(isOnDemand);
  const results = [];

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
      // Path/title/tag hits signal the whole file is about this concept.
      let termScore = lowerHeader.includes(term) ? 5 : 0;
      // Body hits accumulate, capped so one giant file can't drown the rest.
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
    // Reward files matching more distinct terms over one term repeated.
    if (score > 0 && terms.length > 0) score *= matchedTerms.length / terms.length;

    // Blend: cosine similarity (~0.3–0.7 for real hits) scaled into the same
    // range as lexical scores. Catches paraphrased queries ("crowded court
    // dockets") that share no tokens with the file ("court clog").
    const sim = semantic.get(relPath);
    if (sim && sim.score >= 0.3) score += sim.score * 20;

    if (score === 0) continue;

    let snippets = extractSnippets(content, lowerContent, matchedTerms);
    // Semantic-only hit (no term matched anywhere): snippet from the best
    // matching chunk so the model still sees why the file surfaced.
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
      score: Math.round(score * 10) / 10,
      sizeChars: content.length,
      snippets,
    });
  }

  return results.sort((a, b) => b.score - a.score).slice(0, maxResults);
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
