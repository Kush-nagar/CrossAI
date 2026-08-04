# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**Cross** is a competitive-debate AI coaching assistant. Node.js/Express backend, Next.js/React frontend (`web/`), powered entirely by NVIDIA's hosted Nemotron 3 Super (`nvidia/nemotron-3-super-120b-a12b`, OpenAI-compatible NIM API — see `scripts/lib/aiClient.mjs`). Image attachments are captioned by a second NVIDIA-hosted vision model (`meta/llama-3.2-11b-vision-instruct`) before reaching Nemotron, since it's text-only; PDFs are extracted to text server-side instead. The system prompt/persona spec lives in `CROSS.md` — read it before touching prompt or tool-calling logic; it defines Cross's coaching voice, the corpus-privacy rule, and the drill/Bayesian-ledger scoring framework.

## Commands

```
npm run dev         # both processes: Express API (:3000) + Next dev server (:3001), proxied together
npm start           # or `npm run web` (identical) — Express only, loads .env if present
npm run ingest      # process incoming/ -> training-data/ (see Ingestion pipeline below)
npm run chat        # scripts/chat.mjs — CLI chat entry point
```

Backend: no lint, build, or test-runner configured (no eslint/prettier/jest/vitest in root `package.json`). Node ≥ 20.6 required (`engines`). Pure ESM (`"type": "module"`) — all backend files are `.mjs`. Frontend (`web/`): its own `package.json`/TypeScript/Tailwind toolchain; `npm run build`/`npx tsc --noEmit` inside `web/` are the closest things to CI there.

**Manual verification, not automated tests.** There is no test suite. The closest thing is `scripts/lib/devTestRoutes.mjs`: dev-only (`NODE_ENV !== "production"`), loopback-only routes that clone a live browser session (via `session.mjs`) so you can `curl` the authenticated API surface without re-entering credentials. It hot-reloads `tools.mjs` on every call (cache-busted dynamic import) specifically so scraping/tool-layer fixes can be exercised without a server restart — a restart wipes the in-memory session store.

## Architecture

### Single Express app, flat `scripts/lib/` modules

Everything server-side is one file, `scripts/server.mjs`, importing focused modules from `scripts/lib/` (one concern per file: `aiClient.mjs`, `session.mjs`, `caselistClient.mjs`, `tabroomJudgeClient.mjs`, `corpusSearch.mjs`, `prompt.mjs`, `tools.mjs`, `voiceProfile.mjs`, `bayes.mjs`, `extract.mjs`, `fileGen.mjs`, `stt.mjs`, `groqVoice.mjs`, `humeVoice.mjs`, `transcribe.mjs`). There's no `services/`/`api/` layering — routes are registered directly in `server.mjs` and call into `lib/` functions. No database; persistence is either in-memory (`session.mjs`'s `Map`, resets on restart) or flat files on disk (`training-data/`, `uploads/`, `generated/`, `case-uploads/`).

### Speech-to-text: Groq Whisper large-v3, Hume EVI, and local Whisper fallback

Audio uploads are transcribed by `stt.mjs` in three tiers: when `GROQ_API_KEY` is set, `groqVoice.mjs` posts the audio to Groq's hosted `whisper-large-v3` (cloud — **audio leaves the machine**; fast, no local model download, no tone data). Without a Groq key — or on any Groq failure — it falls back to Hume EVI when `HUME_API_KEY` is set (`humeVoice.mjs`, cloud, transcript **plus** a vocal-tone/prosody summary fed to the model as delivery context — drill grading `speechMeta.tone`, chat transcript suffix). Without either key — or on Hume failure too — it falls back to the fully local Whisper pipeline in `transcribe.mjs` (no audio leaves the machine, no tone data, and the only tier paying the ~1.5GB Xenova model download). Calibration takes bypass the transcript-cleanup pass via the `rawTranscript` upload flag regardless of engine.

### Delivery analysis: tone segments, trends, coach rubrics

