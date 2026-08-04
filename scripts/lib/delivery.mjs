// Delivery analysis infrastructure: tone-over-time tracking, per-segment
// tone rendering, and tone-aware grading criteria for the drill grader.
//
// Three pieces:
//   1. Snapshot store (delivery-history.json, gitignored, capped) — every
//      graded drill speech records WPM + tone so trends survive sessions.
//   2. Trend summary — recent takes vs earlier takes, fed to the grader so
//      feedback can reference trajectory ("anxiety is trending down").
//   3. delivery-data/ loader — user-curated rubric/reference files (.md,
//      .txt, .json) injected verbatim into the grading prompt. Drop files
//      into delivery-data/rubrics/ or delivery-data/reference/ — no code
//      changes or restarts needed; files are read per grading request.

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..");
const HISTORY_PATH = path.join(ROOT, "delivery-history.json");
const DELIVERY_DATA_DIR = path.join(ROOT, "delivery-data");

const MAX_SNAPSHOTS = 500;
const TREND_RECENT = 5; // "recent" window size for trend comparison
const RUBRIC_EXTENSIONS = new Set([".md", ".txt", ".json"]);

// --- 1. Tone-over-time snapshot store --------------------------------------

async function loadHistory() {
  try {
    const data = JSON.parse(await fs.readFile(HISTORY_PATH, "utf8"));
    return { snapshots: Array.isArray(data.snapshots) ? data.snapshots : [] };
  } catch {
    return { snapshots: [] };
  }
}

async function saveHistory(data) {
  await fs.writeFile(HISTORY_PATH, JSON.stringify(data, null, 2) + "\n", "utf8");
}

/**
 * Records one graded speech's delivery metrics. Call after grading so the
 * snapshot can carry the score. All fields optional except date (auto).
 */
export async function recordDeliverySnapshot({ route, wpm, durationSec, tone, toneSegments, score }) {
  const data = await loadHistory();
  // Aggregate top emotions (small, queryable) — provided directly, or
  // derived from the per-segment scores when only those are available
  // (the drill-grade route receives segments, not the aggregate).
  let top = Array.isArray(tone?.top) ? tone.top.slice(0, 5) : null;
  if (!top && Array.isArray(toneSegments) && toneSegments.length > 0) {
    top = meanEmotionScores(toneSegments.map((s) => ({ top: s.top }))).slice(0, 5);
    if (top.length === 0) top = null;
  }
  data.snapshots.push({
    date: new Date().toISOString(),
    route: route || "drill",
    wpm: Number(wpm) || null,
    durationSec: Number(durationSec) || null,
    top,
    segments: Array.isArray(toneSegments)
      ? toneSegments.slice(0, 50).map((s) => ({
          text: String(s.text ?? "").slice(0, 200),
          top: Array.isArray(s.top) ? s.top.slice(0, 3) : [],
        }))
      : null,
    score: Number.isFinite(score) ? score : null,
  });
  if (data.snapshots.length > MAX_SNAPSHOTS) {
    data.snapshots = data.snapshots.slice(-MAX_SNAPSHOTS);
  }
  await saveHistory(data);
  return { count: data.snapshots.length };
}

export async function getDeliveryHistory() {
  return (await loadHistory()).snapshots;
}

function meanEmotionScores(snapshots) {
  const sums = new Map();
  let n = 0;
  for (const s of snapshots) {
    if (!Array.isArray(s.top)) continue;
    n++;
    for (const { name, score } of s.top) {
      sums.set(name, (sums.get(name) ?? 0) + score);
    }
  }
  if (n === 0) return [];
  return [...sums.entries()]
    .map(([name, sum]) => ({ name, score: Number((sum / n).toFixed(3)) }))
    .sort((a, b) => b.score - a.score);
}

function meanOf(snapshots, field) {
  const vals = snapshots.map((s) => s[field]).filter((v) => Number.isFinite(v));
  return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
}

/**
 * Trend block for the grading prompt: recent takes vs the ones before them.
 * Empty string until there's enough history to say anything (2+ takes).
 */
