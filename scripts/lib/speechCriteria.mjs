// Canonical speech-quality criteria — the ONE place the construction and
// delivery standards live so that "the AI voice box builds and delivers
// speeches to the same criteria Cross grades on" is literally true, not two
// prose copies that drift apart.
//
// Three consumers:
//   - delivery.mjs (the drill GRADER) renders DELIVERY_GRADING_BULLETS as its
//     tone-aware grading criteria.
//   - humeTts.mjs (the TTS voice) turns the same delivery qualities into
//     positive Octave acting directions via deliveryActingDirectives().
//   - server.mjs /api/drill/speak (the GENERATOR) injects buildAuthoringCriteria()
//     so generated exemplar / opponent-setup speeches are constructed to the
//     construction standards the grader scores against.

// --- Delivery -------------------------------------------------------------
// Phrased as grading criteria (what the grader looks for). The TTS view below
// re-phrases the same qualities as things the voice should DO.
export const DELIVERY_GRADING_BULLETS = [
  "Translate scores into coaching language — never quote raw emotion numbers back to the debater.",
  "Monotone/flatness during weighing or voting issues is a ballot problem: judges flow emphasis. If the segments show calmness/boredom dominating exactly where the speech weighs, make emphasis one of the fixes.",
  "Anxiety/distress spiking on a specific argument usually marks the debater's least-drilled material — name the argument and prescribe targeted practice on it, not generic 'be confident'.",
  "Read tone WITH pace: high anxiety + above-ceiling WPM means cut content (word economy); high anxiety at normal pace means rehearsal; confidence with monotone means add vocal variation, the content is fine.",
  "Determination/confidence sustained through the back half of the speech is a strength — say so explicitly; delivery feedback that only criticizes teaches debaters to ignore it.",
];

/**
 * The same delivery qualities as positive acting directions for Octave TTS,
 * specialized by speech slot. Kept concise — Octave wants a short natural-
 * language delivery brief per utterance. This is the delivery half of "vary
 * the voice to the grading criteria": emphasis on signposts/numbers, no
 * monotone, lean into weighing/voters, sustain energy through the back half.
 */
export function deliveryActingDirectives(speechType) {
  const slot = String(speechType || "").toLowerCase();
  // Kept compact — Octave wants a short delivery brief. Names the graded
  // qualities (signpost/number emphasis, no monotone, weigh-slow, back-half
  // energy) once, then a slot-specific accent.
  const common = "Punch signposts and numbers; vary pitch, never monotone; slow into weighing/voters; hold energy through the back half.";
  if (/final focus|2ar|2nr/.test(slot)) return common + " Voters in ballot-ready reason-for-decision language: decisive, the last word.";
  if (/summary|1ar/.test(slot)) return common + " Crystallize — press the collapse, don't re-read the flow.";
  if (/rebuttal|1nc|2ac|block/.test(slot)) return common + " Brisk and crisp; punch the frontlines and turn tags.";
  return common;
}

// --- Construction ---------------------------------------------------------
// The load-bearing case-construction / round-vision standards the drill grader
// scores against (server.mjs grade prompt + the case-construction marks +
// DRILL_LEDGER_RULES), distilled to authoring guidance.
export const CONSTRUCTION_GRADING_BULLETS = [
  "Offense counts only if it is extended in both back-half speeches; defense isn't sticky; an unwarranted claim is not an argument; a turn needs both a link and an impact implication; a line the judge couldn't flow was functionally never said.",
  "Show the case-construction marks: embedded weighing, offensive and defensive spikes, high-quality evidence (quals/recency), and collapse flexibility (more than one link/impact so you aren't pinned to a single path).",
  "Take the path of least resistance — the cheapest sufficient offense — and trade time efficiently with weighing filters, grouping, and strategic concessions rather than brute-forcing the line-by-line. Collapse decisively.",
  "Preempt the opponent's predicted next move and close their ballot path; respect any live weighing debate instead of talking past it.",
];

/**
 * Construction standards phrased as authoring instructions for a generated
 * speech, specialized for closing speeches (summary / final focus) which must
 * crystallize rather than re-read. Injected into the /api/drill/speak
 * generation prompt so the voice box's speeches are built to the same bar the
 * grader holds the student to.
 */
export function buildAuthoringCriteria(speechType) {
  const slot = String(speechType || "").toLowerCase();
  const isClosing = /final focus|2ar|summary|1ar/.test(slot);
  const lines = [...CONSTRUCTION_GRADING_BULLETS];
  if (isClosing) {
    lines.push(
      "This is a closing speech: crystallize the round — collapse to the cleanest winning path, extend only what you're going into the back half on, and weigh it against their best offense. Do not re-read the whole flow."
    );
  }
  if (/final focus|2ar|2nr/.test(slot)) {
    lines.push(
      "As the final speech: mirror your summary, speak in ballot-ready reason-for-decision language, and preempt the judge's single most likely sticking point."
    );
  }
  return (
    "Construction standards this speech must meet (the same standards Cross grades speeches on):\n" +
    lines.map((l) => `- ${l}`).join("\n")
  );
}
