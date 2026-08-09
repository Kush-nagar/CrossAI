-- Multi-user auth for Cross. Supabase Auth (auth.users) is the identity
-- provider; these tables are everything Cross itself needs to know about a
-- user. User id is auth.users.id throughout — no shadow user table.
--
-- RLS is enabled with NO policies on every table here, matching
-- 0001_judge_paradigm_cache.sql: only the server's service_role key ever
-- touches them (it bypasses RLS), and the browser never talks to Postgres
-- directly. That is strictly tighter than auth.uid() policies — add policies
-- the day a client queries these tables, not before.

-- Per-user profile + preferences. Created on first sign-in.
create table if not exists profiles (
  user_id         uuid primary key references auth.users (id) on delete cascade,
  email           text,
  display_name    text,
  consent_version int not null default 0,          -- privacy notice accepted
  prefs           jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table profiles enable row level security;

-- Server-side sessions, so they survive a restart and stay revocable.
-- Stores sha256(sid), never the sid itself: a dump of this table yields no
-- usable session cookies. The cookie is still `<sid>.<hmac>` (session.mjs).
create table if not exists cross_sessions (
  sid_hash     text primary key,                   -- sha256 hex of the session id
  user_id      uuid not null references auth.users (id) on delete cascade,
  created_at   timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  expires_at   timestamptz not null,               -- absolute cap
  revoked_at   timestamptz
);

create index if not exists cross_sessions_user_id_idx on cross_sessions (user_id);
create index if not exists cross_sessions_expires_at_idx on cross_sessions (expires_at);

alter table cross_sessions enable row level security;

-- Optional Tabroom link. Cross accounts do NOT require a Tabroom account;
-- linking one unlocks the caselist_* scouting tools and logged-in judge
-- paradigm lookups. Tokens are AES-256-GCM encrypted at rest under
-- TOKEN_ENC_KEY (see userStore.mjs). The Tabroom password is never stored.
create table if not exists tabroom_links (
  user_id            uuid primary key references auth.users (id) on delete cascade,
  tabroom_username   text not null,
  caselist_token_enc text,                         -- 'iv:tag:ciphertext', base64url
  tabroom_token_enc  text,
  linked_at          timestamptz not null default now(),
  last_verified_at   timestamptz not null default now()
);

alter table tabroom_links enable row level security;
