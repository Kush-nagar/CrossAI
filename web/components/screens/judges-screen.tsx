'use client'

import { useEffect, useState } from 'react'
import { Search } from 'lucide-react'
import { InkButton, PageTitle } from '@/components/ui/primitives'
import { getJudgeSummary, type JudgeSummaryResult } from '@/lib/api'
import { JudgeProfile } from '@/components/judges/judge-profile'
import { judgeKey, loadSaved, loadStruck, recordRecent, toggleSaved, toggleStruck, type JudgeEntry } from '@/lib/local-judges'

export function JudgesScreen() {
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [matches, setMatches] = useState<{ name: string; judge_id: string; affiliations?: string }[] | null>(null)
  const [judge, setJudge] = useState<JudgeSummaryResult | null>(null)
  const [saved, setSaved] = useState<JudgeEntry[]>([])
  const [struck, setStruck] = useState<JudgeEntry[]>([])

  useEffect(() => {
    setSaved(loadSaved())
    setStruck(loadStruck())
  }, [])

  const activeId = judge ? judgeKey({ judge_id: judge.judge_id, name: judge.name }) : null

  async function runSearch(body: { name: string } | { judge_id: string }, forceRefresh = false) {
    setLoading(true)
    setError(null)
    if (!forceRefresh) {
      setJudge(null)
      setMatches(null)
    }
    try {
      const data = await getJudgeSummary({ ...body, forceRefresh })
      if (Array.isArray(data.results) && data.results.length) {
        setMatches(data.results)
      } else {
        setJudge(data)
        recordRecent({ id: judgeKey({ judge_id: data.judge_id, name: data.name }), name: data.name, judge_id: data.judge_id, source: data.source })
        setSaved(loadSaved())
        setStruck(loadStruck())
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Judge lookup failed.')
    } finally {
      setLoading(false)
    }
  }

  function refreshJudge() {
    if (!judge) return
    return runSearch(judge.judge_id ? { judge_id: judge.judge_id } : { name: judge.name }, true)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (query.trim()) runSearch({ name: query.trim() })
  }

  function handleToggleSaved() {
    if (!judge) return
    toggleSaved({ id: activeId!, name: judge.name, judge_id: judge.judge_id, source: judge.source })
    setSaved(loadSaved())
    setStruck(loadStruck())
  }

  function handleToggleStruck() {
    if (!judge) return
    toggleStruck({ id: activeId!, name: judge.name, judge_id: judge.judge_id, source: judge.source })
    setSaved(loadSaved())
    setStruck(loadStruck())
  }

  return (
    <div className="page-enter flex flex-col gap-7">
      <PageTitle
        eyebrow="Judge intelligence"
        title="Know the room."
        description="Turn long paradigms into trustworthy, source-linked strategic guidance."
      />
      <form onSubmit={handleSubmit} className="glass mx-auto flex min-h-16 w-full max-w-3xl items-center gap-3 rounded-xl px-5">
        <Search className="size-5 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by judge name"
          className="w-full bg-transparent text-lg outline-none"
        />
        <InkButton type="submit" className="!min-h-9 py-2">
          Search
        </InkButton>
      </form>

      <div className="mx-auto w-full max-w-3xl">
        <div className="flex flex-col gap-5">
          {loading && (
            <div className="surface flex w-full items-center justify-center rounded-xl p-8" role="status">
              <span className="size-6 animate-spin rounded-full border-2 border-border border-t-foreground" />
            </div>
          )}

          {error && <div className="surface w-full rounded-xl p-6 text-sm text-destructive">{error}</div>}

          {matches && (
            <div className="surface flex w-full flex-col gap-2 rounded-xl p-4">
              <p className="eyebrow px-2 py-2">Multiple matches — pick one</p>
              {matches.map((m) => (
                <button
                  key={m.judge_id}
                  onClick={() => runSearch({ judge_id: m.judge_id })}
                  className="flex flex-col gap-0.5 rounded-md p-4 text-left hover:bg-secondary"
                >
                  <span className="text-sm font-semibold">{m.name}</span>
                  {m.affiliations && <span className="text-xs text-muted-foreground">{m.affiliations}</span>}
                </button>
              ))}
            </div>
          )}

          {judge && !loading && (
            <JudgeProfile
              key={activeId}
              judge={judge}
              entryId={activeId!}
              saved={saved.some((s) => s.id === activeId)}
              struck={struck.some((s) => s.id === activeId)}
              onToggleSaved={handleToggleSaved}
              onToggleStruck={handleToggleStruck}
              onRefresh={refreshJudge}
            />
          )}

          {!judge && !loading && !error && !matches && (
            <div className="surface flex w-full flex-col items-center gap-2 rounded-xl p-12 text-center">
              <p className="text-sm text-muted-foreground">Search a judge's name to pull their real Tabroom paradigm.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
