#!/usr/bin/env node
// Extracts the REBUTTAL material embedded in the disclosed-case archive into a
// parallel, first-class corpus at training-data/cases/pf-rebuttals/, mirroring
// the case corpus's season/cycle layout and frontmatter.
//
//   node scripts/extract-rebuttals.mjs            # rebuild the whole corpus
//   node scripts/extract-rebuttals.mjs --limit 5  # sample run (first 5 outputs)
//   node scripts/extract-rebuttals.mjs --dry      # report only, write nothing
//
// Disclosed docs bundle a constructive AND that team's rebuttal answers in one
// file. Two delineations are used in the wild (confirmed against the archive):
//   - "AT:" / "A2:" / "A/T:" headers — one labeled answer block each, cards
//     below, block ending at the next answer header or a real markdown heading.
//   - a "2AC" marker line (bare, or "2AC---Label" / "2AC Label") — everything
//     from the first 2AC marker to the end of the case (past which sits only the
//     ingest-appended "## Construction-criteria audit") is the rebuttal region.
//
// This pass is MECHANICAL and verbatim: it copies the rebuttal text unchanged
// (<mark> highlights, cites, and cards intact) — it never rewrites a card. The
// AI scoring/pattern pass that mirrors the case corpus's construction audit is a
// separate, deliberately deferred step (scripts/audit-rebuttals.mjs).

import fs from "node:fs/promises";
import fssync from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const ARCHIVE_DIR = path.join(ROOT, "training-data", "cases", "pf-archive");
const OUT_DIR = path.join(ROOT, "training-data", "cases", "pf-rebuttals");
const TRAINING_DATA = path.join(ROOT, "training-data");

const AUDIT_MARKER = "\n## Construction-criteria audit";
// Disclosed-cites section the ingest appends alongside the audit — also metadata
// about the doc, not rebuttal content, so it never travels into the corpus.
const DISCLOSED_MARKER = "\n## Disclosed cites";

// An AT:/A2:/A/T: answer header: a separator is mandatory so a sentence merely
// starting with "At " can't masquerade as one (same guard caseArchive.mjs uses).
const AT_HEADER = /^\s*(?:#{1,6}\s*|\*{1,2}\s*)?(?:AT|A2|A\/T)[:.]\s*\S/i;
// A 2AC region marker: the line is essentially just "2AC", optionally with a
// sub-label after a dash/colon/space. Anchored so a "2AC" buried in prose can't
// trip it.
const TWOAC_HEADER = /^\s*(?:#{1,6}\s*|\*{1,2}\s*)?2AC\b\s*[-–—:]*\s*(.*)$/i;
// Any real markdown heading ends an AT: block (also keeps the appended audit out).
const MD_HEADING = /^#{1,4}\s/;

function parseArgs(argv) {
  const args = { limit: 0, dry: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--limit") args.limit = Number(argv[++i]) || 0;
    else if (argv[i] === "--dry") args.dry = true;
  }
  return args;
}

async function walk(dir, out = []) {
  let entries = [];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) await walk(p, out);
    else if (e.name.endsWith(".md")) out.push(p);
  }
  return out;
}

// Splits a doc into { fmLines: [...], body } — fmLines are the raw frontmatter
// lines (without the --- fences); body is everything after. Returns null fm when
// the doc has no frontmatter.
function splitFrontmatter(content) {
  if (!content.startsWith("---")) return { fmLines: null, body: content };
  const end = content.indexOf("\n---", 3);
  if (end === -1) return { fmLines: null, body: content };
  const fmLines = content.slice(3, end).split("\n").filter((l) => l.length > 0);
  return { fmLines, body: content.slice(end + 4).replace(/^\n+/, "") };
}

function fmValue(fmLines, key) {
  for (const line of fmLines || []) {
    const m = new RegExp(`^${key}:\\s*(.+)$`).exec(line);
    if (m) return m[1].trim();
  }
  return "";
}

// Strips the two appended metadata sections so only real case/rebuttal text
// remains, whichever appears first.
function stripAppended(body) {
  let cut = body.length;
  for (const marker of [AUDIT_MARKER, DISCLOSED_MARKER]) {
    const i = body.indexOf(marker);
    if (i !== -1) cut = Math.min(cut, i);
  }
  return body.slice(0, cut).trimEnd();
}

