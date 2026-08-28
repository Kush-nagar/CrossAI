// Builds ONLY the lexical index (scripts/lexical-index.json) — not the
// semantic/embedding one. Deliberately separate from build-index.mjs: this
// has no embedding-model dependency and takes seconds, so it's safe to run
// on every deploy build. The semantic index stays committed and untouched
// here, since re-embedding the whole corpus at deploy time is the exact
// cost that design was avoiding in the first place.
//
//   node scripts/build-lexical-index.mjs

import { buildLexicalIndex, LEXICAL_INDEX_PATH } from "./lib/corpusIndex.mjs";

const started = Date.now();
const { files, terms } = await buildLexicalIndex();
console.log(
  `Lexical index: ${terms} terms from ${files} files in ${((Date.now() - started) / 1000).toFixed(1)}s -> ${LEXICAL_INDEX_PATH}`
);
