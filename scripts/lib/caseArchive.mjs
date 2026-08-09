// Access layer for the disclosed-case archive at
// training-data/cases/pf-archive/<season>/<cycle>/*.md — open-source case docs
// from top-ranked PF teams, ingested from the OpenCaselist wiki and tagged
// with season/topic-cycle/resolution/side frontmatter.
//
// This is PUBLIC disclosure data (same standing as the caselist_* scouting
// tools), so unlike the private coaching corpus it MAY be quoted, attributed,
// and reused verbatim: the drill tool builds practice cases out of these real
// cards, and the stress test benchmarks a debater's case against them.

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..");
const ARCHIVE_DIR = path.join(ROOT, "training-data", "cases", "pf-archive");
// The rebuttal corpus (scripts/extract-rebuttals.mjs) — real disclosed rebuttal
// docs, one per source case, mirroring the case archive's season/cycle layout.
const REBUTTALS_DIR = path.join(ROOT, "training-data", "cases", "pf-rebuttals");

const STOPWORDS = new Set(
  "the a an of in on to for and or should would that with its it is are be by from at as into their".split(" ")
);

function tokens(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));
}

// Minimal frontmatter parse — mirrors the conventions used by the ingest
// pipeline (string values, one `key: value` per line; tags list ignored here).
function parseFrontmatter(content) {
  if (!content.startsWith("---")) return { meta: {}, body: content };
  const end = content.indexOf("\n---", 3);
  if (end === -1) return { meta: {}, body: content };
  const meta = {};
  for (const line of content.slice(3, end).split("\n")) {
    const m = /^([a-z_]+):\s*(.+)$/.exec(line.trim());
    if (m) meta[m[1]] = m[2].replace(/^"|"$/g, "");
  }
  return { meta, body: content.slice(end + 4) };
}

// Frontmatter-only read: scoring 500+ archive docs (20MB+) shouldn't read
// every file in full — only the picked cases get a full loadCaseBody read.
async function readFileHead(absPath, bytes = 4096) {
  const fh = await fs.open(absPath, "r");
  try {
    const buf = Buffer.alloc(bytes);
    const { bytesRead } = await fh.read(buf, 0, bytes, 0);
    return buf.toString("utf8", 0, bytesRead);
  } finally {
    await fh.close();
  }
}

async function walk(dir, out = []) {
  let entries = [];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return out; // archive not present — feature quietly disabled
  }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) await walk(p, out);
    else if (e.name.endsWith(".md")) out.push(p);
  }
  return out;
}

// Corpus-relative path (POSIX style) for an absolute archive file path —
// matches the paths stored in the semantic index (scripts/corpus-index.json).
const TRAINING_DATA = path.join(ROOT, "training-data");
function toRelPath(absPath) {
  return path.relative(TRAINING_DATA, absPath).split(path.sep).join("/");
}

// Best semantic-similarity score per archive FILE for a topic query, from the
// shared MiniLM chunk index. Content-level matching is what rescues the
// pass-1 ingest's tournament-calendar heuristic: a doc filed under the wrong
// cycle (wrong frontmatter resolution) still surfaces when its actual cards
// are about the requested topic — and a loosely-worded topic still finds the
// right cycle without sharing tokens with the resolution. Empty map when the
// index/embedder is unavailable (callers fall back to lexical-only).
async function semanticArchiveScores(topic, side) {
  try {
    const { searchIndex } = await import("./corpusIndex.mjs");
    const query = `Public Forum debate case${side ? ` for the ${side} side` : ""} on: ${topic}`;
    const hits = await searchIndex(query, { k: 96 });
    const byFile = new Map();
    for (const h of hits) {
      if (!h.path.startsWith("cases/pf-archive/")) continue;
      if (!byFile.has(h.path) || byFile.get(h.path) < h.score) byFile.set(h.path, h.score);
    }
    return byFile;
  } catch {
    return new Map();
  }
}

/**
 * Scores every on-topic archive doc for a topic, best-first, WITHOUT the
 * one-per-team dedup `findArchiveCases` applies. Scoring blends two signals:
 * semantic similarity of the doc's actual chunks to the topic (primary — the
 * chunk index, when built) and topic-token overlap against the stored
 * resolution/title (lexical fallback and exact-wording boost). Ties broken by
 * the team's season Elo rank.
 *
 * Callers that need to partition the full result set (e.g. picking one doc per
 * SIDE within a single resolution) use this directly so one archive walk
 * serves every partition — the walk reads 4.5k file heads and is the expensive
 * part of any archive lookup.
 */
async function scoreArchive({ topic, side } = {}) {
  const files = await walk(ARCHIVE_DIR);
  if (files.length === 0) return [];
  const want = new Set(tokens(topic));
  if (want.size === 0) return [];

  const semantic = await semanticArchiveScores(topic, side);

  const scored = [];
  for (const absPath of files) {
    let head;
    try {
      head = await readFileHead(absPath);
    } catch {
      continue;
    }
    const { meta } = parseFrontmatter(head);
    if (side && meta.side && meta.side.toLowerCase() !== String(side).toLowerCase()) continue;
    const against = tokens(meta.resolution || meta.title || path.basename(absPath));
    let lexical = 0;
    if (against.length > 0) {
      let hit = 0;
      for (const t of against) if (want.has(t)) hit++;
      lexical = hit / Math.max(4, against.length);
    }
    const sem = semantic.get(toRelPath(absPath)) || 0;
    // Same-scale blend (both signals live in ~0..1): whichever signal is
    // stronger carries the file, so a mislabeled resolution can't sink a
    // semantically on-topic doc and vice versa.
    const score = Math.max(lexical, sem);
    const onTopic = lexical >= 0.25 || sem >= 0.38;
    if (!onTopic) continue;
    scored.push({ absPath, meta, score, rank: Number(meta.elo_rank) || 999 });
  }
  scored.sort((a, b) => b.score - a.score || a.rank - b.rank);
  return scored;
}

