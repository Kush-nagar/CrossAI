// Empathic text-to-speech via Hume's Octave TTS — the drill tool's "deliver
// it out loud" engine. Octave is prompt-steerable: each utterance carries a
// short natural-language acting instruction ("calm and surgical, emphasize
// signposts"), so delivery sounds like a debater working a round rather than
// flat TTS. See humeVoice.mjs for the companion STT/prosody module; both are
// optional at runtime and gated on HUME_API_KEY.
//
// SDK surface verified against the installed hume@0.16.0 typings
// (node_modules/hume/dist/cjs/api/resources/tts/): client.tts.synthesizeJson
// takes { utterances: [{ text, description?, voice? }], format, context? }
// and returns { generations: [{ audio: <base64>, generationId, ... }] }.

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { deliveryActingDirectives } from "./speechCriteria.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..");
// Written by scripts/ingest-voice.mjs (or by hand) when a custom Hume voice
// exists for the "sound like a debater" training corpus. Gitignored.
const VOICE_PROFILE_PATH = path.join(ROOT, "speech-training", "voice-profile.json");

// Hume caps the combined utterance text per request; stay well under it and
// chunk long speeches at sentence boundaries, chaining requests together with
// `context.generationId` so prosody stays continuous across chunks.
const MAX_REQUEST_CHARS = 2500;
const MAX_UTTERANCE_CHARS = 600;
// Anything longer than this isn't a speech, it's a document — refuse early
// rather than burn minutes of synthesis.
export const MAX_TTS_TEXT_CHARS = 20000;

// A preset from Hume's Voice Library (provider HUME_AI). If the library ever
// renames it, synthesizeSpeech falls back to dynamic voice generation below
// instead of failing the request.
const DEFAULT_LIBRARY_VOICE = "Male English Actor";
// Used only on the voiceless fallback path, where the description doubles as
// the voice-design prompt (Octave generates a novel voice from it).
const DYNAMIC_VOICE_PROMPT =
  "A sharp varsity debate competitor in their late teens: clear, articulate, quick but never slurred.";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class HumeTtsError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "HumeTtsError";
    this.status = status;
  }
}

export function isHumeTtsAvailable() {
  return Boolean(process.env.HUME_API_KEY);
}

async function readClonedVoice() {
  try {
    const profile = JSON.parse(await fs.readFile(VOICE_PROFILE_PATH, "utf8"));
    if (profile && typeof profile.voiceId === "string" && profile.voiceId.trim()) {
      return { voiceId: profile.voiceId.trim(), name: profile.name || null };
    }
  } catch {
    // no profile — fall through
  }
  return null;
}

// A voice string (API arg or HUME_TTS_VOICE) can be a voice id (UUID → the
// caller's own custom voice) or a name (assumed to be a Hume Voice Library
// preset — custom voices are addressed by id here).
function voiceSpecFromString(value) {
  const v = value.trim();
  return UUID_RE.test(v) ? { id: v, provider: "CUSTOM_VOICE" } : { name: v, provider: "HUME_AI" };
}

/**
 * Resolution order: explicit arg → cloned voice in
 * speech-training/voice-profile.json → HUME_TTS_VOICE env → default library
 * voice. Returns { spec, source, label } — source "default" marks the one
 * case where a failed lookup silently falls back to dynamic generation.
 */
export async function resolveVoice(explicit) {
  if (typeof explicit === "string" && explicit.trim()) {
    return { spec: voiceSpecFromString(explicit), source: "explicit", label: explicit.trim() };
  }
  const cloned = await readClonedVoice();
  if (cloned) {
    return {
      spec: { id: cloned.voiceId, provider: "CUSTOM_VOICE" },
      source: "cloned",
      label: cloned.name || cloned.voiceId,
    };
  }
  if (process.env.HUME_TTS_VOICE?.trim()) {
    return { spec: voiceSpecFromString(process.env.HUME_TTS_VOICE), source: "env", label: process.env.HUME_TTS_VOICE.trim() };
  }
  return { spec: { name: DEFAULT_LIBRARY_VOICE, provider: "HUME_AI" }, source: "default", label: DEFAULT_LIBRARY_VOICE };
}

// --- Acting instructions --------------------------------------------------
// Octave's per-utterance `description` field wants concise natural-language
// delivery direction (~100 chars). The base register is competitive-debate
// delivery; when the opponent's Hume prosody data is available (speech-to-
// speech mode), the register adapts empathically to how THEY sounded.

// Buckets over Hume's prosody emotion names (48 dims). Matching is
// substring-based so close variants ("Anger" / "Angry") still land.
const AGGRESSIVE_TONES = ["anger", "contempt", "disgust", "determination", "pride", "triumph"];
const UNCERTAIN_TONES = ["anxiety", "doubt", "confusion", "awkwardness", "distress", "fear", "embarrassment", "shame"];
const FLAT_TONES = ["boredom", "tiredness", "calmness", "contemplation"];

