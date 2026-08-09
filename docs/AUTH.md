# Auth in Cross

Cross is a multi-user public app. A **Cross account** (Google or emailed
sign-in link) gates everything. A **Tabroom account** is optional and separate:
linking one adds opponent scouting and signed-in judge paradigms.

Those two are deliberately not the same thing. Tabroom has no sanctioned
signup API, and the NSDA terms behind it prohibit automated access ("any
robot, spider or other automatic device") and impersonating another user —
plus its 13+/parental-permission clause isn't ours to accept on a student's
behalf. So Cross never creates Tabroom accounts. Users link their own, or
don't.

## Sign-in flow

Supabase Auth is the identity provider; Cross's own cookie is the session.
The browser never talks to Supabase, never holds a Supabase token, and never
receives the anon key.

```
Google:  GET /api/auth/start/google  → 302 ${SUPABASE_URL}/auth/v1/authorize
                                     → Google → Supabase
                                     → 302 /api/auth/callback?code=…
Email:   POST /api/auth/magic-link {email} → GoTrue /auth/v1/otp
                                     → user clicks the emailed link → Supabase
                                     → 302 /api/auth/callback?code=…
Both:    callback → POST /auth/v1/token?grant_type=pkce {auth_code, code_verifier}
                  → upsert profile → mint session cookie → 302 to the app
```

The PKCE `code_verifier` is minted at step 1 and parked in a 10-minute
httpOnly cookie on our origin; only its sha256 goes to Supabase. Without it,
an intercepted `code` in a redirect URL would be redeemable by anyone who saw
it. The access/refresh tokens the exchange returns are **discarded** — Cross
mints its own session instead, so there's no refresh machinery and no bearer
token near the browser.

`PUBLIC_BASE_URL` must be the origin the *browser* is on. In dev that's Next
(`:3001`), which proxies `/api/*` to Express (`:3000`) — redirecting to
Express's own port lands on a 404.

## Routes

| Route | Notes |
|---|---|
| `GET /api/auth/start/google` | sets PKCE cookie, redirects to Supabase |
| `POST /api/auth/magic-link` | always `{ok:true}` — never reveals whether an address is registered |
| `GET /api/auth/callback` | redeems the code, mints the session, redirects to the app |
| `GET /api/auth/me` | ungated; `{authenticated, user, tabroom}` |
| `POST /api/auth/logout` | revokes the session row, not just the cookie |
| `POST /api/auth/tabroom/link` | requires a Cross session + current consent version |
| `POST /api/auth/tabroom/unlink` | deletes the stored tokens |

All of them sit behind `authRateLimiter` (`LOGIN_LIMIT_PER_MINUTE`, default
10/min per IP). `/api/auth/tabroom/link` additionally keeps the per-username
lockout from the old Tabroom login (`LOGIN_LOCKOUT_THRESHOLD` failures → 15
minute lockout), so this endpoint can't be used as a distributed brute-force
oracle against one debater's Tabroom password.

Everything else under `/api/*` is gated by the middleware in `server.mjs`,
which sets `req.session = { userId, tabroomUsername, caselistToken,
tabroomToken }`. The last two are `null` for unlinked users — every caller
must handle that. If session storage is unreachable the gate returns 503
rather than serving requests unauthenticated.

## Data model (`supabase/migrations/0002_auth.sql`)

User id is `auth.users.id` throughout; there's no shadow user table.

| Table | Holds |
|---|---|
| `profiles` | email, display name, accepted consent version, `prefs` |
| `cross_sessions` | `sha256(sid)`, user, created/last-seen/expires, revoked |
| `tabroom_links` | Tabroom username + AES-256-GCM encrypted tokens |

RLS is enabled with **no policies** on all three, matching the judge cache:
only the server's service_role key touches them, and the browser never queries
Postgres. That's strictly tighter than `auth.uid()` policies — add policies the
day a client queries these tables directly.

Sessions store `sha256(sid)` rather than the id, so a dump of that table
yields no usable cookies. The browser still holds `<sid>.<hmac>` in an
httpOnly, SameSite=Lax, `__Host-`-prefixed (prod) cookie.

Linked tokens are encrypted under `TOKEN_ENC_KEY`. Tampered or wrong-key
ciphertext decrypts to `null`, which callers treat as "not linked" rather than
sending garbage upstream. Tabroom **passwords are never stored** — they're used
once to mint tokens and dropped.

## Performance notes

`readSession` is async and hits Postgres, so validated sessions are cached
in-process for 60s and `last_seen_at` is written back at most every 5 minutes.
Decrypted Tabroom tokens are cached alongside for 5 minutes;
`invalidateLinkCache(userId)` clears them immediately on link/unlink. A
revoked session therefore stops working within 60 seconds, not instantly.

The AI rate limiter keys on `userId` (falling back to IP), so one account
can't multiply its budget by rotating IPs and a shared school network isn't
throttled into a single bucket. `DAILY_REQUEST_CAP` remains global.

## Setup

1. Apply `supabase/migrations/0001_*.sql` and `0002_auth.sql`.
2. Set `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`,
   `TOKEN_ENC_KEY` (`openssl rand -hex 32`), `SESSION_SECRET`, and
   `PUBLIC_BASE_URL`. The server refuses to boot without the Supabase three.
3. Supabase dashboard → **Authentication → Providers → Google**: enable it
   with a GCP OAuth client id/secret.
4. Supabase dashboard → **Authentication → URL Configuration → Redirect
   URLs**: add `<PUBLIC_BASE_URL>/api/auth/callback`.
5. Supabase dashboard → **Authentication → Emails → SMTP**: configure a real
   provider. The built-in mailer is capped at a couple of messages per hour
   and is not meant for production — magic links are unreliable without this.
   Google sign-in works regardless.

## Manual test checklist

No automated tests exist for this (the repo has no runner). Run these against
a fresh dev server.

- [ ] `node scripts/lib/auth.smoke.mjs` prints `auth.smoke: ok`
- [ ] Booting without `SUPABASE_ANON_KEY` fails loudly at startup
- [ ] **Google**: sign in → lands back on the app, signed in
- [ ] **Email**: request a link → inbox → click → signed in
- [ ] Requesting a link for an unregistered address gives the same response as
      a registered one (no enumeration)
- [ ] A tampered/expired `?code=` lands on `/?authError=…` and shows the error
      inline, and the param disappears from the URL on reload
- [ ] **Unlinked**: Settings shows "Link Tabroom account"; chat and judge
      lookups still work; Pre-Round offers no scouting tools
- [ ] **Link**: notice appears above the fields; wrong password shows an error;
      correct credentials show "Linked as <username>"
- [ ] Linked Pre-Round chat can scout an opponent; judge lookup resolves a
      login-gated paradigm
- [ ] **Unlink**: two-step confirm; scouting stops being offered afterwards
      (immediately, not after 5 minutes)
- [ ] **Restart persistence**: restart the API — still signed in, Tabroom still
      linked
- [ ] **Logout**: sign out, then reuse the old cookie with `curl` → 401
- [ ] **Cross-user isolation**: sign in as user A, link Tabroom; in another
      browser sign in as user B → B shows unlinked, B's Pre-Round has no
      scouting tools, and `/api/auth/me` shows B's own email only
- [ ] No token, password, cookie, or auth header appears in server logs during
      any of the above
