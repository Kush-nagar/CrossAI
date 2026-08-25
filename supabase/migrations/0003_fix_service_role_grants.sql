-- Fixes a gap in 0001_judge_paradigm_cache.sql and 0002_auth.sql: both assumed
-- service_role automatically has table-level privileges because it bypasses
-- RLS. It does bypass RLS, but RLS and Postgres GRANTs are separate systems —
-- bypassing RLS does not grant SELECT/INSERT/UPDATE/DELETE on its own. On at
-- least one project (fresh Supabase instance, Aug 2026), these tables came
-- up with service_role missing all four of those privileges, so every write
-- from the server failed with "permission denied for table <name>" the
-- moment auth/session code tried to touch them.
--
-- Safe to run on a project that already has correct grants — GRANT is
-- idempotent, re-running it is a no-op.

grant select, insert, update, delete on public.profiles to service_role;
grant select, insert, update, delete on public.cross_sessions to service_role;
grant select, insert, update, delete on public.judge_paradigm_cache to service_role;
grant select, insert, update, delete on public.tabroom_links to service_role;