/**
 * Finds archived cases matching a topic (free text or full resolution).
 * Options: side ("Pro"/"Con") to filter, limit (default 4).
 * Returns [{absPath, meta, score}] best-first, at most one per team.
 */
export async function findArchiveCases({ topic, side, limit = 4 } = {}) {
  const scored = await scoreArchive({ topic, side });

  // One case per team so "mix across teams" actually mixes teams.
  const seen = new Set();
  const picked = [];
  for (const c of scored) {
    const key = c.meta.team || c.absPath;
    if (seen.has(key)) continue;
    seen.add(key);
    picked.push(c);
    if (picked.length >= limit) break;
  }
  return picked;
}

// The ingest/audit pipeline appends a "## Construction-criteria audit" section
// (coach commentary + a **Score: N/10** line) to every archive file. That
// section is metadata ABOUT the case — it must never travel into reproduced
// case/rebuttal documents, exports, or TTS input.
const AUDIT_MARKER = "\n## Construction-criteria audit";

// A construction-audit score at or above this is a "great" case: the quality
// bar for benchmark/example material and for the hardest drill difficulty.
// Below it, cases still serve intro/easy-mid drills and "show me a weak case"
// requests — they're kept, just not held up as the standard.
const GREAT_SCORE = 7;

function stripAuditSection(body) {
  const i = body.indexOf(AUDIT_MARKER);
  return i === -1 ? body : body.slice(0, i);
}

/** Audit quality score (1-10) parsed from a file's audit section, or null. */
export function parseAuditScore(content) {
  const m = /\*\*Score:\s*(\d+)\/10\*\*/.exec(content);
  return m ? Number(m[1]) : null;
}

// Cuts text at the last paragraph break before maxChars so a reproduction cap
// never slices through the middle of a card.
function capAtCardBoundary(text, maxChars) {
  if (text.length <= maxChars) return text;
  const cut = text.lastIndexOf("\n\n", maxChars);
  return (cut > maxChars / 2 ? text.slice(0, cut) : text.slice(0, maxChars)).trimEnd();
}

/** Reads a matched case's body (frontmatter + audit stripped), capped at maxChars. */
export async function loadCaseBody(absPath, maxChars = 12000) {
  const content = await fs.readFile(absPath, "utf8");
  const { body } = parseFrontmatter(content);
  return stripAuditSection(body).trim().slice(0, maxChars);
}

