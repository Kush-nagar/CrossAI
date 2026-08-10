'use client'

// Fail-closed sign-in gate: nothing in `children` renders until /api/auth/me
// confirms a session. Sign-in is Google or an emailed link, both brokered
// server-side (scripts/lib/crossAuth.mjs) — no password is ever typed here and
// no auth token reaches this bundle.
//
// A Tabroom account is NOT part of signing in. It's an optional link users add
// later from Settings (see tabroom-link.tsx), which is also where the
// credentials notice lives, because that's the only place a third-party
// password is involved.

import { createContext, useContext, useEffect, useState } from 'react'
import Image from 'next/image'
import { getAuthMe, logout as apiLogout, sendMagicLink, startGoogleSignIn, type AuthMe } from '@/lib/api'
import { InkButton } from '@/components/ui/primitives'
import { TabroomLinkPrompt } from '@/components/auth/tabroom-link-prompt'

type Stage = 'checking' | 'signin' | 'sent' | 'authenticated'

type AuthState = {
  /** Friendly name for greetings and avatars — display name, else the email's local part. */
  username: string | null
  email: string | null
  tabroom: AuthMe['tabroom']
  signOut: () => void
  /** Re-read /api/auth/me — call after linking or unlinking Tabroom. */
  refresh: () => Promise<void>
}

const AuthContext = createContext<AuthState>({
  username: null,
  email: null,
  tabroom: { linked: false, username: null },
  signOut: () => {},
  refresh: async () => {},
})
export const useAuth = () => useContext(AuthContext)

// The server redirects back with ?authError=<code> when a sign-in round trip
// fails, since a redirect can't carry a JSON error body.
const AUTH_ERRORS: Record<string, string> = {
  expired: 'That sign-in link has expired. Request a new one below.',
  failed: "Sign-in didn't complete. Please try again.",
  unavailable: 'Sign-in is temporarily unavailable. Try again in a moment.',
}

function displayNameOf(me: AuthMe): string | null {
  if (!me.user) return null
  return me.user.displayName || me.user.email?.split('@')[0] || null
}

export function AuthGate({ children }: { children: React.ReactNode }) {
  const [stage, setStage] = useState<Stage>('checking')
  const [me, setMe] = useState<AuthMe | null>(null)
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function refresh() {
    const data = await getAuthMe().catch(() => null)
    setMe(data)
    setStage(data?.authenticated ? 'authenticated' : 'signin')
  }

  useEffect(() => {
    // Surface a failed redirect, then strip the param so a reload doesn't
    // resurrect a stale error.
    const code = new URLSearchParams(window.location.search).get('authError')
    if (code) {
      setError(AUTH_ERRORS[code] || AUTH_ERRORS.failed)
      window.history.replaceState({}, '', window.location.pathname)
    }
    refresh()
  }, [])

  useEffect(() => {
    const onExpired = () => {
      setMe(null)
      setStage('signin')
    }
    window.addEventListener('cross-session-expired', onExpired)
    return () => window.removeEventListener('cross-session-expired', onExpired)
  }, [])

  async function handleEmailSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    if (!email.trim()) {
      setError('Enter your email address.')
      return
    }
    setSubmitting(true)
    try {
      await sendMagicLink(email.trim())
      setStage('sent')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send the sign-in link. Try again.')
    } finally {
      setSubmitting(false)
    }
  }

  async function signOut() {
    try {
      await apiLogout()
    } catch {
      // ignore — reload resets state regardless
    }
    window.location.reload()
  }

  if (stage === 'authenticated' && me) {
    return (
      <AuthContext.Provider
        value={{ username: displayNameOf(me), email: me.user?.email || null, tabroom: me.tabroom, signOut, refresh }}
      >
        {children}
        {/* Post-sign-in one-time nudge to link Tabroom (skips if already linked/dismissed). */}
        <TabroomLinkPrompt />
      </AuthContext.Provider>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background p-4">
      <div className="glass page-enter w-full max-w-sm rounded-3xl p-8">
        {stage === 'checking' && <p className="text-center text-sm text-muted-foreground">Checking your session…</p>}

        {stage === 'signin' && (
          <div className="flex flex-col gap-6">
            <div className="flex flex-col items-center gap-3 text-center">
              <Image src="/cross-logo.png" alt="" width={48} height={48} className="size-12 rounded-2xl" priority />
              <div className="flex flex-col gap-1">
                <h1 className="font-display text-2xl font-semibold tracking-[-0.02em]">Sign in to Cross</h1>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  Your debate coach, your prep, your rounds.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={startGoogleSignIn}
              className="press flex min-h-11 w-full items-center justify-center gap-3 rounded-xl border border-border bg-background text-sm font-semibold transition hover:bg-secondary"
            >
              <GoogleMark />
              Continue with Google
            </button>

            <div className="flex items-center gap-3" aria-hidden="true">
              <span className="h-px flex-1 bg-border" />
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">or</span>
              <span className="h-px flex-1 bg-border" />
            </div>

            <form onSubmit={handleEmailSubmit} className="flex flex-col gap-4">
              <label className="flex flex-col gap-1.5 text-sm font-semibold">
                Email
                <input
                  type="email"
                  name="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@school.edu"
                  className="min-h-11 w-full rounded-xl border bg-background px-3 outline-none focus:ring-2 focus:ring-primary"
                />
              </label>
              {error && (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              )}
              <InkButton type="submit" disabled={submitting}>
                {submitting ? 'Sending…' : 'Email me a sign-in link'}
              </InkButton>
            </form>

            <p className="text-center text-xs leading-relaxed text-muted-foreground">
              No password to remember. We'll email you a link that signs you in.
            </p>
          </div>
        )}

        {stage === 'sent' && (
          <div className="flex flex-col gap-5 text-center">
            <h1 className="font-display text-2xl font-semibold tracking-[-0.02em]">Check your inbox</h1>
            <p className="text-sm leading-relaxed text-muted-foreground">
              If <b className="text-foreground">{email.trim()}</b> has an account — or is ready for one — a sign-in link
              is on its way. It expires shortly, so use it soon.
            </p>
            <button
              type="button"
              onClick={() => {
                setStage('signin')
                setError('')
              }}
              className="press min-h-11 rounded-xl border border-border px-4 text-sm font-semibold hover:bg-secondary"
            >
              Use a different email
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// Google's mark, inlined rather than fetched: the sign-in screen must render
// before any network round trip, and nothing external is loaded app-wide.
function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" className="size-5" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  )
}
