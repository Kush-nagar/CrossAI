import type { Metadata } from 'next'
import Link from 'next/link'
import { PublicShell } from '@/components/public/public-shell'
import { PAST_RESOLUTIONS, type PastSeason } from '@/lib/past-resolutions-data'
import { getTopics } from '@/lib/topics'

export const metadata: Metadata = {
  title: 'Past debate resolutions: Public Forum, LD and Policy by season',
  description: 'Every NSDA Public Forum, Lincoln-Douglas and Policy resolution by season, from 2000 to today.',
  alternates: { canonical: '/resolutions' },
}

const SECTIONS: { id: 'pf' | 'ld' | 'policy'; title: string }[] = [
  { id: 'pf', title: 'Public Forum' },
  { id: 'ld', title: 'Lincoln-Douglas' },
  { id: 'policy', title: 'Policy' },
]

export default function ResolutionsPage() {
  // PF topics with a Cross breakdown page, keyed by resolution text.
  const topicPages = new Map(getTopics().map((t) => [t.resolution.trim().toLowerCase(), t.slug]))
  const pageFor = (resolution: string) => topicPages.get(resolution.replace(/^Resolved:\s*/i, '').trim().toLowerCase())

  function Season({ s, linkTopics }: { s: PastSeason; linkTopics: boolean }) {
    return (
      <div className="border-b border-border/60 py-4">
        <h3 className="font-semibold">{s.season}</h3>
        <ul className="mt-2 flex flex-col gap-1.5 text-[0.95rem]">
          {s.topics.map((t, i) => {
            const slug = linkTopics ? pageFor(t.resolution) : undefined
            return (
              <li key={i} className="grid gap-x-4 sm:grid-cols-[11rem_minmax(0,1fr)]">
                <span className="text-muted-foreground">{t.period}</span>
                <span>
                  {t.resolution}
                  {slug && (
                    <>
                      {' '}
                      <Link href={`/topics/${slug}`} className="font-semibold underline underline-offset-2">
                        What teams ran
                      </Link>
                    </>
                  )}
                </span>
              </li>
            )
          })}
        </ul>
      </div>
    )
  }

  return (
    <PublicShell>
      <h1 className="font-display text-4xl font-semibold tracking-tight md:text-5xl">Past debate resolutions</h1>
      <p className="mt-3 max-w-2xl text-lg text-muted-foreground">
        Public Forum, Lincoln-Douglas and Policy topics by season. Check the NSDA for the official wording of any
        resolution.
      </p>
      <nav aria-label="Events" className="mt-6 flex flex-wrap gap-2 text-sm">
        {SECTIONS.map((s) => (
          <a key={s.id} href={`#${s.id}`} className="rounded-full bg-secondary px-3 py-1.5 font-semibold hover:bg-border">
            {s.title}
          </a>
        ))}
      </nav>
      {SECTIONS.map((sec) => (
        <section key={sec.id} id={sec.id} className="mt-10 scroll-mt-6" aria-labelledby={`h-${sec.id}`}>
          <h2 id={`h-${sec.id}`} className="font-display text-2xl font-semibold">
            {sec.title}
          </h2>
          {PAST_RESOLUTIONS[sec.id].map((s) => (
            <Season key={s.season} s={s} linkTopics={sec.id === 'pf'} />
          ))}
        </section>
      ))}
    </PublicShell>
  )
}
