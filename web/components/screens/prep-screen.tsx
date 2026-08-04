'use client'

import { useRef, useState } from 'react'
import { Search, Sparkles, Upload, X } from 'lucide-react'
import { InkButton, PageTitle, Pill } from '@/components/ui/primitives'
import { deleteCase, runStressTest, uploadCase, type CaseUploadResult } from '@/lib/api'
import { addCaseRecord, removeCaseRecord } from '@/lib/local-cases'

type CaseEntry = CaseUploadResult & { path: string }

type StressCard = {
  type: 'flaw' | 'attack'
  severity?: 'High' | 'Med' | 'Low'
  dimension?: string
  attackType?: string
  wording?: string
  frontline?: string
  thinkPrompt?: string
}

function scoreClass(score: number) {
  if (score >= 70) return 'text-primary'
  if (score >= 40) return 'text-accent'
  return 'text-destructive'
}

export function PrepScreen() {
  const [cases, setCases] = useState<CaseEntry[]>([])
  const [activePath, setActivePath] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [uploading, setUploading] = useState(false)
  const [stressMode, setStressMode] = useState<'skim' | 'full'>('skim')
  const [stressLoading, setStressLoading] = useState(false)
  const [stressResult, setStressResult] = useState<{ score: number; cards: StressCard[] } | null>(null)
  const [triage, setTriage] = useState<Record<number, 'prepped' | 'needswork' | undefined>>({})
  const fileInputRef = useRef<HTMLInputElement>(null)

  const active = cases.find((c) => c.path === activePath) || null
  const filtered = cases.filter((c) => c.filename.toLowerCase().includes(search.toLowerCase()))

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setUploading(true)
    try {
      const attachment = await uploadCase(file)
      const path = `uploaded/${file.name}`
      const entry: CaseEntry = { ...attachment, path }
      setCases((prev) => [...prev.filter((c) => c.path !== path), entry])
      setActivePath(path)
      setStressResult(null)
      addCaseRecord(file.name, attachment.kind)
    } catch (err) {
      alert(`Couldn't attach ${file.name}: ${err instanceof Error ? err.message : 'Upload failed.'}`)
    } finally {
      setUploading(false)
    }
  }

  async function handleDelete(path: string) {
    const entry = cases.find((c) => c.path === path)
    if (!entry) return
    setCases((prev) => prev.filter((c) => c.path !== path))
    if (entry.kind === 'pdf' && entry.url) {
      const filename = entry.url.split('/').pop()
      if (filename) deleteCase(filename).catch(() => {})
    }
    if (activePath === path) {
      setActivePath(null)
      setStressResult(null)
    }
    removeCaseRecord(entry.filename)
  }

  async function runTest() {
    if (!active) return
    setStressLoading(true)
    setStressResult(null)
    try {
      const data = await runStressTest({ title: active.filename, content: active.text, mode: stressMode })
      setStressResult({ score: data.score, cards: data.cards as StressCard[] })
      setTriage({})
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Stress test failed.')
    } finally {
      setStressLoading(false)
    }
  }

  return (
    <div className="page-enter flex flex-col gap-7">
      <PageTitle
        eyebrow="Prepare"
        title="Build arguments that hold."
        description="Upload a case, read it, and pressure-test it before someone else does."
        action={
          <InkButton onClick={() => fileInputRef.current?.click()} disabled={uploading}>
            <Upload className="size-4" />
            {uploading ? 'Uploading…' : 'Upload case'}
          </InkButton>
        }
      />
      <input ref={fileInputRef} type="file" accept=".docx,.pdf,.txt,.md,.html,.htm" hidden onChange={handleUpload} />

      <div className="grid min-h-[650px] gap-5 xl:grid-cols-[260px_minmax(0,1fr)_300px]">
        <aside className="surface rounded-3xl p-4">
          <label className="flex min-h-11 items-center gap-2 rounded-xl bg-secondary px-3">
            <Search className="size-4 text-muted-foreground" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search cases" className="w-full bg-transparent text-sm outline-none" />
          </label>
          <div className="mt-4 flex flex-col gap-2">
            {filtered.length === 0 && <p className="px-2 py-4 text-sm text-muted-foreground">No cases uploaded yet.</p>}
            {filtered.map((c) => (
              <div key={c.path} className="group relative">
                <button
                  onClick={() => {
                    setActivePath(c.path)
                    setStressResult(null)
                  }}
                  className={`w-full rounded-2xl p-4 text-left transition ${activePath === c.path ? 'bg-foreground text-card' : 'hover:bg-secondary'}`}
                >
                  <p className="truncate pr-5 text-sm font-semibold leading-snug">{c.filename}</p>
                  <p className={`mt-2 text-xs ${activePath === c.path ? 'text-card/60' : 'text-muted-foreground'}`}>{c.kind}</p>
                </button>
                <button
                  onClick={() => handleDelete(c.path)}
                  aria-label="Delete case"
                  className="absolute right-3 top-3 text-lg leading-none text-muted-foreground opacity-0 hover:text-destructive group-hover:opacity-100"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </aside>

        <article className="surface overflow-hidden rounded-3xl">
          {!active && (
            <div className="flex h-full min-h-[500px] items-center justify-center p-10 text-center text-sm text-muted-foreground">
              Upload or select a case to start reading.
            </div>
          )}
          {active && !stressResult && !stressLoading && (
            <>
              <header className="flex flex-wrap items-center gap-3 border-b p-5 md:p-7">
                <h2 className="font-display flex-1 text-xl font-semibold md:text-2xl">{active.filename}</h2>
                <div className="flex items-center gap-1 rounded-full bg-secondary p-1">
                  {(['skim', 'full'] as const).map((m) => (
                    <button
                      key={m}
                      onClick={() => setStressMode(m)}
                      className={`rounded-full px-3 py-1.5 text-xs font-semibold capitalize transition ${stressMode === m ? 'bg-card shadow' : 'text-muted-foreground'}`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
                <button
                  onClick={runTest}
                  className="press flex min-h-9 items-center gap-1.5 rounded-xl bg-primary px-3 text-xs font-semibold text-primary-foreground"
                >
                  <Sparkles className="size-3.5" />
                  Stress Test
                </button>
              </header>
              <div className="max-h-[600px] overflow-y-auto p-6 md:p-10">
                {active.kind === 'pdf' ? (
                  <iframe src={active.url} title={active.filename} className="h-[560px] w-full rounded-xl border" />
                ) : active.kind === 'docx' ? (
                  <div className="prose max-w-none text-base leading-8" dangerouslySetInnerHTML={{ __html: active.html }} />
                ) : (
                  <p className="whitespace-pre-wrap text-base leading-8">{active.text}</p>
                )}
              </div>
            </>
          )}
          {active && stressLoading && (
            <div className="flex h-full min-h-[500px] flex-col items-center justify-center gap-4 p-10 text-center">
              <span className="size-8 animate-spin rounded-full border-2 border-border border-t-primary" />
              <p className="text-sm text-muted-foreground">
                {stressMode === 'full' ? 'Running full stress test — a thorough audit takes a moment…' : 'Running skim stress test…'}
              </p>
            </div>
          )}
          {active && stressResult && !stressLoading && (
            <>
              <header className="flex items-center justify-between border-b p-5 md:p-7">
                <div>
                  <span className={`font-display text-3xl font-semibold ${scoreClass(stressResult.score)}`}>{stressResult.score}/100</span>
                  <p className="text-xs text-muted-foreground">Case construction score</p>
                </div>
                <button
                  onClick={() => setStressResult(null)}
                  className="press rounded-xl bg-secondary px-3 py-2 text-xs font-semibold text-secondary-foreground"
                >
                  Back to reader
                </button>
              </header>
              <div className="flex max-h-[600px] flex-col gap-3 overflow-y-auto p-6 md:p-8">
                {stressResult.cards.map((card, i) => {
                  const isFlaw = card.type === 'flaw'
                  const secondary = isFlaw ? card.dimension : card.attackType
                  return (
                    <div key={i} className="rounded-2xl border p-4">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex flex-wrap gap-1.5">
                          <Pill tone="pen">{isFlaw ? 'Flaw' : 'Predicted Attack'}</Pill>
                          {secondary && <Pill>{secondary}</Pill>}
                        </div>
                        <Pill tone={card.severity === 'High' ? 'highlight' : 'neutral'}>{card.severity || 'Med'}</Pill>
                      </div>
                      <p className="mt-3 text-sm">{isFlaw ? card.wording : `"${card.wording || ''}"`}</p>
                      <p className="mt-2 text-xs text-muted-foreground">
                        <b className="text-foreground">{isFlaw ? 'Suggestion: ' : 'Build your frontline: '}</b>
                        {isFlaw ? card.frontline : card.thinkPrompt || card.frontline}
                      </p>
                      <div className="mt-3 flex gap-2">
                        {(['prepped', 'needswork'] as const).map((t) => (
                          <button
                            key={t}
                            onClick={() => setTriage((prev) => ({ ...prev, [i]: prev[i] === t ? undefined : t }))}
                            className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                              triage[i] === t ? 'bg-foreground text-card' : 'bg-secondary text-muted-foreground'
                            }`}
                          >
                            {t === 'prepped' ? 'Prepped' : 'Needs work'}
                          </button>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </article>

        <aside className="surface h-fit rounded-3xl p-5 xl:sticky xl:top-6">
          <p className="text-sm font-semibold">About stress test</p>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            Skim is a fast focused gut-check. Full is an exhaustive audit — flaw cards suggest a fix; predicted-attack cards
            withhold the answer so you build your own frontline.
          </p>
        </aside>
      </div>
    </div>
  )
}
