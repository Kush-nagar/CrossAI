'use client'

// Ports public/auth.js 1:1: consent gate -> login form -> session check,
// fail-closed (nothing in `children` renders until a session is confirmed),
// inline error text (not toasts), global 401 -> forced re-login.

import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { getAuthMe, login as apiLogin, logout as apiLogout } from '@/lib/api'
import { InkButton } from '@/components/ui/primitives'

const CONSENT_VERSION = 1
const CONSENT_KEY = 'crossConsent'

function hasConsent(): boolean {
  try {
    const raw = localStorage.getItem(CONSENT_KEY)
    if (!raw) return false
    return JSON.parse(raw).version === CONSENT_VERSION
  } catch {
    return false
  }
}

function saveConsent() {
  try {
    localStorage.setItem(CONSENT_KEY, JSON.stringify({ version: CONSENT_VERSION, at: new Date().toISOString() }))
  } catch {
    // private-mode storage failures fall through — consent just re-prompts
  }
}

type Stage = 'checking' | 'consent' | 'consent-declined' | 'login' | 'authenticated'

type AuthState = { username: string | null; signOut: () => void }
const AuthContext = createContext<AuthState>({ username: null, signOut: () => {} })
export const useAuth = () => useContext(AuthContext)

export function AuthGate({ children }: { children: React.ReactNode }) {
  const [stage, setStage] = useState<Stage>('checking')
  const [username, setUsername] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const pendingReveal = useRef<string | null>(null)

  function afterConsent(revealUsername: string | null) {
    if (hasConsent()) {
      if (revealUsername) setUsername(revealUsername)
      setStage(revealUsername ? 'authenticated' : 'login')
    } else {
      pendingReveal.current = revealUsername
      setStage('consent')
    }
  }

  useEffect(() => {
    getAuthMe()
      .then((data) => afterConsent(data.authenticated ? data.username : null))
      .catch(() => afterConsent(null))
  }, [])

  useEffect(() => {
    const onExpired = () => {
      setUsername(null)
      setStage('login')
    }
    window.addEventListener('cross-session-expired', onExpired)
    return () => window.removeEventListener('cross-session-expired', onExpired)
  }, [])

  function handleConsentAgree() {
    saveConsent()
    const revealUsername = pendingReveal.current
    pendingReveal.current = null
    if (revealUsername) {
      setUsername(revealUsername)
      setStage('authenticated')
    } else {
      setStage('login')
    }
  }

  async function handleLoginSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    const form = e.currentTarget
    const user = (form.elements.namedItem('username') as HTMLInputElement).value.trim()
    const pass = (form.elements.namedItem('password') as HTMLInputElement).value
    const remember = (form.elements.namedItem('remember') as HTMLInputElement).checked
    if (!user || !pass) {
      setError('Enter your Tabroom username and password.')
      return
    }
    setSubmitting(true)
    try {
      const data = await apiLogin(user, pass, remember, CONSENT_VERSION)
      setUsername(data.username || user)
      setStage('authenticated')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed. Check your credentials and try again.')
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

  if (stage === 'authenticated') {
    return <AuthContext.Provider value={{ username, signOut }}>{children}</AuthContext.Provider>
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background p-4">
      <div className="glass page-enter w-full max-w-sm rounded-3xl p-8">
        {stage === 'checking' && (
          <p className="text-center text-sm text-muted-foreground">Checking your session…</p>
        )}

        {stage === 'consent' && (
          <div className="flex flex-col gap-4">
            <h1 className="font-display text-xl font-semibold">Before you sign in</h1>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Cross uses your Tabroom credentials to look up opponent case data and judge paradigms on your behalf.
              Your password is used only for that sign-in and is never stored or logged.
            </p>
            <div className="mt-2 flex gap-2">
              <InkButton onClick={handleConsentAgree} className="flex-1">
                Agree & continue
              </InkButton>
              <button
                type="button"
                onClick={() => setStage('consent-declined')}
                className="press min-h-11 rounded-md border border-border px-4 text-sm font-semibold hover:bg-secondary"
              >
                Decline
              </button>
            </div>
          </div>
        )}

        {stage === 'consent-declined' && (
          <div className="flex flex-col gap-4">
            <h1 className="font-display text-xl font-semibold">Consent required</h1>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Cross can't sign you in without agreeing to the data & permissions notice.
            </p>
            <button
              type="button"
              onClick={() => setStage('consent')}
              className="press min-h-11 rounded-md border border-border px-4 text-sm font-semibold hover:bg-secondary"
            >
              Review notice again
            </button>
          </div>
        )}

        {stage === 'login' && (
          <form onSubmit={handleLoginSubmit} className="flex flex-col gap-4">
            <h1 className="font-display text-xl font-semibold">Sign in with Tabroom</h1>
            <label className="flex flex-col gap-1.5 text-sm font-semibold">
              Username
              <input
                name="username"
                autoComplete="username"
                className="min-h-11 w-full rounded-xl border bg-background px-3 outline-none focus:ring-2 focus:ring-primary"
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-semibold">
              Password
              <input
                name="password"
                type="password"
                autoComplete="current-password"
                className="min-h-11 w-full rounded-xl border bg-background px-3 outline-none focus:ring-2 focus:ring-primary"
              />
            </label>
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input name="remember" type="checkbox" defaultChecked className="size-4" />
              Remember me
            </label>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <InkButton type="submit" disabled={submitting}>
              {submitting ? 'Signing in…' : 'Sign in with Tabroom'}
            </InkButton>
          </form>
        )}
      </div>
    </div>
  )
}
