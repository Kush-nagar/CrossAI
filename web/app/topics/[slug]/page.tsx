import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { PublicShell } from '@/components/public/public-shell'
import { SITE_URL } from '@/lib/seo'
import { getTopic, getTopics, type TopicSideSummary } from '@/lib/topics'

// One static page per PF resolution, built from the disclosed card archive.
// Public and indexable: aggregates and card tags only. Team names and card
// text stay behind sign-in.
export const dynamicParams = false

export function generateStaticParams() {
  return getTopics().map((t) => ({ slug: t.slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const topic = getTopic((await params).slug)
  if (!topic) return {}
  const title = `PF ${topic.label} topic: arguments, evidence and authors`
  const description = `What teams ran on "${topic.resolution}": the main Pro and Con arguments, common themes and most-read authors from ${topic.docs} disclosed cases.`
  return {
    title,
    description,
    alternates: { canonical: `/topics/${topic.slug}` },
    openGraph: { title, description, url: `/topics/${topic.slug}`, type: 'article' },
  }
}

function plural(n: number, word: string) {
  return `${n} ${word}${n === 1 ? '' : 's'}`
}

function SideColumn({ side, data }: { side: 'Pro' | 'Con'; data: TopicSideSummary }) {
  return (
    <section aria-labelledby={`side-${side}`} className="surface flex flex-col gap-6 rounded-3xl p-6">
      <div>
        <h2 id={`side-${side}`} className="font-display text-2xl font-semibold">
          {side}
        </h2>
        <p className="text-sm text-muted-foreground">
          {plural(data.docs, 'disclosed case')} · {data.cards.toLocaleString()} cards
        </p>
      </div>

      {data.arguments.length > 0 && (
        <div>
          <h3 className="font-semibold">Arguments teams ran</h3>
          <ul className="mt-2 flex flex-col gap-1.5">
            {data.arguments.map((a) => (
              <li key={a.label} className="flex justify-between gap-4 text-[0.95rem]">
                <span>{a.label}</span>
                <span className="shrink-0 text-muted-foreground">{plural(a.docs, 'case')}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {data.themes.length > 0 && (
        <div>
          <h3 className="font-semibold">Common themes in {side} tags</h3>
          <ul className="mt-2 flex flex-wrap gap-2">
            {data.themes.map((t) => (
              <li key={t.label} className="rounded-full bg-secondary px-3 py-1 text-sm">
                {t.label}
              </li>
            ))}
          </ul>
        </div>
      )}

      {data.authors.length > 0 && (
        <div>
          <h3 className="font-semibold">Most-read authors</h3>
          <p className="mt-2 text-[0.95rem] leading-relaxed">
            {data.authors.map((a, i) => (
              <span key={a.label}>
                {a.label} <span className="text-muted-foreground">({a.docs})</span>
                {i < data.authors.length - 1 ? ', ' : ''}
              </span>
            ))}
          </p>
        </div>
      )}

      {data.examples.length > 0 && (
        <div>
          <h3 className="font-semibold">Example cards</h3>
          <ul className="mt-2 flex flex-col gap-3">
            {data.examples.map((e) => (
              <li key={e.id}>
                <p className="font-semibold leading-snug">{e.tag}</p>
                <p className="text-sm text-muted-foreground">
                  {e.cite} · {e.argument} ·{' '}
                  <Link href={`/cards?id=${e.id}`} className="font-semibold text-foreground underline underline-offset-2">
                    Read the card
                  </Link>
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}

export default async function TopicPage({ params }: { params: Promise<{ slug: string }> }) {
  const topic = getTopic((await params).slug)
  if (!topic) notFound()
  const others = getTopics().filter((t) => t.slug !== topic.slug).slice(0, 6)
  const breadcrumbs = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Topics', item: `${SITE_URL}/topics` },
      { '@type': 'ListItem', position: 2, name: `PF ${topic.label}`, item: `${SITE_URL}/topics/${topic.slug}` },
    ],
  }
  const topPro = topic.sides.Pro.arguments[0]
  const topCon = topic.sides.Con.arguments[0]

  return (
    <PublicShell>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbs).replace(/</g, '\\u003c') }} />
      <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
        <Link href="/topics" className="underline-offset-2 hover:underline">
          Topics
        </Link>{' '}
        › PF {topic.label}
      </nav>
      <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight md:text-5xl">PF {topic.label} topic</h1>
      <p className="mt-4 max-w-3xl font-display text-2xl leading-snug">Resolved: {topic.resolution}</p>
      <p className="mt-4 max-w-3xl text-lg text-muted-foreground">
        {plural(topic.teams, 'team')} disclosed {plural(topic.docs, 'case')} on this topic on openCaselist, and Cross split
        them into {topic.cards.toLocaleString()} individual cards.
        {topPro && ` The most common Pro argument was ${topPro.label}`}
        {topPro && topCon ? `; on Con it was ${topCon.label}.` : topPro ? '.' : ''}
        {!topPro && topCon && ` The most common Con argument was ${topCon.label}.`}
      </p>

      <div className="mt-6 flex flex-wrap gap-3">
        <Link
          href={`/cards?season=${encodeURIComponent(topic.season)}&cycle=${encodeURIComponent(topic.cycle)}`}
          className="rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background"
        >
          Search every card on this topic
        </Link>
        <Link href="/home" className="rounded-full border border-border px-5 py-2.5 text-sm font-semibold hover:bg-secondary">
          Drill this topic with Cross
        </Link>
      </div>

      <div className="mt-10 grid gap-5 lg:grid-cols-2">
        <SideColumn side="Pro" data={topic.sides.Pro} />
        <SideColumn side="Con" data={topic.sides.Con} />
      </div>

      <p className="mt-6 max-w-3xl text-sm text-muted-foreground">
        Counts are disclosed cases (one team&apos;s case at one tournament), not cards, so one long case can&apos;t skew them.
        Themes are phrases that show up far more in one side&apos;s card tags than the other&apos;s, counted per team. Teams
        aren&apos;t named on public pages. Cards are as the teams disclosed them; check the original source before reading one
        in a round.
      </p>

      {others.length > 0 && (
        <section className="mt-12" aria-labelledby="other-topics">
          <h2 id="other-topics" className="font-display text-2xl font-semibold">
            Other topics
          </h2>
          <ul className="mt-3 grid gap-2 md:grid-cols-2">
            {others.map((t) => (
              <li key={t.slug}>
                <Link href={`/topics/${t.slug}`} className="underline-offset-2 hover:underline">
                  PF {t.label}: {t.resolution}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </PublicShell>
  )
}
