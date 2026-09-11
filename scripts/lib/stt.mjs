// Speech-to-text orchestrator, 3 tiers: Groq's hosted whisper-large-v3
// (cloud — fastest, no local model, text only) when GROQ_API_KEY is set,
// else Hume EVI (cloud — transcript + vocal tone analysis) when
// HUME_API_KEY is set, else the local Whisper pipeline. Any tier's failure
// falls through to the next, so transcription never breaks because a cloud
// path is down.

import { transcribeAudioBuffer } from "./transcribe.mjs";
import { hasHumeCredentials, transcribeWithHume } from "./humeVoice.mjs";
import { hasGroqCredentials, transcribeWithGroq } from "./groqVoice.mjs";

/**
 * Transcribes an audio buffer of any ffmpeg-readable format.
 * Returns { text, tone } — tone is { top: [{name, score}], prompt } from
 * Hume prosody analysis, or null on the Groq/Whisper paths / silent audio.
 *
 * `ext` (no leading dot, e.g. "m4a") is optional and only used by the Groq
 * tier, so it can send the original compressed audio instead of re-encoding
 * to an inflated WAV — see groqVoice.mjs.
 */
export async function transcribeAudio(buffer, { ext } = {}) {
  if (hasGroqCredentials()) {
    try {
      const { text } = await transcribeWithGroq(buffer, { ext });
      console.log(`[stt] groq ok (${text.length} chars)`);
      return { text, tone: null };
    } catch (err) {
      console.error("[stt] Groq transcription failed — falling back:", err);
    }
  }
  if (hasHumeCredentials()) {
    try {
      const { text, tone } = await transcribeWithHume(buffer);
      console.log(`[stt] hume ok (${text.length} chars${tone ? ", tone analyzed" : ""})`);
      return { text, tone };
    } catch (err) {
      console.error("[stt] Hume transcription failed — falling back to local Whisper:", err);
    }
  }
  const { text } = await transcribeAudioBuffer(buffer);
  return { text, tone: null };
}