function toneBucket(toneTop) {
  if (!Array.isArray(toneTop) || toneTop.length === 0) return null;
  const scores = { aggressive: 0, uncertain: 0, flat: 0 };
  for (const t of toneTop) {
    const name = String(t?.name ?? "").toLowerCase();
    const score = Number(t?.score) || 0;
    if (AGGRESSIVE_TONES.some((a) => name.includes(a))) scores.aggressive += score;
    else if (UNCERTAIN_TONES.some((u) => name.includes(u))) scores.uncertain += score;
    else if (FLAT_TONES.some((f) => name.includes(f))) scores.flat += score;
  }
  const best = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
  return best[1] > 0 ? best[0] : null;
}

/**
 * Derives the acting instruction passed to Octave. `opponentToneTop` is the
 * opponent's aggregate Hume prosody top-scores array ([{name, score}]) when
 * this synthesis is a rebuttal to a recorded speech; the delivery adapts
 * empathically — calm and surgical against aggression, confident emphasis
 * where the opponent sounded unsure.
 */
export function deriveActingInstructions({ speechType, opponentToneTop } = {}) {
  const slot = String(speechType ?? "").toLowerCase();
  let base;
  if (/final focus|2ar|2nr|pmr|lor/.test(slot)) {
    base = "Closing debate speech: measured pace, earnest conviction, deliberate weight on each voter.";
  } else if (/summary|rebuttal|1ar|2ac|block/.test(slot)) {
    base = "Fast confident debate rebuttal: brisk but crisp, punchy emphasis on signposts and numbers.";
  } else {
    base = "Confident varsity debater: clear brisk pace, crisp emphasis on signposts, controlled intensity.";
  }

  // The register — either the slot's default or the empathic adaptation to how
  // the opponent sounded — carries the same delivery qualities the grader
  // scores (emphasis on weighing/voters, no monotone, back-half energy) so the
  // voice models what a graded speech should sound like, varied by slot.
  const directives = deliveryActingDirectives(speechType);
  const bucket = toneBucket(opponentToneTop);
  if (bucket === "aggressive") {
    base = "Calm, surgical debate rebuttal: unhurried, precise, cool contrast to a heated opponent.";
  } else if (bucket === "uncertain") {
    base = "Assured debate rebuttal: steady and warm, confident emphasis wherever you press their claims.";
  } else if (bucket === "flat") {
    base = "Energetic debate speech: urgent, engaged, vary pitch to command attention, never monotone.";
  }
  return `${base} ${directives}`;
}

// --- Text chunking --------------------------------------------------------

