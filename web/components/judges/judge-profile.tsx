'use client'

import { useState } from 'react'
import { Bookmark, RefreshCw, ShieldCheck, Sparkles } from 'lucide-react'
import { Pill } from '@/components/ui/primitives'
import type { JudgeSummaryResult } from '@/lib/api'
import { extractEmails, extractPullQuote, heuristicJudgeInterpretation, paradigmToParagraphs } from '@/lib/paradigm'
import { JudgeSummaryPanel } from '@/components/judges/judge-summary'

const COLLAPSE_THRESHOLD = 700

function sourceLabel(source?: string): string {
  return source === 'tournaments_tech' ? 'tournaments.tech' : 'Tabroom'
}

function relativeTime(iso?: string | null): string | null {
  if (!iso) return null
  const ms = Date.now() - new Date(iso).getTime()
  const days = Math.floor(ms / 86_400_000)
  if (days <= 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 30) return `${days}d ago`
  return `${Math.floor(days / 30)}mo ago`
}

export function JudgeProfile({
  judge,
  entryId: _entryId,
  saved,
  onToggleSaved,
  onRefresh,
}: {
  judge: JudgeSummaryResult
  entryId: string
  saved: boolean
  onToggleSaved: () => void
  onRefresh: () => Promise<void> | void
}) {
  const [refreshing, setRefreshing] = useState(false)
  const [expanded, setExpanded] = useState(false)

  async function handleRefresh() {
    setRefreshing(true)
    try {
      await onRefresh()
    } finally {
      setRefreshing(false)
    }
  }

  // Structured AI summary present → render it. Absent but paradigm present →
  // same heuristic fallback as before (server/AI path failed entirely).
  // Neither → nothing. Never a blank screen.
  const heuristic = !judge.summary && judge.paradigm?.trim() ? heuristicJudgeInterpretation(judge.paradigm) : null

  const paragraphs = paradigmToParagraphs(judge.paradigm)
  const pullQuote = extractPullQuote(judge.paradigm, judge.summary?.headline ?? heuristic?.summary)
  const rawLength = String(judge.paradigm || '').length
  const isLong = rawLength > COLLAPSE_THRESHOLD
  const emails = extractEmails(judge.paradigm)
  const checkedLabel = relativeTime(judge.cachedAt)

  return (
    <article className="surface rounded-xl p-6 md:p-9">
      <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
        <div className="flex items-center gap-4">
          <div>
            <Pill tone="pen">
              <ShieldCheck className="size-3" />
              Source verified
            </Pill>
            <h2 className="font-display mt-3 text-3xl font-semibold">{judge.name || 'Unknown'}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{sourceLabel(judge.source)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            aria-label="Refresh paradigm and summary"
            className="press flex min-h-11 items-center gap-2 rounded-md border border-border px-4 text-sm font-semibold text-muted-foreground transition hover:bg-secondary disabled:opacity-60"
          >
            <RefreshCw className={`size-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            type="button"
            onClick={onToggleSaved}
            aria-pressed={saved}
            aria-label={saved ? 'Unsave this judge' : 'Save this judge'}
            className={`press flex min-h-11 items-center gap-2 rounded-md border px-4 text-sm font-semibold transition ${
              saved ? 'border-pen text-pen' : 'border-border text-muted-foreground hover:bg-secondary'
            }`}
          >
            <Bookmark className={`size-4 ${saved ? 'fill-current' : ''}`} />
            {saved ? 'Saved' : 'Save'}
          </button>
        </div>
      </div>

      {judge.warning && <p className="mt-4 text-sm text-destructive">{judge.warning}</p>}

      {judge.paradigm?.trim() && (
        <section className="ballot-rule mt-7">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 text-pen" />
              <p className="eyebrow">{judge.summary ? 'AI interpretation' : heuristic ? 'Heuristic read' : 'AI interpretation'}</p>
            </div>
            {checkedLabel && <p className="text-xs text-muted-foreground">Checked {checkedLabel}</p>}
          </div>

          {judge.summary && <JudgeSummaryPanel summary={judge.summary} />}

          {!judge.summary && heuristic && (
            <>
              {heuristic.summary && <p className="mt-3 text-lg font-semibold leading-snug">{heuristic.summary}</p>}
              {heuristic.tags.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {heuristic.tags.map((tag) => (
                    <Pill key={tag} tone="neutral">
                      {tag}
                    </Pill>
                  ))}
                </div>
              )}
            </>
          )}
        </section>
      )}

      <section className="ballot-rule mt-7">
        <p className="eyebrow">Original paradigm</p>
        <div className={`mt-5 max-w-3xl text-base leading-8 text-foreground/90 ${isLong && !expanded ? 'max-h-64 overflow-hidden' : ''}`}>
          {paragraphs.length ? (
            paragraphs.map((p, i) => {
              const isHeading = p.length < 80 && /:$/.test(p)
              return (
                <div key={i}>
                  <p className={isHeading ? 'mb-2 font-semibold text-foreground' : 'mb-4'}>{p}</p>
                  {i === 0 && pullQuote && !p.includes(pullQuote) && (
                    <blockquote className="my-5 border-l-2 border-pen pl-4 text-lg italic leading-relaxed text-foreground">
                      "{pullQuote}"
                    </blockquote>
                  )}
                </div>
              )
            })
          ) : (
            <p className="text-muted-foreground">No paradigm found for this judge.</p>
          )}
        </div>
        {isLong && (
          <button type="button" onClick={() => setExpanded((v) => !v)} className="mt-3 text-sm font-semibold text-pen hover:underline">
            {expanded ? 'Show less ↑' : 'Show full paradigm ↓'}
          </button>
        )}
      </section>

      {emails.length > 0 && (
        <details className="mt-6 text-sm">
          <summary className="cursor-pointer font-semibold text-muted-foreground hover:text-foreground">Contact info</summary>
          <div className="mt-2 flex flex-wrap gap-2">
            {emails.map((email) => (
              <a key={email} href={`mailto:${email}`} className="rounded-sm border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground">
                {email}
              </a>
            ))}
          </div>
        </details>
      )}

      {judge.tabroom_url && (
        <a href={judge.tabroom_url} target="_blank" rel="noopener" className="mt-6 inline-block text-sm font-semibold text-pen hover:underline">
          View on Tabroom →
        </a>
      )}
    </article>
  )
}
