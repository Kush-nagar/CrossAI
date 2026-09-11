#!/usr/bin/env node
// Ingests VIDEO (or audio) recordings of debaters from speech-training/incoming/
// into (a) a delivery/style profile the model writes speeches in
// (training-data/reference/speech-style-profile.md — reference/ is CORE_DIRS,
// always inlined into prompts), (b) full cleaned transcripts under
// training-data/speech-exemplars/ for retrieval mode, and (c) a clean 30-90s
// audio sample per recording for voice cloning.
//
// Usage:
//   npm run ingest:voice                 process everything new in speech-training/incoming/
//   npm run ingest:voice -- --label "Ben — 2024 TOC finals"   label this batch in the style profile
//
// Pipeline per file: extract audio (ffmpeg) → transcribe via the existing
// stt.mjs tiers (Groq Whisper → Hume EVI with prosody → local Whisper) →
// model-synthesize/merge the style profile (Nemotron via aiClient) → move the
// original to speech-training/processed/, tracked by content hash in
// scripts/voice-manifest.json (mirrors scripts/ingest.mjs's manifest pattern).
//
// Voice cloning: the installed Hume SDK (0.16) creates custom voices only
// from a prior TTS generationId (client.tts.voices.create), NOT from uploaded
// audio — so cloning is skipped with a log line and the clean sample is saved
// for manual cloning in Hume's web app. See speech-training/README.md.

import fs from "node:fs/promises";
import fssync from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { transcribeAudio } from "./lib/stt.mjs";
import { cleanupTranscript } from "./lib/transcriptCleanup.mjs";
import { completeText, hasCredentials, missingCredentialsError } from "./lib/aiClient.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const INCOMING = path.join(ROOT, "speech-training", "incoming");
const PROCESSED = path.join(ROOT, "speech-training", "processed");
const SAMPLES = path.join(ROOT, "speech-training", "samples");
const MANIFEST_PATH = path.join(__dirname, "voice-manifest.json");
const STYLE_PROFILE_PATH = path.join(ROOT, "training-data", "reference", "speech-style-profile.md");
const EXEMPLARS_DIR = path.join(ROOT, "training-data", "speech-exemplars");

const MEDIA_EXTENSIONS = new Set([".mp4", ".mov", ".webm", ".mkv", ".avi", ".m4a", ".mp3", ".wav", ".aac", ".ogg"]);
// Transcript text budget for the style-synthesis prompt.
const MAX_STYLE_TRANSCRIPT_CHARS = 60000;

const STYLE_PROFILE_MODEL = process.env.STYLE_PROFILE_MODEL || "opus";

function parseArgs(argv) {
  const args = { label: "" };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--label") args.label = argv[++i] ?? "";
  }
  return args;
}

// --- ffmpeg ---------------------------------------------------------------
// Prefer the bundled ffmpeg-static binary (already a dependency, used by
// lib/transcribe.mjs); fall back to a system `ffmpeg` on PATH. If neither
// runs, fail with install instructions instead of a raw ENOENT.

async function resolveFfmpeg() {
  try {
    const { default: ffmpegPath } = await import("ffmpeg-static");
    if (ffmpegPath && fssync.existsSync(ffmpegPath)) return ffmpegPath;
  } catch {
    // ffmpeg-static unavailable on this platform — try PATH
  }
  return "ffmpeg";
}

function runFfmpeg(ffmpegBin, args) {
  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpegBin, args);
    const chunks = [];
    let stderr = "";
    proc.stdout.on("data", (c) => chunks.push(c));
    proc.stderr.on("data", (c) => (stderr += c));
    proc.on("error", (err) => {
      if (err.code === "ENOENT") {
        reject(
          new Error(
            "ffmpeg was not found. Install it and re-run — on Windows:\n" +
              "  winget install Gyan.FFmpeg\n" +
              "then restart your terminal so `ffmpeg` is on PATH. (The bundled ffmpeg-static binary was also unavailable.)"
          )
        );
      } else reject(err);
    });
    proc.on("close", (code) => {
      if (code === 0) resolve({ stdout: Buffer.concat(chunks), stderr });
      else reject(new Error(`ffmpeg exited with code ${code}: ${stderr.trim().slice(-2000)}`));
    });
  });
}