function cleanLabel(raw) {
  return String(raw || "")
    .replace(/^[#*\s]+/, "")
    .replace(/^(?:AT|A2|A\/T|2AC)\b[-–—:.\s]*/i, "")
    .replace(/["\[\]]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 90);
}

/**
 * Pulls the rebuttal region + its answer labels from a stripped case body.
 * Returns { text, answers } or null when the doc carries no rebuttal material.
 */
function extractRebuttal(body) {
  const lines = body.split("\n");

  // 2AC mode: the rebuttal region runs from the first 2AC marker to the end.
  const firstTwoAc = lines.findIndex((l) => TWOAC_HEADER.test(l));
  if (firstTwoAc !== -1) {
    const region = lines.slice(firstTwoAc);
    const answers = [];
    for (const l of region) {
      const two = TWOAC_HEADER.exec(l);
      if (two) {
        const lab = cleanLabel(two[1]);
        if (lab) answers.push(lab);
        continue;
      }
      if (AT_HEADER.test(l)) {
        const lab = cleanLabel(l);
        if (lab) answers.push(lab);
      }
    }
    const text = region.join("\n").trim();
    return text.length >= 200 ? { text, answers: dedupe(answers) } : null;
  }

  // AT: mode: gather each answer block (header → next header or markdown heading).
  const blocks = [];
  const answers = [];
  let current = null;
  for (const line of lines) {
    if (AT_HEADER.test(line)) {
      current = [line];
      blocks.push(current);
      const lab = cleanLabel(line);
      if (lab) answers.push(lab);
    } else if (MD_HEADING.test(line)) {
      current = null;
    } else if (current) {
      current.push(line);
    }
  }
  if (blocks.length === 0) return null;
  const text = blocks.map((b) => b.join("\n").trim()).filter(Boolean).join("\n\n").trim();
  return text.length >= 200 ? { text, answers: dedupe(answers) } : null;
}

function dedupe(list) {
  const seen = new Set();
  const out = [];
  for (const x of list) {
    const k = x.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(x);
  }
  return out.slice(0, 14);
}

// Rewrites the source frontmatter for the rebuttal corpus: retags case→rebuttal
// and pf-archive→pf-rebuttals, retitles, and appends doc_type/source/answers.
function buildFrontmatter(fmLines, relSource, answers) {
  const out = [];
  for (const line of fmLines) {
    if (/^title:/.test(line)) {
      out.push(line.replace(/\bPF case\b/i, "PF rebuttal doc").replace(/\(([^)]*)\)/, "($1 — rebuttal)"));
    } else if (/^tags:/.test(line)) {
      out.push(
        line
          .replace(/(^|[\[,]\s*)case(\s*[,\]])/, "$1rebuttal$2")
          .replace(/pf-archive/g, "pf-rebuttals")
      );
    } else {
      out.push(line);
    }
  }
  out.push("doc_type: rebuttal");
  out.push(`source: ${relSource}`);
  const ans = answers.map((a) => `"${a.replace(/"/g, "'")}"`).join(", ");
  out.push(`answers: [${ans}]`);
  return `---\n${out.join("\n")}\n---\n`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const files = await walk(ARCHIVE_DIR);
  files.sort();

  let scanned = 0;
  let written = 0;
  let skippedNoRebuttal = 0;
  let mode2ac = 0;
  let modeAt = 0;

  for (const absPath of files) {
    scanned++;
    let content;
    try {
      content = await fs.readFile(absPath, "utf8");
    } catch {
      continue;
    }
    const { fmLines, body } = splitFrontmatter(content);
    if (!fmLines) continue;
    const stripped = stripAppended(body);
    const rebuttal = extractRebuttal(stripped);
    if (!rebuttal) {
      skippedNoRebuttal++;
      continue;
    }
    if (TWOAC_HEADER.test(stripped.split("\n").find((l) => TWOAC_HEADER.test(l)) || "")) mode2ac++;
    else modeAt++;

    const relSource = path.relative(TRAINING_DATA, absPath).split(path.sep).join("/");
    const relOut = path.relative(ARCHIVE_DIR, absPath); // <season>/<cycle>/<file>.md
    const outPath = path.join(OUT_DIR, relOut);

    const frontmatter = buildFrontmatter(fmLines, relSource, rebuttal.answers);
    const outContent = `${frontmatter}\n${rebuttal.text.trim()}\n`;

    if (!args.dry) {
      await fs.mkdir(path.dirname(outPath), { recursive: true });
      await fs.writeFile(outPath, outContent, "utf8");
    }
    written++;
    if (args.limit && written >= args.limit) {
      console.log(`[extract-rebuttals] --limit ${args.limit} reached; stopping.`);
      break;
    }
  }

  console.log(
    `[extract-rebuttals] scanned=${scanned} wrote=${written} ` +
      `(2AC=${mode2ac} AT=${modeAt}) noRebuttal=${skippedNoRebuttal}` +
      (args.dry ? " [DRY RUN — nothing written]" : ` -> ${path.relative(ROOT, OUT_DIR)}`)
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
