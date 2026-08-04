#!/usr/bin/env node
// Ingests raw case files (PDF, DOCX, HTML, TXT/MD, or pasted stdin) from
// incoming/ into clean, tagged .md files in training-data/.
//
// Usage:
//   npm run ingest                                   process everything new in incoming/
//   npm run ingest -- --tags aff,econ-da              apply tags to this batch
//   npm run ingest -- --category evidence/ai-cybercrime   write into a training-data/ subfolder
//   npm run ingest -- --paste "Title" --tags neg,topicality   read stdin, save as a note
//
// Already-processed originals are moved to incoming/processed/ and tracked
// in scripts/manifest.json (by content hash) so re-running is safe.

import fs from "node:fs/promises";
import fssync from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { extractText, cleanText } from "./lib/extract.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const INCOMING = path.join(ROOT, "incoming");
const PROCESSED = path.join(INCOMING, "processed");
const OUTPUT = path.join(ROOT, "training-data");
const MANIFEST_PATH = path.join(__dirname, "manifest.json");

function parseArgs(argv) {
  const args = { tags: [], paste: null, category: "" };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--tags") args.tags = (argv[++i] ?? "").split(",").map((s) => s.trim()).filter(Boolean);
    else if (a === "--paste") args.paste = argv[++i] ?? "Pasted note";
    else if (a === "--category") args.category = (argv[++i] ?? "").replace(/^\/+|\/+$/g, "");
  }
  return args;
}

async function loadManifest() {
  try {
    return JSON.parse(await fs.readFile(MANIFEST_PATH, "utf8"));
  } catch {
    return { processed: {} };
  }
}

async function saveManifest(manifest) {
  await fs.writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + "\n", "utf8");
}

function hashOf(buf) {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

function slugify(title) {
  return (
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "untitled"
  );
}

async function uniqueOutputPath(slug, category, ext = ".md") {
  const dir = category ? path.join(OUTPUT, category) : OUTPUT;
  let candidate = path.join(dir, `${slug}${ext}`);
  let n = 2;
  while (fssync.existsSync(candidate)) {
    candidate = path.join(dir, `${slug}-${n}${ext}`);
    n++;
  }
  return candidate;
}

function frontmatter({ title, source, tags, category, ingested }) {
  const tagLine = tags.length ? tags.join(", ") : "";
  return [
    "---",
    `title: ${title}`,
    `source: ${source}`,
    `category: ${category || "(none)"}`,
    `ingested: ${ingested}`,
    `tags: [${tagLine}]`,
    "---",
    "",
    "",
  ].join("\n");
}

async function writeEntry({ title, source, tags, category, body }) {
  const slug = slugify(title);
  const outPath = await uniqueOutputPath(slug, category);
  await fs.mkdir(path.dirname(outPath), { recursive: true });
  const content =
    frontmatter({ title, source, tags, category, ingested: new Date().toISOString() }) + cleanText(body) + "\n";
  await fs.writeFile(outPath, content, "utf8");
  return outPath;
}

async function processPasted(title, tags, category) {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw.trim()) {
    console.error("No input received on stdin for --paste. Pipe text in, e.g.: cat notes.txt | npm run ingest -- --paste \"Title\"");
    process.exitCode = 1;
    return;
  }
  const outPath = await writeEntry({ title, source: "pasted", tags, category, body: raw });
  console.log(`Wrote ${path.relative(ROOT, outPath)}`);
}

async function processIncoming(tags, category) {
  await fs.mkdir(PROCESSED, { recursive: true });
  await fs.mkdir(OUTPUT, { recursive: true });
  const manifest = await loadManifest();

  const entries = (await fs.readdir(INCOMING, { withFileTypes: true })).filter(
    (e) => e.isFile() && !e.name.startsWith(".")
  );

  if (entries.length === 0) {
    console.log("No new files in incoming/. Drop .pdf, .docx, .html, .txt, or .md files there and re-run.");
    return;
  }

  let count = 0;
  for (const entry of entries) {
    const filePath = path.join(INCOMING, entry.name);
    const buf = await fs.readFile(filePath);
    const hash = hashOf(buf);

    if (manifest.processed[hash]) {
      console.log(`Skipping ${entry.name} (already ingested as ${manifest.processed[hash]})`);
      continue;
    }

    const raw = await extractText(filePath);
    if (raw === null) {
      console.log(`Skipping ${entry.name} (unsupported file type)`);
      continue;
    }
    if (!raw.trim()) {
      console.log(`Skipping ${entry.name} (no extractable text)`);
      continue;
    }

    const title = path.parse(entry.name).name.replace(/[_-]+/g, " ").trim();
    const outPath = await writeEntry({ title, source: entry.name, tags, category, body: raw });

    manifest.processed[hash] = path.relative(ROOT, outPath);
    await fs.rename(filePath, path.join(PROCESSED, entry.name));

    console.log(`Ingested ${entry.name} -> ${path.relative(ROOT, outPath)}`);
    count++;
  }

  await saveManifest(manifest);
  console.log(`Done. ${count} file(s) ingested.`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.paste !== null) {
    await processPasted(args.paste, args.tags, args.category);
  } else {
    await processIncoming(args.tags, args.category);
  }

  // Keep the semantic retrieval index in sync with the corpus. Non-fatal:
  // ingest already succeeded; the index can be rebuilt with npm run build-index.
  try {
    const { buildIndex, invalidateIndexCache } = await import("./lib/corpusIndex.mjs");
    const { chunks } = await buildIndex();
    invalidateIndexCache();
    console.log(`Semantic index rebuilt (${chunks} chunks).`);
  } catch (err) {
    console.warn(`Semantic index rebuild failed (run "npm run build-index" manually): ${err.message}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
