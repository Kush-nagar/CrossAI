# Deploying Cross online (Render)

Cross is a Node.js web app. Going online = running it on a host that keeps the
server up and gives you a public URL. These steps use **Render**.

## What's already set up for you

- **Public with a usage cap.** Every AI request spends your NVIDIA key, so
  the server enforces two limits (tune them with env vars, no code change):
  - `RATE_LIMIT_PER_MINUTE` — per-visitor requests/min to AI endpoints (default 20)
  - `DAILY_REQUEST_CAP` — total AI requests/day across everyone (default 1000; `0` = off)
- `npm start` runs the web server; `engines` pins Node ≥ 20.6.
- `render.yaml` is a blueprint so Render configures itself.

## One-time deploy

1. Create a free account at <https://render.com> and connect your GitHub.
2. **New → Blueprint**, pick the `felikslin/CrossAI` repo. Render reads
   `render.yaml`.
3. When prompted, paste your **`NVIDIA_API_KEY`** (the same value that's in
   your local `.env` — get one at <https://build.nvidia.com>). It is stored
   encrypted on Render, never in git.
4. Click **Apply / Deploy**. First build takes a few minutes (it installs the
   PDF/audio libraries). When it's live you'll get a URL like
   `https://cross-ai.onrender.com`.

## After it's live

- **Update the app:** push to the `master` branch — Render redeploys automatically.
- **Change the caps:** Render dashboard → your service → *Environment* → edit
  `DAILY_REQUEST_CAP` / `RATE_LIMIT_PER_MINUTE` → save (triggers a restart).
- **Watch spend:** keep an eye on usage at <https://build.nvidia.com>. The
  caps bound requests, not tokens, so start conservative.

## Things to know

- **NVIDIA's free `build.nvidia.com` tier is rate-limited** (order of tens of
  requests/minute — check your own account dashboard for the current number,
  it changes). For production traffic beyond that, point `NVIDIA_BASE_URL` at
  a paid OpenAI-compatible host (OpenRouter, Together, a self-hosted NIM) —
  same client code in `scripts/lib/aiClient.mjs`, no code change needed.
- **Free tier sleeps** after ~15 min idle; the first visit then takes ~30s to
  wake. Upgrade to the **Starter** plan (~$7/mo) to stay always-on.
- **Uploaded files don't persist.** `uploads/`, `generated/`, `case-uploads/`,
  and `voice-profile.json` are written to a disk that resets on every redeploy
  or restart. Chat still works; only saved uploads/voice calibration are lost.
  To keep them, add a Render **Disk** (paid) mounted at the project root, or
  move storage to a service like S3.
- **Speech-to-text keys are optional.** Set `GROQ_API_KEY` (Render dashboard →
  Environment, not `render.yaml` — same as `HUME_API_KEY`) to use Groq's
  hosted `whisper-large-v3` instead of the local model (override the model
  via `GROQ_WHISPER_MODEL`, default `whisper-large-v3`): faster, and it
  eliminates local Whisper's memory usage on the happy path. `HUME_API_KEY`
  is a separate, optional add-on for vocal-tone/prosody analysis. Neither is
  required; without either, audio falls back to the fully local pipeline.
- **Audio transcription is heavy — only when falling back to local Whisper.**
  Whisper runs in-process and can exceed the free tier's memory on large
  files. Setting `GROQ_API_KEY` avoids loading the local model at all on the
  happy path. Core chat is unaffected either way; upgrade the plan if local
  transcription of big files matters.
