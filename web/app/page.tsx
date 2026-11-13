import type { Metadata } from 'next'
import { SITE_URL } from '@/lib/seo'
import { LandingAuthRedirect } from '@/components/landing/landing-auth-redirect'
import { Reveal } from '@/components/landing/reveal'
import { VanishingPoint } from '@/components/landing/vanishing-point'
import './landing.css'

export const metadata: Metadata = {
  title: { absolute: 'Cross: argue like the room is watching' },
  description:
    'An AI debate coach for Public Forum, Lincoln-Douglas, Policy and Parli. Get your speeches graded, read your judge\'s paradigm, and search 17,000 disclosed PF cards.',
  alternates: { canonical: '/' },
  openGraph: {
    title: 'Cross: argue like the room is watching',
    description: 'An AI debate coach that grades your speeches, reads your judge, and finds the card.',
    url: '/',
  },
}

// Structured data so search engines know what Cross is (a free web app for
// debate coaching) and who runs it. Facts only — keep in step with /terms.
const JSON_LD = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebApplication',
      name: 'Cross',
      url: SITE_URL,
      description:
        'AI debate coach for Public Forum, Lincoln-Douglas, Policy and Parliamentary debate: graded speech drills, judge paradigm summaries, and a searchable library of disclosed Public Forum evidence cards.',
      applicationCategory: 'EducationalApplication',
      operatingSystem: 'Web',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      publisher: { '@id': `${SITE_URL}/#org` },
    },
    {
      '@type': 'Organization',
      '@id': `${SITE_URL}/#org`,
      name: 'Cross AI',
      url: SITE_URL,
      logo: `${SITE_URL}/cross-logo.png`,
      email: 'support@cross-ai.dev',
    },
  ],
}

const CONTRACT = `
THESIS: The fresco's own one-point perspective is the page grid; this refuses the
dark-SaaS hero with a floating dashboard screenshot.
OWN-WORLD: Limewash plaster (#F2F1EC) and ink (#16181C) with one arch-sky accent
(#2E5C8A). Zodiak display, Switzer body, Azeret Mono for data. Arcade "bay" cards
with arched tops, hairline rules, no filled containers.
STORY: A debater sees a room built for argument, learns Cross coaches judgment
rather than scripts, and signs in.
FIRST VIEWPORT: Full-bleed central bay of The School of Athens, top third
dissolving to plaster; frosted pill nav centred at top; headline on the vanishing
axis; primary pill CTA below centre; orthogonals converging behind Plato's hand,
straightening into the body's vertical rules as the hero scrolls away.
FORM: Architectural measured drawing, candidate 1 of the grounded list.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, and DESIGN.md
`

export default function LandingPage() {
  return (
    <>
      <div dangerouslySetInnerHTML={{ __html: `<!--${CONTRACT}-->` }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD).replace(/</g, '\\u003c') }} />
      <LandingAuthRedirect />
      <VanishingPoint />
      <Reveal />
    </>
  )
}