// Splits at sentence boundaries into utterances (≤ MAX_UTTERANCE_CHARS),
// then groups utterances into request batches (≤ MAX_REQUEST_CHARS each).
export function chunkForSynthesis(text) {
  const clean = String(text).replace(/\s+/g, " ").trim();
  const sentences = clean.match(/[^.!?]+[.!?]+(?:["')\]]+)?\s*|[^.!?]+$/g) ?? [clean];

  const utterances = [];
  let current = "";
  for (const raw of sentences) {
    const sentence = raw.trim();
    if (!sentence) continue;
    if (current && current.length + sentence.length + 1 > MAX_UTTERANCE_CHARS) {
      utterances.push(current);
      current = sentence;
    } else {
      current = current ? `${current} ${sentence}` : sentence;
    }
    // A single sentence longer than the cap gets hard-split on commas/spaces.
    while (current.length > MAX_UTTERANCE_CHARS) {
      let cut = current.lastIndexOf(", ", MAX_UTTERANCE_CHARS);
      if (cut < MAX_UTTERANCE_CHARS / 2) cut = current.lastIndexOf(" ", MAX_UTTERANCE_CHARS);
      if (cut <= 0) cut = MAX_UTTERANCE_CHARS;
      utterances.push(current.slice(0, cut + 1).trim());
      current = current.slice(cut + 1).trim();
    }
  }
  if (current) utterances.push(current);

  const batches = [];
  let batch = [];
  let batchChars = 0;
  for (const u of utterances) {
    if (batch.length > 0 && batchChars + u.length > MAX_REQUEST_CHARS) {
      batches.push(batch);
      batch = [];
      batchChars = 0;
    }
    batch.push(u);
    batchChars += u.length;
  }
  if (batch.length > 0) batches.push(batch);
  return batches;
}

// --- Synthesis ------------------------------------------------------------

function ttsErrorFrom(err) {
  const status = err?.statusCode ?? err?.status;
  // Hume's error body carries a human-readable message ("Exhausted credit
  // balance. Visit platform.hume.ai/billing…") — surface that, not the SDK's
  // raw "Status code: 400\nBody: {…}" dump.
  let detail = typeof err?.body?.message === "string" && err.body.message.trim() ? err.body.message.trim() : null;
  if (!detail && typeof err?.body === "string") {
    try {
      const parsed = JSON.parse(err.body);
      if (typeof parsed?.message === "string") detail = parsed.message;
    } catch {
      // not JSON — fall through
    }
  }
  if (!detail) detail = typeof err?.message === "string" ? err.message : String(err);
  return new HumeTtsError(`Hume TTS failed: ${detail}`, typeof status === "number" && status >= 400 ? status : 502);
}

// The SDK's default retry policy can spend 90+ seconds re-trying a request
// that will never succeed (e.g. an exhausted-credits 400) — long enough that
// the dev proxy resets the socket before the real error ever surfaces. Fail
// fast instead; multi-batch synthesis makes slow retries extra costly.
const REQUEST_OPTS = { maxRetries: 1, timeoutInSeconds: 120 };

/**
 * Synthesizes a full speech to MP3. Long texts are chunked at sentence
 * boundaries and the chunks chained via context.generationId so prosody stays
 * continuous; the returned buffer is the concatenated MP3 stream (browsers
 * play frame-concatenated MP3 fine).
 *
 * @param {object} opts
 * @param {string} opts.text              speech text (plain spoken prose)
 * @param {string} [opts.actingInstructions] Octave delivery direction; derived
 *   via deriveActingInstructions when omitted
 * @param {string} [opts.voice]           voice name or id — see resolveVoice
 * @returns {Promise<{audio: Buffer, mimeType: string, voice: string, voiceSource: string, actingInstructions: string}>}
 */
export async function synthesizeSpeech({ text, actingInstructions, voice } = {}) {
  if (!isHumeTtsAvailable()) {
    throw new HumeTtsError("Spoken delivery is not configured on this server (no HUME_API_KEY).", 503);
  }
  const speech = String(text ?? "").trim();
  if (!speech) throw new HumeTtsError("No speech text to synthesize.", 400);
  if (speech.length > MAX_TTS_TEXT_CHARS) {
    throw new HumeTtsError(
      `That text is too long to deliver aloud (about ${Math.round(speech.length / 1000)}k characters; ` +
        `the cap is ${Math.round(MAX_TTS_TEXT_CHARS / 1000)}k). Split it into speeches.`,
      413
    );
  }

  const instructions = (actingInstructions ?? "").trim() || deriveActingInstructions({});
  let resolved = await resolveVoice(voice);
  const batches = chunkForSynthesis(speech);

  const { HumeClient } = await import("hume");
  const client = new HumeClient({ apiKey: process.env.HUME_API_KEY });

  const buffers = [];
  let generationId = null;
  let dynamicVoice = false; // fell back to voiceless dynamic generation

  for (const batch of batches) {
    const utterances = batch.map((u, i) => ({
      text: u,
      // Acting direction on every utterance keeps delivery on-register across
      // Octave's own splitting. On the dynamic-voice path the description
      // doubles as the voice-design prompt, so it carries the voice too.
      description: dynamicVoice ? `${DYNAMIC_VOICE_PROMPT} ${instructions}` : instructions,
      // Voice persists "for this and all subsequent utterances" within a
      // request — set it once per request.
      ...(i === 0 && !dynamicVoice ? { voice: resolved.spec } : {}),
    }));

    const request = {
      utterances,
      format: { type: "mp3" },
      numGenerations: 1,
      ...(generationId ? { context: { generationId } } : {}),
    };

    let response;
    try {
      response = await client.tts.synthesizeJson(request, REQUEST_OPTS);
    } catch (err) {
      const status = err?.statusCode ?? err?.status;
      // Only the built-in default voice gets a silent fallback: if the
      // library preset is missing/renamed, regenerate voicelessly (Octave
      // designs a voice from the description) rather than failing the drill.
      if (resolved.source === "default" && !dynamicVoice && typeof status === "number" && status >= 400 && status < 500) {
        console.warn(`[tts] default library voice "${resolved.label}" rejected (${status}) — falling back to dynamic voice generation`);
        dynamicVoice = true;
        generationId = null;
        buffers.length = 0;
        resolved = { ...resolved, label: "dynamic (generated from prompt)" };
        try {
          response = await client.tts.synthesizeJson(
            {
              utterances: batch.map((u) => ({ text: u, description: `${DYNAMIC_VOICE_PROMPT} ${instructions}` })),
              format: { type: "mp3" },
              numGenerations: 1,
            },
            REQUEST_OPTS
          );
        } catch (err2) {
          throw ttsErrorFrom(err2);
        }
      } else {
        throw ttsErrorFrom(err);
      }
    }

    const generation = response?.generations?.[0];
    if (!generation?.audio) throw new HumeTtsError("Hume TTS returned no audio.", 502);
    buffers.push(Buffer.from(generation.audio, "base64"));
    generationId = generation.generationId ?? generationId;
  }

  return {
    audio: Buffer.concat(buffers),
    mimeType: "audio/mpeg",
    voice: resolved.label,
    voiceSource: dynamicVoice ? "dynamic" : resolved.source,
    actingInstructions: instructions,
  };
}
