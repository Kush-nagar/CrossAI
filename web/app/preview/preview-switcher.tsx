'use client'

// Switcher for the reference previews. "A" leaves the preview surface for the
// real landing page, which is what Direction A became.

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const DIRECTIONS = [
  { href: '/', label: 'A' },
  { href: '/preview/b', label: 'B' },
  { href: '/preview/c', label: 'C' },
]

export function PreviewSwitcher() {
  const pathname = usePathname()
  if (pathname === '/preview') return null

  return (
    <nav className="pv-switch" aria-label="Switch landing direction">
      {DIRECTIONS.map((d) => (
        <Link
          key={d.href}
          href={d.href}
          data-active={pathname === d.href}
          aria-current={pathname === d.href ? 'page' : undefined}
        >
          {d.label}
        </Link>
      ))}
      <Link className="pv-switch-back" href="/preview">
        All three
      </Link>
    </nav>
  )
}
