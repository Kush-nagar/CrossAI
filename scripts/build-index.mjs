// Builds the semantic corpus index (scripts/corpus-index.json) from
// training-data/**. Run after adding corpus material:
//
//   npm run build-index
//
// The ingest pipeline (npm run ingest) also rebuilds it automatically.

import { buildIndex, INDEX_PATH } from "./lib/corpusIndex.mjs";

const started = Date.now();
const { files, chunks } = await buildIndex();
console.log(
  `Indexed ${chunks} chunks from ${files} files in ${((Date.now() - started) / 1000).toFixed(1)}s -> ${INDEX_PATH}`
);
