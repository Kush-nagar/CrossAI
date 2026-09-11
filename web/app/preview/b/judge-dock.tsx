'use client'

// The panel docked to the hero plate. It cycles three judges so the hero shows
// the product doing its job rather than a static screenshot. Synthetic data.

import { useEffect, useState } from 'react'

const JUDGES = [
  {
    name: 'A. Reyes',
    school: 'Tabroom',
    summary:
      'Tech over truth. Wants the ballot written for them in the last two minutes: collapse early and weigh explicitly.',
    tags: ['speed: 8/10', 'theory: reluctant', 'wants weighing'],
  },
  {
    name: 'M. Okafor',
    school: 'Tabroom',
    summary:
      'Flows everything, votes on the cleanest extension. Hates new-in-the-2 and will cross-apply your own framing against you.',
    tags: ['speed: 6/10', 'K: familiar', 'line-by-line'],
  },
  {
    name: 'J. Lindqvist',
    school: 'Tabroom',
    summary:
      'Lay-adjacent. Plain-language impact calculus travels; jargon does not. Signposting matters more than card count.',
    tags: ['speed: 4/10', 'no theory', 'persuasion'],
  },
]

export function JudgeDock() {
  const [i, setI] = useState(0)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const id = setInterval(() => setI((n) => (n + 1) % JUDGES.length), 5000)
    return () => clearInterval(id)
  }, [])

  const judge = JUDGES[i]
  return (
    <aside className="pv-b-dock" aria-live="polite">
      <div className="pv-b-dock-head">
        <strong key={`${judge.name}-n`} className="pv-b-fade">
          {judge.name}
        </strong>
        <span>Pre-round · paradigm</span>
      </div>
      <p key={`${judge.name}-s`} className="pv-b-fade">
        {judge.summary}
      </p>
      <ul key={`${judge.name}-t`} className="pv-b-fade">
        {judge.tags.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ul>
    </aside>
  )
}
