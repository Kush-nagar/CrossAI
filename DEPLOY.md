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
3. When prompted, paste the secrets Render asks for. All are stored encrypted
   on Render, never in git:
   - **`NVIDIA_API_KEY`** — same value as your local `.env` (<https://build.nvidia.com>)
   - **`SUPABASE_URL`**, **`SUPABASE_SERVICE_ROLE_KEY`**, **`SUPABASE_ANON_KEY`** —
     accounts + sessions live here, so the server won't boot without them
   - **`TOKEN_ENC_KEY`** — `openssl rand -hex 32`. Use the *same* value as
     local only if you want existing Tabroom links to keep working; changing
     it just makes users re-link.
   - **`PUBLIC_BASE_URL`** — your Render URL, e.g. `https://cross-ai.onrender.com`.
     You won't know it until after the first deploy; set it then and redeploy.
4. Click **Apply / Deploy**. First build takes a few minutes (it installs the
   PDF/audio libraries). When it's live you'll get a URL like
   `https://cross-ai.onrender.com`.
5. Finish the auth setup in the Supabase dashboard — apply the migrations in
   `supabase/migrations/`, enable the Google provider, add
   `<your-url>/api/auth/callback` to the redirect allowlist, and configure
   SMTP so magic links actually send. Full steps: [docs/AUTH.md](./docs/AUTH.md).

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
  move storage to a service like S3. Accounts, sessions and Tabroom links are
  **not** affected — those live in Supabase and survive redeploys.
- **Magic links need real SMTP.** Supabase's built-in mailer is capped at a
  couple of messages an hour and isn't meant for production, so email sign-in
  will look broken under any real traffic until you configure SMTP in the
  Supabase dashboard. Google sign-in works without it.
- **`PUBLIC_BASE_URL` must match the origin users actually visit.** If it's
  wrong, sign-in completes and then redirects to a 404. Custom domain? Update
  this *and* the Supabase redirect allowlist together.
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
