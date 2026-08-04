// Semantic index over the on-demand corpus (everything outside CORE_DIRS —
// reference/ is always inlined in prompts, so it is never indexed).
//
// The index is a JSON file of chunk embeddings built offline/at-ingest by
// scripts/build-index.mjs. Chunk offsets are char offsets into the raw file,
// so they line up with readCorpusSection / search snippet offsets. Query-time
// consumers (corpusSearch.mjs, prompt.mjs retrieval mode) treat the index as
// optional: if the file is missing or the embedding model can't load, they
// fall back to lexical-only behavior rather than failing the request.

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { embedTexts, embedText, cosineSimilarity, EMBEDDING_MODEL_ID } from "./embeddings.mjs";
import { listCorpusPaths, CORE_DIRS } from "./corpusSearch.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..");
const TRAINING_DATA = path.join(ROOT, "training-data");
// Lives next to scripts/manifest.json (the ingest ledger) — generated, but
// committed so deploys don't need to re-embed the corpus at boot.
export const INDEX_PATH = path.join(ROOT, "scripts", "corpus-index.json");

// Chunk sizing: big enough that a debate card (tag + cite + body) usually
// fits in one chunk, small enough that top-k retrieval stays focused.
const CHUNK_CHARS = 1600;
const CHUNK_OVERLAP = 200;

function isOnDemand(relPath) {
  return !CORE_DIRS.has(relPath.split("/")[0]);
}

// Splits file content into chunks preferring paragraph boundaries; falls back
// to hard splits for wall-of-text files. Returns [{offset, length, text}].
export function chunkContent(content) {
  const chunks = [];
  let pos = 0;
  while (pos < content.length) {
    let end = Math.min(pos + CHUNK_CHARS, content.length);
    if (end < content.length) {
      // Prefer to break at a blank line, then a newline, inside the back
      // half of the window so chunks don't split cards mid-sentence.
      const window = content.slice(pos + Math.floor(CHUNK_CHARS / 2), end);
      const blank = window.lastIndexOf("\n\n");
      const newline = window.lastIndexOf("\n");
      const cut = blank !== -1 ? blank : newline;
      if (cut !== -1) end = pos + Math.floor(CHUNK_CHARS / 2) + cut + 1;
    }
    const text = content.slice(pos, end);
    if (text.trim().length > 0) {
      chunks.push({ offset: pos, length: text.length, text });
    }
    if (end >= content.length) break;
    pos = Math.max(end - CHUNK_OVERLAP, pos + 1);
  }
  return chunks;
}

function parseHeader(content) {
  // Reuses the frontmatter conventions from corpusSearch.parseFrontmatter,
  // but only needs title/tags for embedding context.
  const meta = { title: "", tags: [] };
  if (!content.startsWith("---")) return meta;
  const end = content.indexOf("\n---", 3);
  if (end === -1) return meta;
  for (const line of content.slice(3, end).split("\n")) {
    const m = line.match(/^(\w+):\s*(.+)$/);
    if (!m) continue;
    if (m[1] === "title") meta.title = m[2].trim();
    else if (m[1] === "tags") {
      meta.tags = m[2].trim().replace(/^\[|\]$/g, "").split(",").map((t) => t.trim()).filter(Boolean);
    }
  }
  return meta;
}

/**
 * Builds the full index and writes it to INDEX_PATH.
 * Returns { files, chunks } counts for logging.
 */
export async function buildIndex() {
  const relPaths = (await listCorpusPaths()).filter(isOnDemand);
  const entries = [];
  const texts = [];

  for (const relPath of relPaths) {
    let content;
    try {
      content = await fs.readFile(path.join(TRAINING_DATA, ...relPath.split("/")), "utf8");
    } catch {
      continue;
    }
    const meta = parseHeader(content);
    for (const chunk of chunkContent(content)) {
      entries.push({ path: relPath, title: meta.title, offset: chunk.offset, length: chunk.length });
      // Prefix the header context so a chunk from deep inside a file still
      // carries what the file is about; the stored offsets stay raw-content.
      texts.push(`${relPath} ${meta.title} ${meta.tags.join(" ")}\n${chunk.text}`);
    }
  }

  const vectors = await embedTexts(texts);
  const chunks = entries.map((e, i) => ({
    ...e,
    // 4 decimals keeps the file ~3x smaller with no retrieval-quality loss.
    vec: vectors[i].map((v) => Math.round(v * 10000) / 10000),
  }));

  const index = {
    model: EMBEDDING_MODEL_ID,
    builtAt: new Date().toISOString(),
    chunks,
  };
  await fs.writeFile(INDEX_PATH, JSON.stringify(index), "utf8");
  return { files: relPaths.length, chunks: chunks.length };
}

