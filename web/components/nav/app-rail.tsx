'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { primaryNavItems, secondaryNavItems, type NavItem } from './nav-config'
import { useAuth } from '@/components/auth/auth-gate'

function RailButton({ item, active, expanded }: { item: NavItem; active: boolean; expanded: boolean }) {
  const Icon = item.icon
  return (
    <Link
      href={item.href}
      aria-current={active ? 'page' : undefined}
      data-active={active}
      title={item.label}
      className={`nav-pen-mark relative flex min-h-12 items-center gap-3 overflow-hidden rounded-xl px-3 text-sm font-medium transition ${
        active ? 'text-pen' : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
      }`}
    >
      <Icon className="size-5 shrink-0" />
      <span className={`whitespace-nowrap transition ${expanded ? 'translate-x-0 opacity-100' : '-translate-x-2 opacity-0'}`}>
        {item.label}
      </span>
    </Link>
  )
}

export function AppRail() {
  const [expanded, setExpanded] = useState(false)
  const pathname = usePathname()
  const { username } = useAuth()
  const initials = (username || '?')
    .split(/[\s._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join('')

  return (
    <aside
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
      className={`glass fixed inset-y-4 left-4 z-20 hidden flex-col rounded-xl p-2.5 transition-all duration-300 md:flex ${expanded ? 'w-52' : 'w-[68px]'}`}
    >
      <Link href="/home" aria-label="Cross home" className="flex min-h-12 items-center gap-3 overflow-hidden rounded-md px-2.5">
        <Image src="/cross-logo.png" alt="" width={32} height={32} priority className="size-8 shrink-0 rounded-lg" />
        <span className={`font-display text-lg font-semibold transition ${expanded ? 'opacity-100' : 'opacity-0'}`}>Cross</span>
      </Link>
      <nav aria-label="Primary" className="mt-5 flex flex-col gap-1">
        {primaryNavItems.map((item) => (
          <RailButton key={item.id} item={item} active={pathname.startsWith(item.href)} expanded={expanded} />
        ))}
      </nav>
      <div className="mt-auto flex flex-col gap-1">
        {secondaryNavItems.map((item) => (
          <RailButton key={item.id} item={item} active={pathname.startsWith(item.href)} expanded={expanded} />
        ))}
        <Link href="/settings" className="mt-2 flex min-h-12 items-center gap-3 overflow-hidden rounded-md px-2.5 hover:bg-secondary">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-foreground text-xs font-bold text-card">
            {initials || '?'}
          </span>
          <span className={`whitespace-nowrap text-left text-sm transition ${expanded ? 'opacity-100' : 'opacity-0'}`}>
            <b className="block truncate max-w-32">{username || 'Debater'}</b>
          </span>
        </Link>
      </div>
    </aside>
  )
}
