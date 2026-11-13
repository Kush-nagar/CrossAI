import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { PublicShell } from '@/components/public/public-shell'
import { SITE_URL } from '@/lib/seo'
import { getGuide, getGuides } from '@/lib/guides'

export const dynamicParams = false

export function generateStaticParams() {
  return getGuides().map((g) => ({ slug: g.slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const guide = getGuide((await params).slug)
  if (!guide) return {}
  return {
    title: guide.title,
    description: guide.description,
    alternates: { canonical: `/guides/${guide.slug}` },
    openGraph: { title: guide.title, description: guide.description, url: `/guides/${guide.slug}`, type: 'article' },
  }
}

export default async function GuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const guide = getGuide((await params).slug)
  if (!guide) notFound()
  const all = getGuides()
  const i = all.findIndex((g) => g.slug === guide.slug)
  const next = all[i + 1]
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Article',
        headline: guide.title,
        description: guide.description,
        url: `${SITE_URL}/guides/${guide.slug}`,
        author: { '@type': 'Organization', name: 'Cross AI', url: SITE_URL },
        publisher: { '@type': 'Organization', name: 'Cross AI', url: SITE_URL },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Guides', item: `${SITE_URL}/guides` },
          { '@type': 'ListItem', position: 2, name: guide.title, item: `${SITE_URL}/guides/${guide.slug}` },
        ],
      },
    ],
  }
  return (
    <PublicShell>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
      <div className="mx-auto max-w-3xl">
        <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
          <Link href="/guides" className="underline-offset-2 hover:underline">
            Guides
          </Link>{' '}
          › {guide.title}
        </nav>
        <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight md:text-5xl">{guide.title}</h1>
        <p className="mt-3 text-lg text-muted-foreground">{guide.description}</p>
        <article className="legal-prose mt-8" dangerouslySetInnerHTML={{ __html: guide.html }} />
        <aside className="surface mt-10 rounded-2xl p-6">
          <p className="font-display text-xl font-semibold">Practice it with Cross</p>
          <p className="mt-2 text-[0.95rem] text-muted-foreground">
            Give the speech out loud and Cross grades it, factor by factor, against the round you were handed.
          </p>
          <Link href="/home" className="mt-4 inline-block rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background">
            Start a drill
          </Link>
        </aside>
        {next && (
          <p className="mt-8 text-[0.95rem]">
            Next guide:{' '}
            <Link href={`/guides/${next.slug}`} className="font-semibold underline underline-offset-2">
              {next.title}
            </Link>
          </p>
        )}
      </div>
    </PublicShell>
  )
}
