// Minimal, dependency-free server-side session store for the Tabroom gate.
//
// Design for handling other people's credentials safely:
//   - The OpenCaselist token lives ONLY in this in-memory store, keyed by an
//     opaque random session id. It is never written to the browser, a cookie,
//     or disk.
//   - The browser holds only `<sid>.<hmac>` in an httpOnly cookie. The HMAC
//     (keyed by SESSION_SECRET) makes the sid unforgeable; httpOnly keeps it
//     out of reach of any XSS.
//   - Sessions expire on idle and absolute timeouts and are swept periodically.
//
// Single-instance, in-memory: sessions reset on restart (users re-login) and
// this does not share across multiple server processes. A multi-instance
// deploy should swap this store for Redis (and only then does token-at-rest
// encryption become relevant, since the token would leave the process).

import crypto from "node:crypto";

const IDLE_MS = 12 * 60 * 60 * 1000; // 12h since last activity
const ABSOLUTE_MS = 30 * 24 * 60 * 60 * 1000; // 30d hard cap
const SWEEP_MS = 30 * 60 * 1000;

const IS_PROD = process.env.NODE_ENV === "production";

// The __Host- prefix (prod only — it requires Secure) makes the browser
// reject the cookie unless it is Secure, Path=/, and host-only, so a
// subdomain or plain-HTTP response can never plant or override it.
const COOKIE_NAME = IS_PROD ? "__Host-cross_sid" : "cross_sid";

// A stable secret is required to keep sessions valid across restarts and to
// sign cookies. In production it must be set — an ephemeral fallback would
// mean an operator can't reason about cookie validity, so fail closed at
// boot. In dev we generate one so the app still runs.
const SECRET =
  process.env.SESSION_SECRET ||
  (() => {
    if (IS_PROD) {
      throw new Error(
        "[session] SESSION_SECRET must be set in production — refusing to start with an ephemeral cookie-signing secret."
      );
    }
    console.warn(
      "[session] SESSION_SECRET is not set — using an ephemeral secret. " +
        "Sessions will not survive restarts. Set SESSION_SECRET in production."
    );
    return crypto.randomBytes(32).toString("hex");
  })();

/** sid -> { username, caselistToken, tabroomToken, createdAt, lastSeen } */
const store = new Map();

function sign(sid) {
  return crypto.createHmac("sha256", SECRET).update(sid).digest("base64url");
}

function timingSafeEqual(a, b) {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

function parseCookies(header) {
  const out = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    if (i === -1) continue;
    const k = part.slice(0, i).trim();
    const v = part.slice(i + 1).trim();
    if (k) out[k] = decodeURIComponent(v);
  }
  return out;
}

function cookieString(value, maxAgeSec) {
  const attrs = [
    `${COOKIE_NAME}=${value}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAgeSec}`,
  ];
  // Secure requires HTTPS; the app trusts one proxy hop (Render/etc.) in prod.
  if (IS_PROD) attrs.push("Secure");
  return attrs.join("; ");
}

/** Create a session for a freshly-authenticated user and set the cookie. */
export function createSession(res, { username, caselistToken, tabroomToken }) {
  const sid = crypto.randomBytes(32).toString("base64url");
  const now = Date.now();
  store.set(sid, { username, caselistToken, tabroomToken, createdAt: now, lastSeen: now });
  const value = `${sid}.${sign(sid)}`;
  res.append("Set-Cookie", cookieString(value, Math.floor(ABSOLUTE_MS / 1000)));
  return sid;
}

/**
 * Resolve the session for a request, or null. Verifies the cookie signature,
 * enforces idle/absolute expiry, and refreshes lastSeen on a valid hit.
 */
export function readSession(req) {
  const cookies = parseCookies(req.headers.cookie);
  const raw = cookies[COOKIE_NAME];
  if (!raw) return null;

  const dot = raw.lastIndexOf(".");
  if (dot === -1) return null;
  const sid = raw.slice(0, dot);
  const mac = raw.slice(dot + 1);
  if (!sid || !mac || !timingSafeEqual(mac, sign(sid))) return null;

  const sess = store.get(sid);
  if (!sess) return null;

  const now = Date.now();
  if (now - sess.lastSeen > IDLE_MS || now - sess.createdAt > ABSOLUTE_MS) {
    store.delete(sid);
    return null;
  }
  sess.lastSeen = now;
  return { sid, username: sess.username, caselistToken: sess.caselistToken, tabroomToken: sess.tabroomToken };
}

/** Destroy the current session and clear the cookie. */
export function destroySession(req, res) {
  const cookies = parseCookies(req.headers.cookie);
  const raw = cookies[COOKIE_NAME];
  if (raw) {
    const dot = raw.lastIndexOf(".");
    if (dot !== -1) store.delete(raw.slice(0, dot));
  }
  res.append("Set-Cookie", cookieString("", 0));
}

/**
 * DEV ONLY (guarded by the caller — see devTestRoutes.mjs): clone the most
 * recently active live session into a fresh one and set its cookie on `res`.
 * Lets a localhost test harness piggyback on a session the user created by
 * signing in normally, without the token ever leaving the process. Returns
 * the username of the cloned session, or null if nobody is signed in.
 */
export function devCloneLatestSession(res) {
  let latest = null;
  for (const sess of store.values()) {
    if (!latest || sess.lastSeen > latest.lastSeen) latest = sess;
  }
  if (!latest) return null;
  createSession(res, { username: latest.username, caselistToken: latest.caselistToken, tabroomToken: latest.tabroomToken });
  return latest.username;
}

// Periodic sweep of expired sessions (lazy expiry in readSession handles the
// common path; this bounds memory for abandoned sessions).
const sweep = setInterval(() => {
  const now = Date.now();
  for (const [sid, sess] of store) {
    if (now - sess.lastSeen > IDLE_MS || now - sess.createdAt > ABSOLUTE_MS) {
      store.delete(sid);
    }
  }
}, SWEEP_MS);
sweep.unref?.();
