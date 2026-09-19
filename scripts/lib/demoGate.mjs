// Optional pre-auth gate for sharing a public demo build without opening it
// to the world: one shared password blocks everyone — including the Cross
// sign-in screen and every /api/* route — before the real account gate in
// server.mjs ever runs. Fully inert unless DEMO_GATE_ENABLED=true (see
// .env.example); this module is never imported into the request path when
// the toggle is off. No database: the "session" is a signed cookie using the
// same scheme session.mjs uses for its short-lived PKCE cookie, so passing
// the gate once is remembered without a server-side session row.

import crypto from "node:crypto";
import { buildCookie, cookieName, parseCookies } from "./session.mjs";

const COOKIE = cookieName("demo_gate");
const COOKIE_DAYS = Number(process.env.DEMO_GATE_COOKIE_DAYS) || 30;
const COOKIE_MAX_AGE_SEC = Math.floor(COOKIE_DAYS * 24 * 60 * 60);
const MARKER = "demo-gate-pass";
const IS_PROD = process.env.NODE_ENV === "production";

// Cross's own sign-in round trip (server.mjs's "THE GATE" comment already
// documents these as intentionally reachable without a Cross session). In
// production these stay fully behind the demo gate like every other route —
// that's the whole point of the gate, and nothing about the dev-only bug
// below applies there. In dev they're exempted because `npm run dev` runs
// Next's dev server on its own port (:3001), which serves every real page
// directly and never routes through Express at all — so a developer lands on
// Cross's actual sign-in screen with no chance to have picked up a demo-gate
// cookie first, and completing that sign-in (Google or magic-link) must
// still work. No feature route (/api/chat, /api/status, uploads, etc.) is
// ever exempted, in dev or prod — only the four routes below.
const DEV_ONLY_AUTH_EXEMPT_ROUTES = new Set([
  "GET /api/auth/me",
  "GET /api/auth/start/google",
  "POST /api/auth/magic-link",
  "GET /api/auth/callback",
]);

// Mirrors session.mjs's own ephemeral-secret fallback: by the time this
// module is used, server.mjs has already imported session.mjs, whose
// module-level SECRET lookup throws at boot if SESSION_SECRET is unset in
// production — so in practice this fallback only ever fires in dev.
const SECRET =
  process.env.SESSION_SECRET ||
  (() => {
    console.warn(
      "[demoGate] SESSION_SECRET is not set — using an ephemeral secret to sign the demo-gate cookie. " +
        "It will not survive a restart. Set SESSION_SECRET in production."
    );
    return crypto.randomBytes(32).toString("hex");
  })();

export function isDemoGateEnabled() {
  return process.env.DEMO_GATE_ENABLED === "true";
}

