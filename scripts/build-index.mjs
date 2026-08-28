// Builds the semantic corpus index (scripts/corpus-index.json) from
// training-data/**. Run after adding corpus material:
//
//   npm run build-index
//
// The ingest pipeline (npm run ingest) also rebuilds it automatically.

import { buildIndex, buildLexicalIndex, INDEX_PATH, LEXICAL_INDEX_PATH } from "./lib/corpusIndex.mjs";

const lexStarted = Date.now();
const { files: lexFiles, terms } = await buildLexicalIndex();
console.log(
  `Lexical index: ${terms} terms from ${lexFiles} files in ${((Date.now() - lexStarted) / 1000).toFixed(1)}s -> ${LEXICAL_INDEX_PATH}`
);

const started = Date.now();
const { files, chunks } = await buildIndex();
console.log(
  `Semantic index: ${chunks} chunks from ${files} files in ${((Date.now() - started) / 1000).toFixed(1)}s -> ${INDEX_PATH}`
);
