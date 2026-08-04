// Correction-learning voice profile: not acoustic model fine-tuning (that
// needs far more data + GPU training infra than a dozen short recordings
// can provide).
// Instead, each user-submitted correction is diffed word-by-word and stored;
// known corrections are applied to future transcripts automatically, and
// summarized into the system prompt so the model can recognize likely
// mis-transcriptions even when they're not an exact repeat.

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..");
const PROFILE_PATH = path.join(ROOT, "voice-profile.json");

// 12 distinct calibration scripts (~30-50 words each), one per take, drawn
// from across the debate glossary (training-data/reference/) so calibration
// covers a broad spread of jargon rather than repeating one narrow sentence.
// Reading each at real "technical round" (spreading) speed gives realistic
// pace data too. Because each script's correct text is known in advance,
// every take is diffed against it automatically — no manual correction step.
export const CALIBRATION_SCRIPTS = [
  // 1. Policy — plan/CP/DA/T mechanics
  "The affirmative's plan solves the disadvantage's uniqueness because the link is non-intrinsic. " +
  "Extend our counterplan, which competes through net benefits, and the topicality violation " +
  "independently justifies a negative ballot on limits and ground.",

  // 2. LD — value/criterion/framework
  "Our value is justice, achieved through the criterion of protecting individual autonomy. " +
  "The negative's framework collapses into utilitarian calculus, which fails to respect human " +
  "dignity as an end in itself under the categorical imperative.",

  // 3. Theory — topicality shell structure
  "Interpretation: the affirmative must defend a topical plan text within the " +
  "resolution's bounds. Violation: their counterplan-esque advocacy strays outside " +
  "those limits, which independently justifies a topicality loss on predictability, " +
  "since the negative's ground and ability to generate offense were denied.",

  // 4. Kritik — link/alt/framework
  "The kritik's link is the affirmative's reliance on state action, which entrenches " +
  "capitalism and structural violence. Our alternative rejects the plan's ontology, and the " +
  "framework argument means you evaluate discourse before the plan's consequences.",

  // 5. Evidence — cards/cites/warrants
  "Extend our Hathaway twenty-five card, tagged as solving the impact, cut from a " +
  "peer-reviewed journal rather than a think tank. Cross-apply the warrant to answer their " +
  "turn, since their evidence indict fails to contest our internal link.",

  // 6. Flowing / round mechanics
  "In the rebuttal, collapse to the disad and extend the link, impact, and turn. " +
  "The second affirmative constructive dropped our uniqueness claim, so it's conceded into " +
  "the block, and the judge should vote negative on presumption.",

  // 7. Philosophy / metaethics
  "Moral realism holds that objective moral facts exist independent of belief, unlike moral " +
  "relativism or nihilism. Rawls's veil of ignorance and difference principle ground our " +
  "framework, prioritizing the least advantaged over aggregate utilitarian welfare.",

  // 8. Argumentation / logic
  "Every claim needs a warrant connecting evidence to impact, or it's just an assertion. " +
  "Their disad's link chain commits a non-sequitur against our counterplan, and the turn " +
  "independently outweighs on net benefits since probability and magnitude both favor our side.",

  // 9. Public Forum specific
  "In final focus, crystallize the round to your strongest weighing mechanism and extend " +
  "uncontested impacts. Their case collapsed after cross-examination, and the framework " +
  "debate favors magnitude over probability, so the ballot should go affirmative on net benefits.",

  // 10. Judge paradigm / adaptation
  "A tabula rasa judge defaults to no preconceived framework, unlike a policymaker paradigm " +
  "that weighs consequences like a legislator. Adapting to a traditional judge means slowing " +
  "down, signposting clearly, and avoiding excessive jargon or spreading.",

  // 11. Prep / speaker points / round logistics
  "During prep time, allocate extra minutes to the block covering the disad and kritik, " +
  "since those flows are collapsing fastest. Watch your speaker points by signposting each " +
  "off-case position and flowing cleanly through cross-examination questions.",

  // 12. Comprehensive mix, pulling from several categories at once
  "Extend the contention, weigh magnitude against timeframe, and answer their kritik's " +
  "alternative with a permutation. The negative's disad links only absent the plan, so " +
  "cross-apply our solvency evidence and crystallize the ballot on offense, not defense.",
];

export const CALIBRATION_TOTAL_SAMPLES = CALIBRATION_SCRIPTS.length;

function emptyProfile() {
  return { samples: [], knownCorrections: {}, pendingCorrections: {} };
}

export async function loadProfile() {
  try {
    const profile = JSON.parse(await fs.readFile(PROFILE_PATH, "utf8"));
    // Older profiles predate the pending-corrections holding area.
    profile.pendingCorrections ??= {};
    return profile;
  } catch {
    return emptyProfile();
  }
}