// Rebuttal material lives under AT:/A2: answer headers or a "2AC" region
// marker, usually deep in a disclosed doc — far past the head slice
// loadCaseBody takes. Pulls those sections (header through the next answer
// header or markdown heading, which also keeps appended construction-criteria
// audits out) whole, up to maxChars. Returns null when the doc has no answer
// blocks (caller falls back to the head slice).
// For AT:/A2:/A/T: the separator is mandatory: an optional [:.] made any
// sentence starting with "At …" look like an answer header. "2AC" is anchored
// on a word boundary instead (it appears alone or as "2AC---Label"); a bare
// "2AC" line opens the rebuttal region that runs to the case's end.
const REBUTTAL_HEADER = /^\s*(?:#+\s*|\*{1,2}\s*)?(?:(?:AT|A2|A\/T)[:.]\s*\S|2AC\b)/i;
export async function loadRebuttalBody(absPath, maxChars = 12000) {
  const content = await fs.readFile(absPath, "utf8");
  const { body: rawBody } = parseFrontmatter(content);
  const body = stripAuditSection(rawBody);
  const sections = [];
  let current = null;
  for (const line of body.split("\n")) {
    if (REBUTTAL_HEADER.test(line)) {
      current = [line];
      sections.push(current);
    } else if (/^#{1,4}\s/.test(line)) {
      current = null; // a real heading ends the answer block
    } else if (current) {
      current.push(line);
    }
  }
  if (sections.length === 0) return null;
  let out = "";
  for (const sec of sections) {
    const text = sec.join("\n").trim();
    if (!text) continue;
    if (out && out.length + text.length > maxChars) break;
    out += (out ? "\n\n" : "") + text;
  }
  return out ? out.slice(0, maxChars) : null;
}

/**
 * Reads just the CONSTRUCTIVE portion of a disclosed doc — frontmatter and
 * audit stripped, then cut at the first structural boundary below the case.
 *
 * A disclosed doc is a whole case FILE: the constructive, then the team's own
 * AT:/A2: answer blocks, then the ingest-added "## Disclosed cites for rounds
 * reading this doc" and "## Construction-criteria audit" sections. Exporting a
 * "case" should hand back the case, not the whole file — so cut at the first
 * AT:/A2: header (REBUTTAL_HEADER, reused) or the first markdown heading,
 * whichever comes first. That one boundary drops all three trailing sections.
 *
 * Everything kept is byte-identical to the source — the cut chooses which part
 * of the file to reproduce, it never rewrites what it keeps. No char cap.
 *
 * The boundary is the first candidate that leaves MOST of the doc behind it,
 * not simply the first candidate. A minority of docs (~0.4%, measured) open
 * with pre-fire answer blocks — "AT: Moral Skep" and friends, read before the
 * case itself — and cutting at those returns a scrap of framework prefire
 * instead of the case. Requiring the cut to sit past the halfway mark walks
 * past an opening block and still catches the trailing one; the absolute
 * minimum guards short docs, where half of very little is still nothing. A doc
 * with no qualifying candidate reproduces whole, which is the safe direction:
 * it over-includes rather than handing back a fragment.
 */
const MIN_CONSTRUCTIVE_CHARS = 1500;
const MIN_CONSTRUCTIVE_RATIO = 0.5;
export async function loadConstructiveBody(absPath) {
  const content = await fs.readFile(absPath, "utf8");
  const { body: rawBody } = parseFrontmatter(content);
  const body = stripAuditSection(rawBody).trim();

  const floor = Math.max(MIN_CONSTRUCTIVE_CHARS, body.length * MIN_CONSTRUCTIVE_RATIO);
  const lines = body.split("\n");
  let seen = 0;
  for (let i = 0; i < lines.length; i++) {
    if (seen >= floor && (REBUTTAL_HEADER.test(lines[i]) || /^#{1,4}\s/.test(lines[i]))) {
      return lines.slice(0, i).join("\n").trim();
    }
    seen += lines[i].length + 1;
  }
  return body;
}

// --- Spoken-speech mechanics (drill spec, drill-data/scenario-instructions.md)
// The mechanical side of the coach's drill spec lives in code, not prompt
// compliance: delivery-speed word budgets by difficulty and speech slot, and
// TTS input assembly from highlighted card text (tag + author-year +
// <mark>-highlighted portions only).

// Delivery speeds (wpm) from the reconciled clarifications in
// drill-data/scenario-instructions.md: evidence-reading speeches
// (constructives, rebuttals) vs. closing speeches (summary, final focus).
const WPM = {
  evidence: { intro: 200, standard: 225, hard: 250 },
  closing: { intro: 150, standard: 180, hard: 200 },
};

function slotInfo(speechType) {
  const slot = String(speechType || "").toLowerCase();
  if (/final focus|2ar/.test(slot)) return { kind: "closing", minutes: 2 };
  if (/summary|1ar/.test(slot)) return { kind: "closing", minutes: 3 };
  if (/rebuttal|1nc|2ac|neg block/.test(slot)) return { kind: "evidence", minutes: 4, rebuttal: true };
  // constructive / case / default evidence-reading slot
  return { kind: "evidence", minutes: 4 };
}

/**
 * Mechanical word budget for a drill speech: how many words fit the slot at
 * the difficulty's delivery speed. For evidence speeches the budget bounds
 * HIGHLIGHTED words (what the TTS actually reads from cards). A 2nd-speaking
 * rebuttal must frontline first, so its EVIDENCE portion is budgeted at
 * 1:45–2:30 of the 4 minutes (evidenceWordsMin/Max) with the rest frontlining.
 * Returns { kind, minutes, wpm, words, evidenceWordsMin?, evidenceWordsMax? }.
 */
export function speechWordBudget({ speechType, difficulty, speakingOrder } = {}) {
  const info = slotInfo(speechType);
  const tier = difficulty === "intro" || difficulty === "hard" ? difficulty : "standard";
  const wpm = WPM[info.kind][tier];
  const budget = { kind: info.kind, minutes: info.minutes, wpm, words: Math.round(info.minutes * wpm) };
  if (info.rebuttal && speakingOrder === "2nd") {
    budget.evidenceWordsMin = Math.round((105 / 60) * wpm); // 1:45 of evidence
    budget.evidenceWordsMax = Math.round((150 / 60) * wpm); // 2:30 of evidence
  }
  return budget;
}

/**
 * Given the back-half speech the student is about to practice, returns the
 * opponent's IMMEDIATELY-PRECEDING speech that the AI voice box should deliver
 * so the student has something to respond to. PF back-half order is
 * 1st Rebuttal → 2nd Rebuttal → 1st Summary → 2nd Summary → 1st FF → 2nd FF,
 * with the two teams alternating, so in every case the preceding speech is the
 * OPPOSING team's. Returns { speechType, speakingOrder, label } or null when
 * nothing meaningful precedes on the opponent's side for an in-drill setup
 * (constructives and the 1st rebuttal).
 */
export function precedingOpponentSpeech({ speechType, speakingOrder } = {}) {
  const slot = String(speechType || "").toLowerCase();
  const order = String(speakingOrder || "");
  if (/summary|1ar/.test(slot)) {
    if (order === "1st") return { speechType: "rebuttal", speakingOrder: "2nd", label: "2nd Rebuttal" };
    if (order === "2nd") return { speechType: "summary", speakingOrder: "1st", label: "1st Summary" };
  }
  if (/final focus|2ar/.test(slot)) {
    if (order === "1st") return { speechType: "summary", speakingOrder: "2nd", label: "2nd Summary" };
    if (order === "2nd") return { speechType: "final focus", speakingOrder: "1st", label: "1st Final Focus" };
  }
  return null;
}

const countWords = (s) => (String(s || "").trim().match(/\S+/g) || []).length;

// Author last name + year from a card's cite line, e.g.
// "Steve Tonneson, xxxx, \"The East Asian Peace…\", Global Asia, https…" ->
// "Tonneson" + first plausible year found anywhere in the line.
function spokenCite(citeLine) {
  const line = String(citeLine || "").trim();
  if (!line) return "";
  const firstField = line.split(",")[0].trim();
  const words = firstField.replace(/[^A-Za-zÀ-ɏ' -]/g, " ").trim().split(/\s+/).filter(Boolean);
  const lastName = words.length > 0 ? words[words.length - 1] : "";
  const year =
    (line.match(/\b(?:19|20)(\d{2})\b/) || [])[0] ||
    (line.match(/\b\d{1,2}[\/-]\d{1,2}[\/-]((?:19|20)?\d{2})\b/) || [])[1] ||
    "";
  const shortYear = year.length === 4 ? `'${year.slice(2)}` : year ? `'${year.slice(-2)}` : "";
  return [lastName, shortYear].filter(Boolean).join(" ");
}

/**
 * Assembles the TTS input for an evidence-reading drill speech from marked-up
 * case text: per card, the tag line + spoken cite (author last name + year) +
 * the <mark>-highlighted portions ONLY — nothing else from the card body is
 * read aloud. Cards are kept whole; trailing cards are dropped once the
 * HIGHLIGHTED-word budget (maxWords) is reached. Returns
 * { text, cards, highlightedWords } or null when the text carries no <mark>
 * highlighting (caller falls back to model generation).
 */
export function buildSpokenCaseText(caseText, { maxWords = 900 } = {}) {
  const lines = String(caseText || "").split("\n");
  if (!lines.some((l) => l.includes("<mark>"))) return null;

  // Group consecutive <mark>-bearing lines into cards; the nearest two
  // non-empty lines above a card are its tag and cite lines (ingest layout:
  // tag \n cite \n body-with-marks).
  const cards = [];
  let recent = []; // last non-empty, non-marked lines
  let current = null;
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      current = null;
      continue;
    }
    if (line.includes("<mark>")) {
      const highlights = [...line.matchAll(/<mark>([\s\S]*?)<\/mark>/g)].map((m) => m[1].trim()).filter(Boolean);
      if (!current) {
        current = {
          tag: recent.length >= 2 ? recent[recent.length - 2] : recent[recent.length - 1] || "",
          cite: recent.length >= 1 ? recent[recent.length - 1] : "",
          highlights: [],
        };
        cards.push(current);
        recent = [];
      }
      current.highlights.push(...highlights);
    } else {
      current = null;
      recent.push(line);
      if (recent.length > 2) recent.shift();
    }
  }

  const spoken = [];
  let highlightedWords = 0;
  for (const card of cards) {
    const body = card.highlights.join(" ");
    const w = countWords(body);
    if (w === 0) continue;
    if (spoken.length > 0 && highlightedWords + w > maxWords) break; // whole cards only, keep at least one
    const cite = spokenCite(card.cite);
    spoken.push(`${card.tag ? `${card.tag} — ` : ""}${cite ? `${cite}: ` : ""}${body}`);
    highlightedWords += w;
  }
  if (spoken.length === 0) return null;
  return { text: spoken.join("\n\n"), cards: spoken.length, highlightedWords };
}

// Observability for the verbatim-card rule: how many of caseText's marked
// (card-body) lines literally appear in the injected source material. A
// heuristic — normalization forgives quote/dash/whitespace styling, but a
// model that reflows a card across different line breaks reads as unmatched —
// so treat a LOW ratio as a signal to inspect, not proof of tampering.
const normalizeForMatch = (s) =>
  String(s || "")
    .replace(/<\/?mark>/g, "")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

export function verbatimCardCheck(caseText, sourceBodies = []) {
  const hay = normalizeForMatch(sourceBodies.join("\n"));
  let checked = 0;
  let matched = 0;
  for (const line of String(caseText || "").split("\n")) {
    if (!line.includes("<mark>")) continue;
    const norm = normalizeForMatch(line);
    if (norm.length < 40) continue; // too short to attribute reliably
    checked++;
    if (hay.includes(norm)) matched++;
  }
  return { checked, matched };
}

/**
 * Assembles the drill's case/rebuttal document MECHANICALLY, verbatim from
 * disclosed archive docs — the model never writes, edits, or mixes contention
 * or rebuttal text (per the coach's spec: this is the ONE place corpus files
 * are used as CONTENT rather than reference material). Difficulty selects
 * WHICH real doc the debater trains on, by construction-audit score: intro =
 * the lowest-scored on-topic case (findable flaws), hard = the highest-scored,
 * standard = the median. Docs carrying <mark> highlighting are preferred (the
 * TTS reads only highlighted card text). Rebuttal-slot drills reproduce whole
 * AT:/A2: answer blocks (from up to 2 docs) and include 1-2 opposing-side
 * cases as read-only context for the round history.
 * Returns { section, kind: "case"|"rebuttal", caseText, sources } or null
 * when the archive has nothing on-topic. `section` is the prompt context
 * block; `caseText` is stamped onto the scenario by the server, never
 * requested from the model.
 */
export async function buildDrillCaseSection({ topic, side, difficulty, speech, speakingOrder } = {}) {
  const slot = slotInfo(speech);
  const rebuttal = Boolean(slot.rebuttal);
  // Rebuttals need a wider shortlist: only ~5-10% of disclosed docs carry
  // highlighted AT:/A2: answer blocks, so a tight relevance cut can miss all
  // of them even when the cycle has plenty.
  const candidates = await findArchiveCases({ topic, side, limit: rebuttal ? 24 : 8 });
  if (candidates.length === 0) return null;

  // Selection needs the audit score and highlight presence, which the 4KB
  // relevance-scoring head can't see — read the shortlisted docs in full.
  const loaded = [];
  for (const c of candidates) {
    try {
      const content = await fs.readFile(c.absPath, "utf8");
      const { body } = parseFrontmatter(content);
      const clean = stripAuditSection(body).trim();
      if (!clean) continue;
      loaded.push({ ...c, body: clean, marked: clean.includes("<mark>"), auditScore: parseAuditScore(content) });
    } catch {
      // unreadable file — skip
    }
  }
  if (loaded.length === 0) return null;
  const pool = loaded.some((c) => c.marked) ? loaded.filter((c) => c.marked) : loaded;

  const byQuality = [...pool].sort((a, b) => (a.auditScore ?? 5) - (b.auditScore ?? 5));
  // Hard difficulty trains against a GREAT case (construction-audit score >= 7):
  // a well-built case is what a debater actually struggles to answer. Fall back
  // to the highest-scored on-topic case when the cycle has nothing that strong.
  const great = byQuality.filter((c) => (c.auditScore ?? 0) >= GREAT_SCORE);
  const pick =
    difficulty === "intro"
      ? byQuality[0]
      : difficulty === "hard"
        ? (great.length > 0 ? great[great.length - 1] : byQuality[byQuality.length - 1])
        : byQuality[Math.floor(byQuality.length / 2)];

  const caseSource = (c) => ({
    team: c.meta.team,
    rank: c.meta.elo_rank,
    season: c.meta.season,
    cycle: c.meta.cycle,
    side: c.meta.side,
    resolution: c.meta.resolution,
  });
  const labelFor = (c) =>
    `${c.meta.team || "Unknown team"} (${c.meta.side || "?"}, season Elo rank #${c.meta.elo_rank || "?"}) — ${c.meta.season || ""} ${c.meta.cycle || ""}`;

  // --- verbatim document assembly ---
  let caseText;
  let used;
  if (rebuttal) {
    // Whole AT:/A2: answer blocks, reproduced verbatim; combine from up to 2
    // docs. Blocks carrying <mark> highlighting are strongly preferred — the
    // TTS reads only highlighted card text, and an unhighlighted document
    // would push the speak endpoint into (forbidden) model generation. Docs
    // without answer blocks fall back to case cards (answers by function —
    // still verbatim).
    const order =
      difficulty === "hard" ? [...byQuality].reverse() : difficulty === "intro" ? byQuality : pool;
    const withAt = [];
    for (const c of order) {
      const at = await loadRebuttalBody(c.absPath, 12000);
      if (at) withAt.push({ c, at, marked: at.includes("<mark>") });
    }
    const markedAt = withAt.filter((x) => x.marked);
    const chosen = (markedAt.length > 0 ? markedAt : withAt).slice(0, 2);
    if (chosen.length === 0) {
      caseText = capAtCardBoundary(pick.body, 16000);
      used = [pick];
    } else {
      caseText = chosen.map((x) => x.at).join("\n\n");
      used = chosen.map((x) => x.c);
    }
  } else {
    caseText = capAtCardBoundary(pick.body, 16000);
    used = [pick];
  }

  // Opposing-side disclosed cases: read-only context so the round history and
  // the rebuttal's targets are real.
  let oppCases = [];
  if (rebuttal) {
    const oppSide = /^pro$/i.test(String(side)) ? "Con" : /^con$/i.test(String(side)) ? "Pro" : null;
    if (oppSide) {
      try {
        oppCases = await findArchiveCases({ topic, side: oppSide, limit: 2 });
      } catch {
        oppCases = [];
      }
    }
  }
  const oppBlocks = [];
  for (const c of oppCases) {
    const body = await loadCaseBody(c.absPath, 9000);
    oppBlocks.push(
      `<opponent-case team="${c.meta.team || "unknown"}" rank="${c.meta.elo_rank || "?"}">\n${labelFor(c)}\n` +
        `(the OPPOSING side's disclosed case — what the rebuttal document answers)\n\n${body}\n</opponent-case>`
    );
  }

  console.log(
    `[archive] drill kind=${rebuttal ? "rebuttal" : "case"} pool=${pool.length} opp=${oppCases.length} ` +
      `picked=${used.map((c) => `${c.meta.team || "?"}(audit=${c.auditScore ?? "?"})`).join("|")} ` +
      `difficulty=${difficulty || "standard"} chars=${caseText.length} topic="${String(topic).slice(0, 60)}"`
  );

  const docLabel = rebuttal ? "rebuttal document" : "case";
  const section =
    `\n\nTHE DEBATER'S ${rebuttal ? "REBUTTAL DOCUMENT" : "CASE"} (assembled by the app, verbatim, from real ` +
    `disclosed docs on the public OpenCaselist wiki — the corpus-privacy rule does NOT apply; provenance is ` +
    `public and may be named openly):\n` +
    used.map((c) => `Source: ${labelFor(c)}`).join("\n") +
    `\n\n<drill-${rebuttal ? "rebuttal" : "case"}-document>\n${caseText}\n</drill-${rebuttal ? "rebuttal" : "case"}-document>\n` +
    (oppBlocks.length > 0 ? `\n${oppBlocks.join("\n\n")}\n` : "") +
    `\nHow to use this material:\n` +
    `- The ${docLabel} above IS the debater's prepared material for this round — the app supplies it verbatim ` +
    `and exports it separately. Do NOT write, rewrite, summarize, extend, or mix contention or rebuttal text ` +
    `yourself, and do NOT include a "caseText" field in your JSON response.\n` +
    `- Build the scenario AROUND this document: the round history, opponent profile, task, and answer-key moves ` +
    `should reference its actual contentions, taglines, and cards (and the opposing case's, when shown) by name.\n` +
    `- Cites in this material are REAL — never invent fictional cites for arguments drawn from it.`;

  return {
    section,
    kind: rebuttal ? "rebuttal" : "case",
    caseText,
    sources: [
      ...used.map(caseSource),
      ...oppCases.map((c) => ({ ...caseSource(c), role: "opponent" })),
    ],
  };
}

/**
 * Builds the stress-test benchmark section: top disclosed cases on the same
 * topic (plus their construction-criteria audits when the ingest pipeline has
 * appended them), for grounding feedback in what strong execution actually
 * looks like. Returns "" when nothing matches.
 */
export async function buildStressBenchmarkSection({ topic, limit = 2 }) {
  // A benchmark is a GREAT example, not merely the most on-topic doc — pull a
  // wider relevance shortlist, read each one's construction-audit score, and
  // lead with cases scoring >= GREAT_SCORE (relevance order preserved within
  // that tier). Fill any remaining slots from the rest so we still show `limit`
  // when the cycle has few great cases; content is read once here and reused.
  const candidates = await findArchiveCases({ topic, limit: Math.max(limit * 4, 8) });
  if (candidates.length === 0) return "";
  const withContent = [];
  for (const c of candidates) {
    try {
      const content = await fs.readFile(c.absPath, "utf8");
      withContent.push({ c, content, score: parseAuditScore(content) ?? 0 });
    } catch {
      // unreadable file — skip
    }
  }
  if (withContent.length === 0) return "";
  const greatFirst = [
    ...withContent.filter((x) => x.score >= GREAT_SCORE),
    ...withContent.filter((x) => x.score < GREAT_SCORE),
  ].slice(0, limit);

  const blocks = await Promise.all(
    greatFirst.map(async ({ c, content }) => {
      const body = await loadCaseBody(c.absPath, 9000);
      // The audit lives at the file's END, past any head-slice cap — pull it
      // explicitly (it's the benchmark's whole point) and cap it separately.
      let audit = "";
      const i = content.indexOf(AUDIT_MARKER);
      if (i !== -1) audit = `\n\n${content.slice(i).trim().slice(0, 4000)}`;
      return `<benchmark-case team="${c.meta.team || "unknown"}" rank="${c.meta.elo_rank || "?"}" season="${c.meta.season || ""}">\n${body}${audit}\n</benchmark-case>`;
    })
  );
  return (
    `\n\nBENCHMARK CASES (public OpenCaselist disclosure from top-ranked teams on this same topic — the ` +
    `corpus-privacy rule does NOT apply; you may name these teams and cite their cards openly):\n` +
    `${blocks.join("\n\n")}\n\n` +
    `Use them as the concrete standard: when you flag a construction criterion as weak or missing in the ` +
    `submitted case, point to how a benchmark case executes that same criterion (name the team and the specific ` +
    `card/tag) — and when a benchmark case ALSO lacks it, say so rather than implying top teams always do it. ` +
    `Any "Construction-criteria audit" section inside a benchmark maps each criterion to its specific card or ` +
    `notes its absence — mine it for exact examples.`
  );
}

/**
 * Builds the attack-pattern section: real, highlighted AT:/A2: answer blocks
 * that top teams have actually run on this topic (from public disclosure), so
 * predicted-attack cards REPLICATE the structure and evidence of attacks
 * debaters really face rather than inventing plausible-sounding ones. Pulls
 * from a wider shortlist than the benchmark (only a fraction of disclosed docs
 * carry highlighted answer blocks). Returns "" when the archive has none.
 */
export async function buildAttackPatternSection({ topic, limit = 3 } = {}) {
  const candidates = await findArchiveCases({ topic, limit: 20 });
  if (candidates.length === 0) return "";
  const blocks = [];
  for (const c of candidates) {
    if (blocks.length >= limit) break;
    let at;
    try {
      at = await loadRebuttalBody(c.absPath, 4500);
    } catch {
      at = null;
    }
    if (!at) continue;
    blocks.push(
      `<attack-pattern team="${c.meta.team || "unknown"}" rank="${c.meta.elo_rank || "?"}" season="${c.meta.season || ""}">\n${at}\n</attack-pattern>`
    );
  }
  if (blocks.length === 0) return "";
  return (
    `\n\nREAL ATTACK PATTERNS (verbatim AT:/A2: answer blocks that top teams have disclosed running on this topic — ` +
    `public data, quotable and attributable openly):\n` +
    `${blocks.join("\n\n")}\n\n` +
    `When you write a predicted-attack card, MODEL it on these real blocks — mirror how they tag the answer, what ` +
    `evidence they lean on, and the response structure — instead of inventing an attack no one actually runs. If one ` +
    `of these blocks fits the predicted attack, reproduce its card as the attack's carded example (attributed to the ` +
    `team) rather than paraphrasing.`
  );
}

// Best semantic-similarity score per REBUTTAL-corpus file for a topic query,
// from the shared chunk index. Empty until the index is rebuilt to include
// cases/pf-rebuttals/ (npm run build-index) — callers then fall back to lexical.
async function semanticRebuttalScores(topic, side) {
  try {
    const { searchIndex } = await import("./corpusIndex.mjs");
    const query = `Public Forum debate rebuttal / frontline answers${side ? ` for the ${side} side` : ""} on: ${topic}`;
    const hits = await searchIndex(query, { k: 96 });
    const byFile = new Map();
    for (const h of hits) {
      if (!h.path.startsWith("cases/pf-rebuttals/")) continue;
      if (!byFile.has(h.path) || byFile.get(h.path) < h.score) byFile.set(h.path, h.score);
    }
    return byFile;
  } catch {
    return new Map();
  }
}

/**
 * Builds the stress-test BENCHMARK section for a REBUTTAL under test: real,
 * top-team rebuttal docs on the same topic and SAME side (the standard for what
 * strong coverage + frontlining looks like). Scored like the case benchmark —
 * semantic similarity when the index carries the rebuttal corpus, topic-token
 * overlap otherwise — one doc per team, best-first. Returns "" when nothing
 * matches. `side` is the side of the team whose rebuttal is under test.
 */
export async function buildRebuttalBenchmarkSection({ topic, side, limit = 3 } = {}) {
  const files = await walk(REBUTTALS_DIR);
  if (files.length === 0) return "";
  const want = new Set(tokens(topic));
  if (want.size === 0) return "";
  const semantic = await semanticRebuttalScores(topic, side);

  const scored = [];
  for (const absPath of files) {
    let head;
    try {
      head = await readFileHead(absPath, 2048);
    } catch {
      continue;
    }
    const { meta } = parseFrontmatter(head);
    if (side && meta.side && meta.side.toLowerCase() !== String(side).toLowerCase()) continue;
    const against = tokens(meta.resolution || meta.title || path.basename(absPath));
    let lexical = 0;
    if (against.length > 0) {
      let hit = 0;
      for (const t of against) if (want.has(t)) hit++;
      lexical = hit / Math.max(4, against.length);
    }
    const sem = semantic.get(toRelPath(absPath)) || 0;
    const score = Math.max(lexical, sem);
    if (lexical < 0.25 && sem < 0.38) continue;
    scored.push({ absPath, meta, score, rank: Number(meta.elo_rank) || 999 });
  }
  scored.sort((a, b) => b.score - a.score || a.rank - b.rank);

  const seen = new Set();
  const picked = [];
  for (const c of scored) {
    const key = c.meta.team || c.absPath;
    if (seen.has(key)) continue;
    seen.add(key);
    picked.push(c);
    if (picked.length >= limit) break;
  }
  if (picked.length === 0) return "";

  const blocks = [];
  for (const c of picked) {
    const content = await fs.readFile(c.absPath, "utf8");
    const { body } = parseFrontmatter(content);
    const answers = c.meta.answers || "";
    blocks.push(
      `<benchmark-rebuttal team="${c.meta.team || "unknown"}" side="${c.meta.side || "?"}" rank="${c.meta.elo_rank || "?"}" season="${c.meta.season || ""}">\n` +
        (answers ? `Answers: ${answers}\n\n` : "") +
        `${body.trim().slice(0, 7000)}\n</benchmark-rebuttal>`
    );
  }
  return (
    `\n\nBENCHMARK REBUTTALS (real disclosed rebuttal/frontline docs from top-ranked ${side || ""} teams on this same ` +
    `topic — public OpenCaselist data; the corpus-privacy rule does NOT apply, name teams and cards openly):\n` +
    `${blocks.join("\n\n")}\n\n` +
    `Use them as the concrete standard for COVERAGE and FRONTLINING: what a strong rebuttal on this side actually ` +
    `answers, how it warrants its responses, which turns it reads with link + impact, and how it makes the arguments ` +
    `it wants extended hard to kick. When you flag a gap in the submitted rebuttal, point to how a benchmark rebuttal ` +
    `handles that same answer (name the team and the card/tag).`
  );
}

// --- Paired same-resolution export (chat's export_archive_case tool) --------
// Cross must never WRITE a Pro/Con case or a rebuttal document — it reproduces
// real disclosed ones. When a debater asks for both sides, "both sides" is only
// meaningful if the two docs argue the SAME resolution, which the per-side
// relevance search alone doesn't guarantee: Pro could land in one topic cycle
// and Con in another that shares topic words.

// Resolution text is the topic identity. Directory is NOT a safe proxy — the
// `unsorted/` dirs hold mixed resolutions.
function resolutionKey(resolution) {
  return String(resolution || "")
    .toLowerCase()
    .replace(/^resolved:\s*/, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// How deep to look for a doc carrying real AT:/A2: answer blocks. Only ~12% of
// disclosed docs have them, so a handful of probes isn't enough. Cases only
// probe for <mark> highlighting, which is common, so a short look suffices.
const REBUTTAL_PROBE_LIMIT = 30;
const CASE_PROBE_LIMIT = 8;

// A covered topic cycle holds 49-239 docs, so a real match surfaces dozens.
// A handful of stragglers means the semantic search stretched to the nearest
// neighbour rather than finding the topic — asking for a Mars colonization
// case matched two space-investment docs. Below this floor we report no match
// so Cross refuses honestly instead of handing over an unrelated case.
const MIN_TOPIC_POOL = 5;

/**
 * Picks one disclosed doc per requested side, all pinned to a SINGLE
 * resolution, and loads each one's reproducible body.
 *
 * `kind: "case"` reproduces the constructive only (loadConstructiveBody);
 * `kind: "rebuttal"` reproduces whole verbatim AT:/A2: answer blocks, probing
 * down the relevance-ordered list until it finds a doc that has them and
 * preferring <mark>-highlighted ones. A side with no answer blocks anywhere in
 * the cycle is reported as missing rather than silently substituted.
 *
 * Returns { resolution, season, cycle, docs: [...], missingSides: [...] }, or
 * null when the archive has nothing on-topic at all.
 */
export async function findPairedArchiveCases({ topic, sides = ["Pro", "Con"], kind = "case" } = {}) {
  const wantSides = (Array.isArray(sides) ? sides : [sides])
    .map((s) => String(s || "").trim().toLowerCase())
    .filter((s) => s === "pro" || s === "con");
  if (wantSides.length === 0) return null;

  // One walk feeds every side — the 4.5k-file head scan is the expensive part.
  const scored = await scoreArchive({ topic });
  if (scored.length === 0) return null;

  // Pick the topic by aggregate score across the strongest hits rather than
  // taking hit #1: one outlier doc shouldn't drag both sides into a cycle the
  // rest of the results disagree with.
  const weight = new Map();
  for (const c of scored.slice(0, 12)) {
    const key = resolutionKey(c.meta.resolution);
    if (!key) continue;
    weight.set(key, (weight.get(key) || 0) + c.score);
  }
  if (weight.size === 0) return null;
  const targetKey = [...weight.entries()].sort((a, b) => b[1] - a[1])[0][0];

  const onTopic = scored.filter((c) => resolutionKey(c.meta.resolution) === targetKey);
  if (onTopic.length < MIN_TOPIC_POOL) return null;

  const rebuttal = kind === "rebuttal";
  const docs = [];
  const missingSides = [];
  // Two sides of one topic read better as two different programs' takes than
  // as one team's own Pro and Con files, so a side prefers a team the other
  // side didn't already use — falling back to the best doc when that's all
  // the cycle offers.
  const usedTeams = new Set();
  const preferUnusedTeam = (list) => list.find((c) => c.meta.team && !usedTeams.has(c.meta.team)) || list[0];

  for (const side of wantSides) {
    const label = side === "pro" ? "Pro" : "Con";
    // One doc per team before probing: a team that disclosed twenty rounds
    // would otherwise fill the whole probe window with its own files, leaving
    // no room for another program's take (and defeating preferUnusedTeam).
    const seenTeams = new Set();
    const candidates = onTopic.filter((c) => {
      if (String(c.meta.side || "").toLowerCase() !== side) return false;
      const team = c.meta.team || c.absPath;
      if (seenTeams.has(team)) return false;
      seenTeams.add(team);
      return true;
    });
    if (candidates.length === 0) {
      missingSides.push(label);
      continue;
    }

    if (!rebuttal) {
      // Prefer a doc that carries <mark> highlighting — same preference the
      // drill builder applies. An unhighlighted doc is faithful to its source
      // (some teams disclose without highlighting) but teaches less: you can't
      // see what was actually read aloud versus kept for backup.
      const probed = [];
      for (const c of candidates.slice(0, CASE_PROBE_LIMIT)) {
        try {
          probed.push({ ...c, body: await loadConstructiveBody(c.absPath) });
        } catch {
          // unreadable file — skip
        }
      }
      if (probed.length === 0) {
        missingSides.push(label);
        continue;
      }
      const marked = probed.filter((x) => x.body.includes("<mark>"));
      const pick = preferUnusedTeam(marked.length > 0 ? marked : probed);
      usedTeams.add(pick.meta.team);
      docs.push({ side: label, kind: "case", absPath: pick.absPath, meta: pick.meta, body: pick.body });
      continue;
    }

    // Answer blocks are rare — probe down the list, preferring highlighted
    // ones (a highlighted block shows what actually gets read aloud).
    const withAt = [];
    for (const c of candidates.slice(0, REBUTTAL_PROBE_LIMIT)) {
      let at;
      try {
        at = await loadRebuttalBody(c.absPath, 16000);
      } catch {
        at = null;
      }
      if (at) withAt.push({ ...c, at });
    }
    if (withAt.length === 0) {
      missingSides.push(label);
      continue;
    }
    const marked = withAt.filter((x) => x.at.includes("<mark>"));
    const use = preferUnusedTeam(marked.length > 0 ? marked : withAt);
    usedTeams.add(use.meta.team);
    docs.push({ side: label, kind: "rebuttal", absPath: use.absPath, meta: use.meta, body: use.at });
  }

  if (docs.length === 0) return null;

  const first = docs[0].meta;
  console.log(
    `[archive] paired export kind=${kind} pool=${onTopic.length} ` +
      `picked=${docs.map((d) => `${d.side}:${d.meta.team || "?"}(${d.body.length}c)`).join("|")} ` +
      `${missingSides.length ? `missing=${missingSides.join(",")} ` : ""}topic="${String(topic).slice(0, 60)}"`
  );

  return {
    resolution: first.resolution || "",
    season: first.season || "",
    cycle: first.cycle || "",
    docs,
    missingSides,
  };
}

/**
 * Season/cycle directories the archive actually covers, with each one's
 * resolution — what Cross offers when a requested topic isn't in the archive,
 * so "I don't have that topic" comes with real alternatives instead of a
 * bare refusal.
 */
export async function listArchiveCoverage() {
  const files = await walk(ARCHIVE_DIR);
  const byCycle = new Map();
  for (const absPath of files) {
    let head;
    try {
      head = await readFileHead(absPath, 1024);
    } catch {
      continue;
    }
    const { meta } = parseFrontmatter(head);
    if (!meta.season || !meta.cycle || meta.cycle === "unsorted") continue;
    const key = `${meta.season}/${meta.cycle}`;
    const g = byCycle.get(key) || { season: meta.season, cycle: meta.cycle, count: 0, resolution: "" };
    g.count++;
    if (!g.resolution && meta.resolution) g.resolution = meta.resolution;
    byCycle.set(key, g);
  }
  return [...byCycle.values()].sort((a, b) =>
    a.season === b.season ? a.cycle.localeCompare(b.cycle) : b.season.localeCompare(a.season)
  );
}
