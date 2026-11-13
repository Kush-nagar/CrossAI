import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { PublicShell } from '@/components/public/public-shell'
import { FEATURES, getFeature } from '@/lib/features-data'

export const dynamicParams = false

export function generateStaticParams() {
  return FEATURES.map((f) => ({ slug: f.slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const f = getFeature((await params).slug)
  if (!f) return {}
  return {
    title: f.metaTitle,
    description: f.description,
    alternates: { canonical: `/features/${f.slug}` },
    openGraph: { title: f.metaTitle, description: f.description, url: `/features/${f.slug}` },
  }
}

export default async function FeaturePage({ params }: { params: Promise<{ slug: string }> }) {
  const f = getFeature((await params).slug)
  if (!f) notFound()
  const others = FEATURES.filter((o) => o.slug !== f.slug)
  return (
    <PublicShell>
      <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
        <Link href="/features" className="underline-offset-2 hover:underline">
          Features
        </Link>{' '}
        › {f.name}
      </nav>
      <h1 className="mt-3 max-w-3xl font-display text-4xl font-semibold tracking-tight md:text-5xl">{f.title}</h1>
      <p className="mt-4 max-w-2xl text-lg text-muted-foreground">{f.intro}</p>
      <Link href={f.cta.href} className="mt-6 inline-block rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background">
        {f.cta.label}
      </Link>

      <ul className="mt-10 grid gap-4 md:grid-cols-2">
        {f.points.map((p) => (
          <li key={p.title} className="surface rounded-2xl p-5">
            <h2 className="font-semibold">{p.title}</h2>
            <p className="mt-1.5 text-[0.95rem] text-muted-foreground">{p.body}</p>
          </li>
        ))}
      </ul>

      <section className="mt-10" aria-labelledby="how">
        <h2 id="how" className="font-display text-2xl font-semibold">
          How it works
        </h2>
        <ol className="mt-3 flex flex-col gap-2 text-[0.95rem]">
          {f.steps.map((s, i) => (
            <li key={s} className="flex gap-3">
              <span className="font-data font-semibold text-muted-foreground">{i + 1}.</span>
              {s}
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-12" aria-labelledby="more">
        <h2 id="more" className="font-display text-2xl font-semibold">
          More from Cross
        </h2>
        <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
          {others.map((o) => (
            <li key={o.slug}>
              <Link href={`/features/${o.slug}`} className="underline-offset-2 hover:underline">
                {o.name}
              </Link>
            </li>
          ))}
          <li>
            <Link href="/guides" className="underline-offset-2 hover:underline">
              Guides
            </Link>
          </li>
          <li>
            <Link href="/tools" className="underline-offset-2 hover:underline">
              Free tools
            </Link>
          </li>
        </ul>
      </section>
    </PublicShell>
  )
}
