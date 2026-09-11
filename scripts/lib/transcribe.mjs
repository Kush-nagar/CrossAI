// Local speech-to-text: converts an uploaded audio buffer (webm/opus, etc.)
// to 16kHz mono WAV via bundled ffmpeg, then runs it through a local Whisper
// model (no external API, no per-use cost — the model downloads once and is
// cached on disk after that).

import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import ffmpegPath from "ffmpeg-static";
import wavefilePkg from "wavefile";
const { WaveFile } = wavefilePkg;
import { pipeline } from "@huggingface/transformers";

// medium.en over small.en: substantially fewer errors on debate jargon and
// names (the voice-calibration bottleneck), at the cost of a ~1.5GB one-time
// download and slower CPU inference per file.
const MODEL_ID = "Xenova/whisper-medium.en";

let transcriberPromise = null;
function getTranscriber() {
  if (!transcriberPromise) {
    transcriberPromise = pipeline("automatic-speech-recognition", MODEL_ID);
  }
  return transcriberPromise;
}

// Exported for reuse by humeVoice.mjs (EVI wants the same 16kHz mono PCM).
//
// Writes the buffer to a real temp file rather than piping it into ffmpeg's
// stdin. MP4-family containers (.m4a, .mp4, .mov — what phone voice-memo
// apps produce) can put their index (the moov atom) at the END of the file
// instead of the start; demuxing that requires seeking back, which a pipe
// can't do. Fed via pipe:0, ffmpeg fails to find any stream ("Invalid data
// found when processing input") but — for this container family — still
// exits 0 with an empty output, so the failure was previously invisible:
// downstream code got a "successful" WAV with zero samples, and Whisper's
// classic hallucination on silence/empty audio is a single repeated token
// ("you" is the textbook case) — that's what looked like a transcription
// quality problem but was actually silent conversion failure. A real file
// path gives ffmpeg random access so it can find the index wherever it is.
export async function convertToWav(buffer) {
  const tmpIn = path.join(os.tmpdir(), `cross-stt-${crypto.randomUUID()}`);
  await fs.writeFile(tmpIn, buffer);
  try {
    return await new Promise((resolve, reject) => {
      const ffmpeg = spawn(ffmpegPath, [
        "-i", tmpIn,
        "-ar", "16000",
        "-ac", "1",
        "-f", "wav",
        "-loglevel", "error",
        "pipe:1",
      ]);

      const chunks = [];
      let stderr = "";
      ffmpeg.stdout.on("data", (chunk) => chunks.push(chunk));
      ffmpeg.stderr.on("data", (chunk) => (stderr += chunk));
      ffmpeg.on("error", reject);
      ffmpeg.on("close", (code) => {
        const out = Buffer.concat(chunks);
        // A bare WAV header with no sample data (ffmpeg can exit 0 on this
        // for some inputs) means conversion silently failed — surface it as
        // an error instead of letting an empty clip reach Whisper, where it
        // reads as inaudible/hallucinated speech rather than a broken upload.
        if (code === 0 && out.length > 44) resolve(out);
        else reject(new Error(`ffmpeg produced no audio (exit ${code}): ${stderr.trim() || "empty output"}`));
      });
    });
  } finally {
    await fs.rm(tmpIn, { force: true });
  }
}

// Exported for reuse by groqVoice.mjs: a compact, lossless re-encode for
// inputs Groq's API doesn't accept directly (see GROQ_NATIVE_EXTS there).
// FLAC over WAV specifically — WAV is uncompressed PCM, which on a
// multi-minute full-round recording balloons to 3-4x the original file's
// size (a ~30MB compressed m4a round decoded to 16kHz mono WAV came out
// ~109MB) and reliably blows past Groq's 25MB/100MB request-size limits.
// FLAC keeps the same 16kHz mono signal at roughly the original's size.
export async function convertToFlac(buffer) {
  const tmpIn = path.join(os.tmpdir(), `cross-stt-${crypto.randomUUID()}`);
  await fs.writeFile(tmpIn, buffer);
  try {
    return await new Promise((resolve, reject) => {
      const ffmpeg = spawn(ffmpegPath, [
        "-i", tmpIn,
        "-ar", "16000",
        "-ac", "1",
        "-f", "flac",
        "-loglevel", "error",
        "pipe:1",
      ]);

      const chunks = [];
      let stderr = "";
      ffmpeg.stdout.on("data", (chunk) => chunks.push(chunk));
      ffmpeg.stderr.on("data", (chunk) => (stderr += chunk));
      ffmpeg.on("error", reject);
      ffmpeg.on("close", (code) => {
        const out = Buffer.concat(chunks);
        if (code === 0 && out.length > 0) resolve(out);
        else reject(new Error(`ffmpeg produced no audio (exit ${code}): ${stderr.trim() || "empty output"}`));
      });
    });
  } finally {
    await fs.rm(tmpIn, { force: true });
  }
}

// Parses ffmpeg's stderr "Duration: HH:MM:SS.ss" line, printed for any input
// regardless of what the run actually does with it.
function parseDurationSec(stderr) {
  const m = /Duration:\s*(\d+):(\d\d):(\d\d(?:\.\d+)?)/.exec(stderr);
  if (!m) return 0;
  return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
}

