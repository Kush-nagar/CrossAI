#!/usr/bin/env node
// DEFERRED AI pass over the rebuttal corpus (training-data/cases/pf-rebuttals/),
// mirroring the case corpus's "## Construction-criteria audit". It scores each
// rebuttal doc /10 on the rebuttal rubric (coverage, responsiveness, round
// vision, evidence, turn setup, weighing) and appends a "## Rebuttal-criteria
// audit" section — the sortable quality signal buildRebuttalBenchmarkSection can
// later lead with (parseAuditScore already reads "**Score: N/10**").
//
//   node scripts/audit-rebuttals.mjs --limit 5     # try a handful first
//   node scripts/audit-rebuttals.mjs               # audit everything unaudited
//   node scripts/audit-rebuttals.mjs --redo        # re-audit even if present
//
// This is intentionally NOT run as part of extraction — it costs one model call
// per doc (~583 calls for the full corpus). Run it deliberately, in batches,
// like the original case audit. Extraction (scripts/extract-rebuttals.mjs) is
// the mechanical, verbatim, no-token step; this is the enrichment step.
//
// Idempotent: docs that already carry the audit section are skipped unless
// --redo. Safe to stop and resume.

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { completeText, hasCredentials, missingCredentialsError } from "./lib/aiClient.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const REBUTTALS_DIR = path.join(ROOT, "training-data", "cases", "pf-rebuttals");
const AUDIT_MARKER = "## Rebuttal-criteria audit";

// Small concurrency — the aiClient owns the real upstream semaphore; this just
// keeps a few docs in flight so the walk isn't strictly serial.
const CONCURRENCY = 3;

function parseArgs(argv) {
  const args = { limit: 0, redo: false, dry: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--limit") args.limit = Number(argv[++i]) || 0;
    else if (argv[i] === "--redo") args.redo = true;
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

function frontmatterValue(content, key) {
  const m = new RegExp(`^${key}:\\s*(.+)$`, "m").exec(content);
  return m ? m[1].trim().replace(/^"|"$/g, "") : "";
}

const SYSTEM =
  "You are an elite Public Forum coach auditing a real disclosed REBUTTAL document for quality. You grade the same " +
  "way tech/flow judges evaluate the back half: coverage is dictated by what the opponent goes for, an unwarranted " +
  "answer is not an answer, a turn needs a link and an impact, and strong round vision makes the arguments you want " +
  "extended hard to kick (link defense + link turns + non-uniques, or impact defense + impact turns) while dumping " +
  "impact defense + evidence indicts on the argument you think the opponent most wants to go for.";

function buildPrompt(meta, body) {
  return (
    `Audit this ${meta.side || ""} rebuttal document on the resolution "${meta.resolution || "(unknown)"}".\n\n` +
    `Score it on each of six rebuttal criteria and give a one-line, specific reason per criterion, then an overall ` +
    `score. Be honest and use the full range. Output GitHub-flavored markdown in EXACTLY this shape (no preamble):\n\n` +
    `### Coverage\n<one line>\n### Responsiveness\n<one line>\n### Round vision\n<one line>\n### Evidence quality\n` +
    `<one line>\n### Turn & offense setup\n<one line>\n### Weighing setup\n<one line>\n### Overall rebuttal score\n` +
    `**Score: N/10** — <one sentence justification>\n\n` +
    `Criteria meaning: Coverage = answers what the opponent will actually extend; Responsiveness = warranted, clashes ` +
    `with their specific warrants, not docbot blocks; Round vision = makes its key arguments hard to kick and ` +
    `dissuades the opponent's go-for; Evidence quality = quals/recency, not analytic-only where a card is needed; ` +
    `Turn & offense setup = turns carry link + impact; Weighing setup = starts the comparison it will extend.\n\n` +
    `--- REBUTTAL DOCUMENT ---\n${body.slice(0, 16000)}`
  );
}

async function auditFile(absPath, args) {
  const content = await fs.readFile(absPath, "utf8");
  if (!args.redo && content.includes(AUDIT_MARKER)) return "skip";
  // Body = everything after frontmatter, minus any prior audit.
  const fmEnd = content.startsWith("---") ? content.indexOf("\n---", 3) : -1;
  let body = fmEnd === -1 ? content : content.slice(fmEnd + 4);
  const priorAudit = body.indexOf(`\n${AUDIT_MARKER}`);
  if (priorAudit !== -1) body = body.slice(0, priorAudit);
  const meta = {
    side: frontmatterValue(content, "side"),
    resolution: frontmatterValue(content, "resolution"),
  };
  if (args.dry) return "would-audit";

  const audit = await completeText({
    system: SYSTEM,
    prompt: buildPrompt(meta, body.trim()),
    maxTokens: 900,
  });
  const trimmed = String(audit || "").trim();
  if (!trimmed) return "empty";

  // Rewrite the file with a single, clean audit section appended.
  const base = (fmEnd === -1 ? "" : content.slice(0, fmEnd + 4)) + body.trimEnd();
  const out = `${base}\n\n${AUDIT_MARKER}\n\n${trimmed}\n`;
  await fs.writeFile(absPath, out, "utf8");
  return "audited";
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.dry && !hasCredentials()) {
    console.error(missingCredentialsError());
    process.exit(1);
  }
  const files = (await walk(REBUTTALS_DIR)).sort();
  const stats = { audited: 0, skip: 0, empty: 0, error: 0, "would-audit": 0 };
  let processed = 0;

  // Simple bounded-concurrency worker pool.
  let idx = 0;
  async function worker() {
    while (idx < files.length) {
      if (args.limit && stats.audited + stats["would-audit"] >= args.limit) return;
      const absPath = files[idx++];
      try {
        const r = await auditFile(absPath, args);
        stats[r] = (stats[r] || 0) + 1;
      } catch (err) {
        stats.error++;
        console.error(`[audit-rebuttals] ${path.relative(ROOT, absPath)}: ${err.message}`);
      }
      processed++;
      if (processed % 25 === 0) console.log(`[audit-rebuttals] processed ${processed}/${files.length}…`);
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  console.log(
    `[audit-rebuttals] done: audited=${stats.audited} skipped=${stats.skip} empty=${stats.empty} ` +
      `error=${stats.error}${args.dry ? ` wouldAudit=${stats["would-audit"]} [DRY]` : ""}`
  );
  console.log("Reminder: rebuild the semantic index afterward (npm run build-index) so audits/scores are searchable.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
