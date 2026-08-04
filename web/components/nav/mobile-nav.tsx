'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { MoreHorizontal } from 'lucide-react'
import { mobileNavItems } from './nav-config'

export function MobileNav({ openMore }: { openMore: () => void }) {
  const pathname = usePathname()
  return (
    <nav
      aria-label="Mobile navigation"
      className="glass fixed inset-x-3 bottom-3 z-30 flex items-center justify-around rounded-xl p-1.5 pb-[max(.375rem,env(safe-area-inset-bottom))] md:hidden"
    >
      {mobileNavItems.map((item) => {
        const Icon = item.icon
        const active = pathname.startsWith(item.href)
        return (
          <Link
            key={item.id}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            data-active={active}
            className={`nav-pen-mark font-data flex min-h-12 min-w-14 flex-col items-center justify-center gap-1 rounded-md text-[10px] font-semibold uppercase tracking-wide transition ${
              active ? 'text-foreground' : 'text-muted-foreground'
            }`}
          >
            <Icon className="size-4" />
            {item.label === 'CrossCoach' ? 'Coach' : item.label}
          </Link>
        )
      })}
      <button
        onClick={openMore}
        className="font-data flex min-h-12 min-w-14 flex-col items-center justify-center gap-1 rounded-md text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
      >
        <MoreHorizontal className="size-4" />
        More
      </button>
    </nav>
  )
}
