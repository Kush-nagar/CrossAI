'use client'

// Post-sign-in nudge: right after a session is confirmed, an unlinked debater
// is asked once whether they want to link a Tabroom account. Linking is still
// optional (and still lives in Settings) — this just surfaces it up front so
// opponent scouting and signed-in judge paradigms are one decision away instead
// of a setting they have to discover.
//
// The actual link flow — including the third-party-password consent notice —
// is the same <TabroomLink/> shown in Settings, embedded here rather than
// reimplemented, so consent copy and the CONSENT_VERSION handshake stay in one
// place. A successful link flips tabroom.linked and this unmounts on its own.
//
// Shown when: authenticated AND not linked AND not previously dismissed
// (persisted per account so it never nags twice). Rendered only inside
// AuthGate's authenticated branch, so it can't appear on the public landing.

import { useEffect, useState } from 'react'
import { Link2, X } from 'lucide-react'
import { useAuth } from '@/components/auth/auth-gate'
import { TabroomLink } from '@/components/auth/tabroom-link'

const dismissKey = (email: string | null) => `cross.tabroomPrompt.dismissed:${email ?? 'anon'}`

export function TabroomLinkPrompt() {
  const { tabroom, email } = useAuth()
  // Start hidden and only reveal after the client has read localStorage — keeps
  // SSR/first paint stable and avoids flashing the modal at an already-dismissed
  // user before the check resolves.
  const [checked, setChecked] = useState(false)
  const [dismissed, setDismissed] = useState(true)

  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(dismissKey(email)) === '1')
    } catch {
      setDismissed(false)
    }
    setChecked(true)
  }, [email])

  if (!checked || tabroom.linked || dismissed) return null

  function dismiss() {
    try {
      localStorage.setItem(dismissKey(email), '1')
    } catch {
      // Private mode / storage disabled — worst case the prompt reappears next
      // session, which is a non-issue.
    }
    setDismissed(true)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tabroom-prompt-title"
    >
      <div className="glass page-enter relative w-full max-w-md rounded-3xl p-8">
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss"
          className="press absolute right-4 top-4 flex size-8 items-center justify-center rounded-full text-muted-foreground transition hover:bg-secondary"
        >
          <X className="size-4" />
        </button>

        <div className="flex flex-col gap-6">
          <div className="flex flex-col items-center gap-3 text-center">
            <span className="flex size-12 items-center justify-center rounded-2xl bg-secondary text-foreground">
              <Link2 className="size-5" />
            </span>
            <h2 id="tabroom-prompt-title" className="font-display text-2xl font-semibold tracking-[-0.02em]">
              Link your Tabroom account?
            </h2>
          </div>

          {/* Same flow (and consent notice) as Settings. */}
          <TabroomLink />

          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={dismiss}
              className="press min-h-11 rounded-xl border border-border text-sm font-semibold hover:bg-secondary"
            >
              Maybe later
            </button>
            <p className="text-center text-xs text-muted-foreground">
              You can always link — or unlink — from Settings.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
