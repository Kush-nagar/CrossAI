// Builds the card library index (scripts/card-index/) from the public
// disclosed archive — see scripts/lib/cardLibrary.mjs. Pure text processing,
// no model or network, so it runs on every deploy build alongside the
// lexical index.
//
//   node scripts/build-card-index.mjs

import { buildCardIndex, CARD_INDEX_DIR } from "./lib/cardLibrary.mjs";

const started = Date.now();
const { files, cards } = await buildCardIndex();
console.log(`Card index: ${cards} cards from ${files} files in ${((Date.now() - started) / 1000).toFixed(1)}s -> ${CARD_INDEX_DIR}`);