async function saveProfile(profile) {
  await fs.writeFile(PROFILE_PATH, JSON.stringify(profile, null, 2) + "\n", "utf8");
}

function tokenize(text) {
  return text.trim().split(/\s+/).filter(Boolean);
}

// Common short words the diff can spuriously "correct" when it misaligns at
// a sentence's tail (e.g. matching "for" against a trailing "from the
// case."). Blanket-replacing these globally would corrupt unrelated future
// transcripts, so corrections keyed on them are recorded in sample history
// for audit purposes but never applied automatically.
const UNSAFE_CORRECTION_KEYS = new Set([
  "a", "an", "the", "is", "was", "were", "it", "this", "that", "and", "or",
  "but", "so", "if", "as", "by", "from", "with", "be", "are", "has", "have",
  "had", "not", "do", "does", "did", "can", "will", "would", "should",
  "could", "may", "might", "of", "to", "in", "on", "at", "for",
]);

function isSafeCorrectionKey(from) {
  const key = from.toLowerCase();
  return key.length >= 3 && !UNSAFE_CORRECTION_KEYS.has(key);
}

// Plain character-level Levenshtein — inputs are single words or short
// phrases, so the O(n*m) DP is trivial.
function levenshtein(a, b) {
  const n = a.length;
  const m = b.length;
  if (!n) return m;
  if (!m) return n;
  let prev = Array.from({ length: m + 1 }, (_, j) => j);
  for (let i = 1; i <= n; i++) {
    const curr = [i];
    for (let j = 1; j <= m; j++) {
      curr[j] = Math.min(
        prev[j] + 1,
        curr[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    prev = curr;
  }
  return prev[m];
}

// A real mis-hearing spells/sounds like its correction ("critique" ->
// "kritik"); a spurious diff misalignment pairs unrelated spans. Gate
// single-observation corrections on orthographic closeness.
function isPlausibleMishearing(from, to) {
  const a = from.toLowerCase();
  const b = to.toLowerCase();
  return levenshtein(a, b) / Math.max(a.length, b.length) <= 0.6;
}

export const CALIBRATION_MAX_WER = 0.35;

// Word error rate: word-level edit distance over the reference length. Reuses
// the char-level levenshtein above — it only compares elements via === and
// reads .length, so an array of normalized tokens works exactly like a
// string of chars. This is true min-edit-distance WER (counts insertions and
// deletions), unlike diffWords below, which only reports LCS-aligned
// substitutions and undercounts skipped/garbled speech.
export function wordErrorRate(transcript, script) {
  const hyp = tokenize(transcript).map(normalize);
  const ref = tokenize(script).map(normalize);
  if (!ref.length) return 0;
  return levenshtein(hyp, ref) / ref.length;
}

function normalize(word) {
  return word.toLowerCase().replace(/^[^\w]+|[^\w]+$/g, "");
}

// Word-level LCS diff (classic edit-distance DP + backtrack). Returns
// [{ from, to }] for substituted spans — insertions/deletions are ignored
// since we only care about "this word became that word" corrections.
function diffWords(originalText, correctedText) {
  const a = tokenize(originalText);
  const b = tokenize(correctedText);
  const n = a.length;
  const m = b.length;

  const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      dp[i][j] =
        normalize(a[i - 1]) === normalize(b[j - 1])
          ? dp[i - 1][j - 1] + 1
          : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }

  const substitutions = [];
  let i = n;
  let j = m;
  let pendingA = [];
  let pendingB = [];

  function flushPending() {
    if (pendingA.length || pendingB.length) {
      const from = pendingA.reverse().join(" ");
      const to = pendingB.reverse().join(" ");
      if (from && to && from.toLowerCase() !== to.toLowerCase()) {
        substitutions.push({ from, to });
      }
      pendingA = [];
      pendingB = [];
    }
  }

  while (i > 0 && j > 0) {
    if (normalize(a[i - 1]) === normalize(b[j - 1])) {
      flushPending();
      i--;
      j--;
    } else if (dp[i - 1][j] >= dp[i][j - 1]) {
      pendingA.push(a[i - 1]);
      i--;
    } else {
      pendingB.push(b[j - 1]);
      j--;
    }
  }
  while (i > 0) {
    pendingA.push(a[--i]);
  }
  while (j > 0) {
    pendingB.push(b[--j]);
  }
  flushPending();

  return substitutions.reverse();
}

/**
 * Records a calibration take. Each take reads a distinct, known script (see
 * CALIBRATION_SCRIPTS), so the correct text is always known in advance — the
 * transcript is diffed against it automatically, no manual correction needed.
 */
export async function addCalibrationSample({ transcript }) {
  const profile = await loadProfile();
  const scriptIndex = Math.min(profile.samples.length, CALIBRATION_SCRIPTS.length - 1);
  const script = CALIBRATION_SCRIPTS[scriptIndex];
  const wer = wordErrorRate(transcript, script);
  const corrections = diffWords(transcript, script);
  const wasCorrect = corrections.length === 0;

  // Garbled/skipped takes are rejected before they touch the profile at
  // all — sampleCount/scriptIndex naturally stay put on the next status
  // fetch, and no unreliable "correction" ever reaches knownCorrections.
  if (wer > CALIBRATION_MAX_WER) {
    console.log(`[voice-profile] take rejected: wer=${wer.toFixed(2)} (max ${CALIBRATION_MAX_WER})`);
    return { profile, corrections: [], wasCorrect: false, rejected: true, wer, mismatches: corrections.slice(0, 8) };
  }

  profile.samples.push({
    date: new Date().toISOString(),
    transcript,
    wasCorrect,
    corrections,
    wer,
  });

  // A correction becomes an auto-applied rewrite rule when it's either
  // (a) orthographically close to what it replaces (a genuine mis-hearing —
  // applies immediately, so the 12 one-shot scripts still teach), or
  // (b) observed twice with the same target (repeat evidence outweighs the
  // misalignment risk). Anything else is held in pendingCorrections until
  // a second observation confirms it — this is what stops one misaligned
  // sentence-tail diff from becoming a permanent global rewrite rule.
  for (const { from, to } of corrections) {
    if (!isSafeCorrectionKey(from)) continue;
    const key = from.toLowerCase();
    const pending = profile.pendingCorrections[key];
    const confirmedByRepeat = pending && pending.to.toLowerCase() === to.toLowerCase();
    if (confirmedByRepeat || isPlausibleMishearing(from, to)) {
      profile.knownCorrections[key] = to;
      delete profile.pendingCorrections[key];
    } else {
      // New or conflicting evidence — (re)start the pending entry.
      profile.pendingCorrections[key] = { to, count: 1 };
    }
  }

  await saveProfile(profile);
  return { profile, corrections, wasCorrect, rejected: false, wer, mismatches: corrections };
}

// Applies known word/phrase corrections to a fresh transcript. Whole-word,
// case-insensitive, longest-match-first so multi-word corrections
// ("F-solve" -> "aff solves") don't get partially clobbered by a shorter one.
export async function applyKnownCorrections(text) {
  const profile = await loadProfile();
  const entries = Object.entries(profile.knownCorrections).sort((a, b) => b[0].length - a[0].length);
  let result = text;
  for (const [from, to] of entries) {
    const escaped = from.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`\\b${escaped}\\b`, "gi");
    result = result.replace(re, to);
  }
  return result;
}

// Wipes all recorded takes and learned corrections so a debater can redo
// calibration from scratch (e.g. after a mic change, or if early takes were
// noisy) rather than being stuck once `calibrated` flips true.
export async function resetProfile() {
  await saveProfile(emptyProfile());
  return getCalibrationStatus();
}

export async function getCalibrationStatus() {
  const profile = await loadProfile();
  const nextScriptIndex = Math.min(profile.samples.length, CALIBRATION_SCRIPTS.length - 1);
  // Takes 1-6 read at normal debate pace; 7-12 at spread/competition speed —
  // a realistic failure mode local/cloud STT both need to be tested against.
  const pace = nextScriptIndex + 1 <= 6 ? "normal" : "spread";
  return {
    sampleCount: profile.samples.length,
    total: CALIBRATION_TOTAL_SAMPLES,
    correctionCount: Object.keys(profile.knownCorrections).length,
    calibrated: profile.samples.length >= CALIBRATION_TOTAL_SAMPLES,
    script: CALIBRATION_SCRIPTS[nextScriptIndex],
    pace,
  };
}

// A short text block for the system prompt, so the model knows this debater's
// known mis-transcription patterns and can flag/interpret likely repeats.
export async function getProfileSummaryForPrompt() {
  const profile = await loadProfile();
  if (profile.samples.length === 0) return "";

  const correctionLines = Object.entries(profile.knownCorrections)
    .map(([from, to]) => `- "${from}" is usually actually "${to}"`)
    .join("\n");

  return (
    `This debater has completed ${profile.samples.length} voice-calibration sample(s). ` +
    (correctionLines
      ? `Known local transcription mistakes for this debater's voice (apply this pattern when a transcript looks similarly garbled, even if the exact words differ):\n${correctionLines}`
      : "No corrections needed yet — transcripts have been accurate so far.")
  );
}
