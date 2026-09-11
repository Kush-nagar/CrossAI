#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { listCorpusPaths } from "./lib/corpusSearch.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const TRAINING_DATA = path.join(ROOT, "training-data");
const OUTPUT = path.join(
  ROOT,
  "incoming",
  "reference-enriched-metadata.json"
);

function normalize(text = "") {
  return text
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function unique(arr) {
  return [...new Set(arr.filter(Boolean))];
}

function hasAny(text, patterns) {
  return patterns.some((pattern) => pattern.test(text));
}

function countMatches(text, patterns) {
  return patterns.reduce(
    (count, pattern) => count + (pattern.test(text) ? 1 : 0),
    0
  );
}

/**
 * Infer metadata from both the file path and the actual document contents.
 */
function inferMetadata(relPath, content) {
  const p = normalize(relPath);
  const text = normalize(content);

  const types = [];
  const categories = [];
  const tags = [];
  const subtopics = [];

  // ============================================================
  // SOURCE / DOCUMENT TYPE
  // ============================================================

  let source = "unknown";
  let documentType = "unknown";

  if (p.startsWith("cases/pf-archive/")) {
    source = "pf-archive";
    documentType = "round";
  } else if (p.startsWith("cases/pf-rebuttals/")) {
    source = "pf-rebuttal";
    documentType = "round";
  } else if (p.startsWith("cases/")) {
    source = "case";
    documentType = "case";
  } else if (p.startsWith("blocks/")) {
    source = "blocks";
    documentType = "block";
  } else if (p.startsWith("evidence/")) {
    source = "evidence";
    documentType = "evidence";
  } else if (p.startsWith("lectures/")) {
    source = "lecture";
    documentType = "lecture";
  } else if (p.startsWith("judging/")) {
    source = "judging";
    documentType = "judging";
  } else if (p.startsWith("rounds/")) {
    source = "rounds";
    documentType = "round";
  } else if (p.startsWith("reference/")) {
    source = "reference";
    documentType = "reference";
  }

  types.push(documentType);

  // ============================================================
  // SEASON
  // ============================================================

  let season = null;

  const seasonMatch = relPath.match(
    /(?:^|\/)(20\d{2}-20\d{2})(?:\/|$)/
  );

  if (seasonMatch) {
    season = seasonMatch[1];
  }

  // ============================================================
  // SIDE
  // ============================================================

  let side = "unknown";

  const affirmativePatterns = [
    /\b1ac\b/,
    /\b1ar\b/,
    /\baffirmative\b/,
    /\baffirm\b/,
    /\bpro\b/,
    /\baff\b/,
  ];

  const negativePatterns = [
    /\b2nc\b/,
    /\b2nr\b/,
    /\bnegative\b/,
    /\bneg\b/,
    /\bcon\b/,
  ];

  const affPathHits = countMatches(p, affirmativePatterns);
  const negPathHits = countMatches(p, negativePatterns);

  const affTextHits = countMatches(text, affirmativePatterns);
  const negTextHits = countMatches(text, negativePatterns);

  const affScore = affPathHits * 3 + affTextHits;
  const negScore = negPathHits * 3 + negTextHits;

  if (affScore > negScore && affScore > 0) {
    side = "affirmative";
  } else if (negScore > affScore && negScore > 0) {
    side = "negative";
  }

  // ============================================================
  // TOPICALITY
  // ============================================================

  if (
    hasAny(text, [
      /\btopicality\b/,
      /\binterpretation\b/,
      /\bstandards\b/,
      /\bviolation\b/,
      /\bcompeting interpretations\b/,
      /\bwe meet\b/,
      /\bnot topical\b/,
      /\bextra topical\b/,
    ])
  ) {
    types.push("topicality");
    categories.push("topicality");
    tags.push("topicality");
  }

  // ============================================================
  // THEORY
  // ============================================================

  if (
    hasAny(text, [
      /\btheory shell\b/,
      /\btheory argument\b/,
      /\bprocedural fairness\b/,
      /\bconditionality\b/,
      /\bcondo\b/,
      /\bdisclosure\b/,
      /\bjudge kick\b/,
      /\bmultiple worlds\b/,
      /\btheory\b/,
    ])
  ) {
    types.push("theory");
    categories.push("theory");
    tags.push("theory");
  }

  // ============================================================
  // FRAMEWORK
  // ============================================================

  if (
    hasAny(text, [
      /\bframework\b/,
      /\brole of the ballot\b/,
      /\brole of the judge\b/,
      /\bstandard of evaluation\b/,
      /\bweighing mechanism\b/,
      /\bvalue criterion\b/,
      /\bvalue premise\b/,
    ])
  ) {
    types.push("framework");
    categories.push("framework");
    tags.push("framework");
  }

  // ============================================================
  // KRITIK
  // ============================================================

  const kritikSignals = [
    /\bkritik\b/,
    /\bkritik argument\b/,
    /\bthe k\b/,
    /\blink\b.*\balt\b/,
    /\balternative\b/,
    /\broot cause\b/,
    /\bepistemolog/,
    /\bontology\b/,
    /\bmethodology\b/,
    /\bmethodological\b/,
    /\brepresentation\b/,
    /\bdiscursive\b/,
  ];

  if (countMatches(text, kritikSignals) >= 2) {
    types.push("kritik");
    categories.push("kritik");
    tags.push("k");
  }

  // ============================================================
  // COUNTERPLAN
  // ============================================================

  if (
    hasAny(text, [
      /\bcounterplan\b/,
      /\bcounterplan text\b/,
      /\bnet benefit\b/,
      /\bsolvency advocate\b/,
      /\bcompetition\b.*\bcounterplan\b/,
      /\bconditional counterplan\b/,
    ])
  ) {
    types.push("counterplan");
    categories.push("counterplan");
    tags.push("cp");
    tags.push("counterplan");
  }

  // ============================================================
  // PERMUTATION
  // ============================================================

  if (
    hasAny(text, [
      /\bpermutation\b/,
      /\bperm\b/,
      /\bpermute\b/,
    ])
  ) {
    tags.push("permutation");
  }

  // ============================================================
  // IMPACTS
  // ============================================================

  if (
    hasAny(text, [
      /\bimpact\b/,
      /\bterminal impact\b/,
      /\bextinction\b/,
      /\bwar\b/,
      /\bnuclear war\b/,
      /\bglobal war\b/,
      /\bcatastrophe\b/,
      /\bexistential risk\b/,
    ])
  ) {
    types.push("impact");
    categories.push("impact");
    tags.push("impact");
  }

  // ============================================================
  // SOLVENCY
  // ============================================================

  if (
    hasAny(text, [
      /\bsolvency\b/,
      /\bsolves\b/,
      /\bsolve for\b/,
      /\bsolves the impact\b/,
      /\bsolvency deficit\b/,
    ])
  ) {
    tags.push("solvency");
  }

  // ============================================================
  // COMMON DEBATE CONCEPTS
  // ============================================================

  const concepts = {
    baudrillard: [
      "baudrillard",
    ],

    psychoanalysis: [
      "psychoanalysis",
      "psychoanalytic",
      "psychoanalysis",
    ],

    deleuze: [
      "deleuze",
      "deleuzian",
    ],

    colonialism: [
      "colonialism",
      "colonial",
      "settler colonialism",
    ],

    afropessimism: [
      "afropessimism",
      "afropessimist",
    ],

    heidegger: [
      "heidegger",
      "heideggerian",
    ],

    nietzsche: [
      "nietzsche",
      "nietzschean",
    ],

    orientalism: [
      "orientalism",
      "orientalist",
    ],

    "racial-capitalism": [
      "racial capitalism",
      "racial-capitalism",
    ],

    misinterpellation: [
      "misinterpellation",
    ],

    luminosity: [
      "luminosity",
    ],

    "serious-gaming": [
      "serious gaming",
    ],

    activism: [
      "activism",
      "activist",
    ],

    consult: [
      "consult",
      "consultation",
    ],

    disclosure: [
      "disclosure",
      "disclose",
    ],

    condo: [
      "condo",
      "conditionality",
    ],

    process: [
      "process counterplan",
      "process cp",
    ],

    "cap-good": [
      "cap good",
      "capitalism good",
    ],

    "cap-bad": [
      "cap bad",
      "capitalism bad",
    ],

    extinction: [
      "extinction",
    ],

    personhood: [
      "personhood",
    ],

    warming: [
      "global warming",
      "warming",
      "climate warming",
    ],

    util: [
      "utilitarian",
      "utilitarianism",
      "util",
    ],

    hobbes: [
      "hobbes",
      "hobbesian",
    ],

    kant: [
      "kant",
      "kantian",
    ],

    "virtue-ethics": [
      "virtue ethics",
      "virtue ethic",
    ],
  };

  for (const [tag, needles] of Object.entries(concepts)) {
    if (needles.some((needle) => text.includes(needle))) {
      tags.push(tag);
      subtopics.push(tag);
    }
  }

  // ============================================================
  // ADDITIONAL COMMON PF / POLICY CONCEPTS
  // ============================================================

  const debateConcepts = {
    "link-turn": [
      "link turn",
      "link turn",
    ],

    "impact-turn": [
      "impact turn",
      "impact-turn",
    ],

    "solvency-turn": [
      "solvency turn",
    ],

    "case-turn": [
      "case turn",
    ],

    "uniqueness": [
      "uniqueness",
    ],

    "internal-link": [
      "internal link",
    ],

    "external-link": [
      "external link",
    ],

    "magnitude": [
      "magnitude",
    ],

    "probability": [
      "probability",
    ],

    "timeframe": [
      "timeframe",
      "time frame",
    ],

    "risk-calculus": [
      "risk calculus",
      "risk analysis",
    ],

    "weighing": [
      "weighing",
      "weigh the impacts",
    ],
  };

  for (const [tag, needles] of Object.entries(debateConcepts)) {
    if (needles.some((needle) => text.includes(needle))) {
      tags.push(tag);
      subtopics.push(tag);
    }
  }

  // ============================================================
  // STRUCTURAL SIGNALS
  // ============================================================

  const signals = {
    hasTopicality:
      hasAny(text, [
        /\btopicality\b/,
        /\binterpretation\b/,
        /\bstandards\b/,
        /\bviolation\b/,
      ]),

    hasTheory:
      hasAny(text, [
        /\btheory\b/,
        /\bcondo\b/,
        /\bconditionality\b/,
        /\bdisclosure\b/,
      ]),

    hasFramework:
      hasAny(text, [
        /\bframework\b/,
        /\brole of the ballot\b/,
        /\brole of the judge\b/,
      ]),

    hasImpact:
      hasAny(text, [
        /\bimpact\b/,
        /\bextinction\b/,
        /\bwar\b/,
        /\bcatastrophe\b/,
      ]),

    hasKritik:
      hasAny(text, [
        /\bkritik\b/,
        /\blink\b/,
        /\balternative\b/,
        /\bepistemolog/,
        /\bontology\b/,
      ]),

    hasCP:
      hasAny(text, [
        /\bcounterplan\b/,
        /\bnet benefit\b/,
        /\bsolvency advocate\b/,
      ]),

    hasPermutation:
      hasAny(text, [
        /\bpermutation\b/,
        /\bperm\b/,
      ]),

    hasSolvency:
      hasAny(text, [
        /\bsolvency\b/,
        /\bsolves\b/,
      ]),

    hasLink:
      hasAny(text, [
        /\blink\b/,
        /\blink turn\b/,
        /\binternal link\b/,
      ]),

    hasWarrant:
      hasAny(text, [
        /\bwarrant\b/,
        /\bbecause\b/,
        /\btherefore\b/,
        /\bthis means\b/,
      ]),

    hasUniqueness:
      hasAny(text, [
        /\buniqueness\b/,
        /\balready happening\b/,
        /\balready exists\b/,
      ]),

    hasWeighing:
      hasAny(text, [
        /\bweighing\b/,
        /\bmagnitude\b/,
        /\bprobability\b/,
        /\btimeframe\b/,
      ]),
  };

  // ============================================================
  // CLEAN UP
  // ============================================================

  return {
    source,
    documentType,
    season,

    types: unique(types),
    categories: unique(categories),
    tags: unique(tags),
    subtopics: unique(subtopics),

    side,

    signals,
  };
}

async function main() {
  const paths = await listCorpusPaths();

  const documents = [];

  let processed = 0;
  let failed = 0;

  for (const relPath of paths) {
    const absPath = path.join(
      TRAINING_DATA,
      ...relPath.split("/")
    );

    let stat;

    try {
      stat = await fs.stat(absPath);
    } catch {
      continue;
    }

    if (!stat.isFile()) continue;

    let content;

    try {
      content = await fs.readFile(absPath, "utf8");
    } catch (error) {
      failed++;

      console.error(
        `Could not read ${relPath}: ${error.message}`
      );

      continue;
    }

    const inferred = inferMetadata(relPath, content);

    documents.push({
      path: relPath,
      filename: path.basename(relPath),

      ...inferred,

      sizeBytes: stat.size,
      sizeChars: content.length,
    });

    processed++;

    if (processed % 500 === 0) {
      console.log(`Processed ${processed} documents...`);
    }
  }

  const metadata = {
    generatedAt: new Date().toISOString(),

    version: 2,

    documentCount: documents.length,

    failed,

    documents,
  };

  await fs.mkdir(
    path.dirname(OUTPUT),
    { recursive: true }
  );

  await fs.writeFile(
    OUTPUT,
    JSON.stringify(metadata, null, 2),
    "utf8"
  );

  console.log("");
  console.log(`Processed ${documents.length} documents.`);

  if (failed > 0) {
    console.log(`Failed to read ${failed} documents.`);
  }

  console.log(
    `Wrote: incoming/reference-enriched-metadata.json`
  );

  // ============================================================
  // STATISTICS
  // ============================================================

  const counts = (field) => {
    const map = new Map();

    for (const doc of documents) {
      for (const value of doc[field] || []) {
        map.set(
          value,
          (map.get(value) || 0) + 1
        );
      }
    }

    return [...map.entries()]
      .sort((a, b) => b[1] - a[1]);
  };

  console.log("\n=== Sources ===");

  const sources = new Map();

  for (const doc of documents) {
    sources.set(
      doc.source,
      (sources.get(doc.source) || 0) + 1
    );
  }

  for (
    const [key, value] of [...sources.entries()]
      .sort((a, b) => b[1] - a[1])
  ) {
    console.log(
      String(value).padStart(5),
      key
    );
  }

  console.log("\n=== Document Types ===");

  const documentTypes = new Map();

  for (const doc of documents) {
    documentTypes.set(
      doc.documentType,
      (documentTypes.get(doc.documentType) || 0) + 1
    );
  }

  for (
    const [key, value] of [...documentTypes.entries()]
      .sort((a, b) => b[1] - a[1])
  ) {
    console.log(
      String(value).padStart(5),
      key
    );
  }

  console.log("\n=== Argument Types ===");

  for (const [key, value] of counts("types")) {
    console.log(
      String(value).padStart(5),
      key
    );
  }

  console.log("\n=== Categories ===");

  for (const [key, value] of counts("categories")) {
    console.log(
      String(value).padStart(5),
      key
    );
  }

  console.log("\n=== Top Tags ===");

  for (
    const [key, value] of counts("tags").slice(0, 40)
  ) {
    console.log(
      String(value).padStart(5),
      key
    );
  }

  console.log("\n=== Sides ===");

  const sides = new Map();

  for (const doc of documents) {
    sides.set(
      doc.side,
      (sides.get(doc.side) || 0) + 1
    );
  }

  for (
    const [key, value] of [...sides.entries()]
      .sort((a, b) => b[1] - a[1])
  ) {
    console.log(
      String(value).padStart(5),
      key
    );
  }

  // ============================================================
  // SIGNAL STATISTICS
  // ============================================================

  console.log("\n=== Structural Signals ===");

  const signalNames = [
    "hasTopicality",
    "hasTheory",
    "hasFramework",
    "hasImpact",
    "hasKritik",
    "hasCP",
    "hasPermutation",
    "hasSolvency",
    "hasLink",
    "hasWarrant",
    "hasUniqueness",
    "hasWeighing",
  ];

  for (const signal of signalNames) {
    const count = documents.filter(
      (doc) => doc.signals?.[signal]
    ).length;

    console.log(
      String(count).padStart(5),
      signal
    );
  }

  // ============================================================
  // SAMPLE DOCUMENTS
  // ============================================================

  console.log("\n=== Sample enriched documents ===");

  for (const doc of documents.slice(0, 20)) {
    console.log(`\n${doc.path}`);

    console.log(
      `  source: ${doc.source}`
    );

    console.log(
      `  documentType: ${doc.documentType}`
    );

    console.log(
      `  season: ${doc.season || "none"}`
    );

    console.log(
      `  types: ${doc.types.join(", ") || "none"}`
    );

    console.log(
      `  categories: ${
        doc.categories.join(", ") || "none"
      }`
    );

    console.log(
      `  tags: ${doc.tags.join(", ") || "none"}`
    );

    console.log(
      `  subtopics: ${
        doc.subtopics.join(", ") || "none"
      }`
    );

    console.log(
      `  side: ${doc.side}`
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});