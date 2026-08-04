// Local speech-to-text: converts an uploaded audio buffer (webm/opus, etc.)
// to 16kHz mono WAV via bundled ffmpeg, then runs it through a local Whisper
// model (no external API, no per-use cost — the model downloads once and is
// cached on disk after that).

import { spawn } from "node:child_process";
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
export function convertToWav(buffer) {
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn(ffmpegPath, [
      "-i", "pipe:0",
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
      if (code === 0) resolve(Buffer.concat(chunks));
      else reject(new Error(`ffmpeg exited with code ${code}: ${stderr.trim()}`));
    });

    ffmpeg.stdin.write(buffer);
    ffmpeg.stdin.end();
  });
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
 */
export async function transcribeAudioBuffer(buffer) {
  const wavBuffer = await convertToWav(buffer);
  const audioData = wavToFloat32(wavBuffer);
  const transcriber = await getTranscriber();
  const output = await transcriber(audioData);
  return { text: (output.text ?? "").trim() };
}