// "Duration: 00:41:23.52" from ffmpeg's stderr banner.
function parseDurationSec(stderr) {
  const m = /Duration:\s*(\d+):(\d\d):(\d\d(?:\.\d+)?)/.exec(stderr);
  if (!m) return 0;
  return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
}

// Strip the video track, downmix to 16kHz mono MP3 — small enough to buffer,
// and every stt.mjs tier accepts it.
async function extractAudio(ffmpegBin, filePath) {
  const { stdout, stderr } = await runFfmpeg(ffmpegBin, [
    "-i", filePath,
    "-vn", "-ac", "1", "-ar", "16000", "-b:a", "64k",
    "-f", "mp3", "-loglevel", "info", "-hide_banner",
    "pipe:1",
  ]);
  return { audio: stdout, durationSec: parseDurationSec(stderr) };
}

// A clean 30-90s slice for voice cloning: skip the first ~30s (intros, mic
// fumbling) when the recording is long enough to afford it.
async function extractCloneSample(ffmpegBin, filePath, durationSec, outPath) {
  const start = durationSec > 150 ? 30 : 0;
  const length = Math.min(90, Math.max(30, Math.floor(durationSec - start)));
  if (length < 10) return null; // too short to be a useful sample
  await runFfmpeg(ffmpegBin, [
    "-ss", String(start), "-t", String(length),
    "-i", filePath,
    "-vn", "-ac", "1", "-ar", "24000", "-b:a", "96k",
    "-f", "mp3", "-loglevel", "error", "-hide_banner",
    outPath,
  ]);
  return { outPath, start, length };
}

// --- manifest (mirrors scripts/ingest.mjs) --------------------------------

async function loadManifest() {
  try {
    return JSON.parse(await fs.readFile(MANIFEST_PATH, "utf8"));
  } catch {
    return { processed: {} };
  }
}

async function saveManifest(manifest) {
  await fs.writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + "\n", "utf8");
}

