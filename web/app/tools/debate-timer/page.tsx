import type { Metadata } from 'next'
import Link from 'next/link'
import { PublicShell } from '@/components/public/public-shell'
import { DebateTimer } from '@/components/tools/debate-timer'

export const metadata: Metadata = {
  title: 'Debate timer for Public Forum, LD and Policy',
  description:
    'Free online debate timer with the full speech order and prep time for Public Forum, Lincoln-Douglas and Policy. Keyboard shortcuts, overtime display and a beep at time.',
  alternates: { canonical: '/tools/debate-timer' },
}

export default function DebateTimerPage() {
  return (
    <PublicShell>
      <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
        <Link href="/tools" className="underline-offset-2 hover:underline">
          Tools
        </Link>{' '}
        › Debate timer
      </nav>
      <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight md:text-5xl">Debate timer</h1>
      <p className="mt-3 max-w-2xl text-lg text-muted-foreground">
        Speech order and prep time for PF, LD and Policy. Times follow common high-school formats; check your
        tournament&apos;s rules for prep.
      </p>
      <div className="mt-8">
        <DebateTimer />
      </div>
    </PublicShell>
  )
}
