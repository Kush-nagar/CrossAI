import type { Metadata } from 'next'
import Link from 'next/link'
import { PublicShell } from '@/components/public/public-shell'
import { FEATURES } from '@/lib/features-data'

export const metadata: Metadata = {
  title: 'Features: card search, judge paradigms, speech drills, round feedback',
  description: 'What Cross does: search disclosed PF cards, read any judge’s paradigm in a minute, practice speeches with grading, and get feedback on real rounds.',
  alternates: { canonical: '/features' },
}

export default function FeaturesIndex() {
  return (
    <PublicShell>
      <h1 className="font-display text-4xl font-semibold tracking-tight md:text-5xl">What Cross does</h1>
      <p className="mt-3 max-w-2xl text-lg text-muted-foreground">
        An AI debate coach plus the tools around it. Free to use with a Cross account.
      </p>
      <ul className="mt-8 grid gap-3 md:grid-cols-2">
        {FEATURES.map((f) => (
          <li key={f.slug}>
            <Link href={`/features/${f.slug}`} className="surface block h-full rounded-2xl p-5 transition hover:bg-secondary/60">
              <p className="font-display text-xl font-semibold">{f.name}</p>
              <p className="mt-2 text-[0.95rem] text-muted-foreground">{f.description}</p>
            </Link>
          </li>
        ))}
      </ul>
    </PublicShell>
  )
}