// Shared ffmpeg runner for the file-in/file-out passes below (convertToWav
// and convertToFlac pipe through stdout instead, since a single buffer out
// is all they need). Resolves with stderr so callers needing ffmpeg's
// printed metadata (Duration:, etc.) — currently just probeDurationSec —
// don't need a separate invocation.
function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn(ffmpegPath, args);
    let stderr = "";
    ffmpeg.stderr.on("data", (chunk) => (stderr += chunk));
    ffmpeg.on("error", reject);
    ffmpeg.on("close", (code) => {
      if (code === 0) resolve(stderr);
      else reject(new Error(`ffmpeg failed (exit ${code}): ${stderr.trim() || "no output"}`));
    });
  });
}

async function probeDurationSec(filePath) {
  // "-f null -" still prints the input's Duration: line to stderr even
  // though it discards the actual output, and exits 0 doing so — no need
  // for a try/catch dance here.
  const stderr = await runFfmpeg(["-i", filePath, "-f", "null", "-"]);
  return parseDurationSec(stderr);
}

// Exported for reuse by groqVoice.mjs: splits long audio (a full-round
// recording can run 30-60+ minutes) into fixed-length FLAC segments so each
// one clears Groq's per-request size limit on its own. ffmpeg's segment
// muxer cuts on a time boundary, not a word boundary, so a word can land
// split across two chunks — a rare, minor cost next to the alternative
// (falling all the way back to local Whisper for every full-round upload,
// which is the more error-prone tier on exactly this kind of long, fast
// recording).
//
// An earlier version of this function ran audio through ffmpeg's
// `silenceremove` first, to strip trailing dead air before segmenting (aimed
// at Whisper's habit of hallucinating on near-silent audio instead of
// returning empty text). Reverted: on a real recording, a -40dB threshold
// judged ~99% of the file "silence" and gutted it down to 21 seconds — real
// speech, especially from a laptop/phone mic without normalization, routinely
// sits under a fixed dB floor, so a blunt threshold is worse than the problem
// it targets. Chunk-level filtering (MIN_SPEECH_BYTES_PER_SEC in
// groqVoice.mjs, using each chunk's own returned duration below) is the safer
// place for that: it can only skip *sending* a chunk, never delete audio.
//
// Returns each chunk's duration alongside its bytes so a caller can compute
// bytes/sec and skip ones that are near-silent on average — see
// MIN_SPEECH_BYTES_PER_SEC in groqVoice.mjs.
export async function splitToFlacChunks(buffer, chunkSeconds) {
  const tmpIn = path.join(os.tmpdir(), `cross-stt-${crypto.randomUUID()}`);
  const tmpOutDir = path.join(os.tmpdir(), `cross-stt-chunks-${crypto.randomUUID()}`);
  await fs.writeFile(tmpIn, buffer);
  await fs.mkdir(tmpOutDir, { recursive: true });
  try {
    await runFfmpeg([
      "-i", tmpIn,
      "-ar", "16000",
      "-ac", "1",
      "-f", "segment",
      "-segment_time", String(chunkSeconds),
      "-reset_timestamps", "1",
      "-loglevel", "error",
      path.join(tmpOutDir, "chunk%04d.flac"),
    ]);
    const names = (await fs.readdir(tmpOutDir)).sort();
    if (names.length === 0) throw new Error("ffmpeg segmenting produced no chunks");
    const bytes = await Promise.all(names.map((name) => fs.readFile(path.join(tmpOutDir, name))));
    const totalDurationSec = await probeDurationSec(tmpIn);
    const durationsSec = names.map((_, i) =>
      i === names.length - 1
        ? Math.max(0, totalDurationSec - chunkSeconds * (names.length - 1))
        : chunkSeconds,
    );
    return bytes.map((buf, i) => ({ bytes: buf, durationSec: durationsSec[i] }));
  } finally {
    await fs.rm(tmpIn, { force: true });
    await fs.rm(tmpOutDir, { recursive: true, force: true });
  }
}

function wavToFloat32(wavBuffer) {
  const wav = new WaveFile(wavBuffer);
  wav.toBitDepth("32f");
  const samples = wav.getSamples(false, Float32Array);
  return Array.isArray(samples) ? samples[0] : samples; // mono -> single channel array
}

/**
 * Transcribes an audio buffer of any ffmpeg-readable format.
 * Returns { text } — text is "" if no speech was detected.
 *
 * Whisper's encoder has a fixed 30s window: feeding it the whole array in
 * one shot (no chunk_length_s/stride_length_s) silently drops everything
 * past ~30s and, on audio it can't align, tends to hallucinate a single
 * repeated token (classically "you") instead of erroring — which is exactly
 * what a multi-minute or fast-talking (spread) speech looked like before this
 * fix. chunk_length_s/stride_length_s make the pipeline do sliding-window
 * long-form transcription and stitch the pieces back together, same as the
 * one-off scripts/transcribe-file.mjs already did for local files.
 */
export async function transcribeAudioBuffer(buffer) {
  const wavBuffer = await convertToWav(buffer);
  const audioData = wavToFloat32(wavBuffer);
  const transcriber = await getTranscriber();
  const output = await transcriber(audioData, {
    chunk_length_s: 30,
    stride_length_s: 5,
  });
  return { text: (output.text ?? "").trim() };
}
