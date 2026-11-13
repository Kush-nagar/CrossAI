import type { Metadata } from 'next'
import Link from 'next/link'
import { PublicShell } from '@/components/public/public-shell'
import { getGuides } from '@/lib/guides'

export const metadata: Metadata = {
  title: 'Public Forum guides: case writing, rebuttal, summary, weighing',
  description:
    'Short, practical guides to every part of a Public Forum round: writing a case, rebuttal, frontlining, summary, final focus, weighing, crossfire and cutting cards.',
  alternates: { canonical: '/guides' },
}

export default function GuidesIndex() {
  const guides = getGuides()
  return (
    <PublicShell>
      <h1 className="font-display text-4xl font-semibold tracking-tight md:text-5xl">Debate guides</h1>
      <p className="mt-3 max-w-2xl text-lg text-muted-foreground">
        Short, practical guides to every speech in a Public Forum round, written the way Cross coaches. Most of it carries
        over to LD and Policy.
      </p>
      <ol className="mt-8 grid gap-3 md:grid-cols-2">
        {guides.map((g) => (
          <li key={g.slug}>
            <Link href={`/guides/${g.slug}`} className="surface block h-full rounded-2xl p-5 transition hover:bg-secondary/60">
              <p className="font-display text-xl font-semibold leading-snug">{g.title}</p>
              <p className="mt-2 text-sm text-muted-foreground">{g.description}</p>
              <p className="mt-3 text-xs font-semibold text-muted-foreground">{Math.max(1, Math.round(g.words / 220))} min read</p>
            </Link>
          </li>
        ))}
      </ol>
      <p className="mt-8 text-sm text-muted-foreground">
        Looking up a term? See the{' '}
        <Link href="/glossary" className="font-semibold text-foreground underline underline-offset-2">
          debate glossary
        </Link>
        .
      </p>
    </PublicShell>
  )
}
