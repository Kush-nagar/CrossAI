// Per-user durable state: profiles and the optional Tabroom link.
// (Sessions live in session.mjs, which owns its own table.)
//
// Everything here goes through the service_role Supabase client, which
// bypasses RLS — see supabaseClient.mjs. These tables are never reachable
// from the browser.

import crypto from "node:crypto";
import { getSupabaseClient } from "./supabaseClient.mjs";

const PROFILES = "profiles";
const TABROOM_LINKS = "tabroom_links";

function db() {
  const sb = getSupabaseClient();
  if (!sb) {
    throw new Error(
      "Supabase is not configured (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY) — user accounts are unavailable."
    );
  }
  return sb;
}

// --- Token encryption at rest -------------------------------------------
// Third-party tokens (OpenCaselist, Tabroom) are borrowed credentials: a
// database dump must not hand someone else's Tabroom session to an attacker.
// AES-256-GCM gives confidentiality plus tamper detection, so a modified
// ciphertext fails to decrypt instead of yielding garbage we'd send upstream.

let cachedKey;

function encryptionKey() {
  if (cachedKey) return cachedKey;
  const raw = process.env.TOKEN_ENC_KEY;
  if (!raw || !/^[0-9a-fA-F]{64}$/.test(raw)) {
    throw new Error(
      "TOKEN_ENC_KEY must be a 64-character hex string (32 bytes) to store linked Tabroom tokens. " +
        "Generate one with: openssl rand -hex 32"
    );
  }
  cachedKey = Buffer.from(raw, "hex");
  return cachedKey;
}

/** Returns 'iv:tag:ciphertext', all base64url. Null/empty input returns null. */
export function encryptToken(plaintext) {
  if (!plaintext) return null;
  const iv = crypto.randomBytes(12); // 96-bit nonce, the GCM standard
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(String(plaintext), "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), ciphertext].map((b) => b.toString("base64url")).join(":");
}

/** Inverse of encryptToken. Returns null on missing or tampered input. */
export function decryptToken(encoded) {
  if (!encoded) return null;
  const parts = String(encoded).split(":");
  if (parts.length !== 3) return null;
  try {
    const [iv, tag, ciphertext] = parts.map((p) => Buffer.from(p, "base64url"));
    const decipher = crypto.createDecipheriv("aes-256-gcm", encryptionKey(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
  } catch {
    // Wrong key or tampered ciphertext. Treat as "no token" — the caller
    // degrades to unlinked rather than trusting anything.
    return null;
  }
}

// --- Profiles -------------------------------------------------------------

/** Create-or-refresh the profile row for a user who just signed in. */
export async function upsertProfile({ userId, email, displayName }) {
  const { data, error } = await db()
    .from(PROFILES)
    .upsert(
      {
        user_id: userId,
        email: email || null,
        // Don't clobber a name the user set later with a null from the IdP.
        ...(displayName ? { display_name: displayName } : {}),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    )
    .select()
    .single();
  if (error) throw new Error(`Could not save your profile: ${error.message}`);
  return data;
}

export async function getProfile(userId) {
  const { data, error } = await db().from(PROFILES).select("*").eq("user_id", userId).maybeSingle();
  if (error) throw new Error(`Could not load your profile: ${error.message}`);
  return data;
}

export async function setConsentVersion(userId, version) {
  const { error } = await db()
    .from(PROFILES)
    .update({ consent_version: version, updated_at: new Date().toISOString() })
    .eq("user_id", userId);
  if (error) throw new Error(`Could not record consent: ${error.message}`);
}

// --- Tabroom link ---------------------------------------------------------

/**
 * Store the tokens minted from a user's own Tabroom sign-in. The password
 * that produced them is never passed here and never persisted.
 */
export async function saveTabroomLink({ userId, tabroomUsername, caselistToken, tabroomToken }) {
  const now = new Date().toISOString();
  const { error } = await db().from(TABROOM_LINKS).upsert(
    {
      user_id: userId,
      tabroom_username: tabroomUsername,
      caselist_token_enc: encryptToken(caselistToken),
      tabroom_token_enc: encryptToken(tabroomToken),
      linked_at: now,
      last_verified_at: now,
    },
    { onConflict: "user_id" }
  );
  if (error) throw new Error(`Could not link your Tabroom account: ${error.message}`);
}

/**
 * Returns { tabroomUsername, caselistToken, tabroomToken, linkedAt } with the
 * tokens decrypted, or null when the user has no link. A token that fails to
 * decrypt comes back null, so callers degrade to unlinked behaviour.
 */
export async function getTabroomLink(userId) {
  const { data, error } = await db().from(TABROOM_LINKS).select("*").eq("user_id", userId).maybeSingle();
  if (error) {
    console.error("tabroom link read failed:", error.message);
    return null;
  }
  if (!data) return null;
  return {
    tabroomUsername: data.tabroom_username,
    caselistToken: decryptToken(data.caselist_token_enc),
    tabroomToken: decryptToken(data.tabroom_token_enc),
    linkedAt: data.linked_at,
  };
}

export async function deleteTabroomLink(userId) {
  const { error } = await db().from(TABROOM_LINKS).delete().eq("user_id", userId);
  if (error) throw new Error(`Could not unlink your Tabroom account: ${error.message}`);
}
