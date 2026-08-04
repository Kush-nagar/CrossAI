#!/usr/bin/env node
// One-off long-form transcription: converts an audio/video file to a text
// transcript using the same local ffmpeg + Whisper stack as lib/transcribe.mjs,
// but with long-form chunking so multi-minute/hour files don't OOM.
//
// Usage:
//   node scripts/transcribe-file.mjs <input> [outputPath]
//
// Writes plain UTF-8 text (no frontmatter) so it can be dropped into incoming/
// and picked up by `npm run ingest`.

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import ffmpegPath from "ffmpeg-static";
import wavefilePkg from "wavefile";
const { WaveFile } = wavefilePkg;
import { pipeline } from "@huggingface/transformers";

const MODEL_ID = "Xenova/whisper-medium.en"; // keep in sync with lib/transcribe.mjs

function log(...args) {
  console.error(...args); // stderr so stdout stays clean if piped
}

// Decode input to a 16kHz mono WAV file on disk (bounded memory vs. buffering).
function convertToWavFile(inputPath, outPath) {
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn(ffmpegPath, [
      "-i", inputPath,
      "-ar", "16000",
      "-ac", "1",
      "-f", "wav",
      "-loglevel", "error",
      "-y",
      outPath,
    ]);
    let stderr = "";
    ffmpeg.stderr.on("data", (c) => (stderr += c));
    ffmpeg.on("error", reject);
    ffmpeg.on("close", (code) =>
      code === 0 ? resolve(outPath) : reject(new Error(`ffmpeg exited ${code}: ${stderr.trim()}`))
    );
  });
}

function wavToFloat32(wavBuffer) {
  const wav = new WaveFile(wavBuffer);
  wav.toBitDepth("32f");
  const samples = wav.getSamples(false, Float32Array);
  return Array.isArray(samples) ? samples[0] : samples;
}

async function main() {
  const [input, outArg] = process.argv.slice(2);
  if (!input) {
    log("Usage: node scripts/transcribe-file.mjs <input> [outputPath]");
    process.exitCode = 1;
    return;
  }
  const inputPath = path.resolve(input);
  const outPath = outArg
    ? path.resolve(outArg)
    : path.join(path.dirname(inputPath), path.parse(inputPath).name + ".txt");

  const tmpWav = path.join(os.tmpdir(), `transcribe-${path.parse(inputPath).name}.wav`);

  log(`Decoding ${inputPath} -> ${tmpWav} ...`);
  await convertToWavFile(inputPath, tmpWav);

  log("Loading WAV samples ...");
  const wavBuffer = await fs.readFile(tmpWav);
  const audioData = wavToFloat32(wavBuffer);
  const durationSec = audioData.length / 16000;
  log(`Audio length: ${(durationSec / 60).toFixed(1)} min (${audioData.length} samples)`);

  log(`Loading model ${MODEL_ID} (downloads once, then cached) ...`);
  const transcriber = await pipeline("automatic-speech-recognition", MODEL_ID);

  log("Transcribing (chunked long-form) ...");
  const output = await transcriber(audioData, {
    chunk_length_s: 30,
    stride_length_s: 5,
  });
  const text = (output.text ?? "").trim();

  await fs.writeFile(outPath, text + "\n", "utf8");
  await fs.rm(tmpWav, { force: true });
  log(`Wrote ${outPath} (${text.length} chars)`);
}

main().catch((err) => {
  log(err);
  process.exitCode = 1;
});
