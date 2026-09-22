'use client'

// The landing page is public, but two cases have to leave it immediately:
// an already-signed-in visitor (send them to the app), and the auth callback,
// which the server always returns to "/" — including the ?authError= case,
// which only AuthGate knows how to display.
//
// ?asVisitor=1 skips the signed-in redirect specifically — the in-app "view
// public landing page" link (top-bar globe icon) uses it so a signed-in user
// can actually see the page an outside visitor would, instead of bouncing
// straight back to /home. Reaching "/" any other way (a bookmark, a typed
// URL, a stray link) still redirects a signed-in visitor as before — this
// flag only exists to be opted into, never a default.

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getAuthMe } from '@/lib/api'

export function LandingAuthRedirect() {
  const router = useRouter()

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const authError = params.get('authError')
    if (authError) {
      router.replace(`/home?authError=${encodeURIComponent(authError)}`)
      return
    }
    if (params.get('asVisitor') === '1') return
    let cancelled = false
    getAuthMe()
      .then((me) => {
        if (!cancelled && me?.authenticated) router.replace('/home')
      })
      .catch(() => {
        // Unreachable API just means the visitor stays on the public page.
      })
    return () => {
      cancelled = true
    }
  }, [router])

  return null
}
