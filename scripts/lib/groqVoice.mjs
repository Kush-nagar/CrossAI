// Cloud transcription via Groq's OpenAI-compatible Whisper endpoint — hosted
// whisper-large-v3, fast, free-tier friendly, no local model download. This
// module is optional at runtime: callers must check hasGroqCredentials() (or
// use lib/stt.mjs, which falls back to Hume then local Whisper). Audio sent
// here leaves the machine — see CLAUDE.md's privacy note.

import { convertToFlac, splitToFlacChunks } from "./transcribe.mjs";

const GROQ_TRANSCRIPTIONS_URL = "https://api.groq.com/openai/v1/audio/transcriptions";

// Formats Groq's transcriptions endpoint accepts natively (per
// console.groq.com/docs/speech-to-text) — sending one of these as-is skips
// a local ffmpeg pass entirely. Anything else gets re-encoded to FLAC first
// (see convertToFlac's comment on why FLAC, not WAV).
const GROQ_NATIVE_EXTS = new Set(["flac", "mp3", "mp4", "mpeg", "mpga", "m4a", "ogg", "wav", "webm"]);

// Groq's hard cap is 25MB (free tier) or 100MB (dev tier) per request — we
// don't know which tier a given key is on, so default to the conservative
// free-tier number and let a deploy on the dev tier raise it. Stay a couple
// MB under the real cap: multipart form overhead and Groq's own size check
// (observed rejecting a request only slightly over 25MB) leave little margin.
const MAX_UPLOAD_BYTES = Number(process.env.GROQ_MAX_UPLOAD_MB || 24) * 1024 * 1024;
// Speech-only 16kHz mono FLAC runs well under 1MB/minute in practice, but
// this sizes chunks off a deliberately pessimistic 2MB/minute so a noisier
// recording (crosstalk, room noise, music) doesn't produce an oversized
// chunk that just fails again.
const ASSUMED_BYTES_PER_SEC = (2 * 1024 * 1024) / 60;

// A measured real silent clip encoded to ~575 bytes/sec of 16kHz mono FLAC;
// a measured real single-speech recording encoded to ~34,900 bytes/sec —
// roughly 60x apart. This sits well below actual speech and well above
// silence, so it catches a chunk that's near-silent *on average* (a whole
// dead spot between speeches, trailing recording time after everyone's
// stopped talking) without false-positiving on quiet talkers, and skips the
// Groq call for it rather than upload: Whisper (Groq's included) doesn't
// reliably return empty text for near-silent audio — it hallucinates
// plausible-sounding filler instead (a live full-round file came back with
// our own DEBATE_VOCAB_PROMPT text echoed into the transcript for one such
// chunk). This is a whole-chunk average, though, not a scan of the chunk's
// interior — a chunk that's mostly real speech with only a *trailing* few
// seconds of dead air (a full round's last chunk, most likely) won't trip
// it and can still occasionally echo a short hallucinated phrase at the very
// end. An ffmpeg silenceremove pre-pass was tried to trim that dead air
// before chunking and reverted — see splitToFlacChunks's comment — so this
// average-based guard is deliberately the coarser, safer tool: it can only
// ever discard a chunk's worth of near-total silence, never mangle real
// speech.
const MIN_SPEECH_BYTES_PER_SEC = 3000;

// Whisper's optional `prompt` field biases the decoder toward spellings/
// vocabulary it contains — matched against words, not used as a strict
// keyword list, so (per Whisper's own prompting guidance) a natural passage
// using the terms outperforms a bare comma list. This is PF debate jargon
// (see CROSS.md's "local transcription model doesn't know debate jargon"
// note — the same mishears, aff/neg, clog/clock, apply on the Groq tier at
// real spreading speed, just less often than on the local model) so fast,
// technical rounds are more likely to resolve to the right term instead of
// the nearest generic-sounding word. Keep this under ~200 words — Whisper
// only reads the last ~224 tokens of the prompt.
const DEBATE_VOCAB_PROMPT =
  "Public Forum debate round. Pro and Con sides argue the resolution across " +
  "Constructive, Rebuttal, Summary, and Final Focus speeches, with first, " +
  "second, and grand crossfire between them. Debaters extend contentions, " +
  "weigh impacts by magnitude, probability, timeframe, scope, and " +
  "reversibility, and must collapse to their strongest argument and " +
  "crystallize the round for the judge. Progressive rounds add theory " +
  "shells, kritik link and alternative, and framework clash alongside " +
  "topicality, counterplans, disads, solvency, and uniqueness. Debaters " +
  "frontline attacks, signpost on-case and off-case, and cite cards and " +
  "evidence while flowing. Judges rule lay, flow, or tech; prep time and " +
  "speaker points round out the round.";

export function hasGroqCredentials() {
  return Boolean(process.env.GROQ_API_KEY);
}

async function uploadChunk(bytes, ext) {
  const model = process.env.GROQ_WHISPER_MODEL || "whisper-large-v3";
  const form = new FormData();
  // response_format defaults to "json" -> { text }; that's all we need.
  form.append("file", new Blob([bytes]), `audio.${ext}`);
  form.append("model", model);
  form.append("prompt", DEBATE_VOCAB_PROMPT);

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
  return (text ?? "").trim();
}

/**
 * Transcribes an audio buffer of any ffmpeg-readable format via Groq's
 * hosted whisper-large-v3. Returns { text } — no tone data (Hume-only).
 * Throws on non-2xx responses or network errors (callers fall back).
 *
 * `ext` (no leading dot, e.g. "m4a") should be the upload's original
 * extension when known — sending the compressed original straight through
 * keeps the request small. Without one, or when it's a format Groq doesn't
 * accept natively, the buffer is re-encoded to FLAC first. Re-encoding
 * everything to WAV here (as earlier versions did) inflates a multi-minute
 * recording to 3-4x its compressed size and reliably tripped Groq's
 * 25MB/100MB request-size limit on full-round-length uploads.
 *
 * A recording that's still too big after that (a real full round can run
 * 30-60+ minutes) gets split into fixed-length chunks and transcribed
 * sequentially, then stitched back into one transcript — see
 * splitToFlacChunks's comment on the word-boundary tradeoff this makes.
 */
export async function transcribeWithGroq(buffer, { ext } = {}) {
  const normalizedExt = ext?.toLowerCase().replace(/^\./, "");
  const send = GROQ_NATIVE_EXTS.has(normalizedExt)
    ? { bytes: buffer, ext: normalizedExt }
    : { bytes: await convertToFlac(buffer), ext: "flac" };

  if (send.bytes.length <= MAX_UPLOAD_BYTES) {
    return { text: await uploadChunk(send.bytes, send.ext) };
  }

  const chunkSeconds = Math.max(60, Math.floor((MAX_UPLOAD_BYTES * 0.8) / ASSUMED_BYTES_PER_SEC));
  const chunks = await splitToFlacChunks(buffer, chunkSeconds);
  const texts = [];
  for (const chunk of chunks) {
    if (chunk.durationSec > 0 && chunk.bytes.length / chunk.durationSec < MIN_SPEECH_BYTES_PER_SEC) {
      continue; // near-silent chunk — see MIN_SPEECH_BYTES_PER_SEC
    }
    texts.push(await uploadChunk(chunk.bytes, "flac"));
  }
  return { text: texts.filter(Boolean).join(" ").trim() };
}
