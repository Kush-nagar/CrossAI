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

console.log("auth.smoke: ok");
