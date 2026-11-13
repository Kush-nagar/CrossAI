// Smoke check for the phase-1 auth primitives. No network, no database.
//   node scripts/lib/auth.smoke.mjs
// Matches web/lib/*.smoke.ts's convention: plain asserts, no test runner.

import assert from "node:assert/strict";
import crypto from "node:crypto";

process.env.TOKEN_ENC_KEY = "a".repeat(64);
process.env.SUPABASE_URL = "https://example.supabase.co";
process.env.SUPABASE_ANON_KEY = "anon-key";
process.env.PUBLIC_BASE_URL = "https://cross.example.com";
// crossAuth imports session.mjs for its cookie helpers, which warns at import
// time when this is unset. Keeps the smoke output to one line.
process.env.SESSION_SECRET = "smoke-test-secret";

const HERE = new URL(".", import.meta.url);
const { createPkcePair, googleAuthorizeUrl, callbackUrl } = await import(new URL("crossAuth.mjs", HERE).href);
const { encryptToken, decryptToken } = await import(new URL("userStore.mjs", HERE).href);

// --- PKCE ---------------------------------------------------------------
const { verifier, challenge } = createPkcePair();
assert.ok(verifier.length >= 43 && verifier.length <= 128, "verifier length must satisfy RFC 7636");
assert.equal(challenge, crypto.createHash("sha256").update(verifier).digest("base64url"), "challenge is S256(verifier)");
assert.notEqual(createPkcePair().verifier, verifier, "verifiers must not repeat");

const authorize = new URL(googleAuthorizeUrl(challenge));
assert.equal(authorize.searchParams.get("code_challenge_method"), "s256");
assert.equal(authorize.searchParams.get("code_challenge"), challenge);
assert.equal(authorize.searchParams.get("redirect_to"), callbackUrl());
assert.ok(!authorize.search.includes(verifier), "the verifier must never leave our origin");

// --- Token encryption ----------------------------------------------------
const secret = "caselist_token_value";
const enc = encryptToken(secret);
assert.notEqual(enc, secret, "token must not be stored in plaintext");
assert.ok(!enc.includes(secret));
assert.equal(enc.split(":").length, 3, "format is iv:tag:ciphertext");
assert.equal(decryptToken(enc), secret, "round-trips");
assert.notEqual(encryptToken(secret), enc, "same input encrypts differently (random IV)");

assert.equal(encryptToken(null), null);
assert.equal(decryptToken(null), null);
assert.equal(decryptToken("garbage"), null);

// Flip one ciphertext byte: GCM's auth tag must reject it rather than
// returning corrupted plaintext we'd then send to OpenCaselist.
const [iv, tag, ct] = enc.split(":");
const bytes = Buffer.from(ct, "base64url");
bytes[0] ^= 0xff;
assert.equal(decryptToken(`${iv}:${tag}:${bytes.toString("base64url")}`), null, "tampered ciphertext must not decrypt");

// A different key must not decrypt an existing token (fresh module instance,
// since the key is cached after first use).
process.env.TOKEN_ENC_KEY = "b".repeat(64);
const other = await import(`${new URL("userStore.mjs", HERE).href}?fresh=1`);
assert.equal(other.decryptToken(enc), null, "wrong key must not decrypt");

// --- Direct Google sign-in (crossAuth.mjs) --------------------------------
process.env.GOOGLE_CLIENT_ID = "client-123.apps.googleusercontent.com";
process.env.GOOGLE_CLIENT_SECRET = "google-secret";
const g = await import(new URL("crossAuth.mjs", HERE).href);
assert.ok(g.hasDirectGoogle());
const cookies = [];
const fakeRes = { append: (_h, v) => cookies.push(v) };
const startUrl = new URL(g.startDirectGoogle(fakeRes));
assert.equal(startUrl.origin + startUrl.pathname, "https://accounts.google.com/o/oauth2/v2/auth");
assert.equal(startUrl.searchParams.get("redirect_uri"), "https://cross.example.com/api/auth/google/callback");
assert.equal(startUrl.searchParams.get("client_id"), process.env.GOOGLE_CLIENT_ID);
assert.equal(startUrl.searchParams.get("code_challenge_method"), "S256");
const stateCookie = cookies[0].split(";")[0];
assert.ok(/HttpOnly/.test(cookies[0]) && /Max-Age=600/.test(cookies[0]), "state cookie is httpOnly and short-lived");
const [, cookieVal] = stateCookie.split("=");
const [st, rawNonce, ver] = cookieVal.split(".");
assert.equal(startUrl.searchParams.get("state"), st);
assert.equal(startUrl.searchParams.get("nonce"), crypto.createHash("sha256").update(rawNonce).digest("hex"), "Google gets sha256(nonce)");
assert.equal(startUrl.searchParams.get("code_challenge"), crypto.createHash("sha256").update(ver).digest("base64url"));
assert.ok(!startUrl.search.includes(ver) && !startUrl.search.includes(rawNonce), "verifier and raw nonce never leave our origin");
assert.ok(!startUrl.search.includes("google-secret"), "client secret never goes to the browser");

const cleared = [];
const saved = g.takeGoogleState({ headers: { cookie: stateCookie } }, { append: (_h, v) => cleared.push(v) });
assert.deepEqual(saved, { state: st, nonce: rawNonce, verifier: ver });
assert.ok(/Max-Age=0/.test(cleared[0]), "state cookie is single-use");
assert.equal(g.takeGoogleState({ headers: {} }, fakeRes), null);
assert.ok(g.stateMatches(st, st));
assert.ok(!g.stateMatches(st, `${st}x`) && !g.stateMatches(st, undefined), "mismatched state rejected");

// Code exchange: Google gets code + verifier + secret; Supabase gets the ID
// token + RAW nonce on grant_type=id_token with the anon key.
const realFetch = globalThis.fetch;
const seen = [];
globalThis.fetch = async (url, init) => {
  seen.push({ url: String(url), init });
  if (String(url).startsWith("https://oauth2.googleapis.com/token")) {
    return new Response(JSON.stringify({ id_token: "header.payload.sig", access_token: "x" }), { status: 200 });
  }
  return new Response(JSON.stringify({ access_token: "sb", user: { id: "u-1", email: "a@b.co", user_metadata: { full_name: "A B" } } }), { status: 200 });
};
const user = await g.exchangeGoogleCode("the-code", saved);
globalThis.fetch = realFetch;
assert.deepEqual(user, { userId: "u-1", email: "a@b.co", displayName: "A B" });
const googleBody = new URLSearchParams(seen[0].init.body);
assert.equal(googleBody.get("code"), "the-code");
assert.equal(googleBody.get("code_verifier"), ver);
assert.equal(googleBody.get("client_secret"), "google-secret");
assert.equal(googleBody.get("redirect_uri"), "https://cross.example.com/api/auth/google/callback");
const sbUrl = new URL(seen[1].url);
assert.equal(sbUrl.origin + sbUrl.pathname, "https://example.supabase.co/auth/v1/token");
assert.equal(sbUrl.searchParams.get("grant_type"), "id_token");
assert.deepEqual(JSON.parse(seen[1].init.body), { provider: "google", id_token: "header.payload.sig", nonce: rawNonce });
assert.equal(seen[1].init.headers.apikey, "anon-key");

// A Google refusal surfaces as an AuthError, not a crash.
globalThis.fetch = async () => new Response(JSON.stringify({ error: "invalid_grant" }), { status: 400 });
await assert.rejects(() => g.exchangeGoogleCode("bad", saved), /Google rejected the sign-in: invalid_grant/);
globalThis.fetch = realFetch;

console.log("auth.smoke: ok");
