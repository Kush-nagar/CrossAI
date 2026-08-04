// Model post-pass over locally-transcribed audio. applyKnownCorrections()
// only fixes mis-transcriptions it has seen verbatim during calibration;
// this pass hands the transcript to the model with the debater's correction
// table as context so *unseen* garbles of debate jargon, author names, and
// technical terms get fixed too. Callers must treat it as best-effort and
// fall back to the input text on any error — a transcript must never be
// lost because a cleanup call failed.

import { completeText } from "./aiClient.mjs";
import { getProfileSummaryForPrompt } from "./voiceProfile.mjs";

const CLEANUP_RULES =
  "You clean up speech-to-text transcripts of competitive debaters (Policy, LD, " +
  "Public Forum, Parliamentary). The transcriber often garbles debate jargon " +
  "(kritik, topicality, solvency, uniqueness, permutation, counterplan, " +
  "disad/disadvantage, aff/neg, RFD, tabula rasa), author/card names, and " +
  "technical or philosophical terms.\n" +
  "Rules:\n" +
  "- Fix ONLY clear mis-transcriptions — words that are obviously a garbled " +
  "version of a debate term, name, or technical word given the context.\n" +
  "- Never add, remove, reorder, or rephrase content. Keep filler words, " +
  "false starts, and sentence structure exactly as they are.\n" +
  "- If you are not confident a word is a mis-transcription, leave it unchanged.\n" +
  "- Return ONLY the corrected transcript text — no commentary, no quotes, " +
  "no markdown.";

export async function cleanupTranscript(text, { model } = {}) {
  const trimmed = text?.trim();
  if (!trimmed) return text;

  const profileSummary = await getProfileSummaryForPrompt();
  const system = profileSummary ? `${CLEANUP_RULES}\n\n${profileSummary}` : CLEANUP_RULES;

  // Output is roughly input-sized; headroom covers tokenization variance.
  // completeText throws on max_tokens truncation, which the caller treats as
  // "cleanup failed, keep the original".
  const maxTokens = Math.min(8000, Math.max(1000, Math.ceil(trimmed.length / 2)));
  const cleaned = await completeText({ system, prompt: trimmed, maxTokens, model });
  return cleaned.trim() || text;
}
