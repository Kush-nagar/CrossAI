// Renders the structured Nemotron judge summary — sections, bullets, and
// callouts instead of a wall of text. Built only from existing Ballot/ink
// primitives (.surface/.ballot-rule/.eyebrow/Pill) — no new Card/Callout
// component, per design-system/cross/MASTER.md's one-elevation-step rule.

import { Pill } from '@/components/ui/primitives'
import type { JudgeSummaryBlock, StructuredJudgeSummary } from '@/lib/api'

const SECTION_LABELS: Record<keyof StructuredJudgeSummary['sections'], string> = {
  orientation: 'How they decide',
  delivery: 'Speaking & delivery',
  evidence: 'Evidence & warranting',
  weighing: 'Weighing & impacts',
  theory: 'Theory / T / procedurals',
  cx: 'Cross-ex style',
  speakerPoints: 'Speaker points',
  dealbreakers: 'Pet peeves & dealbreakers',
}

function tagTone(tag: string, i: number): 'pen' | 'highlight' | 'neutral' {
  if (/dislikes?|no\s/i.test(tag)) return 'highlight'
  if (i === 0) return 'pen'
  return 'neutral'
}

function SummaryBlock({ block }: { block: JudgeSummaryBlock }) {
  switch (block.kind) {
    case 'heading':
      return <p className="font-semibold text-foreground">{block.text}</p>
    case 'bullets':
      return (
        <ul className="list-disc space-y-1 pl-4 marker:text-pen">
          {block.items.map((t, i) => (
            <li key={i}>{t}</li>
          ))}
        </ul>
      )
    case 'callout':
      return (
        <blockquote
          className={`border-l-2 pl-4 italic leading-relaxed ${
            block.tone === 'warning' ? 'border-destructive text-destructive' : 'border-pen text-foreground'
          }`}
        >
          {block.text}
        </blockquote>
      )
    case 'keyPrefs':
      return (
        <dl className="grid grid-cols-[max-content_1fr] gap-x-3 gap-y-1">
          {block.pairs.map((p, i) => (
            <div key={i} className="contents">
              <dt className="font-data text-xs uppercase text-muted-foreground">{p.label}</dt>
              <dd>{p.value}</dd>
            </div>
          ))}
        </dl>
      )
  }
}

export function JudgeSummaryPanel({ summary }: { summary: StructuredJudgeSummary }) {
  const sectionIds = Object.keys(SECTION_LABELS) as (keyof StructuredJudgeSummary['sections'])[]

  return (
    <>
      {summary.headline && <p className="mt-3 text-lg font-semibold leading-snug">{summary.headline}</p>}

      {summary.tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {summary.tags.map((tag, i) => (
            <Pill key={tag} tone={tagTone(tag, i)}>
              {tag}
            </Pill>
          ))}
        </div>
      )}

      {summary.howToWin.length > 0 && (
        <div className="mt-5 border-l-2 border-pen pl-4">
          <p className="eyebrow">How to win in front of them</p>
          <ul className="mt-2 list-disc space-y-1 pl-4 marker:text-pen">
            {summary.howToWin.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </div>
      )}

      {sectionIds
        .filter((id) => summary.sections[id]?.addressed)
        .map((id) => (
          <section key={id} className="ballot-rule mt-6">
            <p className="eyebrow">{SECTION_LABELS[id]}</p>
            <div className="mt-3 space-y-3">
              {summary.sections[id].blocks.map((block, i) => (
                <SummaryBlock key={i} block={block} />
              ))}
            </div>
          </section>
        ))}
    </>
  )
}
