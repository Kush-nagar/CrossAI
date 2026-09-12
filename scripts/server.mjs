#!/usr/bin/env node
// Web UI + API for Cross. Serves public/ and proxies chat turns to
// the model (NVIDIA-hosted Nemotron — see aiClient.mjs), streaming the
// response back as plain text.

import express from "express";
import multer from "multer";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";
import { hasCredentials, missingCredentialsError, completeText, prepareConversation, streamChat, appendToolResults } from "./lib/aiClient.mjs";
import { buildSystemPrompt, loadCorpusFiles } from "./lib/prompt.mjs";
import {
  generateFileTool,
  runGenerateFileTool,
  searchCorpusTool,
  readCorpusFileTool,
  runSearchCorpusTool,
  runReadCorpusFileTool,
  caselistTools,
  isCaselistTool,
  runCaselistTool,
  lookupJudgeParadigmTool,
  runLookupJudgeParadigmTool,
  tabroomJudgeReportTool,
  tabroomResultsTools,
  isTabroomTool,
  runTabroomTool,
  webSearchTool,
  runWebSearchTool,
  hasWebSearch,
} from "./lib/tools.mjs";
import { GENERATED_DIR } from "./lib/fileGen.mjs";
import { extractTextFromBuffer, convertDocxToHtml, cleanText } from "./lib/extract.mjs";
import { transcribeAudio } from "./lib/stt.mjs";
import { cleanupTranscript } from "./lib/transcriptCleanup.mjs";
import { recordFeedback } from "./lib/feedback.mjs";
import { buildDeliveryGradingSection, recordDeliverySnapshot, getDeliveryHistory } from "./lib/delivery.mjs";
import { addCalibrationSample, applyKnownCorrections, getCalibrationStatus, resetProfile } from "./lib/voiceProfile.mjs";
import { scoreLedger, scoreMoves } from "./lib/bayes.mjs";
import { login as caselistLogin, CaselistError } from "./lib/caselistClient.mjs";
import { login as tabroomLogin, lookupJudgeByName, lookupJudgeById, TabroomJudgeError } from "./lib/tabroomJudgeClient.mjs";
import { createSession, readSession, destroySession, invalidateLinkCache } from "./lib/session.mjs";
import {
  hasAuthCredentials,
  createPkcePair,
  googleAuthorizeUrl,
  sendMagicLink,
  exchangeCode,
  appBaseUrl,
  setPkceCookie,
  readPkceCookie,
  clearPkceCookie,
  AuthError,
} from "./lib/crossAuth.mjs";
import {
  upsertProfile,
  getProfile,
  setConsentVersion,
  saveTabroomLink,
  deleteTabroomLink,
} from "./lib/userStore.mjs";
import { hasSupabaseCredentials } from "./lib/supabaseClient.mjs";
import { judgeCacheKey, hashParadigm, isFresh, getCachedJudge, upsertJudgeCache, touchScrapedAt } from "./lib/judgeCache.mjs";
// CrossAcademy modules (ported): disclosed-case archive grounding for drills/
// stress, Hume TTS spoken delivery, and the single source for grading criteria.
import {
  buildDrillCaseSection,
  buildStressBenchmarkSection,
  buildAttackPatternSection,
  buildRebuttalBenchmarkSection,
  speechWordBudget,
  buildSpokenCaseText,
  precedingOpponentSpeech,
} from "./lib/caseArchive.mjs";
import { buildAuthoringCriteria } from "./lib/speechCriteria.mjs";
import {
  isHumeTtsAvailable,
  synthesizeSpeech,
  deriveActingInstructions,
  HumeTtsError,
  MAX_TTS_TEXT_CHARS,
} from "./lib/humeTts.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const WEB_DIR = path.join(ROOT, "web");
const UPLOADS_DIR = path.join(ROOT, "uploads");
const CASE_UPLOADS_DIR = path.join(ROOT, "case-uploads");
const PORT = process.env.PORT || 3000;
// Sized for the longest legitimate chain: a Pre-Round scout walks events →
// schools → teams → rounds (paginated, ~12k chars/page) → cites → opensource
// doc pages before it can write stats — easily 15+ calls on an 85-round team.
// Corpus-only chats stop after 2-4 regardless, so the high cap costs nothing.
const MAX_TOOL_ITERATIONS = 24;
// A single drilled/graded speech comfortably fits the old 20MB cap, but a
// full-round recording (Recording Insight's "full round" mode — a real PF
// round can run 45-60+ minutes with crossfires) can land well past it
// depending on format/bitrate — an hour of m4a alone has been observed
// anywhere from ~25MB to 60+MB depending on the recording app's bitrate, so
// this leaves real headroom rather than cutting it close. Keep in sync with
// web/next.config.mjs's experimental.proxyClientMaxBodySize (the dev-only
// Next proxy has its own, separate body-size cap on the same requests).
const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;
const IMAGE_MEDIA_TYPES = new Set(["image/png", "image/jpeg", "image/gif", "image/webp"]);
const AUDIO_EXTENSIONS = new Set([".webm", ".ogg", ".oga", ".wav", ".m4a", ".mp3", ".mp4", ".aac"]);

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_UPLOAD_BYTES } });

const app = express();

// Behind Render's (or any) reverse proxy, the client IP is in X-Forwarded-For.
// Trust one proxy hop so per-IP rate limiting keys on the real visitor, not
// the proxy. Harmless locally (no such header is set).
app.set("trust proxy", 1);

const IS_PROD = process.env.NODE_ENV === "production";

// Accounts are not optional the way the judge cache is: without Supabase
// there is nowhere to store users or sessions, so every request would 401
// with no way to sign in. Fail loudly at boot instead of at first login.
if (!hasSupabaseCredentials() || !hasAuthCredentials()) {
  throw new Error(
    "Cross accounts require SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and SUPABASE_ANON_KEY. " +
      "See .env.example, and apply supabase/migrations/0002_auth.sql."
  );
}

// Dev-only: the Next.js frontend (web/) runs on its own port and proxies
// /api/* to this server via next.config.mjs's rewrites(). Next's rewrite
// proxy forwards the browser's real Origin header unchanged, so this server
// sees an Origin that doesn't match its own host even though the request
// never left localhost. Never relevant in prod: there both apps sit behind
// one public origin (see server's Next-handler fallback), so Origin always
// matches naturally.
const DEV_EXTRA_ORIGINS = IS_PROD
  ? new Set()
  : new Set([`http://localhost:${process.env.WEB_DEV_PORT || 3001}`, `http://127.0.0.1:${process.env.WEB_DEV_PORT || 3001}`]);

// Production only: the Next.js frontend (web/) is served in-process via its
// programmatic API, rather than as a second process/port — Render's free/
// starter web service exposes exactly one port. `next`'s package lives in
// web/node_modules (its own dependency tree), so it's resolved relative to
// WEB_DIR rather than imported normally. In dev, `npm run dev` runs Next as
// its own process (`next dev`) instead — see this file's Next-handler
// fallback registered near the bottom, and root package.json's dev scripts.
let nextRequestHandler = null;
if (IS_PROD) {
  const requireFromWeb = createRequire(path.join(WEB_DIR, "package.json"));
  const { default: next } = await import(pathToFileURL(requireFromWeb.resolve("next")).href);
  const nextApp = next({ dev: false, dir: WEB_DIR });
  await nextApp.prepare();
  nextRequestHandler = nextApp.getRequestHandler();
}

// --- Baseline hardening --------------------------------------------------
// Small hand-rolled equivalents of the helmet defaults this app actually
// needs, focused on keeping the Tabroom login and session cookie safe.
app.use((req, res, next) => {
  res.set("X-Content-Type-Options", "nosniff");
  // The login form must never render inside someone else's iframe
  // (clickjacking a Tabroom password prompt).
  res.set("X-Frame-Options", "DENY");
  res.set("Referrer-Policy", "no-referrer");
  if (IS_PROD) res.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  // API responses can reflect who is signed in; never let a browser or
  // intermediary cache them.
  if (req.path.startsWith("/api/")) res.set("Cache-Control", "no-store");
  next();
});

// Same-origin check for state-changing API calls. Browsers attach an Origin
// header to cross-site fetches; if one is present and doesn't match this
// host, reject before any handler runs. This closes login CSRF (an attacker
// silently signing a victim into an attacker-controlled account), which
// SameSite=Lax doesn't cover because the login request needs no cookie.
// Requests without an Origin header (curl, the dev harness, same-origin GETs)
// pass through — they carry no ambient browser credentials to abuse.
app.use((req, res, next) => {
  if (!req.path.startsWith("/api/") || ["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
  const origin = req.headers.origin;
  if (origin && origin !== `${req.protocol}://${req.get("host")}` && !DEV_EXTRA_ORIGINS.has(origin)) {
    res.status(403).json({ error: "Cross-origin requests are not allowed." });
    return;
  }
  next();
});

// --- Usage caps ---------------------------------------------------------
// This app is public, and every AI call spends the owner's NVIDIA key, so
// two guards keep costs bounded. Both are env-configurable so limits can be
// tuned on the host without a code change.
//   RATE_LIMIT_PER_MINUTE  per-IP requests/min to AI endpoints (default 20)
//   DAILY_REQUEST_CAP      total AI requests/day across everyone (default 1000; 0 = off)
const RATE_LIMIT_PER_MINUTE = Number(process.env.RATE_LIMIT_PER_MINUTE) || 20;
const DAILY_REQUEST_CAP = Number(process.env.DAILY_REQUEST_CAP ?? 1000);

// Per-user limiter (falling back to per-IP): stops any single visitor from
// hammering the API. AI routes sit behind the gate, so req.session is always
// set by the time this runs — keying on the account means one user can't
// multiply their budget by rotating IPs, and a shared school network doesn't
// throttle a whole team into one bucket.
const aiRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: RATE_LIMIT_PER_MINUTE,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  keyGenerator: (req, res) => req.session?.userId || ipKeyGenerator(req, res),
  message: { error: "Too many requests — slow down and try again in a minute." },
});

// Global daily cap: a crude spend ceiling shared across all visitors. Counter
// lives in memory and resets when the UTC date rolls over (or on restart).
let dailyCount = 0;
let dailyKey = new Date().toISOString().slice(0, 10);
function dailyCap(req, res, next) {
  if (DAILY_REQUEST_CAP <= 0) return next();
  const today = new Date().toISOString().slice(0, 10);
  if (today !== dailyKey) {
    dailyKey = today;
    dailyCount = 0;
  }
  if (dailyCount >= DAILY_REQUEST_CAP) {
    res.status(429).json({ error: "This app has hit its daily usage limit. Please try again tomorrow." });
    return;
  }
  dailyCount++;
  next();
}

// Applies to every route that calls the model (see the /api endpoints below).
const aiGuards = [aiRateLimiter, dailyCap];

// Model tier per route — the cheapest model that does each task well.
// Tiers resolve to concrete model ids in aiClient.mjs; each is
// env-overridable (e.g. CHAT_MODEL=opus) for instant rollback per route.
// Effectiveness-first defaults: Opus 4.8 on every reasoning-heavy route,
// Sonnet 5 where speed still matters (summaries feed cross-round memory, so
// they outgrew haiku; transcript cleanup sits on the upload path).
// Chat runs slightly warm by default: API-default sampling reads flat and
// assistant-ish; ~0.85 loosens conversational voice without hurting tool
// calls. JSON one-shot routes (drill grading, scenarios) stay at the API
// default for scoring consistency. Env-overridable for instant tuning.
const CHAT_TEMPERATURE = Number(process.env.CHAT_TEMPERATURE ?? 0.85);

// Invisible chain-of-thought on the chat route. OFF is the latency default:
// Nemotron otherwise streams a discarded `reasoning_content` pass before the
// first visible token, which is the dominant Time-to-First-Token cost on this
// endpoint. Reasoning does improve tool-triggering accuracy, so set
// CHAT_ENABLE_THINKING=1 (or true/yes) to restore it and A/B the tradeoff.
// The one-shot JSON routes are unaffected — they force thinking off in aiClient.
const CHAT_ENABLE_THINKING = /^(1|true|yes)$/i.test(process.env.CHAT_ENABLE_THINKING ?? "");

const ROUTE_MODELS = {
  chat: process.env.CHAT_MODEL || "opus",
  stressTest: process.env.STRESS_TEST_MODEL || "opus",
  strategy: process.env.STRATEGY_MODEL || "opus",
  drill: process.env.DRILL_MODEL || "opus",
  insight: process.env.INSIGHT_MODEL || "opus",
  summarize: process.env.SUMMARIZE_MODEL || "sonnet",
  transcriptCleanup: process.env.TRANSCRIPT_CLEANUP_MODEL || "sonnet",
  judgeInterpret: process.env.JUDGE_INTERPRET_MODEL || "sonnet",
};

// --- Large-request guards -------------------------------------------------
// NVIDIA's endpoint accepts enormous prompts without erroring (verified past
// 576k input tokens), so nothing upstream stops a runaway request — it just
// gets slow and expensive, then fails downstream (output cap, timeouts).
// These caps fail fast with an actionable message instead. All in characters
// (~3.2 chars/token), env-overridable.
const MAX_ONESHOT_INPUT_CHARS = Number(process.env.MAX_ONESHOT_INPUT_CHARS) || 200_000;
const MAX_CHAT_MESSAGE_CHARS = Number(process.env.MAX_CHAT_MESSAGE_CHARS) || 200_000;
const MAX_CHAT_HISTORY_CHARS = Number(process.env.MAX_CHAT_HISTORY_CHARS) || 500_000;

// Approximate size of one chat message, tolerating both plain strings and
// content-block arrays. Image blocks are routed to the vision model and only
// return a short caption, so they count as a flat allowance, not their
// base64 length.
function messageChars(m) {
  if (typeof m.content === "string") return m.content.length;
  if (!Array.isArray(m.content)) return 0;
  let n = 0;
  for (const block of m.content) {
    if (block.type === "text") n += block.text?.length ?? 0;
    else if (block.type === "image") n += 1500;
    else n += 500;
  }
  return n;
}

// Keeps the most recent messages that fit the history budget (always at
// least the last one). Old turns fall off silently — the frontend's
// cross-round memory summary already preserves long-term context.
function trimChatHistory(messages) {
  let total = 0;
  let start = messages.length;
  while (start > 0 && total + messageChars(messages[start - 1]) <= MAX_CHAT_HISTORY_CHARS) {
    total += messageChars(messages[start - 1]);
    start--;
  }
  if (start === messages.length) start = messages.length - 1; // always keep the newest
  if (start > 0) console.log(`[chat] trimmed ${start} old message(s) to fit the ${MAX_CHAT_HISTORY_CHARS}-char history budget`);
  return messages.slice(start);
}

// 413 with a concrete size readout for one-shot inputs (a pasted case, a
// drill speech) that exceed what a single deep call can sensibly process.
// Worded as Cross would say it — plain terms and a next step, no internals.
function rejectOversizedInput(res, text, label) {
  if (typeof text !== "string" || text.length <= MAX_ONESHOT_INPUT_CHARS) return false;
  res.status(413).json({
    error:
      `${label} is more than I can work through in one pass — about ${Math.round(text.length / 1000)}k ` +
      `characters, and I can handle roughly ${Math.round(MAX_ONESHOT_INPUT_CHARS / 1000)}k. Is this several ` +
      `documents pasted together? Send just the piece you want worked, or split it into sections and run them ` +
      `one at a time.`,
  });
  return true;
}

// Turns an internal failure into something Cross would actually say: plain
// terms, a concrete next step, and NO internals — provider names, model ids,
// token limits, and stack details never reach the debater. The real error is
// always logged server-side before this is called.
function friendlyFailureReply(err) {
  const msg = String(err?.message || "");
  if (/truncated at the \d+-token limit/.test(msg)) {
    return (
      "I had more to say than fits in one reply, so I stopped rather than hand you half a thought. " +
      "Ask me for it in pieces — start with whichever part matters most (\"just do the first contention\") " +
      "and we'll work through the rest from there."
    );
  }
  if (err?.status === 429 || /rate.?limit|resource.?exhausted|too many requests/i.test(msg)) {
    return (
      "I'm getting throttled at the moment — too much traffic on my end, nothing you did. Give it a minute " +
      "and resend. If you were sending something big, splitting it up will also make this less likely."
    );
  }
  if (/quota|credit|billing|insufficient|payment/i.test(msg)) {
    return (
      "I'm out of thinking capacity right now — that's on my end, not yours. Let whoever runs this app know, " +
      "and try again later."
    );
  }
  if (/timeout|timed out|etimedout|econnreset|econnrefused|fetch failed|network|socket|aborted/i.test(msg)) {
    return (
      "I lost my connection mid-thought and couldn't finish that one. Mind resending it? If it was a big ask — " +
      "a whole document plus several questions — send the document first, then the questions."
    );
  }
  return (
    "I hit a snag and couldn't finish that reply. Try sending it again — and if it was a lot at once, tell me " +
    "which part to tackle first and I'll take it from there."
  );
}

