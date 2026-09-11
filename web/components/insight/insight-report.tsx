'use client'

// Renders one graded Insight report — extracted from insight-screen.tsx's
// original single-speech result panel so the same JSX serves three call
// sites: a single-speech grade, each card in "grade all individually," and
// the holistic round debrief (which adds per-entry speechLabel tags and a
// perSpeechNotes throughline section the other two modes don't use).

import { InkButton, Pill } from '@/components/ui/primitives'
import { FeedbackPrompt } from '@/components/feedback/feedback-prompt'

type Entry = { quote?: string; note?: string; speechLabel?: string }

export function InsightReport({
  title = 'Your speech',
  verdict,
  strengths,
  weaknesses,
  topFixes,
  improvedFromLastTime,
  perSpeechNotes,
  onRedo,
  redoLabel = 'Redo speech',
}: {
  title?: string
  verdict: string
  strengths: Entry[]
  weaknesses: Entry[]
  topFixes: string[]
  improvedFromLastTime?: string
  /** Cross-speech throughline notes — only populated for a round debrief. */
  perSpeechNotes?: { label: string; note: string }[]
  onRedo?: () => void
  redoLabel?: string
}) {
  return (
    <section className="surface rounded-3xl p-6 md:p-8">
      <Pill tone="pen">{title}</Pill>
      <p className="mt-3 text-sm text-muted-foreground">{verdict}</p>

      {improvedFromLastTime && (
        <div className="mt-4 rounded-xl border border-success/30 bg-success/10 p-4">
          <p className="text-xs font-semibold text-success">Improved from last time</p>
          <p className="mt-1 text-sm">{improvedFromLastTime}</p>
        </div>
      )}

      {strengths.length > 0 && (
        <div className="mt-6">
          <h3 className="font-display text-lg font-semibold">What worked</h3>
          <div className="mt-3 flex flex-col gap-3">
            {strengths.map((entry, i) => (
              <div key={i} className="rounded-xl bg-secondary/60 p-4">
                {entry.speechLabel && <p className="text-[11px] font-semibold text-pen">{entry.speechLabel}</p>}
                {entry.quote && <blockquote className="text-sm italic text-muted-foreground">{entry.quote}</blockquote>}
                {entry.note && <p className="mt-1 text-sm">{entry.note}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {weaknesses.length > 0 && (
        <div className="mt-6">
          <h3 className="font-display text-lg font-semibold">What to fix</h3>
          <div className="mt-3 flex flex-col gap-3">
            {weaknesses.map((entry, i) => (
              <div key={i} className="rounded-xl bg-secondary/60 p-4">
                {entry.speechLabel && <p className="text-[11px] font-semibold text-pen">{entry.speechLabel}</p>}
                {entry.quote && <blockquote className="text-sm italic text-muted-foreground">{entry.quote}</blockquote>}
                {entry.note && <p className="mt-1 text-sm">{entry.note}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {perSpeechNotes && perSpeechNotes.length > 0 && (
        <div className="mt-6">
          <h3 className="font-display text-lg font-semibold">Across the round</h3>
          <div className="mt-3 flex flex-col gap-3">
            {perSpeechNotes.map((entry, i) => (
              <div key={i} className="rounded-xl bg-secondary/60 p-4">
                <p className="text-[11px] font-semibold text-pen">{entry.label}</p>
                <p className="mt-1 text-sm">{entry.note}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {topFixes.length > 0 && (
        <div className="mt-6">
          <h3 className="font-display text-lg font-semibold">Top fixes</h3>
          <ol className="mt-3 list-decimal pl-5 text-sm">
            {topFixes.map((fix, i) => (
              <li key={i} className="mb-1.5">
                {fix}
              </li>
            ))}
          </ol>
        </div>
      )}

      <FeedbackPrompt key={verdict} route="recording-insight" preview={verdict} />

      {onRedo && (
        <InkButton onClick={onRedo} className="mt-6">
          {redoLabel}
        </InkButton>
      )}
    </section>
  )
}