`lib/delivery.mjs` builds the drill grader's delivery block from Hume prosody data: whole-speech tone plus per-utterance `tone.segments` (so feedback localizes — "your voice flattened during weighing"), tone-aware grading criteria, a cross-take trend summary from `delivery-history.json` (gitignored, capped at 500 snapshots, written best-effort after each graded transcribed drill), and any coach-dropped rubric/reference files under `delivery-data/` (read per request, injected verbatim as authoritative). `GET /api/drill/delivery-history` exposes the snapshots. When there's no tone data (Whisper fallback) the grading prompt is unchanged.

### Auth: dual Tabroom-backed session tokens

The whole app is gated — every `/api/*` route requires a valid session (`server.mjs`'s gate middleware, registered after `/api/auth/*`). Signing in (`POST /api/auth/login`) takes a debater's real Tabroom username/password and, from that one submission, mints **two** independent tokens, both stored server-side only (never sent to the browser) in `session.mjs`'s signed-cookie session:
- `caselistToken` — from `caselistClient.mjs`'s `login()`, which hits the *official OpenCaselist REST API* (`https://api.opencaselist.com`). Used for `caselist_*` opponent-scouting tools.
- `tabroomToken` — from `tabroomJudgeClient.mjs`'s `login()`, which POSTs directly to `tabroom.com`'s own login endpoint and extracts the `TabroomToken` cookie. Used to resolve judge paradigms that Tabroom gates behind login. This login is **non-fatal**: if it fails, overall sign-in still succeeds and judge lookups just degrade to anonymous/no-result.

`session.mjs` documents its own security model in comments (httpOnly + HMAC-signed cookie, idle/absolute expiry, `__Host-` prefix in prod) — read it before changing session handling.

### External data: sanctioned API vs. scraping

- `caselistClient.mjs` talks to OpenCaselist's REST API — deliberately *not* scraping HTML ("stable, structured, and on the right side of the community's terms," per its own header comment).
- `tabroomJudgeClient.mjs` *does* scrape Tabroom.com (no official API for judge paradigms exists) — plain `fetch` + regex HTML parsing, ported from the `flowforge-tabroom-link` sibling project's proven `handleJudge` logic. No cheerio/puppeteer — matches the rest of the codebase's zero-scraping-dependency convention. **Gotcha:** scraped `paradigm` text is often one unbroken block (no `<br>`s in source) — `web/lib/paradigm.ts`'s `paradigmToParagraphs()` sentence-chunks it for display; don't re-split naively on blank lines. **Gotcha:** the paradigm-search-results table's cells aren't reliably `[first name, last name]` for every row — trust `extractJudgeName()` on the judge's own paradigm page (the pattern `lookupJudgeById` already uses) over the search table's parsed cells when both are available.
- tournaments.tech (the first-choice judge lookup in `lookupJudgeByName`) is unreachable from this sandbox (DNS fails for external hosts in both the Bash tool and WebFetch) — can't hand-verify its JSON shape from here; the code's `catch` already falls through to Tabroom scraping when it's unreachable, so this only affects debugging, not runtime behavior.
- Both clients follow the same shape: a `login()` that trades credentials for a token (never retained past the call), a typed `*Error` class carrying `.status`, and token-authenticated fetch helpers. Follow this shape for any new external client.

### Judge paradigm cache: Supabase (first DB in this project)

Judge paradigms (scraped) + their Nemotron structured summaries are cached in a Supabase table (`judge_paradigm_cache`, project `cross-judge-cache`) via `scripts/lib/supabaseClient.mjs`/`judgeCache.mjs`, gated behind `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` — unset means every lookup re-scrapes + re-summarizes, no error. **Gotcha:** cache key is `id:<judge_id>` when known, else `name:<normalized name>`. A name-only search that later resolves a judge_id must write under BOTH keys (`/api/judge/summary`'s `writeAliases`) or repeat searches by name never see their own prior write and silently re-run Nemotron every time — this bit us once already. Same trap applies to any future cache keyed by an identity that's only resolved after an external fetch. Supabase's service_role key can't be read back via MCP — must be copied from the dashboard by hand into `.env`.

### Prompt assembly: full-corpus vs. retrieval mode

`prompt.mjs`'s `buildSystemPrompt({ corpusMode, chatMode })` has two distinct strategies for getting `training-data/` content to the model:
- **`corpusMode: "full"`** (used by one-shot endpoints — stress test, strategy mode, drill): the entire corpus is inlined into the prompt every time. Fine for single deep calls with no multi-turn caching to preserve.
- **`corpusMode: "tools"`** (used by `/api/chat`): only `training-data/reference/` (`CORE_DIRS` in `corpusSearch.mjs`) is inlined; everything else is listed in a manifest and fetched on demand via the `search_corpus`/`read_corpus_file` tools (backed by `corpusSearch.mjs`'s lexical scoring — no embeddings). This keeps the prompt prefix byte-stable, which matters if the upstream host does any prompt caching. **Retrieval is silent**: the model must never narrate that it searched or reference a retrieved file/case/cite by name in its reply — this is the "corpus-privacy rule" from `CROSS.md`, enforced by instruction text in `prompt.mjs`, not code.
- `chatMode` (`"general"` | `"preround"`) appends a mode-specific section to the prompt and changes the tool set passed to `streamChat` in `server.mjs`: Pre-Round mode adds the `caselist_*` opponent-scouting tools (public disclosure data — the privacy rule does *not* apply to it, teams/judges/positions can be named openly) on top of the corpus tools. `lookup_judge_paradigm` (judge-paradigm lookup) is available in **both** chat modes.

### Tool-calling loop

`server.mjs`'s `/api/chat` handler runs a loop (`MAX_TOOL_ITERATIONS`) around `aiClient.mjs`'s `streamChat`: stream text deltas straight to the response, and when the model emits tool calls, dispatch each by `call.name` against `tools.mjs`'s exported `run*Tool` functions, collect results, call `appendToolResults`, and loop again. Adding a new tool means: define `{name, description, input_schema}` + a `run*Tool` executor in `tools.mjs`, add it to the tool array(s) built in the `/api/chat` handler (gated by `chatMode` as appropriate), and add a dispatch branch in the loop.

### Frontend: Next.js app in `web/`, talking to Express as a pure API

`web/` is a separate Next.js 16 / React 19 / TypeScript / Tailwind v4 app with its own `package.json` and toolchain — it does not share a dependency tree with the root backend. Routing is real: `web/app/{home,prep,drill,judges,coach,tournament,settings}/page.tsx`, one route per screen, wrapping shared UI in `web/components/nav/app-shell.tsx` (desktop rail, mobile tab bar, ⌘K command bar — all three read from the single `web/components/nav/nav-config.ts` registry, so adding a screen means editing one file, not three).

- **Dev**: `npm run dev` at the root runs both processes (`concurrently`) — Express on `:3000`, `next dev` on `:3001`. `web/next.config.mjs`'s `rewrites()` proxies `/api/*`, `/uploads/*`, `/case-uploads/*`, `/generated/*` from the Next origin to Express, so cookies stay same-origin. `scripts/server.mjs` has a dev-only `DEV_EXTRA_ORIGINS` allowlist so its CSRF origin-check doesn't reject the proxied requests — this only exists when `NODE_ENV !== "production"`.
- **Prod**: one process, one port (Render constraint). `scripts/server.mjs` boots Next's programmatic API in-process (`next({dev:false, dir: WEB_DIR}).getRequestHandler()`, resolved from `web/node_modules` via `createRequire`) and falls through to it as the last-registered route, after every `/api/*` handler and static mount. `render.yaml`'s `buildCommand` builds both (`npm install && npm --prefix web install && npm --prefix web run build`).
- **Auth**: `web/components/auth/auth-gate.tsx` ports the old consent-gate/login/401-interceptor flow as a React client component (`useAuth()` hook exposes `{username, signOut}`), gating everything in `web/app/layout.tsx`. `web/lib/api.ts`'s `apiFetch` wrapper is the single chokepoint every screen calls through — it dispatches a `cross-session-expired` event on any non-auth 401, which `AuthGate` listens for.
- **Voice recording**: one shared hook, `web/components/voice/use-voice-recorder.ts` (+ presentational `voice-recorder-button.tsx`), used at all 3 sites (chat composer, calibration onboarding, drill speech submission) instead of three hand-rolled state machines.
- Non-trivial ported logic lives in `web/lib/`: `paradigm.ts` (judge paradigm chunking), `drill-topics.ts` + `drill-topics-data.ts` (topic bank, format config, randomizer, ledger formatters), `local-conversations.ts` (chat history, localStorage-only, no server-side chat storage), `local-prefs.ts` (Settings toggles including `theme` — light/dark/system, no backend; reduced-motion/contrast/theme all apply real CSS classes on `<html>`, not just cosmetic switches). A few of these carry a `*.smoke.ts` file (run directly via `node foo.smoke.ts` — Node 24 strips TS types natively; no test runner is configured).
- **Design system**: `web/app/globals.css` tokens + `design-system/cross/MASTER.md` document the "Ballot/ink editorial" visual system (ink-black type on paper surfaces, pen/highlighter accents, ink-stamp CTAs) — read `MASTER.md` before restyling any screen so new work stays on-system.

**Frontend gotchas learned the hard way:**
- Tailwind v4's `@theme inline` derives `radius-xl/2xl/3xl` from one `--radius` base in `globals.css` — shrinking that single token restyles every `rounded-*` class app-wide without touching JSX.
- A no-flash theme script (setting `.dark`/`.light` on `<html>` before hydration, see `layout.tsx`) causes a React hydration-mismatch warning on the `<html>` element unless the `<html>` tag has `suppressHydrationWarning`.
- `taskkill /F /IM node.exe /T` (or any all-process kill) gets denied by the sandbox as "kills unrelated work" — target the specific dev-server PID instead.
- `delivery-history.json` snapshots exist for every graded transcribed drill regardless of score/tone presence — it's the honest source for any "practice streak"/calendar-style feature, no new persistence needed.
- Only PDF case uploads ever touch server disk (`case-uploads/`, via `/api/case-upload`) — docx/text/md/html cases are returned to the client and never persist server-side at all. A "cases prepared" count sourced from that directory would silently undercount; `web/lib/local-cases.ts` tracks it client-side instead.

### Ingestion pipeline

`scripts/ingest.mjs` processes raw case files (PDF/DOCX/HTML/TXT/MD, or pasted stdin) from `incoming/` into clean, tagged `.md` files under `training-data/`, tracked by content hash in `scripts/manifest.json` so re-runs are idempotent (already-processed originals move to `incoming/processed/`). This is the only path by which new material enters the corpus the model retrieves from.

### Cost/abuse controls

`aiGuards` middleware (in `server.mjs`) wraps every AI-calling route (chat, stress-test, strategy-mode, drill, summarize) — not the judge-lookup or auth routes, which don't spend model tokens. Two env-configurable caps: `RATE_LIMIT_PER_MINUTE` (per-visitor) and `DAILY_REQUEST_CAP` (global, `0` disables). See `DEPLOY.md` for the full deploy/ops picture (Render blueprint, ephemeral disk caveat — uploads/voice-profile don't survive a redeploy without a paid Disk).

## Related project

`flowforge-tabroom-link/` in this same working directory is a **separate, unrelated project** (a different Tabroom-companion web app, Vite+React+TS, mid-migration from Supabase Edge Functions to Cloudflare Workers) — it happens to live alongside Cross but shares no code, deploy, or session state. `tabroomJudgeClient.mjs`'s scraping logic was ported from it, but the two are otherwise independent; don't assume changes to one affect the other.
