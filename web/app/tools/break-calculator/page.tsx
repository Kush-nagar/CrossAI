import type { Metadata } from 'next'
import Link from 'next/link'
import { PublicShell } from '@/components/public/public-shell'
import { BreakCalculator } from '@/components/tools/break-calculator'

export const metadata: Metadata = {
  title: 'Debate break calculator: which record breaks?',
  description:
    'Estimate which prelim record breaks at a debate tournament from the number of entries, prelim rounds and break size, and how many teams are on the bubble.',
  alternates: { canonical: '/tools/break-calculator' },
}

export default function BreakCalculatorPage() {
  return (
    <PublicShell>
      <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
        <Link href="/tools" className="underline-offset-2 hover:underline">
          Tools
        </Link>{' '}
        › Break calculator
      </nav>
      <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight md:text-5xl">Break calculator</h1>
      <p className="mt-3 max-w-2xl text-lg text-muted-foreground">
        Which record breaks? Enter the tournament&apos;s numbers to see the likely cutoff and how crowded the bubble is.
      </p>
      <div className="mt-8 max-w-3xl">
        <BreakCalculator />
      </div>
    </PublicShell>
  )
}
