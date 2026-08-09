# Cross

Competitive-debate AI coaching assistant. Node.js/Express API + Next.js frontend, powered by NVIDIA Nemotron.

## Prerequisites

- **Node.js ≥ 20.6**
- An **NVIDIA API key** from [build.nvidia.com](https://build.nvidia.com)
- A **Supabase project** (free tier) — Cross accounts and sessions live there,
  so the server won't boot without it

## Run locally

```bash
# 1. Install dependencies (root API + web frontend)
npm install
npm --prefix web install

# 2. Configure env
cp .env.example .env
# Edit .env and set:
#   NVIDIA_API_KEY=nvapi-...
#   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / SUPABASE_ANON_KEY
#   TOKEN_ENC_KEY=$(openssl rand -hex 32)
#   PUBLIC_BASE_URL=http://localhost:3001

# 3. Apply the SQL in supabase/migrations/ to that project, then enable
#    Google sign-in and add http://localhost:3001/api/auth/callback to
#    Authentication > URL Configuration > Redirect URLs.
#    Full setup steps: docs/AUTH.md

# 4. Start both servers (API :3000 + Next :3001)
npm run dev
```

Open **http://localhost:3001** and sign in with Google or an emailed link.
Linking a Tabroom account is optional — do it from Settings to turn on
opponent scouting and signed-in judge paradigms.

On Windows PowerShell, use `copy .env.example .env` instead of `cp`.

## Other commands

| Command | What it does |
|---|---|
| `npm run dev` | Dev mode: Express API + Next.js UI together |
| `npm start` | API only (also serves the built Next app in production) |
| `npm run chat` | CLI chat against the same backend |
| `npm run ingest` | Process files in `incoming/` into `training-data/` |

## Env vars

Required to boot: `NVIDIA_API_KEY`, `SUPABASE_URL`,
`SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`. See `.env.example` for the
rest:

- `TOKEN_ENC_KEY` — encrypts linked Tabroom tokens at rest; needed before anyone can link
- `PUBLIC_BASE_URL` — origin the browser is on (`:3001` in dev, not Express's `:3000`)
- `GROQ_API_KEY` / `HUME_API_KEY` — cloud speech-to-text (falls back to local Whisper without them)
- `SESSION_SECRET` — required in production; ephemeral in local dev

## Auth

Google / emailed-link sign-in via Supabase Auth, optional Tabroom linking.
Flows, data model, and the manual test checklist: [docs/AUTH.md](./docs/AUTH.md).

## Deploy

See [DEPLOY.md](./DEPLOY.md) for Render deployment.