// Streams a short conversational reply (HTTP 200 text/plain), so the message
// lands in the chat as Cross talking rather than as an error toast.
function streamPlainReply(res, text) {
  if (!res.headersSent) res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.write(text);
  res.end();
}

// Machine-readable failure trailer for the chat stream. friendlyFailureReply()
// stays the VISIBLE reply — conversational and internals-free — while this adds
// a short, SAFE reason the UI can surface on demand plus a `retryable` hint, so
// a debater can see *why* a request failed and decide whether to retry. The raw
// error (message/stack/upstream body) is never sent — it stays in the server
// log via console.error. NUL-guarded so it can never collide with model text;
// the frontend splits it off the end of the stream (web/lib/api.ts
// CHAT_ERROR_SENTINEL). Keep the literal identical on both sides.
const CHAT_ERROR_SENTINEL = "\u241E\u241ECROSS_CHAT_ERROR\u241E";

function classifyChatFailure(err) {
  const msg = String(err?.message || "");
  if (/truncated at the \d+-token limit/.test(msg)) {
    return { code: "response_too_long", reason: "The reply ran past its length limit and was stopped so you wouldn't get half a thought.", retryable: true };
  }
  if (err?.status === 429 || /rate.?limit|resource.?exhausted|too many requests/i.test(msg)) {
    return { code: "rate_limited", reason: "The AI provider is rate-limiting requests right now (too much traffic). This usually clears within a minute.", retryable: true };
  }
  if (/quota|credit|billing|insufficient|payment/i.test(msg)) {
    return { code: "quota_exhausted", reason: "The AI provider account is out of quota or credit — an operator needs to resolve this before chat works again.", retryable: false };
  }
  if (/timeout|timed out|etimedout|econnreset|econnrefused|fetch failed|network|socket|aborted/i.test(msg)) {
    return { code: "network", reason: "The connection to the AI provider dropped before the reply finished.", retryable: true };
  }
  const status = Number.isFinite(err?.status) ? err.status : null;
  return {
    code: "upstream_error",
    reason: status ? `The AI provider returned an unexpected error (HTTP ${status}).` : "An unexpected error interrupted the reply.",
    retryable: true,
  };
}

// Appends the failure trailer to an already-flowing (or about-to-start) chat
// stream. Always followed by res.end() at the call site.
function writeChatFailureTrailer(res, err) {
  res.write(CHAT_ERROR_SENTINEL + JSON.stringify(classifyChatFailure(err)));
}

// When a chat message is too big to process, have the model itself look at
// the opening of what was sent and ask targeted questions about what the
// debater actually wants — a coach clarifying, not a system rejecting. Falls
// back to a static (still conversational) version if that call fails too.
async function oversizedMessageReply(lastMessage) {
  const sizeK = Math.round(messageChars(lastMessage) / 1000);
  const limitK = Math.round(MAX_CHAT_MESSAGE_CHARS / 1000);
  const fallback =
    `That's more than I can take in at once — about ${sizeK}k characters, and I can read roughly ${limitK}k ` +
    `per message. What's the core thing you want from me here? If it's a document, send it on its own (or in ` +
    `sections) and tell me what to look for in each part.`;
  try {
    const excerpt = (
      typeof lastMessage.content === "string"
        ? lastMessage.content
        : (Array.isArray(lastMessage.content) ? lastMessage.content : [])
            .filter((b) => b.type === "text")
            .map((b) => b.text)
            .join("\n")
    ).slice(0, 2000);
    const reply = await completeText({
      system:
        "You are Cross, an AI competitive-debate coach. Warm, direct, plain-spoken — a coach talking to their " +
        "debater between rounds, not a system reporting an error.",
      prompt:
        `The debater just sent you a message that is too large for you to read in one go (about ${sizeK}k ` +
        `characters; you can handle roughly ${limitK}k per message). Here is how it starts:\n\n---\n${excerpt}\n---\n\n` +
        `Write your reply to the debater (3-5 sentences, no headers or lists). Tell them plainly that this was ` +
        `more than you can read at once, then ask one or two SPECIFIC questions — based on what the excerpt looks ` +
        `like — about what they want from you and what to prioritize, and suggest how to split it (e.g. send the ` +
        `case alone, one section at a time). Never mention tokens, character counts beyond rough plain-language ` +
        `size, models, providers, or any internal system detail.`,
      maxTokens: 1000,
      model: ROUTE_MODELS.summarize,
    });
    return reply.trim() || fallback;
  } catch {
    return fallback;
  }
}

app.use(express.json({ limit: "30mb" }));
app.use("/generated", express.static(GENERATED_DIR));
app.use("/uploads", express.static(UPLOADS_DIR));
app.use("/case-uploads", express.static(CASE_UPLOADS_DIR));

// --- Auth gate (Cross accounts) -----------------------------------------
// The whole app is gated behind a Cross account. Users sign in with Google or
// an emailed magic link, both brokered by Supabase Auth (crossAuth.mjs) —
// Cross never sees a password and the browser never receives a Supabase
// token; the server exchanges the OAuth code and mints its own session cookie
// (session.mjs, backed by Postgres so sessions survive restarts).
//
// A Tabroom account is OPTIONAL and entirely separate: users link one from
// Settings, which stores the resulting OpenCaselist/Tabroom tokens encrypted
// (userStore.mjs) to power opponent scouting and logged-in judge lookups.
// Unlinked accounts work fine with those capabilities absent.
//
// These /api/auth/* routes are registered BEFORE the gate so they stay
// reachable while logged out. Static files (the login shell) were mounted
// above, so they also load without a session — the client renders a blocking
// sign-in overlay until /api/auth/me reports authenticated.

// Stricter limiter on the auth surface to blunt credential brute-forcing and
// magic-link/OAuth spam. Applied to every /api/auth/* route that does work.
const authRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: Number(process.env.LOGIN_LIMIT_PER_MINUTE) || 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many attempts — wait a minute and try again." },
});

// Per-ACCOUNT lockout on top of the per-IP limiter: the IP limiter alone
// leaves this endpoint usable as a distributed brute-force oracle against one
// victim's Tabroom password (rotate IPs, hammer one username). Track failed
// attempts per username and lock the account out of THIS proxy for a window.
// In-memory like the session store; only failure counts are kept, never
// passwords.
const LOCKOUT_THRESHOLD = Number(process.env.LOGIN_LOCKOUT_THRESHOLD) || 5;
const LOCKOUT_WINDOW_MS = 15 * 60 * 1000;
/** usernameLower -> { fails, windowStart, lockedUntil } */
const loginFailures = new Map();

function checkLockout(usernameLower) {
  const rec = loginFailures.get(usernameLower);
  if (!rec) return false;
  const now = Date.now();
  if (rec.lockedUntil && now < rec.lockedUntil) return true;
  if (now - rec.windowStart > LOCKOUT_WINDOW_MS) loginFailures.delete(usernameLower);
  return false;
}

function recordLoginFailure(usernameLower) {
  const now = Date.now();
  let rec = loginFailures.get(usernameLower);
  if (!rec || now - rec.windowStart > LOCKOUT_WINDOW_MS) {
    rec = { fails: 0, windowStart: now, lockedUntil: 0 };
    loginFailures.set(usernameLower, rec);
  }
  rec.fails++;
  if (rec.fails >= LOCKOUT_THRESHOLD) rec.lockedUntil = now + LOCKOUT_WINDOW_MS;
  // Bound the map so junk usernames can't grow it forever.
  if (loginFailures.size > 10000) {
    for (const [k, v] of loginFailures) {
      if (now - v.windowStart > LOCKOUT_WINDOW_MS) loginFailures.delete(k);
    }
  }
}

// The privacy notice version users must have accepted before handing Cross
// their Tabroom credentials. Must match CONSENT_VERSION in
// web/components/auth/tabroom-link.tsx; bump both together when the notice's
// substance changes so existing users are re-prompted. Signing in to Cross
// itself needs no such notice — no third-party password is involved.
const REQUIRED_CONSENT_VERSION = 1;

// --- Sign in / sign out ---------------------------------------------------

// Step 1 of Google sign-in: park a PKCE verifier on our origin and bounce the
// browser to Supabase. Without the verifier, an intercepted `code` in the
// callback URL would be redeemable by anyone who saw it.
app.get("/api/auth/start/google", authRateLimiter, (req, res) => {
  try {
    const { verifier, challenge } = createPkcePair();
    setPkceCookie(res, verifier);
    res.redirect(googleAuthorizeUrl(challenge));
  } catch (err) {
    console.error("Google sign-in start failed:", err.message);
    res.redirect(`${appBaseUrl()}/home?authError=unavailable`);
  }
});

// Step 1 of email sign-in. Always reports success: telling an anonymous
// caller whether an address is registered would turn this into an account
// enumeration oracle.
app.post("/api/auth/magic-link", authRateLimiter, async (req, res) => {
  const { email } = req.body ?? {};
  if (typeof email !== "string" || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) {
    res.status(400).json({ error: "Enter a valid email address." });
    return;
  }
  try {
    const { verifier, challenge } = createPkcePair();
    setPkceCookie(res, verifier);
    await sendMagicLink(email.trim(), challenge);
  } catch (err) {
    // Never echo the provider's message back — it distinguishes "unknown
    // address" from "rate limited". Log it for the operator instead.
    console.error("Magic link send failed:", err.message);
    if (err instanceof AuthError && err.status === 429) {
      res.status(429).json({ error: "Too many sign-in emails — wait a few minutes and try again." });
      return;
    }
  }
  res.json({ ok: true });
});

// Step 2 of both flows: Supabase sends the browser here with a one-time code.
// Redirects (rather than returning JSON) because a human is following it.
app.get("/api/auth/callback", authRateLimiter, async (req, res) => {
  const code = typeof req.query.code === "string" ? req.query.code : null;
  const verifier = readPkceCookie(req);
  clearPkceCookie(res);
  if (!code || !verifier) {
    res.redirect(`${appBaseUrl()}/home?authError=expired`);
    return;
  }
  try {
    const user = await exchangeCode(code, verifier);
    await upsertProfile(user);
    // Retire any session the browser already holds before minting a new one,
    // so a pre-login cookie can never live on past authentication.
    await destroySession(req, res);
    await createSession(res, { userId: user.userId });
    // Straight into the app: "/" is now the public landing page, and a
    // just-authenticated visitor should never see it flash past.
    res.redirect(`${appBaseUrl()}/home`);
  } catch (err) {
    console.error("Sign-in callback failed:", err.message);
    res.redirect(`${appBaseUrl()}/home?authError=failed`);
  }
});

app.post("/api/auth/logout", async (req, res) => {
  await destroySession(req, res);
  res.json({ ok: true });
});

// Always 200 — the client polls this on boot to decide whether to show the
// sign-in overlay, so it must not itself be gated.
app.get("/api/auth/me", async (req, res) => {
  const s = await readSession(req).catch(() => null);
  if (!s) {
    res.json({ authenticated: false, user: null, tabroom: { linked: false, username: null } });
    return;
  }
  const profile = await getProfile(s.userId).catch(() => null);
  res.json({
    authenticated: true,
    user: {
      id: s.userId,
      email: profile?.email || null,
      displayName: profile?.display_name || null,
      consentVersion: profile?.consent_version || 0,
    },
    tabroom: { linked: Boolean(s.caselistToken || s.tabroomToken), username: s.tabroomUsername },
  });
});

// --- Optional Tabroom link ------------------------------------------------
// Unchanged credential handling from the old Tabroom-only login: the password
// is used once, here, to mint tokens and is never stored or logged. What's
// new is that it's optional, tied to a Cross account, and the resulting
// tokens are encrypted at rest instead of living only in memory.

app.post("/api/auth/tabroom/link", authRateLimiter, async (req, res) => {
  const session = await readSession(req).catch(() => null);
  if (!session) {
    res.status(401).json({ error: "Sign in to Cross first.", needsAuth: true });
    return;
  }
  const { username, password, remember, consentVersion } = req.body ?? {};
  if (typeof username !== "string" || typeof password !== "string" || !username.trim() || !password) {
    res.status(400).json({ error: "Tabroom username and password are required." });
    return;
  }
  // Consent is enforced here, not just in the UI: a link attempt that doesn't
  // carry the current notice version is refused before the credentials are
  // forwarded anywhere.
  if (Number(consentVersion) !== REQUIRED_CONSENT_VERSION) {
    res.status(400).json({ error: "Please review and accept the data & permissions notice before linking." });
    return;
  }
  const usernameLower = username.trim().toLowerCase();
  if (checkLockout(usernameLower)) {
    res.status(429).json({ error: "Too many failed attempts for this Tabroom account — try again in 15 minutes." });
    return;
  }
  try {
    const token = await caselistLogin(username.trim(), password, remember !== false);
    // Same Tabroom account, separate token — lets judge-paradigm lookups
    // resolve pages Tabroom gates behind login. Non-fatal: Cross still works
    // (judge lookup just falls back to anonymous/no-result) if this fails.
    const tabroomToken = await tabroomLogin(username.trim(), password).catch((err) => {
      console.warn("Tabroom direct login failed (judge lookups will be anonymous):", err.message);
      return null;
    });
    loginFailures.delete(usernameLower);
    await saveTabroomLink({
      userId: session.userId,
      tabroomUsername: username.trim(),
      caselistToken: token,
      tabroomToken,
    });
    await setConsentVersion(session.userId, REQUIRED_CONSENT_VERSION).catch(() => {});
    invalidateLinkCache(session.userId);
    res.json({ ok: true, username: username.trim(), judgeLookupsAuthenticated: Boolean(tabroomToken) });
  } catch (err) {
    const status = err instanceof CaselistError ? err.status || 401 : 500;
    // Only credential rejections count toward lockout — an OpenCaselist
    // outage (5xx) shouldn't lock real users out.
    if (status === 401 || status === 403) recordLoginFailure(usernameLower);
    if (status >= 500) console.error("Caselist login error:", err.message);
    res.status(status < 400 ? 500 : status).json({ error: err.message || "Could not link that Tabroom account." });
  }
});

app.post("/api/auth/tabroom/unlink", authRateLimiter, async (req, res) => {
  const session = await readSession(req).catch(() => null);
  if (!session) {
    res.status(401).json({ error: "Sign in to Cross first.", needsAuth: true });
    return;
  }
  await deleteTabroomLink(session.userId);
  invalidateLinkCache(session.userId);
  res.json({ ok: true });
});

// DEV-ONLY functional-test routes (localhost + non-production; see module).
// Registered before the gate — they do their own session handling.
if (process.env.NODE_ENV !== "production") {
  const { mountDevTestRoutes } = await import("./lib/devTestRoutes.mjs");
  mountDevTestRoutes(app);
}

// THE GATE: every /api/* route below requires a valid Cross session.
// Static assets and /api/auth/* were registered above and bypass this.
app.use(async (req, res, next) => {
  if (!req.path.startsWith("/api/")) return next();
  let session;
  try {
    session = await readSession(req);
  } catch (err) {
    // Session storage is down. Fail closed — serving requests unauthenticated
    // is never the safe fallback.
    console.error("Session lookup failed:", err.message);
    res.status(503).json({ error: "Sign-in is temporarily unavailable. Try again in a moment." });
    return;
  }
  if (!session) {
    res.status(401).json({ error: "Sign in to use Cross.", needsAuth: true });
    return;
  }
  req.session = session;
  next();
});

// Note: OpenCaselist wiki access is no longer a client-facing browser. It is
// now a coaching capability — Cross reaches the wiki through the caselist_*
// tools in the /api/chat loop, authenticated with each debater's own token.

// Reports only a count — corpus file names/paths are private training
// material and are never exposed to the client (corpus-privacy rule).
app.get("/api/status", async (req, res) => {
  const files = await loadCorpusFiles();
  res.json({ corpusCount: files.length });
});

