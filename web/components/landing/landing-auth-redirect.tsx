'use client'

// The landing page is public, but two cases have to leave it immediately:
// an already-signed-in visitor (send them to the app), and the auth callback,
// which the server always returns to "/" — including the ?authError= case,
// which only AuthGate knows how to display.

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getAuthMe } from '@/lib/api'

export function LandingAuthRedirect() {
  const router = useRouter()

  useEffect(() => {
    const authError = new URLSearchParams(window.location.search).get('authError')
    if (authError) {
      router.replace(`/home?authError=${encodeURIComponent(authError)}`)
      return
    }
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
