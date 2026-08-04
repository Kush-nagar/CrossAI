// Cloud transcription + vocal tone analysis via Hume AI's Empathic Voice
// Interface (EVI). EVI is a live voice-conversation API, but it doubles as a
// transcription+prosody engine: with `pause_assistant_message` sent up front
// it never generates a reply, yet still transcribes every audio_input and
// attaches prosody scores (48 emotion dimensions) to each user_message.
//
// This module is optional at runtime: callers must check hasHumeCredentials()
// (or use lib/stt.mjs, which falls back to local Whisper). Audio sent here
// leaves the machine — see CLAUDE.md's privacy note.

import { convertToWav } from "./transcribe.mjs";

const SAMPLE_RATE = 16000;
const BYTES_PER_SAMPLE = 2; // linear16
const CHUNK_MS = 100; // Hume-recommended buffer window for web apps
const CHUNK_BYTES = (SAMPLE_RATE * BYTES_PER_SAMPLE * CHUNK_MS) / 1000;
const QUIESCENCE_MS = 4000; // no user_message for this long after last chunk => done
// EVI expects near-real-time streaming: an instant burst (and even 4x pacing)
// makes the server silently drop the session with no transcription. 2x
// real-time is verified reliable, so a clip transcribes in ~half its length.
const PACE_MS = CHUNK_MS / 2;

export function hasHumeCredentials() {
  return Boolean(process.env.HUME_API_KEY);
}

function topScores(scores, n) {
  return Object.entries(scores)
    .map(([name, score]) => ({ name, score: Number(score.toFixed(3)) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, n);
}

// Pure: assemble transcript + tone from collected user_message events.
// Split out so it's testable without a key or a socket. `tone.segments`
// preserves the per-utterance resolution (EVI scores each utterance
// separately) so downstream consumers can localize delivery feedback —
// "anxiety spiked during the disad extension" — instead of only seeing
// the whole-speech aggregate in `tone.top` / `tone.prompt`.
export function assembleFromUserMessages(events) {
  const finals = events.filter((e) => e?.message?.content && !e.interim);
  const text = finals.map((e) => e.message.content.trim()).filter(Boolean).join(" ");

  const scoreSums = new Map();
  const segments = [];
  for (const e of finals) {
    const scores = e.models?.prosody?.scores;
    if (!scores) continue;
    for (const [name, value] of Object.entries(scores)) {
      scoreSums.set(name, (scoreSums.get(name) ?? 0) + value);
    }
    segments.push({
      text: e.message.content.trim(),
      // EVI reports the utterance's time interval in ms when available.
      beginMs: e.time?.begin ?? null,
      endMs: e.time?.end ?? null,
      top: topScores(scores, 3),
    });
  }
  if (!text || segments.length === 0) return { text, tone: null };

  const top = [...scoreSums.entries()]
    .map(([name, sum]) => ({ name, score: Number((sum / segments.length).toFixed(3)) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
  const prompt =
    "Vocal tone (auto-analyzed prosody, 0-1 scores): " +
    top.map((t) => `${t.name} ${t.score}`).join(", ");
  return { text, tone: { top, prompt, segments } };
}

/**
 * Transcribes an audio buffer of any ffmpeg-readable format via Hume EVI and
 * analyzes vocal tone. Returns { text, tone } — tone is null when no speech
 * was detected. Throws on connection/timeout errors (callers fall back).
 */
export async function transcribeWithHume(buffer) {
  const { HumeClient } = await import("hume");
  const client = new HumeClient({ apiKey: process.env.HUME_API_KEY });

  const wav = await convertToWav(buffer);
  const pcm = wav.subarray(44); // strip the 44-byte canonical WAV header

  const connectOptions = {};
  if (process.env.HUME_CONFIG_ID) connectOptions.configId = process.env.HUME_CONFIG_ID;
  const socket = client.empathicVoice.chat.connect(connectOptions);

  const events = [];
  let finish;
  let fail;
  const done = new Promise((resolve, reject) => {
    finish = resolve;
    fail = reject;
  });

  let quiescenceTimer = null;
  let streamed = false;
  const armQuiescence = () => {
    if (!streamed) return; // only start counting down once all audio is sent
    clearTimeout(quiescenceTimer);
    quiescenceTimer = setTimeout(finish, QUIESCENCE_MS);
  };
  // Paced sending means wall-clock scales with clip length: allow half the
  // audio duration (2x pacing) plus generous headroom.
  const audioMs = (pcm.length / (SAMPLE_RATE * BYTES_PER_SAMPLE)) * 1000;
  const hardTimeoutMs = Math.max(90000, audioMs / 2 + 30000);
  const hardTimer = setTimeout(
    () => fail(new Error(`Hume EVI transcription timed out after ${hardTimeoutMs}ms`)),
    hardTimeoutMs,
  );

  socket.on("message", (message) => {
    if (process.env.HUME_DEBUG) {
      console.log(`[hume] event: ${message.type}${message.type === "user_message" ? ` interim=${message.interim} content=${JSON.stringify(message.message?.content)}` : ""}`);
    }
    if (message.type === "user_message") {
      events.push(message);
      armQuiescence();
    } else if (message.type === "error") {
      fail(new Error(`Hume EVI error: ${message.message ?? JSON.stringify(message)}`));
    }
  });
  socket.on("error", (err) => fail(err instanceof Error ? err : new Error(String(err))));
  socket.on("close", () => finish()); // server closed first — use what we have

  try {
    await socket.tillSocketOpen();
    // Never respond — transcription + prosody only.
    socket.pauseAssistant({});
    socket.sendSessionSettings({
      audio: { encoding: "linear16", sampleRate: SAMPLE_RATE, channels: 1 },
    });
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    for (let offset = 0; offset < pcm.length; offset += CHUNK_BYTES) {
      socket.sendAudioInput({
        data: pcm.subarray(offset, offset + CHUNK_BYTES).toString("base64"),
      });
      await sleep(PACE_MS);
    }
    // Trailing silence flushes Hume's endpointing so the final utterance is
    // emitted even when the recording stops mid-breath. EVI's VAD needs
    // actual silent *frames* to close the utterance — merely stopping the
    // stream leaves it waiting forever. 0.5s proved too short; send 2s.
    const silence = Buffer.alloc(CHUNK_BYTES).toString("base64");
    for (let i = 0; i < 20; i++) {
      socket.sendAudioInput({ data: silence });
      await sleep(PACE_MS);
    }
    streamed = true;
    armQuiescence();
    await done;
  } finally {
    clearTimeout(quiescenceTimer);
    clearTimeout(hardTimer);
    try {
      socket.close();
    } catch {
      // already closed
    }
  }

  return assembleFromUserMessages(events);
}