export async function getDeliveryTrendSummaryForPrompt() {
  const { snapshots } = await loadHistory();
  if (snapshots.length < 2) return "";

  const recent = snapshots.slice(-TREND_RECENT);
  const earlier = snapshots.slice(0, -TREND_RECENT);
  const recentEmotions = meanEmotionScores(recent).slice(0, 4);
  const lines = [
    `Delivery history: ${snapshots.length} recorded takes.`,
    `Recent ${recent.length} takes — avg pace ${meanOf(recent, "wpm") ?? "n/a"} WPM; dominant measured tone: ` +
      (recentEmotions.map((e) => `${e.name} ${e.score}`).join(", ") || "n/a") + ".",
  ];
  if (earlier.length > 0) {
    const earlierEmotions = meanEmotionScores(earlier).slice(0, 4);
    lines.push(
      `Earlier ${earlier.length} takes — avg pace ${meanOf(earlier, "wpm") ?? "n/a"} WPM; dominant tone: ` +
        (earlierEmotions.map((e) => `${e.name} ${e.score}`).join(", ") || "n/a") + ".",
      "Compare the two: call out delivery habits that are improving or regressing across takes, not just this take in isolation.",
    );
  }
  return lines.join("\n");
}

// --- 3. delivery-data/ — user-curated rubric & reference files --------------

async function readDeliveryFiles(subdir) {
  const dir = path.join(DELIVERY_DATA_DIR, subdir);
  let names = [];
  try {
    names = (await fs.readdir(dir)).filter((n) => RUBRIC_EXTENSIONS.has(path.extname(n).toLowerCase())).sort();
  } catch {
    return []; // folder missing — fine, feature is opt-in
  }
  const files = [];
  for (const name of names) {
    try {
      const content = (await fs.readFile(path.join(dir, name), "utf8")).trim();
      if (content) files.push({ name: `${subdir}/${name}`, content });
    } catch {
      // unreadable file — skip rather than fail the grading request
    }
  }
  return files;
}

/**
 * Loads every rubric/reference file the user has dropped into
 * delivery-data/. Returns "" when empty so callers can append blindly.
 */
export async function loadDeliveryRubricSection() {
  const files = [...(await readDeliveryFiles("rubrics")), ...(await readDeliveryFiles("reference"))];
  if (files.length === 0) return "";
  return (
    "\nCoach-provided delivery scoring material (authoritative — apply these rubrics/benchmarks when " +
    "scoring delivery, over your own defaults where they conflict):\n" +
    files.map((f) => `<delivery-file name="${f.name}">\n${f.content}\n</delivery-file>`).join("\n")
  );
}

// --- 2 + 3. Tone-aware grading section for the drill grader -----------------

function renderSegments(toneSegments) {
  if (!Array.isArray(toneSegments) || toneSegments.length === 0) return "";
  const rows = toneSegments
    .slice(0, 50)
    .map((s, i) => {
      const top = Array.isArray(s.top) ? s.top.map((t) => `${t.name} ${t.score}`).join(", ") : "";
      return `${i + 1}. "${String(s.text ?? "").slice(0, 160)}" — ${top || "no tone data"}`;
    })
    .join("\n");
  return (
    `\nTone by segment (in delivery order — use this to LOCALIZE feedback, e.g. "your voice flattened exactly ` +
    `when you reached weighing"):\n` + rows
  );
}

/**
 * Builds the delivery-analysis block of the drill grading prompt: aggregate
 * tone, per-segment tone, tone-aware criteria, cross-take trend, and any
 * coach-provided rubric files. Returns "" when there's no tone data at all
 * (Whisper fallback) so the grader prompt stays unchanged in that case.
 */
export async function buildDeliveryGradingSection({ toneSummary, toneSegments }) {
  if (!toneSummary && (!toneSegments || toneSegments.length === 0)) return "";

  let block = "\nVocal delivery analysis (auto-measured prosody of the actual delivery, not self-reported):";
  if (toneSummary) block += `\nWhole-speech tone: ${toneSummary}.`;
  block += renderSegments(toneSegments);
  block +=
    "\nTone-aware delivery criteria:\n" +
    "- Translate scores into coaching language — never quote raw emotion numbers back to the debater.\n" +
    "- Monotone/flatness during weighing or voting issues is a ballot problem: judges flow emphasis. If the " +
    "segments show calmness/boredom dominating exactly where the speech weighs, make emphasis one of the fixes.\n" +
    "- Anxiety/distress spiking on a specific argument usually marks the debater's least-drilled material — " +
    "name the argument and prescribe targeted practice on it, not generic 'be confident'.\n" +
    "- Read tone WITH pace: high anxiety + above-ceiling WPM means cut content (word economy); high anxiety at " +
    "normal pace means rehearsal; confidence with monotone means add vocal variation, the content is fine.\n" +
    "- Determination/confidence sustained through the back half of the speech is a strength — say so explicitly; " +
    "delivery feedback that only criticizes teaches debaters to ignore it.";

  const trend = await getDeliveryTrendSummaryForPrompt();
  if (trend) block += "\n" + trend;
  block += await loadDeliveryRubricSection();
  return block + "\n";
}