app.post("/api/upload", upload.single("file"), async (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: "No file uploaded." });
    return;
  }

  const { originalname, mimetype, buffer } = req.file;
  const ext = path.extname(originalname).toLowerCase();

  try {
    if (IMAGE_MEDIA_TYPES.has(mimetype)) {
      res.json({ kind: "image", filename: originalname, media_type: mimetype, data: buffer.toString("base64") });
      return;
    }

    // PDFs fall through to the generic extractTextFromBuffer() branch below
    // (same highlight-aware pdfjs-dist + pdf-parse pipeline used for
    // .docx/.html/.txt) instead of being sent as raw bytes — Nemotron is
    // text-only, unlike Claude's native PDF vision.

    // Audio: the chat model takes no audio input, so the file itself is
    // never sent to the model. It's saved as a real file for the debater's
    // own playback/download, then transcribed (Groq whisper-large-v3, else
    // Hume EVI, else local Whisper — see stt.mjs) so the transcript — not
    // live browser dictation — is what reaches the model.
    if (mimetype.startsWith("audio/") || AUDIO_EXTENSIONS.has(ext)) {
      await fs.mkdir(UPLOADS_DIR, { recursive: true });
      const safeName = `${Date.now()}-${originalname.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      await fs.writeFile(path.join(UPLOADS_DIR, safeName), buffer);

      let transcript = "";
      let tone = null;
      try {
        const result = await transcribeAudio(buffer, { ext: ext.replace(/^\./, "") });
        tone = result.tone;
        transcript = await applyKnownCorrections(result.text);
        // Model cleanup pass fixes garbles the exact-match table has never
        // seen. Calibration takes send rawTranscript=1 and skip it — their
        // diffs must run against (correction-adjusted) Whisper output, not
        // model-cleaned text, or the profile learns against a moving target.
        if (transcript && !req.body?.rawTranscript) {
          try {
            transcript = await cleanupTranscript(transcript, { model: ROUTE_MODELS.transcriptCleanup });
          } catch (err) {
            console.error("Transcript cleanup failed (using uncleaned transcript):", err);
          }
        }
      } catch (err) {
        console.error("Transcription failed:", err);
      }

      res.json({ kind: "audio", filename: originalname, url: `/uploads/${safeName}`, transcript, tone });
      return;
    }

    const raw = await extractTextFromBuffer(buffer, ext);
    if (raw === null) {
      res.status(400).json({ error: `Unsupported file type: ${ext || mimetype}` });
      return;
    }
    if (!raw.trim()) {
      res.status(400).json({ error: "No extractable text found in that file." });
      return;
    }

    res.json({ kind: "text", filename: originalname, text: cleanText(raw) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    res.status(400).json({ error: `Upload failed: ${err.message}` });
    return;
  }
  next(err);
});

app.get("/api/voice-profile/status", async (req, res) => {
  res.json(await getCalibrationStatus());
});

app.post("/api/voice-profile/sample", async (req, res) => {
  const { transcript } = req.body ?? {};
  if (typeof transcript !== "string" || !transcript.trim()) {
    res.status(400).json({ error: "transcript is required" });
    return;
  }
  const { corrections, wasCorrect, rejected, wer, mismatches } = await addCalibrationSample({ transcript });
  const status = await getCalibrationStatus();
  res.json({ wasCorrect, corrections, rejected, wer, mismatches, ...status });
});

app.post("/api/voice-profile/reset", async (req, res) => {
  res.json(await resetProfile());
});

// Circular feedback loop: the client randomly samples AI responses and asks
// the user whether they were helpful (and why not). Answers stored here are
// fed back into every system prompt via buildSystemPrompt — see
// lib/feedback.mjs for the full mechanism.
app.post("/api/feedback", async (req, res) => {
  const { satisfied, reason, route, preview } = req.body ?? {};
  if (typeof satisfied !== "boolean") {
    res.status(400).json({ error: "satisfied (boolean) is required" });
    return;
  }
  res.json(await recordFeedback({ satisfied, reason, route, preview }));
});

// --- Prep: case library upload ---
// Unlike /api/upload (which feeds chat attachments straight to the model), this
// keeps a rendered version around so the Prep case reader can display the
// original docx/pdf formatting (bold/underline/highlight), not just plain text.
const CASE_UPLOAD_EXTENSIONS = new Set([".docx", ".pdf", ".txt", ".md", ".html", ".htm"]);
app.post("/api/case-upload", upload.single("file"), async (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: "No file uploaded." });
    return;
  }
  const { originalname, buffer } = req.file;
  const ext = path.extname(originalname).toLowerCase();
  if (!CASE_UPLOAD_EXTENSIONS.has(ext)) {
    res.status(400).json({ error: `Unsupported file type: ${ext || "unknown"}` });
    return;
  }

  try {
    if (ext === ".docx") {
      const [rawText, html] = await Promise.all([extractTextFromBuffer(buffer, ext), convertDocxToHtml(buffer)]);
      res.json({ filename: originalname, kind: "docx", text: cleanText(rawText), html });
      return;
    }

    if (ext === ".pdf") {
      await fs.mkdir(CASE_UPLOADS_DIR, { recursive: true });
      const safeName = `${Date.now()}-${originalname.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      await fs.writeFile(path.join(CASE_UPLOADS_DIR, safeName), buffer);
      const rawText = await extractTextFromBuffer(buffer, ext);
      res.json({ filename: originalname, kind: "pdf", text: cleanText(rawText), url: `/case-uploads/${safeName}` });
      return;
    }

    const rawText = await extractTextFromBuffer(buffer, ext);
    if (rawText === null || !rawText.trim()) {
      res.status(400).json({ error: "No extractable text found in that file." });
      return;
    }
    res.json({ filename: originalname, kind: "text", text: cleanText(rawText) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Deletes a saved case PDF (docx/text cases never touch disk, so there's
// nothing to clean up for those — only pdf uploads persist a file here).
app.delete("/api/case-upload/:filename", async (req, res) => {
  const { filename } = req.params;
  if (!/^[a-zA-Z0-9._-]+$/.test(filename)) {
    res.status(400).json({ error: "Invalid filename." });
    return;
  }
  try {
    await fs.unlink(path.join(CASE_UPLOADS_DIR, filename));
  } catch (err) {
    if (err.code !== "ENOENT") {
      res.status(500).json({ error: err.message });
      return;
    }
  }
  res.json({ ok: true });
});

// --- Judges: Tabroom paradigm lookup ---
app.post("/api/judge", async (req, res) => {
  const { name, judge_id } = req.body ?? {};
  if (!name && !judge_id) {
    res.status(400).json({ error: "Provide a judge name or judge_id." });
    return;
  }
  try {
    const result = judge_id
      ? await lookupJudgeById(judge_id, req.session?.tabroomToken)
      : await lookupJudgeByName(name, req.session?.tabroomToken);
    res.json(result);
  } catch (err) {
    const status = err instanceof TabroomJudgeError ? err.status || 502 : 502;
    res.status(status).json({ error: err.message || "Judge lookup failed." });
  }
});

// Structured, section-by-section paradigm summary for the Judges page,
// backed by a Supabase cache (judge_paradigm_cache) so repeat lookups skip
// both the Tabroom scrape and the Nemotron call. See scripts/lib/judgeCache.mjs
// for the cache policy and JUDGE_SUMMARY_SCHEMA below for the response shape.
function buildJudgeSummaryPrompt(name, paradigm) {
  return (
    `Here is a debate judge's paradigm${name ? ` (judge: ${name})` : ""}:\n\n${paradigm.slice(0, 6000)}\n\n` +
    `Fill out the JSON schema describing this judge for a debater prepping in front of them. For each of the 8 ` +
    `sections, set "addressed": false and "blocks": [] ONLY if the paradigm truly says nothing about that ` +
    `dimension — do not pad or invent content. Where addressed, use "bullets" for short discrete points, ` +
    `"callout" (tone "warning") for hard dealbreakers/pet peeves, "callout" (tone "tip") for a standout piece of ` +
    `advice, "keyPrefs" for label/value facts (e.g. speaker point range), and "heading" only for a genuine ` +
    `sub-break within a section. Every block must include all fields; leave kind-irrelevant fields as "" / [].`
  );
}

function toSummaryResponse(row, source) {
  return {
    judge_id: row.judge_id,
    name: row.name,
    source: row.source,
    paradigm: row.paradigm_text,
    tabroom_url: row.tabroom_url,
    summary: row.summary_json,
    summarySource: source,
    tags: row.tags,
    cachedAt: row.scraped_at,
  };
}

// aiRateLimiter/dailyCap must NOT run on a cache hit (no model call happens),
// so they can't be attached via app.post(path, aiGuards, ...) here — invoke
// them manually right before the one place this route actually calls Nemotron.
function guardAiCall(req, res) {
  return new Promise((resolve) => {
    aiRateLimiter(req, res, () => {
      if (res.headersSent) { resolve(false); return; }
      dailyCap(req, res, () => resolve(!res.headersSent));
    });
  });
}

app.post("/api/judge/summary", async (req, res) => {
  const { name, judge_id, forceRefresh } = req.body ?? {};
  if (!name && !judge_id) {
    res.status(400).json({ error: "Provide a judge name or judge_id." });
    return;
  }

  const cacheKey = judgeCacheKey({ judgeId: judge_id, name });
  const cached = await getCachedJudge(cacheKey);

  if (isFresh(cached) && !forceRefresh) {
    res.json(toSummaryResponse(cached, "cache"));
    return;
  }

  let scraped;
  try {
    scraped = judge_id
      ? await lookupJudgeById(judge_id, req.session?.tabroomToken)
      : await lookupJudgeByName(name, req.session?.tabroomToken);
  } catch (err) {
    if (cached) {
      res.json(toSummaryResponse(cached, "cache-stale-fallback")); // Tabroom down, serve stale
      return;
    }
    const status = err instanceof TabroomJudgeError ? err.status || 502 : 502;
    res.status(status).json({ error: err.message || "Judge lookup failed." });
    return;
  }

  if (Array.isArray(scraped.results)) {
    res.json(scraped); // ambiguous name, nothing to cache yet
    return;
  }
  if (!scraped.paradigm?.trim()) {
    res.json({ ...scraped, summary: cached?.summary_json ?? null, summarySource: cached ? "cache" : null });
    return;
  }

  // The request's own key (e.g. name-only, no judge_id yet) can differ from
  // the canonical judge_id key once the scrape resolves one. Check the
  // canonical row too before deciding a Nemotron rerun is actually needed —
  // otherwise a name-only search that always resolves the same judge_id would
  // never see its own prior write (stored under the id key) and would
  // re-summarize on every single visit.
  const resolvedKey = judgeCacheKey({ judgeId: scraped.judge_id, name: scraped.name });
  const canonicalCached = resolvedKey === cacheKey ? cached : (await getCachedJudge(resolvedKey)) ?? cached;
  const newHash = hashParadigm(scraped.paradigm);

  // Writes go to both keys (when they differ) so a later lookup under either
  // the name or the judge_id hits the same cached row directly.
  async function writeAliases(row) {
    await upsertJudgeCache({ ...row, cache_key: resolvedKey });
    if (resolvedKey !== cacheKey) await upsertJudgeCache({ ...row, cache_key: cacheKey });
  }

  if (canonicalCached && canonicalCached.paradigm_hash === newHash) {
    await touchScrapedAt(resolvedKey); // TTL expired, text identical — no Nemotron call
    if (resolvedKey !== cacheKey) await touchScrapedAt(cacheKey);
    res.json(toSummaryResponse({ ...canonicalCached, scraped_at: new Date().toISOString() }, "cache-revalidated"));
    return;
  }

  if (!hasCredentials()) {
    res.status(500).json({ error: missingCredentialsError() });
    return;
  }
  if (!(await guardAiCall(req, res))) return; // 429 already sent by aiRateLimiter/dailyCap

  let summary;
  try {
    const text = await completeText({
      prompt: buildJudgeSummaryPrompt(scraped.name, scraped.paradigm),
      maxTokens: 2000,
      jsonSchema: JUDGE_SUMMARY_SCHEMA,
      model: ROUTE_MODELS.judgeInterpret,
    });
    summary = parseModelJson(text);
  } catch (err) {
    console.error("Judge summarize failed:", err);
    res.json(
      canonicalCached ? toSummaryResponse(canonicalCached, "cache-stale-fallback") : { ...scraped, summary: null, summarySource: null },
    );
    return;
  }

  const tags = Array.isArray(summary.tags) ? summary.tags.filter((t) => typeof t === "string" && t.trim()).slice(0, 6) : [];
  await writeAliases({
    judge_id: scraped.judge_id ?? null,
    name: scraped.name,
    source: scraped.source ?? "tabroom_fallback",
    tabroom_url: scraped.tabroom_url,
    paradigm_text: scraped.paradigm,
    paradigm_hash: newHash,
    summary_json: summary,
    tags,
    summary_model: ROUTE_MODELS.judgeInterpret,
  });
  res.json({ ...scraped, summary, summarySource: "ai", tags, cachedAt: new Date().toISOString() });
});

// --- Prep: AI red-team stress test ---
app.post("/api/stress-test", aiGuards, async (req, res) => {
  const { title, content, mode } = req.body ?? {};
  // "skim" = fast focused gut-check; anything else = full exhaustive audit.
  const isSkim = mode === "skim";
  if (typeof content !== "string" || !content.trim()) {
    res.status(400).json({ error: "content is required" });
    return;
  }
  if (rejectOversizedInput(res, content, "This case")) return;
  if (!hasCredentials()) {
    res.status(500).json({ error: missingCredentialsError() });
    return;
  }

  let system;
  try {
    // Retrieval mode: ground the audit in the corpus sections most relevant
    // to this case instead of inlining the whole corpus.
    system = await buildSystemPrompt({
      corpusMode: "retrieval",
      retrievalQuery: `${title || ""}\n${content}`,
    });
  } catch (err) {
    res.status(500).json({ error: `Failed to build system prompt: ${err.message}` });
    return;
  }

  // Ground the audit in real disclosed top-team cases on this topic (the public
  // wiki archive under training-data/cases/pf-archive), so flaw/attack cards can
  // point at what present/absent execution actually looks like. Best-effort and
  // topic-matched off the title — empty strings when nothing matches, so an
  // off-archive case degrades to the corpus-only audit unchanged.
  let benchmarkSection = "";
  let attackPatternSection = "";
  try {
    const groundingTopic = title || content.slice(0, 200);
    benchmarkSection = await buildStressBenchmarkSection({ topic: groundingTopic });
    attackPatternSection = await buildAttackPatternSection({ topic: groundingTopic });
  } catch (err) {
    console.error("Stress archive grounding failed (continuing without):", err.message);
  }

  const prompt =
    (isSkim
      ? `You are running a quick SKIM stress test on a debate case titled "${title || "Untitled case"}". ` +
        `This is a fast gut-check — surface only the most important, highest-severity issues, not an exhaustive audit.\n\n`
      : `You are running an EXHAUSTIVE pre-round stress test on a debate case titled "${title || "Untitled case"}". ` +
        `This is a full red-team audit, not a quick gut-check — be comprehensive and leave nothing meaningful uncovered.\n\n`) +
    `Evaluate the case against the four marks of a well-built case (the case-construction principles in your training ` +
    `corpus). Walk through EACH of these systematically:\n` +
    `  1. EMBEDDED WEIGHING & round vision — is there pre-written weighing built into the case, and is every card ` +
    `built to be extendable in the back half? Does each card fit the broader cohesive narrative (e.g. a uniqueness ` +
    `card that also serves as a timeframe card) rather than sticking out just to pad a flow?\n` +
    `  2. SPIKES — does the case have offensive spikes (cards that preempt/interact with likely opponent positions so ` +
    `the debater needn't win fresh defense in rebuttal) AND defensive spikes (embedded frontlines preempting the ` +
    `responses they'll actually face)? Call out the specific likely responses that are NOT yet spiked out.\n` +
    `  3. EVIDENCE QUALITY — author qualifications, recency, dataset size, and whether the case can win an ` +
    `evidence-comparison tiebreak. Flag thin sourcing, one source doing too much work, unbaselined stats, mis-cites, ` +
    `and any card that isn't defensible under press.\n` +
    `  4. COLLAPSE FLEXIBILITY — can the case collapse multiple ways (multiple impact scenarios, multiple ` +
    `links/uniqueness) so it isn't pinned to a single link, while staying close to defensible stock ground?\n\n` +
    `Then do two things:\n\n` +
    `1. Score the case's overall construction quality from 1-100 against those four marks plus warrant strength and ` +
    `internal consistency — a judgment of how well-built it is, not a prediction of whether it wins.\n` +
    (isSkim
      ? `2. Produce a FOCUSED set of analysis cards covering the highest-severity, most decisive issues — ` +
        `the flaws most likely to lose the round and the opponent's most probable attacks. This is a quick pass, not ` +
        `a full audit, so prioritize hard and skip minor nitpicks — but it must still include AT LEAST 6 "flaw" cards ` +
        `and AT LEAST 6 "attack" cards. Each card is EITHER:\n`
      : `2. Produce an EXHAUSTIVE set of analysis cards. Systematically cover all four marks above and surface EVERY ` +
        `meaningful construction flaw and EVERY likely opponent attack — do NOT cap at a handful. A full case's stress ` +
        `test is typically 12-20 cards and MUST include AT LEAST 6 "flaw" cards and AT LEAST 6 "attack" cards; go ` +
        `higher when the case warrants it. ` +
        `Don't pad with trivia, but never drop a real flaw just to keep the list short. Each card is EITHER:\n`) +
    `   - a "flaw" card: a genuine construction weakness in the case itself, tagged in a "dimension" field with which ` +
    `construction mark it falls under — one of "Embedded weighing", "Spikes", "Evidence quality", ` +
    `"Collapse flexibility", "Warrant", or "Internal consistency". Give a concrete suggestion for how to fix it — ` +
    `not just "here's what they'd say back". Comment directly on evidence quality when it's weak (thin sourcing, one ` +
    `source doing too much work, an unbaselined stat) rather than only flagging structural gaps. When the fix is an ` +
    `evidence gap, name the specific kind of card needed (e.g. "a solvency card for the mechanism, not just the ` +
    `harm") — described concretely enough to go cut it. Cards inside the debater's own submitted case may be named ` +
    `by their short cite; never reference your internal training corpus by file, case name, or card cite;\n` +
    `   - or an "attack" card: the strongest likely opponent argument against this case, in their voice. Two ` +
    `requirements: (a) LABEL the attack with the argument type it is, in an "attackType" field — one of ` +
    `"Non-unique", "Link turn", "Impact turn", "Impact defense", "Link defense", "Disad", "Case turn", ` +
    `"Framework", or "Theory" (pick the single best fit). (b) Do NOT write the frontline/answer for them. ` +
    `This tool exists to build the debater's own frontlining ability, so instead of handing over the response, ` +
    `give a "thinkPrompt": a short nudge (one or two sentences) that points them at how to answer — what to ` +
    `contest and where to prioritize it (rebuttal vs. summary vs. final focus) given optimal backhalf strategy — ` +
    `and prompts them to draft the frontline themselves, closing by noting they can ask Cross to help refine ` +
    `their draft. Do not include a "frontline" field on attack cards.\n` +
    `Include at least 6 cards of EACH type — 6 or more "flaw" cards AND 6 or more "attack" cards; don't make every ` +
    `card a predicted opponent response — flaws in the ` +
    `case's own construction matter independent of what an opponent might say. If the case or title names a ` +
    `judge you have paradigm data for, ground the flaws/attacks in that judge's specific standards (their ` +
    `warrant threshold, theory defaults, weighing preferences); otherwise use the general cross-judge consensus.\n\n` +
    `CRITICAL OUTPUT RULES — follow exactly:\n` +
    `- Every "attack" card MUST have an "attackType" field and a "thinkPrompt" field, and MUST NOT have a ` +
    `"frontline" field. Do not write the actual answer to the attack anywhere — not in "thinkPrompt", not ` +
    `elsewhere. "thinkPrompt" only points the debater at what to contest and where, and tells them to draft ` +
    `the frontline themselves (they can then ask Cross to refine it).\n` +
    `- Every "flaw" card MUST have a "dimension" field and a "frontline" field, and MUST NOT have "attackType" or ` +
    `"thinkPrompt".\n\n` +
    `Respond with ONLY a JSON object (no prose, no markdown fence) shaped exactly like: ` +
    `{"score": <integer 1-100>, "cards": [` +
    `{"type": "flaw", "severity": "High"|"Med"|"Low", ` +
    `"dimension": "<Embedded weighing|Spikes|Evidence quality|Collapse flexibility|Warrant|Internal consistency>", ` +
    `"wording": "<the construction weakness>", ` +
    `"frontline": "<the suggested fix or direction>"}, ` +
    `{"type": "attack", "severity": "High"|"Med"|"Low", ` +
    `"attackType": "<Non-unique|Link turn|Impact turn|Impact defense|Link defense|Disad|Case turn|Framework|Theory>", ` +
    `"wording": "<the likely opponent argument in their voice>", ` +
    `"thinkPrompt": "<nudge prompting the debater to build their own frontline — do NOT give the answer>"}]}.\n\n` +
    (benchmarkSection ? benchmarkSection + "\n\n" : "") +
    (attackPatternSection ? attackPatternSection + "\n\n" : "") +
    `--- CASE ---\n${content}`;

  try {
    // Skim now floors at 12 cards (6 flaws + 6 attacks), so it needs headroom
    // beyond its old 3000 or the JSON truncates mid-array.
    const text = await completeText({ system, prompt, maxTokens: isSkim ? 6000 : 8000, model: ROUTE_MODELS.stressTest });
    const result = parseModelJson(text);
    const score = Math.max(1, Math.min(100, Math.round(Number(result.score) || 0)));
    res.json({ score, cards: Array.isArray(result.cards) ? result.cards : [] });
  } catch (err) {
    console.error("Stress test failed:", err);
    res.status(500).json({ error: "Couldn't generate a stress test for this case. " + err.message });
  }
});

// --- Round: Strategy Mode checklist during prep time ---
app.post("/api/strategy-mode", aiGuards, async (req, res) => {
  const { event, flow, judge } = req.body ?? {};
  if (!hasCredentials()) {
    res.status(500).json({ error: missingCredentialsError() });
    return;
  }

  const flowText = Array.isArray(flow)
    ? flow.map((col) => `${col.title}:\n${col.cells.filter(Boolean).join("\n") || "(empty)"}`).join("\n\n")
    : "(no flow entered yet)";
  if (rejectOversizedInput(res, flowText, "This flow")) return;

  let system;
  try {
    system = await buildSystemPrompt({
      corpusMode: "retrieval",
      retrievalQuery: `${event || "debate"} round prep strategy${judge ? ` judge ${judge}` : ""}\n${flowText}`,
    });
  } catch (err) {
    res.status(500).json({ error: `Failed to build system prompt: ${err.message}` });
    return;
  }

  const prompt =
    `Prep time just started in a live ${event || "debate"} round${judge ? ` in front of judge ${judge}` : ""}. ` +
    `Here is the flow so far:\n\n${flowText}\n\n` +
    `Give a prioritized prep-time checklist: at most 5 items covering what to extend, what to kick, what to weigh, ` +
    `a suggested collapse, and a judge-adaptation reminder — only include items that actually apply given the flow above. ` +
    `${judge ? `Ground the judge-adaptation item in that specific judge's paradigm if you have data for them.` : `If no judge is named, ground any judge-adaptation item in the general cross-judge consensus rather than inventing specifics.`}\n\n` +
    `Respond with ONLY a JSON array (no prose, no markdown fence) shaped exactly like: ` +
    `{"title": "<short imperative action, under 10 words>", "rationale": "<2-3 sentence why>"}.`;

  try {
    const text = await completeText({ system, prompt, maxTokens: 2000, model: ROUTE_MODELS.strategy });
    const items = parseModelJson(text);
    res.json({ items });
  } catch (err) {
    console.error("Strategy Mode failed:", err);
    res.status(500).json({ error: "Couldn't generate strategy suggestions. " + err.message });
  }
});

// --- Drill: gamified practice round with Bayesian win-probability scoring ---
// Two endpoints implement the drill loop: /scenario generates a hypothetical
// round plus a hidden answer key (candidate moves scored via the factor
// weights in training-data/reference/factor-weights.md), and /grade scores
// the speech the debater actually wrote against that key. The model only
// picks factors and weights; all probability arithmetic happens server-side
// in lib/bayes.mjs so the numbers are deterministic.

// Extracts the JSON payload (object or array) from a model response that
// should be pure JSON but may arrive with stray prose or a markdown fence
// around it. Function declaration, so it hoists for the earlier endpoints.
function parseModelJson(text) {
  let candidate = String(text ?? "").trim();
  // Strip a markdown fence if the model wrapped the JSON in one.
  candidate = candidate.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  // Trim any prose before the first bracket / after the last one.
  const first = candidate.search(/[[{]/);
  const last = Math.max(candidate.lastIndexOf("}"), candidate.lastIndexOf("]"));
  if (first === -1 || last <= first) throw new Error("model response contained no JSON");
  candidate = candidate.slice(first, last + 1);
  try {
    return JSON.parse(candidate);
  } catch (err) {
    // Models occasionally emit literal control characters (raw newlines,
    // tabs) inside JSON string values, which strict JSON.parse rejects.
    // Escape them inside string literals and retry before giving up.
    const repaired = candidate.replace(/"(?:[^"\\]|\\.)*"/g, (str) =>
      str.replace(/[\u0000-\u001f]/g, (c) => (c === "\n" ? "\\n" : c === "\r" ? "\\r" : c === "\t" ? "\\t" : ""))
    );
    if (repaired !== candidate) return JSON.parse(repaired);
    throw err;
  }
}

// JSON schemas for structured outputs — the API constrains the drill
// responses to these shapes, so quoted speech lines and other awkward string
// content can't produce invalid JSON.

// Section titles are a fixed client-side label map (web/components/judges/
// judge-summary.tsx's SECTION_LABELS) — the model only ever fills content
// here, never headings/HTML/CSS.
const JUDGE_SUMMARY_BLOCK_SCHEMA = {
  type: "object",
  properties: {
    kind: { type: "string", enum: ["heading", "bullets", "callout", "keyPrefs"] },
    text: { type: "string" }, // heading + callout; "" otherwise
    tone: { type: "string", enum: ["neutral", "warning", "tip"] }, // callout only; "neutral" otherwise
    items: { type: "array", items: { type: "string" } }, // bullets only; [] otherwise
    pairs: {
      type: "array",
      items: {
        type: "object",
        properties: { label: { type: "string" }, value: { type: "string" } },
        required: ["label", "value"],
        additionalProperties: false,
      },
    }, // keyPrefs only; [] otherwise
  },
  required: ["kind", "text", "tone", "items", "pairs"],
  additionalProperties: false,
};

const JUDGE_SUMMARY_SECTION_SCHEMA = {
  type: "object",
  properties: {
    // false when the paradigm simply doesn't address this dimension — the
    // renderer skips the section entirely instead of showing padded filler.
    addressed: { type: "boolean" },
    blocks: { type: "array", items: JUDGE_SUMMARY_BLOCK_SCHEMA },
  },
  required: ["addressed", "blocks"],
  additionalProperties: false,
};

const JUDGE_SUMMARY_SCHEMA = {
  type: "object",
  properties: {
    headline: { type: "string" }, // one-sentence coaching summary
    tags: { type: "array", items: { type: "string" } }, // 3-6 short preference tags
    howToWin: { type: "array", items: { type: "string" } }, // 3-5 short actionable bullets
    sections: {
      type: "object",
      properties: {
        orientation: JUDGE_SUMMARY_SECTION_SCHEMA, // overall philosophy / how they decide
        delivery: JUDGE_SUMMARY_SECTION_SCHEMA, // speaking/delivery prefs
        evidence: JUDGE_SUMMARY_SECTION_SCHEMA, // evidence & warranting
        weighing: JUDGE_SUMMARY_SECTION_SCHEMA, // weighing/impacts
        theory: JUDGE_SUMMARY_SECTION_SCHEMA, // theory/T/procedural
        cx: JUDGE_SUMMARY_SECTION_SCHEMA, // CX style
        speakerPoints: JUDGE_SUMMARY_SECTION_SCHEMA,
        dealbreakers: JUDGE_SUMMARY_SECTION_SCHEMA, // pet peeves
      },
      required: ["orientation", "delivery", "evidence", "weighing", "theory", "cx", "speakerPoints", "dealbreakers"],
      additionalProperties: false,
    },
  },
  required: ["headline", "tags", "howToWin", "sections"],
  additionalProperties: false,
};

const DRILL_FACTOR_SCHEMA = {
  type: "object",
  properties: {
    name: { type: "string" },
    adjustment: { type: "number" },
    why: { type: "string" },
  },
  required: ["name", "adjustment", "why"],
  additionalProperties: false,
};

const DRILL_SCENARIO_SCHEMA = {
  type: "object",
  properties: {
    scenario: {
      type: "object",
      properties: {
        resolution: { type: "string" },
        format: { type: "string" },
        side: { type: "string" },
        speech: { type: "string" },
        roundHistory: {
          type: "array",
          items: {
            type: "object",
            properties: { speech: { type: "string" }, summary: { type: "string" } },
            required: ["speech", "summary"],
            additionalProperties: false,
          },
        },
        opponentProfile: { type: "string" },
        judgeParadigm: { type: "string" },
        task: { type: "string" },
      },
      required: ["resolution", "format", "side", "speech", "roundHistory", "opponentProfile", "judgeParadigm", "task"],
      additionalProperties: false,
    },
    answerKey: {
      type: "object",
      properties: {
        predictedOpponentMove: { type: "string" },
        hiddenNotes: { type: "string" },
        moves: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              description: { type: "string" },
              prior: { type: "number" },
              factors: { type: "array", items: DRILL_FACTOR_SCHEMA },
            },
            required: ["name", "description", "prior", "factors"],
            additionalProperties: false,
          },
        },
      },
      required: ["predictedOpponentMove", "hiddenNotes", "moves"],
      additionalProperties: false,
    },
  },
  required: ["scenario", "answerKey"],
  additionalProperties: false,
};

const DRILL_GRADE_SCHEMA = {
  type: "object",
  properties: {
    speechLedger: {
      type: "object",
      properties: {
        prior: { type: "number" },
        factors: { type: "array", items: DRILL_FACTOR_SCHEMA },
      },
      required: ["prior", "factors"],
      additionalProperties: false,
    },
    verdict: { type: "string" },
    roundVision: { type: "string" },
    lineByLine: {
      type: "array",
      items: {
        type: "object",
        properties: { quote: { type: "string" }, note: { type: "string" } },
        required: ["quote", "note"],
        additionalProperties: false,
      },
    },
    topFixes: { type: "array", items: { type: "string" } },
  },
  required: ["speechLedger", "verdict", "roundVision", "lineByLine", "topFixes"],
  additionalProperties: false,
};

const DRILL_LEDGER_RULES =
  `Factor rules (apply to every ledger you produce):\n` +
  `- Pick factors and log-odds adjustments from the drill factor-weights reference table in your training corpus. ` +
  `Include only factors genuinely true in this scenario — never the whole list.\n` +
  `- Ground every weight and probability judgment in how judges across the whole activity evaluate rounds — the ` +
  `judge paradigms in your training corpus are a representative sample of that population, not its boundary. Draw ` +
  `on the full breadth of judge paradigms you know (tech/flow, lay, hybrid) together with the round-vision ` +
  `lecture's framework; where the wider judging pool would genuinely diverge from the corpus sample, weight toward ` +
  `the broader norm and note it.\n` +
  `- Factors are degrees, not binary: interpolate between the table's scaled midpoints, and scale a weight up or ` +
  `down when the specific evidence is stronger or weaker than the table's default case (note the deviation in "why").\n` +
  `- Always include the round-vision factors alongside the clash factors, not as an afterthought. Round vision ` +
  `means playing the round forward, per the round-vision framework in your reference material: preempting the ` +
  `opponent's predicted next move (their time allocation last speech is the strongest telegraph), taking the path ` +
  `of least resistance (cheapest sufficient offense over contested flows), making positive time trades (weighing ` +
  `filters and strategic concessions over brute-force line-by-line), collapsing decisively, closing the door on ` +
  `the opponent's ballot path, leaving the final speech safety nets — or, for a final speech, mirroring the ` +
  `summary and preempting the judge's likely sticking point.\n` +
  `- Each factor is {"name": "<factor>", "adjustment": <signed number>, "why": "<one line on why it applies here>"}. ` +
  `Do NOT compute any probabilities yourself — the server does the math.`;

// Public Forum speech roles (CROSS.md §3). Every practice speech is preceded by
// a fixed chain of speeches from both teams; the drill's round history has to
// reproduce exactly that chain so the debater walks into the same round state
// they'd face live before the speech they picked.
const PF_SPEECH_ROLES = {
  Constructive: "presents the case — contentions plus framing (~4 min)",
  Rebuttal: "answers the other side's case line-by-line; the second rebuttal also frontlines answers to the first rebuttal",
  Summary: "collapses to what the team is winning and starts weighing (magnitude, probability, timeframe, clash)",
  "Final Focus": "crystallizes the round — writes the ballot for the judge",
};

// Given the debater's side and the speech they picked in the toggle, returns the
// ordered chain of speeches (both teams) that must precede it, plus the upcoming
// speech label. Speaking position is fixed per speech so the drill lands on the
// skill that speech tests: Rebuttal → the debater's team spoke SECOND (so their
// rebuttal is the frontlining second rebuttal); Summary / Final Focus → the
// debater's team spoke FIRST (so they aren't reacting to the opponent's same
// speech). Labels are team-level ("Pro Rebuttal") to match flow-style history.
function pfDrillSpeechPlan(side, speech) {
  const you = side === "Con" ? "Con" : "Pro";
  const opp = you === "Pro" ? "Con" : "Pro";
  const norm = String(speech || "").trim().toLowerCase();
  if (norm === "rebuttal") {
    return { you, opp, upcoming: `${you} Rebuttal`, preceding: [`${opp} Constructive`, `${you} Constructive`, `${opp} Rebuttal`] };
  }
  if (norm === "summary") {
    return { you, opp, upcoming: `${you} Summary`, preceding: [`${you} Constructive`, `${opp} Constructive`, `${you} Rebuttal`, `${opp} Rebuttal`] };
  }
  if (norm === "final focus") {
    return {
      you,
      opp,
      upcoming: `${you} Final Focus`,
      preceding: [`${you} Constructive`, `${opp} Constructive`, `${you} Rebuttal`, `${opp} Rebuttal`, `${you} Summary`, `${opp} Summary`],
    };
  }
  // Constructive or anything unexpected: opening speech, no prior history.
  return { you, opp, upcoming: `${you} ${speech || "Constructive"}`, preceding: [] };
}

app.post("/api/drill/scenario", aiGuards, async (req, res) => {
  const { format, side, speech, difficulty, topic } = req.body ?? {};
  // A chosen topic pins the resolution; blank keeps the invented-topic default.
  const chosenTopic = typeof topic === "string" ? topic.trim().slice(0, 400) : "";
  if (!hasCredentials()) {
    res.status(500).json({ error: missingCredentialsError() });
    return;
  }

  let system;
  try {
    // Scenario generation leans on case-construction/round-vision material
    // (reference/ is always inlined) plus whatever matches the chosen topic.
    system = await buildSystemPrompt({
      corpusMode: "retrieval",
      retrievalQuery:
        `${chosenTopic} ${format || "Public Forum"} ${side || ""} ${speech || ""} ` +
        `debate round scenario, case construction, collapse strategy, round vision, judge paradigm`,
    });
  } catch (err) {
    res.status(500).json({ error: `Failed to build system prompt: ${err.message}` });
    return;
  }

  // Ground the scenario's arguments/evidence in real disclosed top-team cases on
  // this topic (public wiki archive under training-data/cases/pf-archive) so the
  // round history rings true structurally. Best-effort and topic-matched — empty
  // when nothing matches, leaving the corpus-grounded generation unchanged. The
  // model still invents every cite (corpus-privacy rule).
  let archiveSection = "";
  try {
    archiveSection = await buildDrillCaseSection({ topic: chosenTopic, side, difficulty, speech });
  } catch (err) {
    console.error("Drill archive grounding failed (continuing without):", err.message);
  }

  const difficultyLine =
    difficulty === "intro"
      ? "Difficulty: INTRO — the optimal move should be fairly visible (e.g. an outright dropped argument begging to be collapsed to), so a newer debater can find it."
      : difficulty === "hard"
      ? "Difficulty: HARD — the optimal move should be genuinely non-obvious: the tempting surface-level play (e.g. chasing the loudest argument) should score notably worse than the real optimum, and execution-risk or judge-adaptation factors should matter."
      : "Difficulty: STANDARD — the optimal move is real but not glaringly obvious; a thoughtful debater finds it, a rushed one plays the tempting second-best move.";

  // Build the exact chain of PF speeches that precede the debater's chosen
  // speech, so the round history contains every speech required to hand them a
  // live, mid-round state (task: "generate as many speeches as required").
  const plan = pfDrillSpeechPlan(side, speech);
  const speechRoleGuide = Object.entries(PF_SPEECH_ROLES).map(([k, v]) => `${k} ${v}`).join("; ");
  const sequenceList = plan.preceding.length
    ? plan.preceding.map((s, i) => `${i + 1}. ${s}`).join("  ")
    : "(none — this is the opening speech of the round)";

  const prompt =
    `Generate a practice-drill scenario for a Public Forum debater on the ${plan.you} side, ` +
    `about to give the ${plan.upcoming} (the ${speech || "Summary"} speech they picked). ${difficultyLine}\n\n` +
    `Scenario requirements — all of these, concretely:\n` +
    (chosenTopic
      ? `- Use this resolution/topic, chosen by the debater: "${chosenTopic}". Keep the resolution wording as given ` +
        `(normalize it into standard "Resolved:" phrasing if it arrived as loose keywords) and build the entire ` +
        `round history around it. Use your training corpus to make the arguments and evidence references ring true ` +
        `structurally, but every cite in the scenario must be invented/fictional — never reuse a real card cite, ` +
        `case name, or file identity from your training material.\n`
      : `- A realistic resolution/topic. Use your training corpus to make the arguments and evidence references ring ` +
        `true structurally, but every cite in the scenario must be invented/fictional — never reuse a real card cite, ` +
        `case name, or file identity from your training material.\n`) +
    `- ROUND HISTORY = every speech that precedes the debater's ${plan.upcoming}, and only those. This is a Public ` +
    `Forum round (Constructive → Rebuttal → Summary → Final Focus, four speeches per side), so "roundHistory" MUST ` +
    `be exactly this ordered chain, one entry per speech, in this order:\n` +
    `    ${sequenceList}\n` +
    `  Each entry's "speech" field is that label verbatim; its "summary" is 2-4 sentences, flow-style, of what that ` +
    `speech did. Honor each speech's PF role — ${speechRoleGuide}. The debater's own team's earlier speeches in the ` +
    `chain set up what they now have to work with; if a second Rebuttal appears in the chain it should show ` +
    `frontlining of the first rebuttal. Give each side 2-3 real arguments, developed across their speeches the way a ` +
    `flow would capture them.\n` +
    `- Exactly one clearly dropped argument and one live turn OR open weighing gap embedded in that round history — ` +
    `present them naturally inside the relevant speeches, never labeled as such.\n` +
    `- The opponent's time allocation in ${plan.opp}'s most recent speech (which argument they invested in, which ` +
    `they skimped on), woven into the history — per the round-vision framework, time allocation telegraphs the ` +
    `collapse, and a sharp debater should read the predicted next move from it.\n` +
    `- An opponent profile including a stated tendency that supports predicting their single most likely next move.\n` +
    `- A judge paradigm drawn from the cross-judge consensus in your reference material (tech over truth, flow-based, ` +
    `warrant-demanding, comparative weighing, offense must live in both back-half speeches) with exactly one concrete ` +
    `deviation from the consensus's deviation list as the judge's quirk — the quirk should genuinely shape strategy.\n\n` +
    `Then — this is the hidden answer key, which the app will NOT show the debater until after they submit a ` +
    `speech — identify 3-4 realistic candidate moves for the upcoming speech and build a Bayesian ledger for each. ` +
    `Make the candidates span the round-vision option space rather than minor variations of one strategy: typically ` +
    `a path-of-least-resistance collapse, the tempting brute-force cover-everything play, a door-closing play ` +
    `against the opponent's predicted move, and (where the round state supports it) a weighing-centered or ` +
    `salvage-style line.\n\n` +
    (archiveSection ? archiveSection + "\n\n" : "") +
    DRILL_LEDGER_RULES + `\n\n` +
    `Respond with ONLY a JSON object (no prose, no markdown fence) shaped exactly like:\n` +
    `{"scenario": {"resolution": "<the resolution>", "format": "Public Forum", "side": "${plan.you}", ` +
    `"speech": "${plan.upcoming}", ` +
    `"roundHistory": [{"speech": "<one of the labels from the ordered chain above>", "summary": "<2-4 sentences of what happened, flow-style>"}], ` +
    `"opponentProfile": "<2-3 sentences: their arguments, skill, and stated tendency>", ` +
    `"judgeParadigm": "<2-3 sentences including the concrete quirk>", ` +
    `"task": "<one sentence telling the debater what to write>"}, ` +
    `"answerKey": {"predictedOpponentMove": "<their single most likely next move and why>", ` +
    `"hiddenNotes": "<which argument is dropped, what the live turn/weighing gap is>", ` +
    `"moves": [{"name": "<short move name>", "description": "<what it means concretely in this round>", ` +
    `"prior": 0.5, "factors": [{"name": "...", "adjustment": <number>, "why": "..."}]}]}}`;

  try {
    // 4000 was too tight for 4 candidate moves with full factor ledgers.
    // (The post-routing truncations here were Sonnet's default adaptive
    // thinking eating the budget — now disabled in aiClient.mjs; the JSON
    // itself measures ~3.5k tokens, so 12000 is generous headroom.)
    const text = await completeText({ system, prompt, maxTokens: 12000, jsonSchema: DRILL_SCENARIO_SCHEMA, model: ROUTE_MODELS.drill });
    const result = parseModelJson(text);
    if (!result?.scenario || !Array.isArray(result?.answerKey?.moves) || result.answerKey.moves.length === 0) {
      throw new Error("Model returned an incomplete scenario.");
    }
    // Score the answer key server-side; the client holds it but keeps it
    // hidden until the speech is graded.
    const moves = scoreMoves(result.answerKey.moves);
    res.json({ scenario: result.scenario, answerKey: { ...result.answerKey, moves } });
  } catch (err) {
    console.error("Drill scenario failed:", err);
    res.status(500).json({ error: "Couldn't generate a drill scenario. " + err.message });
  }
});

app.post("/api/drill/grade", aiGuards, async (req, res) => {
  const { scenario, answerKey, speechText, speechMeta } = req.body ?? {};
  if (typeof speechText !== "string" || !speechText.trim()) {
    res.status(400).json({ error: "speechText is required" });
    return;
  }
  if (!scenario || !Array.isArray(answerKey?.moves) || answerKey.moves.length === 0) {
    res.status(400).json({ error: "scenario and answerKey are required" });
    return;
  }
  if (rejectOversizedInput(res, speechText, "This speech")) return;
  if (!hasCredentials()) {
    res.status(500).json({ error: missingCredentialsError() });
    return;
  }

  let system;
  try {
    system = await buildSystemPrompt({
      corpusMode: "retrieval",
      retrievalQuery: `${scenario?.resolution || ""} ${scenario?.task || ""}\n${speechText}`,
    });
  } catch (err) {
    res.status(500).json({ error: `Failed to build system prompt: ${err.message}` });
    return;
  }

  const optimalMove = answerKey.moves.find((m) => m.optimal) || answerKey.moves[0];

  // When the speech arrived as a voice memo, the grader needs the delivery
  // context: the transcript is machine-made (calibration corrections already
  // applied), the debater never saw it, and pace was measured — not
  // self-reported.
  const isTranscribed = Boolean(speechMeta?.transcribed);
  const wpm = Number(speechMeta?.wpm) || 0;
  const durationSec = Number(speechMeta?.durationSec) || 0;
  const toneSummary = typeof speechMeta?.tone === "string" ? speechMeta.tone.trim() : "";
  const toneSegments = Array.isArray(speechMeta?.toneSegments) ? speechMeta.toneSegments : [];
  // Aggregate + per-segment tone, tone-aware criteria, cross-take trend, and
  // any coach-provided rubric files from delivery-data/ — see lib/delivery.mjs.
  const deliverySection = await buildDeliveryGradingSection({ toneSummary, toneSegments });
  const transcriptionContext = isTranscribed
    ? `\nDelivery context — this speech was DELIVERED ALOUD and auto-transcribed (the debater's voice-calibration ` +
      `corrections were already applied; the debater never saw the transcript).` +
      (durationSec ? ` Measured length: ${durationSec}s.` : "") +
      (wpm ? ` Measured pace: ${wpm} WPM (measured, not self-reported).` : "") +
      deliverySection +
      `\nTranscription rules:\n` +
      `- Calibration handles most jargon mis-hearings, but judge residual odd wording charitably — a garbled phrase may be ` +
      `transcription noise, not the debater's words. Don't penalize content for a one-off garble; say so in the note instead.\n` +
      `- BUT estimate what fraction of the transcript is genuinely hard to comprehend (garbled, incoherent, or dropping ` +
      `mid-sentence). If roughly 25% or more is hard to comprehend, that is a delivery problem, not a transcription quirk: ` +
      `include clarity as one of the top fixes — tell the debater directly to slow down and enunciate — and apply the ` +
      `delivery factors for it (a judge who can't flow a line treats it as never said).\n` +
      `- Pace: treat ~200 WPM as the ceiling for comprehensible delivery. If the measured WPM is meaningfully above that, ` +
      `the fix is word economy (cut the speech down), not just "talk slower" — a debater who needs the words out will ` +
      `re-accelerate.\n`
    : "";

  const prompt =
    `You are grading a practice-drill speech. Here is the scenario the debater was given:\n\n` +
    `${JSON.stringify(scenario, null, 2)}\n\n` +
    `Hidden answer key (the debater has NOT seen this):\n` +
    `- Predicted opponent next move: ${answerKey.predictedOpponentMove || "(none recorded)"}\n` +
    `- Hidden round facts: ${answerKey.hiddenNotes || "(none recorded)"}\n` +
    `- Optimal move: ${optimalMove.name} — ${optimalMove.description} ` +
    `(estimated ${(optimalMove.probability * 100).toFixed(0)}%)\n\n` +
    transcriptionContext +
    `\nThe debater's submitted ${scenario.speech || "speech"}:\n\n--- SPEECH ---\n${speechText}\n--- END SPEECH ---\n\n` +
    `Grade it in three steps:\n` +
    `1. Identify what the speech actually did: which arguments it extended or dropped, whether it introduced new ` +
    `material, whether and how it weighed, whether it matched the judge's stated preferences and the norms for ` +
    `this speech slot, and whether it showed round vision. Grade the round-vision DECISIONS at least as heavily as ` +
    `the execution, checking the framework's principles by name: did it take the path of least resistance (the ` +
    `cheapest sufficient offense) or grind through a contested flow? did it trade time efficiently (weighing ` +
    `filters, grouping, strategic concessions) or brute-force line-by-line? did it collapse decisively or ` +
    `half-collapse? did it preempt the opponent's predicted move (readable from their time allocation and profile) ` +
    `and close the door on their ballot path? did it leave the final speech safety nets — or, if this IS the final ` +
    `speech, mirror the summary, speak in ballot-ready reason-for-decision language, and preempt the judge's ` +
    `likely sticking point? did it respect a live weighing debate? Map each observed behavior onto rows of the ` +
    `drill factor-weights table.\n` +
    `2. Build the Bayesian ledger the speech actually earned — positive and negative factors both.\n` +
    `3. Write line-by-line feedback: walk the speech in order, one sentence or logical chunk at a time, quoting or ` +
    `closely paraphrasing each line before the note so the debater can match feedback to their own text. Note what ` +
    `each line accomplished, missed, or risked.\n\n` +
    DRILL_LEDGER_RULES + `\n\n` +
    `Additional grading rules:\n` +
    `- Evaluate through the cross-judge consensus in your reference material: offense counts only if extended in both ` +
    `back-half speeches, defense isn't sticky, an unwarranted claim is not an argument, turns need link+impact ` +
    `implication, and a line the judge couldn't flow was functionally never said. Apply the judge-consensus rows of ` +
    `the factor-weights table alongside the clash and round-vision rows. That consensus is a sample, not the ` +
    `universe: base the ledger's weights and the final probability on how judges across the whole activity would ` +
    `evaluate this speech — every paradigm you know plus the round-vision lecture's framework — using the corpus ` +
    `paradigms for depth and direct heuristics rather than as the only voices in the room.\n` +
    `- If the speech's organization or warranting is hard to identify — you can't cleanly reconstruct what answers ` +
    `what, or claims lean on cites with no explained why — say that explicitly in the feedback and make it a top fix. ` +
    `This feedback is mandatory whenever it applies, not optional polish.\n` +
    `- If something about the speech's intent is genuinely ambiguous (a line that might be a real answer or just a ` +
    `gesture at one), say so in the relevant note rather than silently picking an interpretation.\n` +
    `- If the speech genuinely found a line as strong as or stronger than the answer key's optimal move, say so in ` +
    `"verdict" — the heuristic weights are estimates, and a well-reasoned human judgment call can beat them.\n` +
    `- Coaching tone: specific and concrete ("you extended the economy disad but never said why it outweighs") ` +
    `over generic praise. Give suggestions and direction, not rewritten lines.\n` +
    `- Ground the qualitative feedback in the deep coaching material from your training corpus — the ` +
    `case-construction marks (embedded weighing, spikes, evidence quality, collapse flexibility), the frontlining ` +
    `methodology, and the judge-paradigm data — not in glossary-level definitions. Where the speech left an ` +
    `evidence gap, describe the kind of card that would plug it. Arguments and cites from the scenario or the ` +
    `debater's own speech may be named freely; never reference your internal training corpus by file, case name, ` +
    `or card cite.\n\n` +
    `Respond with ONLY a JSON object (no prose, no markdown fence) shaped exactly like:\n` +
    `{"speechLedger": {"prior": 0.5, "factors": [{"name": "...", "adjustment": <number>, "why": "..."}]}, ` +
    `"verdict": "<2-3 sentences: why the gap between this speech and the optimal move, or why they nailed/beat it>", ` +
    `"roundVision": "<the predicted opponent move, whether the speech preempted it, and whether it set up the final ` +
    `speech — or preempted the judge's sticking point if this was the final speech>", ` +
    `"lineByLine": [{"quote": "<quoted or closely paraphrased line>", "note": "<what it did well or missed>"}], ` +
    `"topFixes": ["<most impactful specific change>", "<second most impactful>"]}`;

  try {
    // Line-by-line feedback on a full-length speech needs room — 6000 could
    // truncate mid-JSON on long submissions.
    const text = await completeText({ system, prompt, maxTokens: 12000, jsonSchema: DRILL_GRADE_SCHEMA, model: ROUTE_MODELS.drill });
    const result = parseModelJson(text);
    const speechScore = scoreLedger(result.speechLedger);
    // Tone-over-time: persist this take's delivery metrics so future grades
    // can reference the trend. Best-effort — never fail a grade over it.
    if (isTranscribed) {
      recordDeliverySnapshot({
        route: "drill",
        wpm,
        durationSec,
        toneSegments,
        score: speechScore.probability,
      }).catch((err) => console.error("Delivery snapshot failed:", err));
    }
    res.json({
      speechScore,
      optimalMove: {
        name: optimalMove.name,
        description: optimalMove.description,
        probability: optimalMove.probability,
        prior: optimalMove.prior,
        factors: optimalMove.factors,
      },
      predictedOpponentMove: answerKey.predictedOpponentMove || "",
      verdict: typeof result.verdict === "string" ? result.verdict : "",
      roundVision: typeof result.roundVision === "string" ? result.roundVision : "",
      lineByLine: Array.isArray(result.lineByLine) ? result.lineByLine : [],
      topFixes: Array.isArray(result.topFixes) ? result.topFixes : [],
    });
  } catch (err) {
    console.error("Drill grading failed:", err);
    res.status(500).json({ error: "Couldn't grade this speech. " + err.message });
  }
});

// Tone-over-time snapshots recorded by graded drill speeches (lib/delivery.mjs).
app.get("/api/drill/delivery-history", async (req, res) => {
  try {
    res.json({ snapshots: await getDeliveryHistory() });
  } catch (err) {
    console.error("Delivery history read failed:", err);
    res.status(500).json({ error: "Couldn't load delivery history." });
  }
});

// --- Recording Insight: feedback on a REAL round speech ---------------------
// Unlike /api/drill/grade, there's no invented scenario or hidden answer key —
// the debater submits (records or uploads) a speech they actually gave, and
// gets direct round feedback: what worked, what didn't, how to fix it. No
// Bayesian ledger/win-probability here, since there's nothing to score it
// against — see CROSS.md's "Round feedback" section, not "Practice drills."

const INSIGHT_GRADE_SCHEMA = {
  type: "object",
  properties: {
    verdict: { type: "string" },
    strengths: {
      type: "array",
      items: {
        type: "object",
        properties: { quote: { type: "string" }, note: { type: "string" } },
        required: ["quote", "note"],
        additionalProperties: false,
      },
    },
    weaknesses: {
      type: "array",
      items: {
        type: "object",
        properties: { quote: { type: "string" }, note: { type: "string" } },
        required: ["quote", "note"],
        additionalProperties: false,
      },
    },
    topFixes: { type: "array", items: { type: "string" } },
    improvedFromLastTime: { type: "string" },
  },
  required: ["verdict", "strengths", "weaknesses", "topFixes", "improvedFromLastTime"],
  additionalProperties: false,
};

const INSIGHT_FEEDBACK_RULES =
  `Feedback rules:\n` +
  `- This is a REAL speech from an actual round the debater gave — not a hypothetical drill against a hidden ` +
  `answer key. There is no "optimal move" to compare against; coach what's actually in the transcript.\n` +
  `- Structure the feedback the way a post-round debrief works (CROSS.md §2): what won or lost this speech's job, ` +
  `what to fix by the next time they give this speech, and what to keep doing.\n` +
  `- Ground the judgment in the deep coaching material from your training corpus, not in glossary-level ` +
  `definitions: use the case-construction marks (embedded weighing & round vision, spikes, evidence quality, ` +
  `collapse flexibility) and the frontlining methodology to judge whether responses and warrants were actually ` +
  `built and answered well; use the judge-paradigm and cross-judge-consensus data to judge what actually won or ` +
  `lost this speech's job; and use real tournament rounds and RFDs (the emerald-ag set is ground truth for ` +
  `circuit-level execution) as your exemplar of what winning execution at this level actually sounds like, not ` +
  `just textbook definitions. Apply the pattern, never the content — per the corpus-privacy rule, none of this ` +
  `material is ever referenced by file, case, or cite.\n` +
  `- "strengths" and "weaknesses" both walk the speech itself: quote or closely paraphrase the specific line, then ` +
  `note what it accomplished or missed. Ground every note in the transcript actually given — never invent content ` +
  `that isn't there.\n` +
  `- Specificity is fair game: call out vague tags, generic analytics, hand-wavy warrants, or evidence that's ` +
  `present but under-explained. When the speech is thin on evidence, name the kind of card that would plug the gap ` +
  `(what it needs to establish), not a real cite — never fabricate or reference a training-corpus cite by name.\n` +
  `- "topFixes" are concrete, actionable changes for the next take of this speech — not generic encouragement.\n` +
  `- If a previous attempt is provided below, compare this take against it: if the speech genuinely fixed a ` +
  `weakness from last time, say so explicitly and specifically in "improvedFromLastTime" before moving to new ` +
  `critique — don't let real improvement pass unacknowledged. If nothing changed, or this isn't a redo, leave ` +
  `"improvedFromLastTime" as an empty string. Never invent improvement that isn't actually there.`;

app.post("/api/insight/grade", aiGuards, async (req, res) => {
  const { speechText, speechMeta, roundContext, previousInsight } = req.body ?? {};
  if (typeof speechText !== "string" || !speechText.trim()) {
    res.status(400).json({ error: "speechText is required" });
    return;
  }
  if (rejectOversizedInput(res, speechText, "This speech")) return;
  if (!hasCredentials()) {
    res.status(500).json({ error: missingCredentialsError() });
    return;
  }

  const side = typeof roundContext?.side === "string" ? roundContext.side.trim() : "";
  const speechType = typeof roundContext?.speechType === "string" ? roundContext.speechType.trim() : "";
  const topic = typeof roundContext?.topic === "string" ? roundContext.topic.trim() : "";
  const judgeType = typeof roundContext?.judgeType === "string" ? roundContext.judgeType.trim() : "";
  const focusArea = typeof roundContext?.focusArea === "string" ? roundContext.focusArea.trim() : "";

  let system;
  try {
    system = await buildSystemPrompt({
      corpusMode: "retrieval",
      // Phrased toward judge RFD/decision-process language rather than
      // generic "speech critique, delivery coaching" — measured to pull a
      // more relevant judging/ section on at least some topics (a real PF
      // rebuttal tested closer to actual paradigm voting rules: "offense
      // must appear in both summary and final focus," "defense isn't
      // sticky"). On other topics it made no difference (the corpus simply
      // doesn't have enough judging-relevant candidates to discriminate
      // between), but it never scored worse in testing — low-confidence but
      // harmless, kept as a secondary nudge on top of retrievalBoostDirs below.
      retrievalQuery:
        `${topic} ${speechType} judge RFD reason for decision, weighing and comparative analysis, dropped and ` +
        `extended arguments, judge paradigm decision process and speaker feedback\n${speechText}`,
      // This is feedback on a REAL delivered speech, not a hypothetical —
      // bias retrieval toward real rounds/RFDs (what winning execution
      // actually looks like) and judge-paradigm data (what wins a ballot),
      // the two folders INSIGHT_FEEDBACK_RULES specifically tells the model
      // to coach from, over whatever else scores marginally higher on raw
      // similarity to the topic/speech text.
      retrievalBoostDirs: ["rounds", "judging"],
    });
  } catch (err) {
    res.status(500).json({ error: `Failed to build system prompt: ${err.message}` });
    return;
  }

  // Same delivery/transcription context drill grading uses — see lib/delivery.mjs.
  const isTranscribed = Boolean(speechMeta?.transcribed);
  const wpm = Number(speechMeta?.wpm) || 0;
  const durationSec = Number(speechMeta?.durationSec) || 0;
  const toneSummary = typeof speechMeta?.tone === "string" ? speechMeta.tone.trim() : "";
  const toneSegments = Array.isArray(speechMeta?.toneSegments) ? speechMeta.toneSegments : [];
  const deliverySection = await buildDeliveryGradingSection({ toneSummary, toneSegments });
  const transcriptionContext = isTranscribed
    ? `\nDelivery context — this speech was DELIVERED ALOUD and auto-transcribed (the debater's voice-calibration ` +
      `corrections were already applied; the debater never saw the transcript).` +
      (durationSec ? ` Measured length: ${durationSec}s.` : "") +
      (wpm ? ` Measured pace: ${wpm} WPM (measured, not self-reported).` : "") +
      deliverySection +
      `\nTranscription rules:\n` +
      `- Calibration handles most jargon mis-hearings, but judge residual odd wording charitably — a garbled ` +
      `phrase may be transcription noise, not the debater's words. Don't penalize content for a one-off garble; ` +
      `say so in the note instead.\n` +
      `- BUT estimate what fraction of the transcript is genuinely hard to comprehend (garbled, incoherent, or ` +
      `dropping mid-sentence). If roughly 25% or more is hard to comprehend, that's a delivery problem, not a ` +
      `transcription quirk: include clarity as one of the top fixes and say so directly.\n` +
      `- Pace: treat ~200 WPM as the ceiling for comprehensible delivery. If the measured WPM is meaningfully ` +
      `above that, the fix is word economy (cut the speech down), not just "talk slower" — a debater who needs ` +
      `the words out will re-accelerate.\n`
    : "";

  const roundContextLines = [
    side ? `- Side: ${side}` : "",
    speechType ? `- Speech: ${speechType}` : "",
    topic ? `- Resolution/topic: ${topic}` : "",
    judgeType ? `- Judge: ${judgeType}` : "",
    focusArea ? `- What the debater specifically wants feedback on: ${focusArea}` : "",
  ].filter(Boolean);
  const roundContextBlock = roundContextLines.length
    ? `\nRound context the debater gave:\n${roundContextLines.join("\n")}\n`
    : `\nNo round context was given (side/speech/topic/judge unknown). Coach from the transcript alone, and note ` +
      `in "verdict" that more context (side, which speech, the resolution, lay vs. flow judge) would sharpen the ` +
      `feedback.\n`;

  const previousInsightBlock =
    previousInsight && typeof previousInsight.verdict === "string"
      ? `\nThis is a REDO — the debater's previous attempt at this same speech got this feedback:\n` +
        `- Verdict: ${previousInsight.verdict}\n` +
        (Array.isArray(previousInsight.topFixes) && previousInsight.topFixes.length
          ? `- Top fixes given last time: ${previousInsight.topFixes.join("; ")}\n`
          : "") +
        `Compare this new take against that feedback specifically.\n`
      : "";

  const prompt =
    `You're giving round feedback on a real Public Forum speech a debater actually gave (or is redoing) — not a ` +
    `hypothetical drill.\n` +
    roundContextBlock +
    transcriptionContext +
    previousInsightBlock +
    `\nThe debater's speech:\n\n--- SPEECH ---\n${speechText}\n--- END SPEECH ---\n\n` +
    INSIGHT_FEEDBACK_RULES + `\n\n` +
    `Respond with ONLY a JSON object (no prose, no markdown fence) shaped exactly like:\n` +
    `{"verdict": "<2-4 sentences: what won or lost this speech's job>", ` +
    `"strengths": [{"quote": "<quoted or closely paraphrased line>", "note": "<what it did well>"}], ` +
    `"weaknesses": [{"quote": "<quoted or closely paraphrased line>", "note": "<what it missed or risked>"}], ` +
    `"topFixes": ["<most impactful specific change>", "<second most impactful>"], ` +
    `"improvedFromLastTime": "<empty string, unless this is a redo that genuinely fixed something>"}`;

  try {
    const text = await completeText({ system, prompt, maxTokens: 6000, jsonSchema: INSIGHT_GRADE_SCHEMA, model: ROUTE_MODELS.insight });
    const result = parseModelJson(text);
    // Tone-over-time: persist this take's delivery metrics under its own
    // route so drill and insight trends don't mix — see lib/delivery.mjs.
    if (isTranscribed) {
      recordDeliverySnapshot({
        route: "recording-insight",
        wpm,
        durationSec,
        toneSegments,
      }).catch((err) => console.error("Delivery snapshot failed:", err));
    }
    res.json({
      verdict: typeof result.verdict === "string" ? result.verdict : "",
      strengths: Array.isArray(result.strengths) ? result.strengths : [],
      weaknesses: Array.isArray(result.weaknesses) ? result.weaknesses : [],
      topFixes: Array.isArray(result.topFixes) ? result.topFixes : [],
      improvedFromLastTime: typeof result.improvedFromLastTime === "string" ? result.improvedFromLastTime : "",
    });
  } catch (err) {
    console.error("Insight grading failed:", err);
    res.status(500).json({ error: "Couldn't grade this speech. " + err.message });
  }
});

// --- Recording Insight: Full Round mode --------------------------------
// A debater can record/upload an ENTIRE round instead of one speech. There's
// no speaker diarization anywhere in this stack (stt.mjs's Groq/Hume/local-
// Whisper tiers all return one flat transcript, no "who's talking" signal),
// so splitting it into individual speeches has to come from the model
// reading the transcript's content and PF's fixed structure — inherently
// inferential, which is why the model is only ever trusted for BOUNDARIES
// (an anchor quote per segment), never for reproducing speech text itself:
// the server locates each anchor in the real transcript and slices there, so
// a paraphrased anchor can't silently corrupt what gets graded.

function normalizeForSearch(s) {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

// Locates `needle` inside `haystack`, returning an offset into the ORIGINAL
// (un-normalized) haystack. Tries an exact match first, then falls back to a
// whitespace/case-normalized search — the model's anchor quote may not
// reproduce the transcript's exact whitespace or casing.
function findAnchorOffset(haystack, needle) {
  if (!needle) return -1;
  const exact = haystack.indexOf(needle);
  if (exact !== -1) return exact;

  let normalized = "";
  const indexMap = [];
  let prevWasSpace = false;
  for (let i = 0; i < haystack.length; i++) {
    const ch = haystack[i];
    if (/\s/.test(ch)) {
      if (!prevWasSpace) {
        normalized += " ";
        indexMap.push(i);
        prevWasSpace = true;
      }
    } else {
      normalized += ch.toLowerCase();
      indexMap.push(i);
      prevWasSpace = false;
    }
  }
  const pos = normalized.indexOf(normalizeForSearch(needle));
  return pos === -1 ? -1 : indexMap[pos];
}

const INSIGHT_SEGMENT_SCHEMA = {
  type: "object",
  properties: {
    segments: {
      type: "array",
      items: {
        type: "object",
        properties: {
          label: { type: "string" },
          side: { type: "string" },
          speechType: { type: "string" },
          startsWith: { type: "string" },
        },
        required: ["label", "side", "speechType", "startsWith"],
        additionalProperties: false,
      },
    },
  },
  required: ["segments"],
  additionalProperties: false,
};

app.post("/api/insight/segment-round", aiGuards, async (req, res) => {
  const { transcript } = req.body ?? {};
  if (typeof transcript !== "string" || !transcript.trim()) {
    res.status(400).json({ error: "transcript is required" });
    return;
  }
  if (rejectOversizedInput(res, transcript, "This recording's transcript")) return;
  if (!hasCredentials()) {
    res.status(500).json({ error: missingCredentialsError() });
    return;
  }

  let system;
  try {
    system = await buildSystemPrompt({
      corpusMode: "retrieval",
      retrievalQuery: "Public Forum round structure, speech order, crossfire, constructive rebuttal summary final focus",
    });
  } catch (err) {
    res.status(500).json({ error: `Failed to build system prompt: ${err.message}` });
    return;
  }

  const prompt =
    `A debater recorded (or uploaded) an ENTIRE Public Forum round — potentially both sides' speeches and crossfires ` +
    `in one continuous recording — and it was transcribed as one flat transcript with NO speaker labels (no audio ` +
    `diarization exists in this pipeline). Your job is to split it into the individual speeches, inferring who's ` +
    `speaking from content and PF's structure, not from any audio cue.\n\n` +
    `PF's full round structure, in order (a real recording may contain only SOME of these — never invent a segment ` +
    `that isn't actually present):\n` +
    `1. Pro Constructive, 2. Con Constructive, [First Crossfire], 3. Pro Rebuttal, 4. Con Rebuttal, [Second ` +
    `Crossfire], 5. Pro Summary, 6. Con Summary, [Grand Crossfire], 7. Pro Final Focus, 8. Con Final Focus.\n` +
    `(Which side goes first is set by a coin flip and stays consistent for the whole round — infer it from the ` +
    `transcript, don't assume Pro always speaks first.)\n\n` +
    `How to tell speeches apart by content:\n` +
    `- Constructive: presents a case's contentions/framing, no direct responses to an opponent yet.\n` +
    `- Rebuttal: directly answers the other side's case line-by-line; a SECOND rebuttal also frontlines answers to ` +
    `the first rebuttal (so it responds to two things at once — the original case AND the first rebuttal's answers).\n` +
    `- Summary: collapses to fewer arguments and starts weighing (magnitude/probability/timeframe/scope language).\n` +
    `- Final Focus: crystallizes the round, writes the ballot, heaviest weighing/voter language, shortest speech.\n` +
    `- Crossfire: rapid back-and-forth question/answer exchange between multiple speakers, distinct in rhythm from ` +
    `the monologue speeches around it — label it "Crossfire" or "Grand Crossfire" (the one before Final Focus is ` +
    `Grand Crossfire; the others are First/Second Crossfire) but don't try to attribute a single side to it.\n\n` +
    `For EACH segment you identify, give:\n` +
    `- "label": a short human label, e.g. "Pro Constructive", "Con Rebuttal", "Grand Crossfire".\n` +
    `- "side": "Pro" or "Con" for a solo speech; "" for any crossfire.\n` +
    `- "speechType": one of "Constructive", "Rebuttal", "Summary", "Final Focus", "Crossfire".\n` +
    `- "startsWith": the EXACT first 8-15 words of this segment, copied verbatim character-for-character from the ` +
    `transcript below (not paraphrased) — this is how the app finds where your segment begins, so it must match ` +
    `the transcript's actual wording exactly.\n\n` +
    `Segments must be in the order they occur in the transcript. If you genuinely cannot tell where one speech ends ` +
    `and the next begins, prefer fewer, larger segments over guessing at a boundary that isn't really there.\n\n` +
    `--- TRANSCRIPT ---\n${transcript}\n--- END TRANSCRIPT ---\n\n` +
    `Respond with ONLY a JSON object (no prose, no markdown fence) shaped exactly like:\n` +
    `{"segments": [{"label": "...", "side": "...", "speechType": "...", "startsWith": "..."}]}`;

  try {
    const text = await completeText({ system, prompt, maxTokens: 3000, jsonSchema: INSIGHT_SEGMENT_SCHEMA, model: ROUTE_MODELS.insight });
    const result = parseModelJson(text);
    const rawSegments = Array.isArray(result?.segments) ? result.segments : [];

    // Resolve each anchor to a real offset in the ORIGINAL transcript — the
    // model's JSON only ever locates boundaries, never supplies the text
    // that gets graded (see file-header comment above).
    const resolved = rawSegments
      .map((s) => ({
        label: typeof s.label === "string" ? s.label.trim() : "",
        side: typeof s.side === "string" ? s.side.trim() : "",
        speechType: typeof s.speechType === "string" ? s.speechType.trim() : "",
        offset: findAnchorOffset(transcript, typeof s.startsWith === "string" ? s.startsWith.trim() : ""),
      }))
      .filter((s) => s.offset !== -1 && s.label)
      .sort((a, b) => a.offset - b.offset);

    if (resolved.length < 2) {
      res.status(422).json({
        error:
          "Couldn't reliably split that recording into speeches — try a recording with less crosstalk or " +
          "background noise, or switch to single-speech mode for just your part.",
      });
      return;
    }

    const segments = resolved.map((s, i) => {
      const end = i + 1 < resolved.length ? resolved[i + 1].offset : transcript.length;
      const segText = transcript.slice(s.offset, end).trim();
      return {
        label: s.label,
        side: s.side,
        speechType: s.speechType,
        text: segText,
        wordCount: segText.split(/\s+/).filter(Boolean).length,
      };
    });

    res.json({ segments });
  } catch (err) {
    console.error("Round segmentation failed:", err);
    res.status(500).json({ error: "Couldn't split that recording into speeches. " + err.message });
  }
});

const INSIGHT_ROUND_GRADE_SCHEMA = {
  type: "object",
  properties: {
    verdict: { type: "string" },
    strengths: {
      type: "array",
      items: {
        type: "object",
        properties: { quote: { type: "string" }, note: { type: "string" }, speechLabel: { type: "string" } },
        required: ["quote", "note", "speechLabel"],
        additionalProperties: false,
      },
    },
    weaknesses: {
      type: "array",
      items: {
        type: "object",
        properties: { quote: { type: "string" }, note: { type: "string" }, speechLabel: { type: "string" } },
        required: ["quote", "note", "speechLabel"],
        additionalProperties: false,
      },
    },
    topFixes: { type: "array", items: { type: "string" } },
    perSpeechNotes: {
      type: "array",
      items: {
        type: "object",
        properties: { label: { type: "string" }, note: { type: "string" } },
        required: ["label", "note"],
        additionalProperties: false,
      },
    },
  },
  required: ["verdict", "strengths", "weaknesses", "topFixes", "perSpeechNotes"],
  additionalProperties: false,
};

// Holistic post-round debrief across every speech ONE debater personally
// gave in a round (not their partner's) — separate from /api/insight/grade
// (unchanged) so a single-speech grade never has to carry the extra
// speechLabel/perSpeechNotes fields this route needs.
app.post("/api/insight/grade-round", aiGuards, async (req, res) => {
  const { speeches, roundContext } = req.body ?? {};
  if (!Array.isArray(speeches) || speeches.length === 0) {
    res.status(400).json({ error: "speeches is required" });
    return;
  }
  const cleanSpeeches = speeches
    .map((s) => ({
      label: typeof s?.label === "string" ? s.label.trim() : "",
      side: typeof s?.side === "string" ? s.side.trim() : "",
      speechType: typeof s?.speechType === "string" ? s.speechType.trim() : "",
      text: typeof s?.text === "string" ? s.text.trim() : "",
    }))
    .filter((s) => s.text && s.label);
  if (cleanSpeeches.length === 0) {
    res.status(400).json({ error: "At least one labeled speech with text is required" });
    return;
  }
  const combinedText = cleanSpeeches.map((s) => s.text).join("\n\n");
  if (rejectOversizedInput(res, combinedText, "These speeches")) return;
  if (!hasCredentials()) {
    res.status(500).json({ error: missingCredentialsError() });
    return;
  }

  const topic = typeof roundContext?.topic === "string" ? roundContext.topic.trim() : "";
  const judgeType = typeof roundContext?.judgeType === "string" ? roundContext.judgeType.trim() : "";
  const focusArea = typeof roundContext?.focusArea === "string" ? roundContext.focusArea.trim() : "";

  let system;
  try {
    system = await buildSystemPrompt({
      corpusMode: "retrieval",
      retrievalQuery: `${topic} Public Forum round debrief, collapse strategy, weighing, round vision\n${combinedText}`,
      // Same reasoning as /api/insight/grade — see comment there.
      retrievalBoostDirs: ["rounds", "judging"],
    });
  } catch (err) {
    res.status(500).json({ error: `Failed to build system prompt: ${err.message}` });
    return;
  }

  const roundContextLines = [
    topic ? `- Resolution/topic: ${topic}` : "",
    judgeType ? `- Judge: ${judgeType}` : "",
    focusArea ? `- What the debater specifically wants feedback on: ${focusArea}` : "",
  ].filter(Boolean);
  const roundContextBlock = roundContextLines.length ? `\nRound context the debater gave:\n${roundContextLines.join("\n")}\n` : "";

  const speechesBlock = cleanSpeeches
    .map((s) => `--- ${s.label.toUpperCase()} ---\n${s.text}\n--- END ${s.label.toUpperCase()} ---`)
    .join("\n\n");
  const labelList = cleanSpeeches.map((s) => s.label).join(", ");

  const prompt =
    `You're giving a POST-ROUND DEBRIEF on a real Public Forum round. Below are every speech THIS ONE DEBATER ` +
    `personally delivered in the round (not their partner's) — they may be one speech or several, in round order. ` +
    `Grade their personal performance across the round as a whole, not each speech in isolation.\n` +
    roundContextBlock +
    `\nThe debater's speeches, in round order (labels: ${labelList}):\n\n${speechesBlock}\n\n` +
    `Structure the debrief the way a real post-round debrief works (CROSS.md §2): what won or lost the round for ` +
    `this debater, what to fix by their next round, what to keep doing.\n` +
    `Specifically call out the THROUGHLINE across their speeches — did an earlier speech's weighing mechanism or ` +
    `argument actually get carried through and extended in a later one, or was it set up and then dropped? Did a ` +
    `later speech (e.g. Final Focus) successfully crystallize what an earlier one (e.g. Rebuttal or Summary) ` +
    `established, or lose the thread? Put this cross-speech analysis in "perSpeechNotes" — one entry per speech ` +
    `listed above, noting specifically what it set up for or inherited from the others — not a repeat of the ` +
    `strengths/weaknesses notes.\n\n` +
    INSIGHT_FEEDBACK_RULES + `\n\n` +
    `Every entry in "strengths" and "weaknesses" must include "speechLabel" naming which of the debater's speeches ` +
    `(use the exact labels above) the quote is from.\n\n` +
    `Respond with ONLY a JSON object (no prose, no markdown fence) shaped exactly like:\n` +
    `{"verdict": "<2-4 sentences: what won or lost the round for this debater>", ` +
    `"strengths": [{"quote": "...", "note": "...", "speechLabel": "<one of: ${labelList}>"}], ` +
    `"weaknesses": [{"quote": "...", "note": "...", "speechLabel": "<one of: ${labelList}>"}], ` +
    `"topFixes": ["<most impactful specific change for their next round>", "..."], ` +
    `"perSpeechNotes": [{"label": "<one of: ${labelList}>", "note": "<what it set up for or inherited from the others>"}]}`;

  try {
    const text = await completeText({ system, prompt, maxTokens: 7000, jsonSchema: INSIGHT_ROUND_GRADE_SCHEMA, model: ROUTE_MODELS.insight });
    const result = parseModelJson(text);
    res.json({
      verdict: typeof result.verdict === "string" ? result.verdict : "",
      strengths: Array.isArray(result.strengths) ? result.strengths : [],
      weaknesses: Array.isArray(result.weaknesses) ? result.weaknesses : [],
      topFixes: Array.isArray(result.topFixes) ? result.topFixes : [],
      perSpeechNotes: Array.isArray(result.perSpeechNotes) ? result.perSpeechNotes : [],
    });
  } catch (err) {
    console.error("Round debrief failed:", err);
    res.status(500).json({ error: "Couldn't build a round debrief. " + err.message });
  }
});

function speechLengthRule(speechType, difficulty, speakingOrder) {
  const b = speechWordBudget({ speechType, difficulty, speakingOrder });
  const base = `about ${b.words} words (a ~${b.minutes}-minute speech delivered at ~${b.wpm} wpm)`;
  if (b.evidenceWordsMin) {
    return (
      base +
      `. This is a 2nd-speaking rebuttal: FRONTLINE FIRST, then go to their case — evidence/card text should ` +
      `total roughly ${b.evidenceWordsMin}-${b.evidenceWordsMax} words (1:45-2:30 of the speech), with the ` +
      `remaining time spent frontlining your own case.`
    );
  }
  return base + ".";
}

// Flips a side label to its opponent for setup-speech delivery (the AI voices
// the OTHER team's preceding speech). PF is Pro/Con; the rest are graceful
// fallbacks for other formats.
function opposingSideOf(side) {
  const map = {
    pro: "Con", con: "Pro",
    aff: "Neg", neg: "Aff",
    affirmative: "Negative", negative: "Affirmative",
    proposition: "Opposition", opposition: "Proposition",
    gov: "Opp", opp: "Gov", government: "Opposition",
  };
  const key = String(side || "").trim().toLowerCase();
  // Fallback is a bare adjective so it reads cleanly in `on the ${side} side`
  // ("on the opposing side"); only reached for non-PF/unmapped labels.
  return map[key] || "opposing";
}

// Realistic spoken length per slot so the exemplar respects real time limits.
function speechWordTarget(speechType) {
  const slot = String(speechType ?? "").toLowerCase();
  if (/final focus|2ar/.test(slot)) return "about 350-450 words (a ~2-minute speech)";
  if (/summary|1ar/.test(slot)) return "about 500-600 words (a ~3-minute speech)";
  if (/rebuttal|constructive|case|1ac|1nc|2ac|2nc|nr|nc/.test(slot)) return "about 600-750 words (a ~4-minute speech)";
  return "about 500-700 words";
}

app.post("/api/drill/speak", aiGuards, async (req, res) => {
  let { text, actingInstructions, voice, generate } = req.body ?? {};
  // The web client (web/lib/api.ts `drillSpeak`) posts the compact
  // { scenario, speech } shape; normalize it into the generate spec this route
  // authors an exemplar speech from. Direct { text } / { generate } callers
  // (e.g. opponent-setup delivery) are untouched.
  if (!generate && !text && req.body?.scenario && typeof req.body.scenario === "object") {
    const sc = req.body.scenario;
    generate = {
      scenario: sc,
      speechType: req.body.speech || sc.speech,
      side: sc.side,
      topic: sc.resolution,
      format: sc.format || "Public Forum",
      difficulty: sc.difficulty,
      speakingOrder: sc.speakingOrder,
    };
  }
  if (!isHumeTtsAvailable()) {
    res.status(503).json({
      unavailable: true,
      error: "Spoken delivery isn't set up on this server — it needs a Hume API key (HUME_API_KEY).",
    });
    return;
  }

  const toneTop = Array.isArray(generate?.tone?.top) ? generate.tone.top : null;
  let speechText = typeof text === "string" ? text.trim() : "";
  let instructions =
    typeof actingInstructions === "string" && actingInstructions.trim()
      ? actingInstructions.trim()
      : deriveActingInstructions({ speechType: generate?.speechType, opponentToneTop: toneTop });

  // Generate mode: write the speech before speaking it.
  if (!speechText && generate && typeof generate === "object") {
    if (!hasCredentials()) {
      res.status(500).json({ error: missingCredentialsError() });
      return;
    }
    const { format, topic, opponentTranscript, scenario } = generate;
    const isSetup = generate.mode === "setup";
    let speechType = generate.speechType;
    let side = generate.side;
    let order = generate.speakingOrder === "1st" || generate.speakingOrder === "2nd" ? generate.speakingOrder : "";
    let opponent = typeof opponentTranscript === "string" ? opponentTranscript.trim() : "";
    let setupLabel = "";

    // Setup mode: deliver the OPPONENT's immediately-preceding speech so the
    // student has something to answer in the speech they're practicing. The
    // flow mapping (which speech precedes which) and the opposing side are
    // derived server-side from the scenario, never trusted from the client.
    if (isSetup) {
      if (!scenario || typeof scenario !== "object") {
        res.status(400).json({ error: "Setup delivery needs the drill scenario." });
        return;
      }
      const preceding = precedingOpponentSpeech({
        speechType: scenario.speech,
        speakingOrder: scenario.speakingOrder,
      });
      if (!preceding) {
        res.status(400).json({
          error:
            "An opponent setup speech is only available for summary and final-focus drills with a 1st/2nd speaking order.",
        });
        return;
      }
      speechType = preceding.speechType;
      order = preceding.speakingOrder;
      side = opposingSideOf(scenario.side);
      setupLabel = preceding.label;
      opponent = ""; // generated from the round flow, not a reply to a recorded speech
      // The acting direction defaulted (above) to the STUDENT's speech type;
      // re-derive it for the opponent's speech we're actually voicing, unless
      // the caller passed explicit instructions.
      if (!(typeof actingInstructions === "string" && actingInstructions.trim())) {
        instructions = deriveActingInstructions({ speechType });
      }
    }

    // Evidence speeches (constructives AND rebuttals) inside an archive-backed
    // drill scenario are NOT written by the model: per the drill spec the
    // constructive IS the case and the rebuttal IS its AT: answer blocks —
    // both reproduced verbatim in scenario.caseText — and the TTS reads only
    // tag + author-year + <mark>-highlighted card text, within the
    // difficulty's highlighted-word budget (a 2nd-speaking rebuttal caps its
    // evidence at the 1:45–2:30 range; the frontline portion is the debater's
    // own job, not read material). Falls through to model generation only when
    // the document carries no highlighting.
    if (
      !isSetup &&
      /constructive|rebuttal|\b1ac\b|\b2ac\b|\b1nc\b/i.test(String(speechType || "")) &&
      typeof scenario?.caseText === "string"
    ) {
      const budget = speechWordBudget({ speechType, difficulty: scenario?.difficulty, speakingOrder: order });
      const maxWords = budget.evidenceWordsMax ?? budget.words;
      const spoken = buildSpokenCaseText(scenario.caseText, { maxWords });
      if (spoken) {
        speechText = spoken.text;
        console.log(
          `[drill-speak] mechanical ${/rebuttal|1nc/i.test(String(speechType)) ? "rebuttal" : "constructive"} ` +
            `cards=${spoken.cards} highlightedWords=${spoken.highlightedWords} budget=${maxWords}@${budget.wpm}wpm`
        );
      }
    }
    const orderNote = order
      ? `\nYour team is the ${order}-speaking team in this round — write the speech with the burdens that order ` +
        `creates for the ${speechType || "speech"} (in PF, e.g.: a 2nd rebuttal must frontline the opponent's ` +
        `rebuttal attacks on your case, a 1st rebuttal only answers case; a 2nd summary answers the 1st summary ` +
        `directly; a 2nd final focus has the true last word).\n`
      : "";
    if (rejectOversizedInput(res, opponent, "That opponent speech")) return;
    const tonePrompt = typeof generate?.tone?.prompt === "string" ? generate.tone.prompt.trim() : "";

    // Model generation only runs when the mechanical constructive assembly
    // above didn't already produce the speech.
    if (!speechText) {
    let system;
    try {
      system = await buildSystemPrompt({
        corpusMode: "retrieval",
        // "case construction / speech structure / frontlining" terms pull the
        // casing lecture (cases/casing-and-case-construction-lecture.md) and
        // frontline material chunks; frontlining-and-coaching-advice.md is in
        // reference/ and always inlined.
        retrievalQuery:
          `${topic || ""} ${format || "Public Forum"} ${side || ""} ${speechType || ""} ` +
          `exemplar speech delivery, rebuttal, signposting, weighing, collapse strategy, ` +
          `case construction, speech structure, frontlining\n${opponent.slice(0, 2000)}`,
      });
    } catch (err) {
      res.status(500).json({ error: `Failed to build system prompt: ${err.message}` });
      return;
    }

    // Style profile from the video-ingest pipeline (training-data/reference/
    // is inlined in every corpus mode, so the model already has the file when
    // it exists — this line just tells it to actually write in that voice).
    let hasStyleProfile = false;
    try {
      await fs.access(path.join(ROOT, "training-data", "reference", "speech-style-profile.md"));
      hasStyleProfile = true;
    } catch {
      // no profile ingested yet
    }

    const prompt =
      (isSetup
        ? `You ARE the opponent in this drill round, delivering the ${setupLabel} — the speech the student must now ` +
          `answer in their ${scenario?.speech || "next speech"}. You are a ${format || "Public Forum"} debater on ` +
          `the ${side} side${topic ? ` of "${topic}"` : ""}. Here is the round so far:\n\n` +
          (scenario ? `${JSON.stringify(scenario, null, 2)}\n\n` : "") +
          `Deliver a realistic, difficulty-appropriate ${setupLabel}: extend your team's best offense, answer the ` +
          `live clash, weigh, and leave the traps and ballot-path pressure the student now has to respond to. This ` +
          `is a real speech in this round's flow — not a generic lecture, and not the student's speech.`
        : opponent
        ? `You just heard an opponent deliver this speech (auto-transcribed):\n\n--- OPPONENT SPEECH ---\n${opponent}\n--- END ---\n` +
          (tonePrompt ? `\nHow they SOUNDED delivering it — ${tonePrompt}\n` : "") +
          `\nWrite the direct ${speechType || "rebuttal"} you would deliver in response, as a ${format || "Public Forum"} ` +
          `debater on the ${side || "opposing"} side${topic ? ` of "${topic}"` : ""}. Answer their actual arguments line by ` +
          `line where it matters, collapse to the strongest offense, and weigh — this is a real responsive speech, not a ` +
          `generic lecture.` +
          (tonePrompt
            ? ` Let their delivery inform your strategy too: press where they sounded uncertain, stay composed where they ran hot.`
            : "")
        : `Write an exemplar ${speechType || "speech"} for a ${format || "Public Forum"} debater on the ${side || "Pro/Aff"} ` +
          `side${topic ? ` of "${topic}"` : ""}` +
          (scenario ? `, inside this drill scenario:\n\n${JSON.stringify(scenario, null, 2)}\n\nDeliver the speech the scenario's task calls for — a model of the optimal play given the round history, opponent, and judge.` : `. Make it a model of strong ${format || "PF"} execution: clean signposting, warranted arguments, embedded weighing, and a decisive collapse.`)) +
      orderNote +
      `\n\nHard rules — the speech will be SPOKEN ALOUD by a text-to-speech voice, so:\n` +
      `- Output ONLY the words of the speech itself: no title, no headers, no markdown, no bullet points, no stage ` +
      `directions, no labels, no meta-commentary before or after. Pure spoken prose.\n` +
      `- Signpost verbally ("First, on their economy contention…", "Now weighing…") the way a real debater does.\n` +
      `- Length: ${speechLengthRule(speechType, scenario?.difficulty ?? generate.difficulty, order)}\n` +
      `- Any evidence citations must be invented/fictional author-year cites — never a real cite or case name from your ` +
      `training material (corpus-privacy rule).\n` +
      (hasStyleProfile
        ? `- Your reference material includes a speech style profile distilled from real recordings of a debater. Write ` +
          `this speech in THAT voice — their diction, sentence rhythm, signposting habits, argument-structure patterns, ` +
          `and catchphrases — without ever mentioning the profile or whose style it is.\n`
        : "") +
      `\n${buildAuthoringCriteria(speechType)}\n`;

    try {
      speechText = (
        await completeText({ system, prompt, maxTokens: 4000, model: ROUTE_MODELS.drill })
      ).trim();
    } catch (err) {
      console.error("Drill speak generation failed:", err);
      res.status(500).json({ error: "Couldn't write that speech. " + err.message });
      return;
    }
    if (!speechText) {
      res.status(500).json({ error: "Couldn't write that speech — the model returned nothing. Try again." });
      return;
    }
    } // end model-generation branch
  }

  if (!speechText) {
    res.status(400).json({ error: "Provide either text to speak or a generate spec." });
    return;
  }
  if (speechText.length > MAX_TTS_TEXT_CHARS) {
    res.status(413).json({
      error:
        `That's more text than I can deliver as one speech — about ${Math.round(speechText.length / 1000)}k characters, ` +
        `and the ceiling is ${Math.round(MAX_TTS_TEXT_CHARS / 1000)}k. Split it up and I'll deliver it in parts.`,
    });
    return;
  }

  try {
    const result = await synthesizeSpeech({ text: speechText, actingInstructions: instructions, voice });
    res.json({
      text: speechText,
      audio: result.audio.toString("base64"),
      mimeType: result.mimeType,
      actingInstructions: result.actingInstructions,
      voice: result.voice,
      voiceSource: result.voiceSource,
    });
  } catch (err) {
    console.error("Drill speak synthesis failed:", err);
    const status = err instanceof HumeTtsError && err.status >= 400 ? err.status : 500;
    res.status(status).json({ error: "Couldn't deliver that speech aloud. " + err.message });
  }
});

// Flattens a message's content (plain string or content-block array)
// down to readable text — used only for the round-summary prompt below,
// which needs a lightweight transcript rather than the real block structure.
function flattenContent(content) {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((b) => {
        if (b.type === "text") return b.text;
        if (b.type === "image") return "[image attachment]";
        if (b.type === "document") return "[document attachment]";
        if (b.type === "tool_use") return `[used tool: ${b.name}]`;
        if (b.type === "tool_result") return "[tool result]";
        return "";
      })
      .filter(Boolean)
      .join(" ");
  }
  return "";
}

// --- Chat: round summarization, used to label a round's sidebar tab and to
// build the cross-round memory digest other rounds later read from ---
app.post("/api/summarize-round", aiGuards, async (req, res) => {
  const { messages } = req.body ?? {};
  if (!Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({ error: "messages array required" });
    return;
  }
  if (!hasCredentials()) {
    res.status(500).json({ error: missingCredentialsError() });
    return;
  }

  const transcript = messages
    .map((m) => `${m.role.toUpperCase()}: ${flattenContent(m.content)}`)
    .join("\n\n")
    .slice(0, 6000);

  const prompt =
    `Here is the start of a coaching conversation between a debater and an AI coach:\n\n${transcript}\n\n` +
    `Respond with ONLY a JSON object (no prose, no markdown fence) shaped exactly like: ` +
    `{"title": "<3-6 word label for this conversation, no trailing punctuation>", ` +
    `"summary": "<1-2 sentence summary of what was discussed, specific enough that the coach could use it to recall this conversation in a later, unrelated round>"}.`;

  try {
    const text = await completeText({ prompt, maxTokens: 200, model: ROUTE_MODELS.summarize });
    const result = parseModelJson(text);
    res.json({
      title: typeof result.title === "string" && result.title.trim() ? result.title.trim() : "New round",
      summary: typeof result.summary === "string" ? result.summary.trim() : "",
    });
  } catch (err) {
    console.error("Round summarization failed:", err);
    res.status(500).json({ error: "Couldn't summarize this round." });
  }
});

app.post("/api/chat", aiGuards, async (req, res) => {
  const { messages: rawMessages, crossChatMemory, mode } = req.body ?? {};
  if (!Array.isArray(rawMessages) || rawMessages.length === 0) {
    res.status(400).json({ error: "messages array required" });
    return;
  }

  if (!hasCredentials()) {
    res.status(500).json({ error: missingCredentialsError() });
    return;
  }

  // Two chat modes, toggled in the CrossCoach panel: General (debate
  // knowledge; nudges toward Pre-Round for round-application asks) and
  // Pre-Round (round prep — scouting tools enabled, uploaded-doc strategy).
  const chatMode = mode === "preround" ? "preround" : "general";

  // Large-request guards: a single oversized message (huge paste/extracted
  // PDF) gets a conversational reply asking what to prioritize — streamed as
  // a normal Cross message, not an error toast; long-running conversations
  // are trimmed to the newest turns that fit the history budget.
  if (messageChars(rawMessages[rawMessages.length - 1]) > MAX_CHAT_MESSAGE_CHARS) {
    streamPlainReply(res, await oversizedMessageReply(rawMessages[rawMessages.length - 1]));
    return;
  }
  const messages = trimChatHistory(rawMessages);

  let system;
  try {
    // Chat uses agentic retrieval: reference core inlined, the rest of the
    // corpus fetched on demand via tools. Keeps the (cached) prompt prefix
    // small and stable across requests.
    system = await buildSystemPrompt({ corpusMode: "tools", chatMode });
    if (typeof crossChatMemory === "string" && crossChatMemory.trim()) {
      system +=
        "\n\n## Memory From Other Rounds\n\nThe debater has had other coaching conversations in this app, summarized " +
        "below (most recent first). Use this as background context when it's relevant — e.g. recalling a case, a " +
        "judge, or a decision from before — but prioritize what's actually said in the current conversation, and " +
        "don't assume anything here still holds unless the debater brings it up.\n\n" + crossChatMemory.trim();
    }
  } catch (err) {
    res.status(500).json({ error: `Failed to build system prompt: ${err.message}` });
    return;
  }

  res.setHeader("Content-Type", "text/plain; charset=utf-8");

  const maxTokens = 8000;

  try {
    const conversation = await prepareConversation(system, messages);

    // Judge intel (paradigm + full judge report) is available in both modes;
    // opponent scouting (caselist disclosure + tabroom results scan) is
    // Pre-Round only. Scouting tools additionally need a linked Tabroom
    // account — offering them to an unlinked user would only produce auth
    // failures the model then has to explain, so they're withheld instead and
    // Cross coaches from the corpus alone.
    const chatTools = [generateFileTool, searchCorpusTool, readCorpusFileTool, lookupJudgeParadigmTool, tabroomJudgeReportTool];
    // Live web search for provably time-sensitive facts (current topic wording,
    // recent results) — env-gated, only offered when a search API key is
    // configured (hasWebSearch()). Silent like corpus retrieval: see
    // WEB_SEARCH_SECTION in prompt.mjs for the corpus-privacy contract.
    if (hasWebSearch()) chatTools.push(webSearchTool);
    if (chatMode === "preround" && req.session?.caselistToken) chatTools.push(...caselistTools);
    if (chatMode === "preround" && req.session?.tabroomToken) chatTools.push(...tabroomResultsTools);

    let answered = false;
    for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
      const { assistantMessage, toolCalls, isToolUse } = await streamChat({
        system,
        conversation,
        model: ROUTE_MODELS.chat,
        temperature: CHAT_TEMPERATURE,
        enableThinking: CHAT_ENABLE_THINKING,
        tools: chatTools,
        maxTokens,
        onText: (delta) => res.write(delta),
      });
      conversation.push(assistantMessage);

      if (!isToolUse) {
        answered = true;
        break;
      }

      // Tool calls in one model turn are independent — run them concurrently.
      // Scouting turns often batch several caselist/tabroom fetches; serial
      // dispatch made those chains minutes slower than they needed to be.
      // generate_file banners are buffered and written in call order after
      // the batch settles so streamed output stays deterministic.
      const results = new Map();
      const banners = new Map();
      await Promise.all(
        toolCalls.map(async (call) => {
          if (call.name === "generate_file") {
            const result = await runGenerateFileTool({ input: call.input }, (finalName) => `/generated/${finalName}`);
            banners.set(
              call.id,
              result.isError
                ? `\n\n⚠️ ${result.toolResultContent}\n\n`
                : `\n\n📎 [Download ${result.finalName}](${result.location})\n\n`
            );
            results.set(call.id, { content: result.toolResultContent, isError: result.isError });
          } else if (call.name === "search_corpus") {
            // Corpus retrieval is silent — nothing is written to the response.
            const result = await runSearchCorpusTool({ input: call.input });
            results.set(call.id, { content: result.toolResultContent, isError: result.isError });
          } else if (call.name === "read_corpus_file") {
            const result = await runReadCorpusFileTool({ input: call.input });
            results.set(call.id, { content: result.toolResultContent, isError: result.isError });
          } else if (call.name === "web_search") {
            // Time-sensitive lookup only — silent like corpus retrieval (see
            // corpus-privacy rule): the model synthesizes in its own words and
            // never surfaces a URL/title/date, and never fabricates a fact
            // when nothing usable comes back.
            const result = await runWebSearchTool({ input: call.input });
            results.set(call.id, { content: result.toolResultContent, isError: result.isError });
          } else if (isCaselistTool(call.name)) {
            // Opponent scouting from the OpenCaselist wiki, authenticated with
            // this debater's own session token. Silent like corpus retrieval —
            // the report is woven into Cross's reply.
            const result = await runCaselistTool({ name: call.name, input: call.input }, req.session?.caselistToken);
            results.set(call.id, { content: result.toolResultContent, isError: result.isError });
          } else if (call.name === "lookup_judge_paradigm") {
            const result = await runLookupJudgeParadigmTool({ input: call.input }, req.session?.tabroomToken);
            results.set(call.id, { content: result.toolResultContent, isError: result.isError });
          } else if (isTabroomTool(call.name)) {
            // Judge records + tournament results scraped from Tabroom with
            // the debater's own token. Public postings — open attribution.
            const result = await runTabroomTool({ name: call.name, input: call.input }, req.session?.tabroomToken);
            results.set(call.id, { content: result.toolResultContent, isError: result.isError });
          } else {
            results.set(call.id, { content: `Unknown tool: ${call.name}`, isError: true });
          }
        })
      );
      for (const call of toolCalls) {
        if (banners.has(call.id)) res.write(banners.get(call.id));
      }
      appendToolResults(conversation, toolCalls, results);
    }
    if (!answered) {
      // Tool budget exhausted mid-chain. Force one final text-only turn so
      // the debater gets a report from what was gathered instead of a
      // silently empty reply.
      await streamChat({
        system,
        conversation,
        model: ROUTE_MODELS.chat,
        temperature: CHAT_TEMPERATURE,
        enableThinking: CHAT_ENABLE_THINKING,
        tools: chatTools,
        toolChoice: { type: "none" },
        maxTokens,
        onText: (delta) => res.write(delta),
      });
    }
    res.end();
  } catch (err) {
    // Real error goes to the log only — what reaches the debater is a
    // conversational, internals-free reply (see friendlyFailureReply).
    console.error(err);
    if (!res.headersSent) {
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.write(friendlyFailureReply(err));
      // Trailer lets the debater see *why* it failed and offers a retry — the
      // visible message above stays internals-free; the raw error only logged.
      writeChatFailureTrailer(res, err);
      res.end();
    } else {
      // The stream is already flowing as plain text — ending silently makes a
      // mid-reply failure look like Cross just stopped talking. Say so.
      res.write(`\n\n${friendlyFailureReply(err)}`);
      writeChatFailureTrailer(res, err);
      res.end();
    }
  }
});

// Anything that isn't /api/* or a static file falls through to the Next.js
// frontend (production only — see nextRequestHandler above). Registered
// last so it never shadows a real route or static asset.
if (nextRequestHandler) {
  app.use((req, res) => nextRequestHandler(req, res));
}

// Last-resort error handler: without this, Express's default handler renders
// an HTML error page (with a full stack trace outside production). Log
// server-side, return a generic message — never reflect internals or request
// contents back to the client.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  // Log message + stack only — body-parser errors carry the raw request body
  // on `err.body`, and for /api/auth/login that would put a password in logs.
  console.error("Unhandled error:", err?.stack || err?.message || err);
  if (res.headersSent) {
    res.end();
    return;
  }
  const status = err?.status || err?.statusCode;
  if (status === 413 || err?.type === "entity.too.large" || err?.code === "LIMIT_FILE_SIZE") {
    res.status(413).json({ error: "Request too large." });
    return;
  }
  if (err?.type === "entity.parse.failed") {
    res.status(400).json({ error: "Malformed request body." });
    return;
  }
  res.status(500).json({ error: "Something went wrong. Try again." });
});

app.listen(PORT, () => {
  console.log(`Cross running at http://localhost:${PORT}`);
  console.log(
    `Usage caps: ${RATE_LIMIT_PER_MINUTE} req/min per IP, ` +
      `${DAILY_REQUEST_CAP > 0 ? DAILY_REQUEST_CAP + " req/day total" : "no daily cap"}`,
  );
});