function hashOf(buf) {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

function slugify(title) {
  return (
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "untitled"
  );
}

// --- voice cloning (graceful skip) ----------------------------------------

async function maybeCloneVoice(sample) {
  // hume@0.16.0's TTS voices API is create({ generationId, name }) — a saved
  // voice must come from a prior TTS generation; there is no clone-from-audio
  // endpoint in this SDK version. Skip rather than fail, and keep the sample
  // for manual cloning (README documents the flow + voice-profile.json shape).
  if (!process.env.HUME_API_KEY) {
    console.log("  [voice] HUME_API_KEY not set — skipping voice cloning.");
    return;
  }
  console.log(
    "  [voice] Hume SDK 0.16 can't create a custom voice from uploaded audio (voices.create needs a TTS generationId) — " +
      "skipping automatic cloning." +
      (sample
        ? ` Clean sample saved at ${path.relative(ROOT, sample.outPath)} — clone it at app.hume.ai and paste the id into speech-training/voice-profile.json.`
        : "")
  );
}

// --- style profile --------------------------------------------------------

function toneSummaryLines(tone) {
  if (!tone) return "";
  let out = `Whole-recording vocal tone (Hume prosody, 0-1): ${tone.top.map((t) => `${t.name} ${t.score}`).join(", ")}\n`;
  const segments = Array.isArray(tone.segments) ? tone.segments.slice(0, 40) : [];
  if (segments.length > 0) {
    out += "Per-utterance tone (text → top prosody scores):\n";
    for (const s of segments) {
      out += `- "${s.text.slice(0, 120)}" → ${s.top.map((t) => `${t.name} ${t.score}`).join(", ")}\n`;
    }
  }
  return out;
}

async function synthesizeStyleProfile({ recordings, label }) {
  let existing = "";
  try {
    existing = await fs.readFile(STYLE_PROFILE_PATH, "utf8");
  } catch {
    // first run — no profile yet
  }

  let budget = MAX_STYLE_TRANSCRIPT_CHARS;
  const sections = [];
  for (const r of recordings) {
    const excerpt = r.transcript.slice(0, Math.max(2000, Math.floor(budget / recordings.length)));
    budget -= excerpt.length;
    sections.push(
      `### Recording: ${r.title}\n` +
        `Duration: ${Math.round(r.durationSec)}s · measured pace: ${r.wpm} WPM · transcription: ${r.engine}\n` +
        (r.tone ? toneSummaryLines(r.tone) : "No vocal-tone data (non-Hume transcription tier).\n") +
        `Transcript${r.transcript.length > excerpt.length ? " (excerpt)" : ""}:\n${excerpt}`
    );
  }

  const system =
    "You are a competitive-debate delivery analyst. You distill how a specific debater actually writes and " +
    "delivers speeches from transcripts, measured pace, and vocal-tone (prosody) data, producing a style profile " +
    "another AI will follow when WRITING and DELIVERING speeches in this debater's voice.";

  const prompt =
    (existing
      ? `An existing style profile is below. MERGE the new recordings into it: keep everything still supported, ` +
        `refine or generalize where the new material adds evidence, and add what's new. Output the complete ` +
        `updated profile, not a diff.\n\n--- EXISTING PROFILE ---\n${existing.slice(0, 20000)}\n--- END EXISTING ---\n\n`
      : "") +
    `New recordings${label ? ` (batch label: ${label})` : ""}:\n\n${sections.join("\n\n")}\n\n` +
    `Write a markdown style profile titled "# Speech Style Profile" with exactly these sections:\n` +
    `## Diction & vocabulary — characteristic word choices, jargon density, sentence length and rhythm\n` +
    `## Pacing & rhythm — measured WPM, where they speed up/slow down, pause habits\n` +
    `## Signposting habits — the literal transition phrases and numbering patterns they use\n` +
    `## Argument structure — how they build and order arguments (claim/warrant/impact patterns, weighing placement, collapse habits)\n` +
    `## Emotional register — tone arc across a speech, intensity control, where conviction/urgency/calm land (ground this in the prosody data when present)\n` +
    `## Catchphrases & verbal signatures — recurring phrases, openers, closers, verbal tics worth keeping (not transcription noise)\n` +
    `## How to WRITE in this style — 5-10 imperative instructions for drafting a speech in this voice\n` +
    `## How to DELIVER in this style — 3-6 short acting-instruction-style delivery directions (pace, emphasis, intensity) suitable for guiding a TTS voice\n\n` +
    `Rules: every claim must be grounded in the transcripts/tone data (quote a short phrase as evidence where useful); ` +
    `describe patterns, never reproduce long transcript passages; if recordings disagree, describe the range. ` +
    `Output ONLY the markdown document.`;

  const profile = await completeText({ system, prompt, maxTokens: 8000, model: STYLE_PROFILE_MODEL });
  await fs.mkdir(path.dirname(STYLE_PROFILE_PATH), { recursive: true });
  await fs.writeFile(STYLE_PROFILE_PATH, profile.trim() + "\n", "utf8");
  return STYLE_PROFILE_PATH;
}

// --- exemplar transcripts -------------------------------------------------

async function writeExemplar(r) {
  await fs.mkdir(EXEMPLARS_DIR, { recursive: true });
  let outPath = path.join(EXEMPLARS_DIR, `${slugify(r.title)}.md`);
  let n = 2;
  while (fssync.existsSync(outPath)) {
    outPath = path.join(EXEMPLARS_DIR, `${slugify(r.title)}-${n}.md`);
    n++;
  }
  const frontmatter = [
    "---",
    `title: ${r.title}`,
    `source: ${r.sourceName}`,
    `category: speech-exemplars`,
    `ingested: ${new Date().toISOString()}`,
    `tags: [speech-exemplar, delivery-style]`,
    `durationSec: ${Math.round(r.durationSec)}`,
    `wpm: ${r.wpm}`,
    `transcription: ${r.engine}`,
    ...(r.tone ? [`topTone: ${r.tone.top.map((t) => t.name).join(", ")}`] : []),
    "---",
    "",
    "",
  ].join("\n");
  await fs.writeFile(outPath, frontmatter + r.transcript.trim() + "\n", "utf8");
  return outPath;
}

// --- main -----------------------------------------------------------------

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!hasCredentials()) {
    // Transcription alone could run without NVIDIA, but the whole point is
    // the style profile — fail fast with the same message the server uses.
    console.error(missingCredentialsError());
    process.exitCode = 1;
    return;
  }

  await fs.mkdir(INCOMING, { recursive: true });
  await fs.mkdir(PROCESSED, { recursive: true });
  await fs.mkdir(SAMPLES, { recursive: true });
  const manifest = await loadManifest();
  const ffmpegBin = await resolveFfmpeg();

  const entries = (await fs.readdir(INCOMING, { withFileTypes: true })).filter(
    (e) => e.isFile() && !e.name.startsWith(".") && MEDIA_EXTENSIONS.has(path.extname(e.name).toLowerCase())
  );
  if (entries.length === 0) {
    console.log("No new recordings in speech-training/incoming/. Drop video (mp4/mov/webm/mkv/avi) or audio (m4a/mp3/wav/aac/ogg) files there and re-run.");
    return;
  }

  const recordings = [];
  for (const entry of entries) {
    const filePath = path.join(INCOMING, entry.name);
    const buf = await fs.readFile(filePath);
    const hash = hashOf(buf);
    if (manifest.processed[hash]) {
      console.log(`Skipping ${entry.name} (already ingested as ${manifest.processed[hash]})`);
      continue;
    }

    console.log(`Processing ${entry.name}…`);
    console.log("  [audio] extracting with ffmpeg…");
    const { audio, durationSec } = await extractAudio(ffmpegBin, filePath);
    if (audio.length === 0) {
      console.log(`  Skipping ${entry.name} (no audio track).`);
      continue;
    }

    console.log(`  [stt] transcribing ${Math.round(durationSec)}s of audio (Groq → Hume EVI → local Whisper)…`);
    const { text: rawText, tone } = await transcribeAudio(audio, { ext: "mp3" }); // extractAudio() encodes to mp3
    if (!rawText.trim()) {
      console.log(`  Skipping ${entry.name} (no speech detected).`);
      continue;
    }
    const engine = tone ? "hume-evi (with prosody)" : "groq-or-local-whisper";

    // Best-effort jargon cleanup — never lose a transcript over it.
    let transcript = rawText;
    try {
      transcript = await cleanupTranscript(rawText, { model: process.env.TRANSCRIPT_CLEANUP_MODEL || "sonnet" });
      console.log("  [cleanup] transcript cleanup pass applied.");
    } catch (err) {
      console.warn(`  [cleanup] failed (keeping raw transcript): ${err.message}`);
    }

    const words = transcript.split(/\s+/).filter(Boolean).length;
    const wpm = durationSec > 0 ? Math.round(words / (durationSec / 60)) : 0;
    const title = path.parse(entry.name).name.replace(/[_-]+/g, " ").trim();

    // Clean sample for voice cloning (manual — see maybeCloneVoice).
    let sample = null;
    try {
      sample = await extractCloneSample(ffmpegBin, filePath, durationSec, path.join(SAMPLES, `${slugify(title)}-sample.mp3`));
    } catch (err) {
      console.warn(`  [voice] sample extraction failed (continuing): ${err.message}`);
    }
    await maybeCloneVoice(sample);

    const record = { title, sourceName: entry.name, transcript, tone, durationSec, wpm, engine };
    const exemplarPath = await writeExemplar(record);
    console.log(`  [corpus] transcript saved -> ${path.relative(ROOT, exemplarPath)} (${words} words, ${wpm} WPM)`);

    manifest.processed[hash] = path.relative(ROOT, exemplarPath);
    await fs.rename(filePath, path.join(PROCESSED, entry.name));
    await saveManifest(manifest);
    recordings.push(record);
  }

  if (recordings.length === 0) {
    console.log("Nothing new to ingest.");
    return;
  }

  console.log(`Synthesizing style profile from ${recordings.length} recording(s)…`);
  const profilePath = await synthesizeStyleProfile({ recordings, label: args.label });
  console.log(`Style profile written -> ${path.relative(ROOT, profilePath)} (inlined into every Cross prompt via training-data/reference/).`);

  // Keep the semantic retrieval index in sync — non-fatal, same as ingest.mjs.
  try {
    const { buildIndex, invalidateIndexCache } = await import("./lib/corpusIndex.mjs");
    const { chunks } = await buildIndex();
    invalidateIndexCache();
    console.log(`Semantic index rebuilt (${chunks} chunks).`);
  } catch (err) {
    console.warn(`Semantic index rebuild failed (run "npm run build-index" manually): ${err.message}`);
  }

  console.log(`Done. ${recordings.length} recording(s) ingested.`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
