// Server-side cache of scraped judge paradigms + their Nemotron structured
// summaries (judge_paradigm_cache table, see supabase/migrations). Every
// exported function no-ops when Supabase isn't configured, so the feature
// degrades to "always scrape, always summarize" rather than erroring.

import crypto from "node:crypto";
import { getSupabaseClient } from "./supabaseClient.mjs";

const TABLE = "judge_paradigm_cache";
export const CACHE_MAX_AGE_DAYS = Number(process.env.JUDGE_CACHE_MAX_AGE_DAYS) || 30;

export function judgeCacheKey({ judgeId, name }) {
  return judgeId ? `id:${judgeId}` : `name:${String(name || "").trim().toLowerCase()}`;
}

// Same approach as scripts/ingest.mjs's content-hash-for-idempotency pattern.
export function hashParadigm(text) {
  return crypto.createHash("sha256").update(String(text || ""), "utf8").digest("hex");
}

export function isFresh(row, maxAgeDays = CACHE_MAX_AGE_DAYS) {
  if (!row) return false;
  return Date.now() - new Date(row.scraped_at).getTime() < maxAgeDays * 86_400_000;
}

export async function getCachedJudge(cacheKey) {
  const sb = getSupabaseClient();
  if (!sb) return null;
  const { data, error } = await sb.from(TABLE).select("*").eq("cache_key", cacheKey).maybeSingle();
  if (error) {
    console.error("judgeCache read failed:", error.message);
    return null;
  }
  return data;
}

// Full write: paradigm + a fresh Nemotron summary.
export async function upsertJudgeCache(row) {
  const sb = getSupabaseClient();
  if (!sb) return;
  const now = new Date().toISOString();
  const { error } = await sb
    .from(TABLE)
    .upsert({ ...row, scraped_at: now, summarized_at: now, updated_at: now }, { onConflict: "cache_key" });
  if (error) console.error("judgeCache write failed:", error.message);
}

// TTL expired but paradigm text unchanged — bump scraped_at only, no Nemotron rerun.
export async function touchScrapedAt(cacheKey) {
  const sb = getSupabaseClient();
  if (!sb) return;
  const now = new Date().toISOString();
  const { error } = await sb.from(TABLE).update({ scraped_at: now, updated_at: now }).eq("cache_key", cacheKey);
  if (error) console.error("judgeCache touch failed:", error.message);
}

// Paradigm-only write from chat tools (no summary yet) — never clobbers an
// existing summary_json, so /api/judge/summary can still skip the scrape
// later without losing a prior AI summary.
export async function upsertParadigmOnly({ cacheKey, judgeId, name, source, tabroomUrl, paradigm }) {
  const sb = getSupabaseClient();
  if (!sb) return;
  const now = new Date().toISOString();
  const { error } = await sb.from(TABLE).upsert(
    {
      cache_key: cacheKey,
      judge_id: judgeId ?? null,
      name,
      source: source ?? "tabroom_fallback",
      tabroom_url: tabroomUrl ?? null,
      paradigm_text: paradigm,
      paradigm_hash: hashParadigm(paradigm),
      summary_json: {},
      scraped_at: now,
      summarized_at: now,
      updated_at: now,
    },
    { onConflict: "cache_key", ignoreDuplicates: true },
  );
  if (error) console.error("judgeCache paradigm-only write failed:", error.message);
}
