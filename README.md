# Cross

Competitive-debate AI coaching assistant. Node.js/Express API + Next.js frontend, powered by NVIDIA Nemotron.

## Prerequisites

- **Node.js ≥ 20.6**
- An **NVIDIA API key** from [build.nvidia.com](https://build.nvidia.com)

## Run locally

```bash
# 1. Install dependencies (root API + web frontend)
npm install
npm --prefix web install

# 2. Configure env
cp .env.example .env
# Edit .env and set NVIDIA_API_KEY=nvapi-...

# 3. Start both servers (API :3000 + Next :3001)
npm run dev
```

Open **http://localhost:3001**. Sign in with your Tabroom username/password.

On Windows PowerShell, use `copy .env.example .env` instead of `cp`.

## Other commands

| Command | What it does |
|---|---|
| `npm run dev` | Dev mode: Express API + Next.js UI together |
| `npm start` | API only (also serves the built Next app in production) |
| `npm run chat` | CLI chat against the same backend |
| `npm run ingest` | Process files in `incoming/` into `training-data/` |

## Optional env vars

Only `NVIDIA_API_KEY` is required to boot. See `.env.example` for the rest:

- `GROQ_API_KEY` / `HUME_API_KEY` — cloud speech-to-text (falls back to local Whisper without them)
- `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` — judge paradigm cache
- `SESSION_SECRET` — required in production; ephemeral in local dev

## Deploy

See [DEPLOY.md](./DEPLOY.md) for Render deployment.
