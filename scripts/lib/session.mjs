// Server-side session store for Cross accounts.
//
// Design for handling other people's credentials safely:
//   - The browser holds only `<sid>.<hmac>` in an httpOnly cookie. The HMAC
//     (keyed by SESSION_SECRET) makes the sid unforgeable; httpOnly keeps it
//     out of reach of any XSS.
//   - Sessions live in Postgres (cross_sessions), so they survive a restart
//     and stay revocable server-side — a real "sign out" rather than just
//     dropping the browser's cookie. Only sha256(sid) is stored, so a dump of
//     that table yields no usable cookies.
//   - A user's linked OpenCaselist/Tabroom tokens are NOT in the session row.
//     They live encrypted in tabroom_links (userStore.mjs) and are decrypted
//     into this process's memory on demand. They are never written to a
//     cookie or sent to the browser.
//
// Every request would otherwise cost a database round-trip, so validated
// sessions are cached in-process for CACHE_TTL_MS and `last_seen_at` is
// written back at most every PERSIST_SEEN_MS. Both are small enough that a
// revoked session stops working promptly.

import crypto from "node:crypto";
import { getSupabaseClient } from "./supabaseClient.mjs";
import { getTabroomLink } from "./userStore.mjs";

const TABLE = "cross_sessions";

const IDLE_MS = 12 * 60 * 60 * 1000; // 12h since last activity
const ABSOLUTE_MS = 30 * 24 * 60 * 60 * 1000; // 30d hard cap
const SWEEP_MS = 30 * 60 * 1000;
const CACHE_TTL_MS = 60 * 1000; // how long a validated session skips the DB
const PERSIST_SEEN_MS = 5 * 60 * 1000; // how often last_seen_at is written back
const LINK_TTL_MS = 5 * 60 * 1000; // how long decrypted Tabroom tokens are reused

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

/** sid -> { userId, createdAt, expiresAt, lastSeen, persistedSeen, checkedAt, link, linkAt } */
const cache = new Map();

function db() {
  const sb = getSupabaseClient();
  if (!sb) {
    throw new Error(
      "Supabase is not configured (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY) — sessions are unavailable."
    );
  }
  return sb;
}

function sign(sid) {
  return crypto.createHmac("sha256", SECRET).update(sid).digest("base64url");
}

/** What the database stores instead of the session id itself. */
function sidHash(sid) {
  return crypto.createHash("sha256").update(sid).digest("hex");
}

