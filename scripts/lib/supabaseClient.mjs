// Lazy Supabase client for server-side cache tables (judge paradigms today).
// Mirrors aiClient.mjs's lazy getClient() pattern. Uses the service_role key
// — server-only, bypasses RLS by design — never expose this to web/.

import { createClient } from "@supabase/supabase-js";

let client;

export function hasSupabaseCredentials() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export function getSupabaseClient() {
  if (!hasSupabaseCredentials()) return null;
  if (!client) {
    client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });
  }
  return client;
}
