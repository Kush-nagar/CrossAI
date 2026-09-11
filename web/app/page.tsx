import type { Metadata } from 'next'
import { LandingAuthRedirect } from '@/components/landing/landing-auth-redirect'
import { Reveal } from '@/components/landing/reveal'
import { VanishingPoint } from '@/components/landing/vanishing-point'
import './landing.css'

export const metadata: Metadata = {
  title: 'Cross: argue like the room is watching',
  description:
    'An AI debate coach for Policy, Lincoln-Douglas, Public Forum and Parliamentary. Prep the round, read the judge, and get a score that shows its work.',
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
      <LandingAuthRedirect />
      <VanishingPoint />
      <Reveal />
    </>
  )
}
