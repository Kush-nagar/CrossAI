// Cloud transcription via Groq's OpenAI-compatible Whisper endpoint — hosted
// whisper-large-v3, fast, free-tier friendly, no local model download. This
// module is optional at runtime: callers must check hasGroqCredentials() (or
// use lib/stt.mjs, which falls back to Hume then local Whisper). Audio sent
// here leaves the machine — see CLAUDE.md's privacy note.

import { convertToWav } from "./transcribe.mjs";

const GROQ_TRANSCRIPTIONS_URL = "https://api.groq.com/openai/v1/audio/transcriptions";

export function hasGroqCredentials() {
  return Boolean(process.env.GROQ_API_KEY);
}

/**
 * Transcribes an audio buffer of any ffmpeg-readable format via Groq's
 * hosted whisper-large-v3. Returns { text } — no tone data (Hume-only).
 * Throws on non-2xx responses or network errors (callers fall back).
 */
export async function transcribeWithGroq(buffer) {
  const wav = await convertToWav(buffer);
  const model = process.env.GROQ_WHISPER_MODEL || "whisper-large-v3";

  const form = new FormData();
  // response_format defaults to "json" -> { text }; that's all we need.
  form.append("file", new Blob([wav], { type: "audio/wav" }), "audio.wav");
  form.append("model", model);

  const res = await fetch(GROQ_TRANSCRIPTIONS_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
    body: form, // fetch sets the multipart boundary itself — don't set Content-Type
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Groq transcription failed: ${res.status} ${body.slice(0, 300)}`);
  }

  const { text } = await res.json();
  return { text: (text ?? "").trim() };
}
