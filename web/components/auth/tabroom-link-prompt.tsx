'use client'

// Post-sign-in step: right after a session is confirmed, an unlinked debater is
// asked whether they want to link a Tabroom account — a consistent beat in the
// onboarding order (landing → sign in → link Tabroom? → app). Linking is still
// optional and still lives in Settings; this just puts the choice in the flow.
//
// It shows on every sign-in / load while the account has no linked Tabroom, so
// it never silently disappears from the flow. "Maybe later" (or ✕) closes it
// for the current visit only — there is no persisted opt-out — and it stops
// appearing for good the moment linking succeeds (tabroom.linked flips true).
//
// The actual link flow — including the third-party-password consent notice — is
// the same <TabroomLink/> shown in Settings, embedded here rather than
// reimplemented, so consent copy and the CONSENT_VERSION handshake stay in one
// place. Rendered only inside AuthGate's authenticated branch, so it can't
// appear on the public landing page.

import { useState } from 'react'
import { Link2, X } from 'lucide-react'
import { useAuth } from '@/components/auth/auth-gate'
import { TabroomLink } from '@/components/auth/tabroom-link'

export function TabroomLinkPrompt() {
  const { tabroom } = useAuth()
  const [dismissed, setDismissed] = useState(false)

  if (tabroom.linked || dismissed) return null

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
          onClick={() => setDismissed(true)}
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
              onClick={() => setDismissed(true)}
              className="press min-h-11 rounded-xl border border-border text-sm font-semibold hover:bg-secondary"
            >
              Maybe later
            </button>
            <p className="text-center text-xs text-muted-foreground">
              You can always link, or unlink, from Settings.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
