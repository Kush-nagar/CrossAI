'use client'

import Image from 'next/image'
import Link from 'next/link'
import { Bell, Menu, Search } from 'lucide-react'
import { useAuth } from '@/components/auth/auth-gate'
import { useCommandBar } from './command-bar'
import { ThemeToggle } from './theme-toggle'

export function TopBar({ openMore }: { openMore: () => void }) {
  const { username } = useAuth()
  const { setOpen } = useCommandBar()
  const initials = (username || '?')
    .split(/[\s._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join('')

  return (
    <div className="flex h-16 items-center justify-between md:h-20">
      <Link href="/home" className="flex items-center gap-2 font-display font-semibold md:hidden">
        <Image src="/cross-logo.png" alt="" width={32} height={32} priority className="size-8 rounded-lg" />
        Cross
      </Link>
      <div className="hidden md:flex" />
      <div className="flex items-center gap-2">
        <button
          onClick={() => setOpen(true)}
          aria-label="Search (Ctrl+K)"
          className="flex size-11 items-center justify-center rounded-md text-muted-foreground transition hover:bg-card hover:text-foreground"
        >
          <Search className="size-5" />
        </button>
        <button
          aria-label="Notifications"
          className="relative flex size-11 items-center justify-center rounded-md text-muted-foreground transition hover:bg-card hover:text-foreground"
        >
          <Bell className="size-5" />
        </button>
        <ThemeToggle className="hidden md:flex" />
        <button
          onClick={openMore}
          aria-label="Open menu"
          className="flex size-11 items-center justify-center rounded-md md:hidden"
        >
          <Menu className="size-5" />
        </button>
        <Link
          href="/settings"
          className="hidden size-10 items-center justify-center rounded-full bg-foreground text-xs font-bold text-card md:flex"
        >
          {initials || '?'}
        </Link>
      </div>
    </div>
  )
}
