// Local sentence embeddings for corpus retrieval: same in-process,
// no-external-API pattern as transcribe.mjs (model downloads once, then is
// cached on disk). Used by the corpus index builder and by query-time
// semantic search in corpusSearch.mjs.

import { pipeline } from "@huggingface/transformers";

const MODEL_ID = "Xenova/all-MiniLM-L6-v2";

let embedderPromise = null;
function getEmbedder() {
  if (!embedderPromise) {
    embedderPromise = pipeline("feature-extraction", MODEL_ID);
  }
  return embedderPromise;
}

export const EMBEDDING_MODEL_ID = MODEL_ID;

/**
 * Embeds an array of strings into unit-normalized vectors.
 * Returns number[][] (one vector per input, in order).
 */
export async function embedTexts(texts) {
  if (!Array.isArray(texts) || texts.length === 0) return [];
  const embedder = await getEmbedder();
  const vectors = [];
  // Batch to keep peak memory modest on long corpus builds.
  const BATCH = 16;
  for (let i = 0; i < texts.length; i += BATCH) {
    const batch = texts.slice(i, i + BATCH);
    const output = await embedder(batch, { pooling: "mean", normalize: true });
    const [rows, dims] = output.dims;
    for (let r = 0; r < rows; r++) {
      vectors.push(Array.from(output.data.slice(r * dims, (r + 1) * dims)));
    }
  }
  return vectors;
}

export async function embedText(text) {
  const [vec] = await embedTexts([text]);
  return vec;
}

// Inputs are unit-normalized, so cosine similarity is just the dot product.
export function cosineSimilarity(a, b) {
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return dot;
}