function timingSafeEqual(a, b) {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

export function parseCookies(header) {
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

/**
 * Cookie string with this app's baseline attributes. Exported so short-lived
 * auth cookies (the PKCE verifier — see crossAuth.mjs) get the same hardening
 * without a second copy of these rules.
 */
export function buildCookie(name, value, maxAgeSec) {
  const attrs = [`${name}=${value}`, "Path=/", "HttpOnly", "SameSite=Lax", `Max-Age=${maxAgeSec}`];
  // Secure requires HTTPS; the app trusts one proxy hop (Render/etc.) in prod.
  if (IS_PROD) attrs.push("Secure");
  return attrs.join("; ");
}

/** Prefix short-lived auth cookies the same way as the session cookie. */
export function cookieName(base) {
  return IS_PROD ? `__Host-${base}` : base;
}

/** Create a session for a freshly-authenticated Cross user and set the cookie. */
export async function createSession(res, { userId }) {
  const sid = crypto.randomBytes(32).toString("base64url");
  const now = Date.now();
  const expiresAt = now + ABSOLUTE_MS;
  const { error } = await db().from(TABLE).insert({
    sid_hash: sidHash(sid),
    user_id: userId,
    expires_at: new Date(expiresAt).toISOString(),
  });
  if (error) throw new Error(`Could not start your session: ${error.message}`);
  cache.set(sid, {
    userId,
    createdAt: now,
    expiresAt,
    lastSeen: now,
    persistedSeen: now,
    checkedAt: now,
    link: null,
    linkAt: 0,
  });
  res.append("Set-Cookie", buildCookie(COOKIE_NAME, `${sid}.${sign(sid)}`, Math.floor(ABSOLUTE_MS / 1000)));
  return sid;
}

/** Extract a signature-verified sid from the request, or null. */
function sidFromRequest(req) {
  const raw = parseCookies(req.headers.cookie)[COOKIE_NAME];
  if (!raw) return null;
  const dot = raw.lastIndexOf(".");
  if (dot === -1) return null;
  const sid = raw.slice(0, dot);
  const mac = raw.slice(dot + 1);
  if (!sid || !mac || !timingSafeEqual(mac, sign(sid))) return null;
  return sid;
}

async function loadEntry(sid) {
  const { data, error } = await db()
    .from(TABLE)
    .select("user_id, created_at, last_seen_at, expires_at, revoked_at")
    .eq("sid_hash", sidHash(sid))
    .maybeSingle();
  if (error) throw new Error(`Could not read your session: ${error.message}`);
  if (!data || data.revoked_at) return null;
  const lastSeen = new Date(data.last_seen_at).getTime();
  return {
    userId: data.user_id,
    createdAt: new Date(data.created_at).getTime(),
    expiresAt: new Date(data.expires_at).getTime(),
    lastSeen,
    persistedSeen: lastSeen,
    checkedAt: Date.now(),
    link: null,
    linkAt: 0,
  };
}

/**
 * Resolve the session for a request, or null. Verifies the cookie signature,
 * enforces idle/absolute expiry, refreshes lastSeen, and attaches the user's
 * linked Tabroom tokens (null when they haven't linked an account — every
 * caller must handle that).
 */
export async function readSession(req) {
  const sid = sidFromRequest(req);
  if (!sid) return null;

  const now = Date.now();
  let entry = cache.get(sid);
  if (!entry || now - entry.checkedAt > CACHE_TTL_MS) {
    // Carry the cached link across a revalidation so a fresh DB read of the
    // session doesn't also force a re-decrypt of the tokens.
    const previous = entry;
    entry = await loadEntry(sid);
    if (!entry) {
      cache.delete(sid);
      return null;
    }
    if (previous && now - previous.linkAt < LINK_TTL_MS) {
      entry.link = previous.link;
      entry.linkAt = previous.linkAt;
    }
    cache.set(sid, entry);
  }

  if (now - entry.lastSeen > IDLE_MS || now > entry.expiresAt) {
    cache.delete(sid);
    await revoke(sid).catch(() => {});
    return null;
  }

  entry.lastSeen = now;
  if (now - entry.persistedSeen > PERSIST_SEEN_MS) {
    entry.persistedSeen = now;
    // Best-effort: a failed heartbeat costs a slightly stale idle timestamp,
    // not a broken request.
    db()
      .from(TABLE)
      .update({ last_seen_at: new Date(now).toISOString() })
      .eq("sid_hash", sidHash(sid))
      .then(({ error }) => {
        if (error) console.warn("session last_seen update failed:", error.message);
      });
  }

  if (!entry.linkAt || now - entry.linkAt > LINK_TTL_MS) {
    entry.link = await getTabroomLink(entry.userId);
    entry.linkAt = now;
  }

  return {
    sid,
    userId: entry.userId,
    tabroomUsername: entry.link?.tabroomUsername || null,
    caselistToken: entry.link?.caselistToken || null,
    tabroomToken: entry.link?.tabroomToken || null,
  };
}

async function revoke(sid) {
  const { error } = await db()
    .from(TABLE)
    .update({ revoked_at: new Date().toISOString() })
    .eq("sid_hash", sidHash(sid));
  if (error) console.warn("session revoke failed:", error.message);
}

/** Destroy the current session and clear the cookie. */
export async function destroySession(req, res) {
  const sid = sidFromRequest(req);
  if (sid) {
    cache.delete(sid);
    await revoke(sid).catch(() => {});
  }
  res.append("Set-Cookie", buildCookie(COOKIE_NAME, "", 0));
}

/**
 * Drop cached Tabroom tokens for a user across all of their sessions, so a
 * link/unlink takes effect on the next request instead of up to LINK_TTL_MS
 * later.
 */
export function invalidateLinkCache(userId) {
  for (const entry of cache.values()) {
    if (entry.userId === userId) {
      entry.link = null;
      entry.linkAt = 0;
    }
  }
}

/**
 * DEV ONLY (guarded by the caller — see devTestRoutes.mjs): mint a fresh
 * session for the most recently active signed-in user and set its cookie on
 * `res`. Lets a localhost test harness piggyback on a session the user
 * created by signing in normally. Returns the user id, or null if nobody is
 * signed in.
 */
export async function devCloneLatestSession(res) {
  let latest = null;
  for (const entry of cache.values()) {
    if (!latest || entry.lastSeen > latest.lastSeen) latest = entry;
  }
  if (!latest) {
    // Nothing in this process's cache (e.g. after a restart) — fall back to
    // the most recently active live session in the database.
    const { data } = await db()
      .from(TABLE)
      .select("user_id")
      .is("revoked_at", null)
      .gt("expires_at", new Date().toISOString())
      .order("last_seen_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!data) return null;
    latest = { userId: data.user_id };
  }
  await createSession(res, { userId: latest.userId });
  return latest.userId;
}

// Periodic sweep. The in-process cache is bounded by dropping entries no
// request has touched for a full idle window; expired rows are deleted so the
// table doesn't grow without limit.
const sweep = setInterval(() => {
  const now = Date.now();
  for (const [sid, entry] of cache) {
    if (now - entry.lastSeen > IDLE_MS || now > entry.expiresAt) cache.delete(sid);
  }
  const sb = getSupabaseClient();
  if (!sb) return;
  sb.from(TABLE)
    .delete()
    .lt("expires_at", new Date(now).toISOString())
    .then(({ error }) => {
      if (error) console.warn("session sweep failed:", error.message);
    });
}, SWEEP_MS);
sweep.unref?.();
