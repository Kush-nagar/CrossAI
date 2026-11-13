import type { Metadata } from 'next'
import Link from 'next/link'
import { PublicShell } from '@/components/public/public-shell'

export const metadata: Metadata = {
  title: 'Free debate tools: break calculator, speech timer, past resolutions',
  description: 'Free tools for debaters, no account needed: estimate which record breaks, time PF, LD and Policy rounds, and look up past NSDA resolutions.',
  alternates: { canonical: '/tools' },
}

const TOOLS = [
  {
    href: '/tools/break-calculator',
    title: 'Break calculator',
    body: 'Enter the field size, prelim rounds and break size to see which record clears and how many teams sit on the bubble.',
  },
  {
    href: '/tools/debate-timer',
    title: 'Debate timer',
    body: 'Speech and prep timers for Public Forum, Lincoln-Douglas and Policy, with keyboard shortcuts and a beep at time.',
  },
  {
    href: '/resolutions',
    title: 'Past resolutions',
    body: 'Every Public Forum, LD and Policy resolution by season, back to 2000.',
  },
  {
    href: '/topics',
    title: 'PF topic breakdowns',
    body: 'What teams actually ran on recent PF topics: top arguments, themes and authors from disclosed cases.',
  },
]

export default function ToolsIndex() {
  return (
    <PublicShell>
      <h1 className="font-display text-4xl font-semibold tracking-tight md:text-5xl">Free debate tools</h1>
      <p className="mt-3 max-w-2xl text-lg text-muted-foreground">No account needed. Built for tournament weekends.</p>
      <ul className="mt-8 grid gap-3 md:grid-cols-2">
        {TOOLS.map((t) => (
          <li key={t.href}>
            <Link href={t.href} className="surface block h-full rounded-2xl p-5 transition hover:bg-secondary/60">
              <p className="font-display text-xl font-semibold">{t.title}</p>
              <p className="mt-2 text-[0.95rem] text-muted-foreground">{t.body}</p>
            </Link>
          </li>
        ))}
      </ul>
    </PublicShell>
  )
}