// --- query-time ------------------------------------------------------------

let indexPromise = null;
function loadIndex() {
  if (!indexPromise) {
    indexPromise = fs
      .readFile(INDEX_PATH, "utf8")
      .then((raw) => JSON.parse(raw))
      .catch(() => null); // no index built yet — callers fall back to lexical
  }
  return indexPromise;
}

// Ingest rebuilds the index in-process; drop the cached copy so the running
// server picks up the fresh file on the next query.
export function invalidateIndexCache() {
  indexPromise = null;
}

/**
 * Semantic search over indexed chunks. Returns up to k chunks:
 * [{path, title, offset, length, score}] sorted by similarity, or [] if the
 * index or embedder is unavailable (callers must tolerate that).
 */
export async function searchIndex(query, { k = 12 } = {}) {
  const index = await loadIndex();
  if (!index || !Array.isArray(index.chunks) || index.chunks.length === 0) return [];
  let queryVec;
  try {
    queryVec = await embedText(query);
  } catch {
    return []; // model unavailable (offline first boot, etc.) — degrade quietly
  }
  const scored = index.chunks.map((c) => ({
    path: c.path,
    title: c.title,
    offset: c.offset,
    length: c.length,
    score: cosineSimilarity(queryVec, c.vec),
  }));
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, k);
}

/**
 * Per-file best hit for a query — used by corpusSearch.searchCorpus to blend
 * semantic signal into its lexical ranking.
 * Returns Map<path, {score, offset, length}>.
 */
export async function fileSimilarities(query) {
  const hits = await searchIndex(query, { k: 64 });
  const byFile = new Map();
  for (const hit of hits) {
    if (!byFile.has(hit.path) || byFile.get(hit.path).score < hit.score) {
      byFile.set(hit.path, { score: hit.score, offset: hit.offset, length: hit.length });
    }
  }
  return byFile;
}

/**
 * Retrieval for prompt injection (the one-shot endpoints). Long inputs (a
 * full case, a drill speech) exceed the embedding model's window, so the
 * query is probed in segments and hit scores merged; overlapping/adjacent
 * chunks from the same file are coalesced into single ranges.
 * Returns [{path, title, offset, length, score}] sorted by score, [] if the
 * index is unavailable.
 */
export async function retrieveChunks(query, { k = 12 } = {}) {
  const text = (query || "").trim();
  if (!text) return [];

  // Probe segments: whole short queries as-is; long ones sampled start /
  // middle / end so retrieval sees more than the intro.
  const SEG = 1500;
  const probes = [];
  if (text.length <= SEG) {
    probes.push(text);
  } else {
    probes.push(text.slice(0, SEG));
    probes.push(text.slice(Math.floor(text.length / 2) - SEG / 2, Math.floor(text.length / 2) + SEG / 2));
    probes.push(text.slice(-SEG));
  }

  const best = new Map(); // key: path:offset -> hit
  for (const probe of probes) {
    for (const hit of await searchIndex(probe, { k: k * 2 })) {
      const key = `${hit.path}:${hit.offset}`;
      if (!best.has(key) || best.get(key).score < hit.score) best.set(key, hit);
    }
  }

  const top = [...best.values()].sort((a, b) => b.score - a.score).slice(0, k);

  // Coalesce overlapping/adjacent ranges within a file (chunks overlap by
  // design) so the prompt doesn't repeat text.
  const byFile = new Map();
  for (const hit of top) {
    if (!byFile.has(hit.path)) byFile.set(hit.path, []);
    byFile.get(hit.path).push(hit);
  }
  const merged = [];
  for (const [, hits] of byFile) {
    hits.sort((a, b) => a.offset - b.offset);
    let current = { ...hits[0] };
    for (let i = 1; i < hits.length; i++) {
      const h = hits[i];
      if (h.offset <= current.offset + current.length + 100) {
        current.length = Math.max(current.offset + current.length, h.offset + h.length) - current.offset;
        current.score = Math.max(current.score, h.score);
      } else {
        merged.push(current);
        current = { ...h };
      }
    }
    merged.push(current);
  }
  return merged.sort((a, b) => b.score - a.score);
}
