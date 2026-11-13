import type { Metadata } from 'next'
import Link from 'next/link'
import { PublicShell } from '@/components/public/public-shell'
import { GLOSSARY } from '@/lib/glossary-data'

export const metadata: Metadata = {
  title: 'Debate glossary: Public Forum, LD and Policy terms explained',
  description:
    'Plain-language definitions of debate terms: uniqueness, link, impact, turns, frontlines, weighing, collapse, theory, kritiks and more.',
  alternates: { canonical: '/glossary' },
}

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

export default function GlossaryPage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'DefinedTermSet',
    name: 'Debate glossary',
    hasDefinedTerm: GLOSSARY.flatMap((s) => s.terms).map((t) => ({ '@type': 'DefinedTerm', name: t.term, description: t.definition })),
  }
  return (
    <PublicShell>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
      <h1 className="font-display text-4xl font-semibold tracking-tight md:text-5xl">Debate glossary</h1>
      <p className="mt-3 max-w-2xl text-lg text-muted-foreground">
        The terms you hear in Public Forum, Lincoln-Douglas and Policy rounds, in plain language.
      </p>
      <nav aria-label="Glossary sections" className="mt-6 flex flex-wrap gap-2 text-sm">
        {GLOSSARY.map((s) => (
          <a key={s.title} href={`#${slugify(s.title)}`} className="rounded-full bg-secondary px-3 py-1.5 font-semibold hover:bg-border">
            {s.title}
          </a>
        ))}
      </nav>
      {GLOSSARY.map((section) => (
        <section key={section.title} id={slugify(section.title)} className="mt-10 scroll-mt-6" aria-labelledby={`h-${slugify(section.title)}`}>
          <h2 id={`h-${slugify(section.title)}`} className="font-display text-2xl font-semibold">
            {section.title}
          </h2>
          <dl className="mt-4 grid gap-x-8 gap-y-4 md:grid-cols-2">
            {section.terms.map((t) => (
              <div key={t.term} id={slugify(t.term)} className="scroll-mt-6">
                <dt className="font-semibold">{t.term}</dt>
                <dd className="mt-1 text-[0.95rem] leading-relaxed text-muted-foreground">
                  {t.definition}
                  {t.link && (
                    <>
                      {' '}
                      <Link href={t.link} className="font-semibold text-foreground underline underline-offset-2">
                        More
                        <span className="sr-only"> about {t.term}</span>
                      </Link>
                    </>
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </PublicShell>
  )
}