function timingSafeStringEqual(a, b) {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

/** Compares a submitted password against DEMO_GATE_PASSWORD in constant time. */
export function demoPasswordMatches(candidate) {
  const expected = process.env.DEMO_GATE_PASSWORD || "";
  if (!expected || typeof candidate !== "string" || !candidate) return false;
  return timingSafeStringEqual(candidate, expected);
}

/**
 * Compares a submitted password against DEMO_GATE_ADMIN_PASSWORD in constant
 * time. A separate env var from DEMO_GATE_PASSWORD, never derived from or
 * shared with it — an admin session is exempted from the hourly rate limit
 * and daily cap (see server.mjs's aiGuards/guardAiCall), so this password
 * deserves its own secret, not a variant of the visitor one.
 */
export function demoAdminPasswordMatches(candidate) {
  const expected = process.env.DEMO_GATE_ADMIN_PASSWORD || "";
  if (!expected || typeof candidate !== "string" || !candidate) return false;
  return timingSafeStringEqual(candidate, expected);
}

const ROLES = new Set(["user", "admin"]);

// The role is signed as part of the payload (MARKER:role), not just
// appended alongside a fixed signature — otherwise a cookie holder could
// flip "user" to "admin" in the value without invalidating the signature.
function signedMarker(role) {
  return crypto.createHmac("sha256", SECRET).update(`${MARKER}:${role}`).digest("base64url");
}

/** Set the "gate passed" cookie on a successful unlock, tagged with which password was used. */
export function issueDemoGateCookie(res, role) {
  if (!ROLES.has(role)) throw new Error(`issueDemoGateCookie: invalid role "${role}"`);
  res.append("Set-Cookie", buildCookie(COOKIE, `${role}.${signedMarker(role)}`, COOKIE_MAX_AGE_SEC));
}

/**
 * The verified role ("user" or "admin") this request's demo-gate cookie
 * carries, or null if there isn't a valid one. Old-format cookies (from
 * before the role was added) fail verification here and are correctly
 * treated as gate-not-passed — a one-time re-prompt, not a crash.
 */
function demoGateRole(req) {
  const raw = parseCookies(req.headers.cookie)[COOKIE];
  if (!raw) return null;
  const dot = raw.indexOf(".");
  if (dot === -1) return null;
  const role = raw.slice(0, dot);
  const mac = raw.slice(dot + 1);
  if (!ROLES.has(role) || !mac) return null;
  return timingSafeStringEqual(mac, signedMarker(role)) ? role : null;
}

/** Whether this request already carries a valid demo-gate cookie, of either role. */
export function hasDemoGatePass(req) {
  return demoGateRole(req) !== null;
}

/**
 * Whether this request's demo-gate cookie was issued from the admin
 * password. Admin sessions skip the hourly rate limit and daily cap (see
 * server.mjs) but not the per-minute burst limiter.
 */
export function isDemoGateAdmin(req) {
  return demoGateRole(req) === "admin";
}

/**
 * Whether this request should bypass the demo gate even without a cookie.
 * Dev-only (see DEV_ONLY_AUTH_EXEMPT_ROUTES above) — always false in
 * production, where the demo gate covers Cross's auth routes like everything
 * else.
 */
export function isDemoGateAuthExempt(method, path) {
  if (IS_PROD) return false;
  return DEV_ONLY_AUTH_EXEMPT_ROUTES.has(`${method} ${path}`);
}

/** Minimal, self-contained gate screen — no React/Next involved, so it renders identically whether Next is up or not. */
export function renderDemoGatePage() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Cross — Private demo</title>
<style>
  :root { color-scheme: light dark; }
  * { box-sizing: border-box; }
  body {
    margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    background: #f5f5f7; color: #1d1d1f; padding: 24px;
  }
  @media (prefers-color-scheme: dark) { body { background: #000; color: #f5f5f7; } }
  .card {
    width: 100%; max-width: 360px; padding: 32px; border-radius: 16px;
    background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,0.08), 0 8px 24px rgba(0,0,0,0.06);
  }
  @media (prefers-color-scheme: dark) { .card { background: #1c1c1e; box-shadow: none; border: 1px solid #2c2c2e; } }
  h1 { font-size: 18px; margin: 0 0 4px; }
  p.sub { margin: 0 0 20px; font-size: 14px; opacity: 0.65; }
  input {
    width: 100%; padding: 10px 12px; font-size: 15px; border-radius: 8px;
    border: 1px solid #d2d2d7; margin-bottom: 12px; background: transparent; color: inherit;
  }
  @media (prefers-color-scheme: dark) { input { border-color: #3a3a3c; } }
  button {
    width: 100%; padding: 10px 12px; font-size: 15px; font-weight: 600; border-radius: 8px;
    border: none; background: #0071e3; color: #fff; cursor: pointer;
  }
  button:disabled { opacity: 0.6; cursor: default; }
  .error { color: #ff453a; font-size: 13px; margin: -4px 0 12px; display: none; }
  .error.show { display: block; }
</style>
</head>
<body>
  <form class="card" id="gate-form">
    <h1>This is a private preview of Cross</h1>
    <p class="sub">Enter the demo password to continue.</p>
    <p class="error" id="gate-error" role="alert">Wrong password.</p>
    <input type="password" name="password" placeholder="Password" autofocus autocomplete="off">
    <button type="submit">Continue</button>
  </form>
  <script>
    const form = document.getElementById("gate-form");
    const errorEl = document.getElementById("gate-error");
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const button = form.querySelector("button");
      const input = form.querySelector("input");
      button.disabled = true;
      errorEl.classList.remove("show");
      try {
        const res = await fetch("/api/demo-gate/unlock", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password: input.value }),
        });
        if (res.ok) {
          window.location.reload();
          return;
        }
        errorEl.classList.add("show");
      } catch {
        errorEl.classList.add("show");
      } finally {
        button.disabled = false;
      }
    });
  </script>
</body>
</html>`;
}
