// Supabase Auth (GoTrue) as an identity provider only — the browser never
// talks to Supabase and never holds a Supabase token.
//
// Flow (server-side PKCE):
//   1. startGoogle()/sendMagicLink() mint a verifier/challenge pair. The
//      verifier goes into a short httpOnly cookie; the challenge goes to
//      Supabase.
//   2. The user authenticates with Google (or clicks the emailed link).
//      Supabase redirects the browser back to /api/auth/callback?code=...
//   3. exchangeCode() trades that code + the cookie's verifier for the user's
//      identity, which is all we keep. The Supabase access/refresh tokens are
//      discarded on the spot: Cross mints its own session cookie
//      (session.mjs), so there is no token refresh machinery and no bearer
//      token anywhere near the browser.
//
// Only the anon key is used here. It is the public, RLS-bound key by design;
// the service_role key (supabaseClient.mjs) is never sent to GoTrue.

import crypto from "node:crypto";
import { buildCookie, cookieName, parseCookies } from "./session.mjs";

// The verifier is parked in a cookie for the seconds between starting
// sign-in and landing back on /api/auth/callback. Short-lived, httpOnly, and
// SameSite=Lax so it survives the top-level redirect back from Google.
const PKCE_COOKIE = cookieName("cross_pkce");
const PKCE_TTL_SEC = 10 * 60;

export class AuthError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "AuthError";
    this.status = status;
  }
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new AuthError(`${name} is not set — Cross sign-in is unavailable.`, 500);
  return value;
}

/** True when Google/email sign-in can work at all. Checked at boot. */
export function hasAuthCredentials() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY);
}

function gotrueUrl(pathname, params) {
  const base = requireEnv("SUPABASE_URL").replace(/\/+$/, "");
  const url = new URL(`${base}/auth/v1${pathname}`);
  for (const [k, v] of Object.entries(params || {})) {
    if (v != null) url.searchParams.set(k, String(v));
  }
  return url;
}

/**
 * Origin the *browser* is on, which is what every auth redirect must target.
 *
 * In production that's this server (it serves the Next app in-process). In
 * dev the two are split: Express is on :3000 but the user is on Next's dev
 * server (:3001), which proxies /api/* back here — so a redirect to :3000/
 * would land on an Express 404 instead of the app. Default accordingly, and
 * let PUBLIC_BASE_URL override for any other arrangement (including running
 * `npm start` in dev, where Express does serve both).
 */
export function appBaseUrl() {
  const configured = process.env.PUBLIC_BASE_URL;
  if (configured) return configured.replace(/\/+$/, "");
  if (process.env.NODE_ENV === "production") return "http://localhost:3000";
  return `http://localhost:${process.env.WEB_DEV_PORT || 3001}`;
}

/**
 * Absolute URL of our OAuth/magic-link landing route. Must also be listed in
 * Supabase's Auth > URL Configuration redirect allowlist, or GoTrue refuses
 * the redirect_to.
 */
export function callbackUrl() {
  return `${appBaseUrl()}/api/auth/callback`;
}

/**
 * PKCE pair. The verifier is the secret half (kept in a cookie on our
 * origin); the challenge is its sha256, safe to hand to Supabase. Without it,
 * an intercepted `code` in a redirect URL would be redeemable by anyone.
 */
export function createPkcePair() {
  const verifier = crypto.randomBytes(48).toString("base64url"); // 64 chars, within RFC 7636's 43-128
  const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

export function setPkceCookie(res, verifier) {
  res.append("Set-Cookie", buildCookie(PKCE_COOKIE, verifier, PKCE_TTL_SEC));
}

export function readPkceCookie(req) {
  return parseCookies(req.headers.cookie)[PKCE_COOKIE] || null;
}

/** Single-use: clear it as soon as the code has been redeemed (or failed). */
export function clearPkceCookie(res) {
  res.append("Set-Cookie", buildCookie(PKCE_COOKIE, "", 0));
}

/** Where to 302 the browser to start Google sign-in. */
export function googleAuthorizeUrl(challenge) {
  return gotrueUrl("/authorize", {
    provider: "google",
    redirect_to: callbackUrl(),
    code_challenge: challenge,
    code_challenge_method: "s256",
  }).toString();
}

async function gotruePost(pathname, params, body) {
  const anonKey = requireEnv("SUPABASE_ANON_KEY");
  let res;
  try {
    res = await fetch(gotrueUrl(pathname, params), {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: anonKey, Authorization: `Bearer ${anonKey}` },
      body: JSON.stringify(body),
    });
  } catch (err) {
    throw new AuthError(`Could not reach the sign-in service: ${err.message}`, 502);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    // GoTrue is inconsistent about which field carries the reason. Never
    // include the request body in the message — it holds the code verifier.
    const reason = data.error_description || data.msg || data.message || data.error || `HTTP ${res.status}`;
    throw new AuthError(reason, res.status);
  }
  return data;
}

/**
 * Email a one-time sign-in link. `create_user` is true so a first-time email
 * signs up and signs in with the same click.
 *
 * NOTE: Supabase's built-in mailer is rate-limited to a couple of messages an
 * hour and is not meant for production — configure custom SMTP in the
 * Supabase dashboard before relying on this.
 */
export async function sendMagicLink(email, challenge) {
  await gotruePost(
    "/otp",
    { redirect_to: callbackUrl() },
    {
      email,
      create_user: true,
      code_challenge: challenge,
      code_challenge_method: "s256",
    }
  );
}

/**
 * Trade the callback's `code` + the cookie's verifier for the signed-in
 * user. Returns only what Cross stores; the access/refresh tokens in the
 * response are deliberately dropped.
 */
export async function exchangeCode(code, verifier) {
  const data = await gotruePost("/token", { grant_type: "pkce" }, { auth_code: code, code_verifier: verifier });
  const user = data.user;
  if (!user?.id) throw new AuthError("Sign-in did not return a user.", 502);
  return {
    userId: user.id,
    email: user.email || null,
    displayName: user.user_metadata?.full_name || user.user_metadata?.name || null,
  };
}
