import type { Metadata } from 'next'
import Link from 'next/link'
import { PublicShell } from '@/components/public/public-shell'
import { getTopics } from '@/lib/topics'

export const metadata: Metadata = {
  title: 'Public Forum topics: what teams ran on each resolution',
  description:
    'Every recent Public Forum resolution with the arguments, themes and authors teams actually read, drawn from cases disclosed on openCaselist.',
  alternates: { canonical: '/topics' },
}

export default function TopicsIndex() {
  const topics = getTopics()
  const seasons = [...new Set(topics.map((t) => t.season))]
  return (
    <PublicShell>
      <h1 className="font-display text-4xl font-semibold tracking-tight md:text-5xl">Public Forum topics</h1>
      <p className="mt-3 max-w-2xl text-lg text-muted-foreground">
        What teams actually ran on each resolution: the arguments, the themes and the authors they read, counted from
        cases disclosed on openCaselist.
      </p>
      {topics.length === 0 && <p className="mt-8 text-muted-foreground">Topic pages are being rebuilt. Check back soon.</p>}
      {seasons.map((season) => (
        <section key={season} className="mt-10" aria-labelledby={`season-${season}`}>
          <h2 id={`season-${season}`} className="font-display text-2xl font-semibold">
            {season} season
          </h2>
          <ul className="mt-4 grid gap-3 md:grid-cols-2">
            {topics
              .filter((t) => t.season === season)
              .map((t) => (
                <li key={t.slug}>
                  <Link href={`/topics/${t.slug}`} className="surface block h-full rounded-2xl p-5 transition hover:bg-secondary/60">
                    <p className="text-sm font-semibold text-muted-foreground">{t.label}</p>
                    <p className="mt-1 font-semibold leading-snug">Resolved: {t.resolution}</p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {t.docs} disclosed cases · {t.cards.toLocaleString()} cards
                    </p>
                  </Link>
                </li>
              ))}
          </ul>
        </section>
      ))}
    </PublicShell>
  )
}
