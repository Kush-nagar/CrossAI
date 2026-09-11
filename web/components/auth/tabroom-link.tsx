'use client'

// Optional Tabroom link, shown in Settings. This is the ONLY place in Cross
// where a third-party password is typed, so the data & permissions notice
// lives here rather than on the sign-in screen.
//
// CONSENT_VERSION must match REQUIRED_CONSENT_VERSION in scripts/server.mjs —
// the server refuses a link request that doesn't carry the current version, so
// bump both together when the notice's substance changes.

import { useState } from 'react'
import { Link2, Link2Off, ShieldCheck } from 'lucide-react'
import { InkButton } from '@/components/ui/primitives'
import { useAuth } from '@/components/auth/auth-gate'
import { linkTabroom, unlinkTabroom } from '@/lib/api'

const CONSENT_VERSION = 1

export function TabroomLink() {
  const { tabroom, refresh } = useAuth()
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [unlinkArmed, setUnlinkArmed] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    setNote('')
    const form = e.currentTarget
    const username = (form.elements.namedItem('tabroomUsername') as HTMLInputElement).value.trim()
    const password = (form.elements.namedItem('tabroomPassword') as HTMLInputElement).value
    if (!username || !password) {
      setError('Enter your Tabroom username and password.')
      return
    }
    setBusy(true)
    try {
      const result = await linkTabroom(username, password, true, CONSENT_VERSION)
      form.reset()
      setShowForm(false)
      if (!result.judgeLookupsAuthenticated) {
        setNote("Linked. Tabroom's own sign-in didn't go through, so judge paradigms will load anonymously.")
      }
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not link that account. Check your credentials.')
    } finally {
      setBusy(false)
    }
  }

  async function handleUnlink() {
    if (!unlinkArmed) {
      setUnlinkArmed(true)
      return
    }
    setUnlinkArmed(false)
    setBusy(true)
    try {
      await unlinkTabroom()
      setNote('')
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not unlink. Try again.')
    } finally {
      setBusy(false)
    }
  }

  if (tabroom.linked) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <span className="flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-full bg-success/15 text-success">
              <ShieldCheck className="size-4" />
            </span>
            <span>
              <b className="block text-sm">Linked as {tabroom.username}</b>
              <span className="text-xs text-muted-foreground">
                Opponent scouting and signed-in judge paradigms are on.
              </span>
            </span>
          </span>
          <button
            type="button"
            disabled={busy}
            onClick={handleUnlink}
            className="press flex min-h-11 items-center gap-2 rounded-xl border border-border px-4 text-sm font-semibold hover:bg-secondary disabled:opacity-50"
          >
            <Link2Off className="size-4" />
            {unlinkArmed ? 'Click again to unlink' : 'Unlink'}
          </button>
        </div>
        {note && <p className="text-sm text-muted-foreground">{note}</p>}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm leading-relaxed text-muted-foreground">
        Cross works without this. Linking a Tabroom account adds opponent scouting from the OpenCaselist wiki and lets
        judge paradigms load from pages Tabroom keeps behind a login.
      </p>

      {!showForm ? (
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="press flex min-h-11 items-center gap-2 rounded-xl bg-secondary px-4 text-sm font-semibold text-secondary-foreground hover:bg-border"
          >
            <Link2 className="size-4" />
            Link Tabroom account
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="rounded-xl bg-secondary p-4 text-xs leading-relaxed text-muted-foreground">
            Your Tabroom password is sent once, used to sign in to OpenCaselist and Tabroom on your behalf, and never
            stored or logged. The resulting access tokens are encrypted and kept on our server only, and are never
            sent to your browser. Unlink at any time to delete them.
          </div>
          <label className="flex flex-col gap-1.5 text-sm font-semibold">
            Tabroom username
            <input
              name="tabroomUsername"
              autoComplete="username"
              className="min-h-11 w-full rounded-xl border bg-background px-3 outline-none focus:ring-2 focus:ring-pen"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-semibold">
            Tabroom password
            <input
              name="tabroomPassword"
              type="password"
              autoComplete="current-password"
              className="min-h-11 w-full rounded-xl border bg-background px-3 outline-none focus:ring-2 focus:ring-pen"
            />
          </label>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <InkButton type="submit" disabled={busy}>
              {busy ? 'Linking…' : 'Agree & link'}
            </InkButton>
            <button
              type="button"
              onClick={() => {
                setShowForm(false)
                setError('')
              }}
              className="press min-h-11 rounded-xl border border-border px-4 text-sm font-semibold hover:bg-secondary"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
      {note && <p className="text-sm text-muted-foreground">{note}</p>}
    </div>
  )
}
