'use client'

// The authenticated app chrome. The public landing page ("/") and the
// remaining direction previews are standalone marketing surfaces, so they
// render bare — no sign-in gate, no rail, no tab bar. Every other route is
// gated as before.
// ponytail: one pathname check beats a second root layout.

import { usePathname } from 'next/navigation'
import { AuthGate } from '@/components/auth/auth-gate'
import { AppShell } from '@/components/nav/app-shell'

const PUBLIC_ROUTES = ['/', '/preview']

export function AppFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isPublic = PUBLIC_ROUTES.some((r) => pathname === r || pathname?.startsWith(`${r}/`))
  if (isPublic) return <>{children}</>
  return (
    <AuthGate>
      <AppShell>{children}</AppShell>
    </AuthGate>
  )
}
