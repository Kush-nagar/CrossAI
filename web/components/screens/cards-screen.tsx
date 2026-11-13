'use client'

// Card library: search the public disclosed archive one card at a time.
// Results on the left, the open card on the right (stacked on small screens).
// Cards are rendered from parsed segments (card-format.ts), never as raw HTML.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Bookmark, BookmarkCheck, ClipboardCopy, Copy, Search, X } from 'lucide-react'
import { PageTitle, Pill } from '@/components/ui/primitives'
import {
  getCard,
  getCardFacets,
  searchCards,
  type CardDetail,
  type CardFacets,
  type CardFilters,
  type CardRow,
} from '@/lib/api'
import { cardParagraphs, cardReadText, cardToHtml, cardToPlain, copyRich } from '@/lib/card-format'
import { loadSavedCards, toggleSavedCard, type SavedCard } from '@/lib/local-cards'

const PAGE = 20

const CYCLE_LABELS: Record<string, string> = {
  'september-october': 'Sep–Oct',
  'november-december': 'Nov–Dec',
  january: 'Jan',
  february: 'Feb',
  march: 'Mar',
  april: 'Apr',
  'nationals': 'Nationals',
}
export function cycleLabel(cycle: string): string {
  return CYCLE_LABELS[cycle] || cycle.replace(/-/g, ' ')
}

type Tab = 'search' | 'saved'

export function CardsScreen() {
  const [query, setQuery] = useState('')
  const [filters, setFilters] = useState<CardFilters>({})
  const [facets, setFacets] = useState<CardFacets | null>(null)
  const [results, setResults] = useState<CardRow[]>([])
  const [total, setTotal] = useState(0)
  const [available, setAvailable] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [card, setCard] = useState<CardDetail | null>(null)
  const [cardLoading, setCardLoading] = useState(false)
  const [saved, setSaved] = useState<SavedCard[]>([])
  const [tab, setTab] = useState<Tab>('search')
  const [shrink, setShrink] = useState(true)
  const [status, setStatus] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)
  const requestSeq = useRef(0)

  // Initial state from the URL (?q=…&id=…) so cards can be linked to.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const q = params.get('q')
    const id = params.get('id')
    if (q) setQuery(q)
    if (id) setSelectedId(id)
    setSaved(loadSavedCards())
    getCardFacets()
      .then(setFacets)
      .catch(() => setFacets(null))
  }, [])

  // "/" focuses search, like most search-first tools.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement
      if (e.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName) && !t.isContentEditable) {
        e.preventDefault()
        searchRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const runSearch = useCallback(
    async (offset: number) => {
      const seq = ++requestSeq.current
      setLoading(true)
      setError(null)
      try {
        const data = await searchCards(query, filters, { limit: PAGE, offset })
        if (seq !== requestSeq.current) return
        setAvailable(data.available)
        setTotal(data.total)
        setResults((prev) => (offset === 0 ? data.results : [...prev, ...data.results]))
      } catch (err) {
        if (seq === requestSeq.current) setError(err instanceof Error ? err.message : 'Search failed.')
      } finally {
        if (seq === requestSeq.current) setLoading(false)
      }
    },
    [query, filters],
  )

  // Debounced search whenever the query or filters change.
  useEffect(() => {
    const t = setTimeout(() => runSearch(0), 250)
    return () => clearTimeout(t)
  }, [runSearch])

  // Load the open card; keep its id in the URL so it can be shared/reopened.
  useEffect(() => {
    const url = new URL(window.location.href)
    if (selectedId) url.searchParams.set('id', selectedId)
    else url.searchParams.delete('id')
    if (query) url.searchParams.set('q', query)
    else url.searchParams.delete('q')
    window.history.replaceState(null, '', url)
    if (!selectedId) {
      setCard(null)
      return
    }
    let cancelled = false
    setCardLoading(true)
    getCard(selectedId)
      .then((c) => !cancelled && setCard(c))
      .catch(() => !cancelled && setCard(null))
      .finally(() => !cancelled && setCardLoading(false))
    return () => {
      cancelled = true
    }
  }, [selectedId, query])

  const cyclesForSeason = useMemo(
    () => (facets?.cycles || []).filter((c) => !filters.season || c.season === filters.season),
    [facets, filters.season],
  )

  function setFilter<K extends keyof CardFilters>(key: K, value: CardFilters[K]) {
    setFilters((prev) => {
      const next = { ...prev, [key]: value || undefined }
      // A topic belongs to one season; changing season clears a stale topic.
      if (key === 'season' && prev.cycle && !(facets?.cycles || []).some((c) => c.season === value && c.cycle === prev.cycle)) {
        next.cycle = undefined
      }
      return next
    })
  }

  function announce(msg: string) {
    setStatus(msg)
    window.setTimeout(() => setStatus(''), 2500)
  }

  async function copyCard() {
    if (!card) return
    await copyRich(cardToHtml(card, { shrink }), cardToPlain(card))
    announce('Card copied with formatting')
  }

  async function copyRead() {
    if (!card) return
    const text = cardReadText(card)
    await navigator.clipboard.writeText(text || cardToPlain(card))
    announce(text ? 'Highlighted text copied' : 'No highlighting on this card; copied the full text')
  }

  async function copyAllSaved() {
    if (!saved.length) return
    announce('Copying saved cards…')
    const cards = (await Promise.all(saved.map((s) => getCard(s.id).catch(() => null)))).filter(Boolean) as CardDetail[]
    await copyRich(
      cards.map((c) => cardToHtml(c, { shrink })).join('<p></p>'),
      cards.map(cardToPlain).join('\n\n'),
    )
    announce(`${cards.length} saved card${cards.length === 1 ? '' : 's'} copied`)
  }

  function toggleSave(row: CardRow) {
    setSaved(toggleSavedCard(row))
  }

  const isSaved = (id: string) => saved.some((s) => s.id === id)
  const list: CardRow[] =
    tab === 'saved'
      ? saved.map((s) => ({ ...s, kind: 'case', hl: 0, preview: '' }) as CardRow)
      : results

  return (
    <div className="page-enter flex flex-col gap-7">
      <PageTitle
        eyebrow="Evidence"
        title="Find the card."
        description={
          facets?.available
            ? `Search ${facets.total.toLocaleString()} cards from disclosed Public Forum cases, one card at a time.`
            : 'Search cards from disclosed Public Forum cases, one card at a time.'
        }
      />

      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault()
          runSearch(0)
        }}
        className="glass flex min-h-16 w-full items-center gap-3 rounded-xl px-5 focus-within:ring-2 focus-within:ring-pen"
      >
        <Search className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
        <input
          ref={searchRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search a claim, author or impact (press / to focus)"
          aria-label="Search cards"
          className="w-full bg-transparent text-lg outline-none"
        />
        {query && (
          <button type="button" onClick={() => setQuery('')} aria-label="Clear search" className="press rounded-md p-2 hover:bg-secondary">
            <X className="size-4" />
          </button>
        )}
      </form>

      <div className="flex flex-wrap items-center gap-3 text-sm" aria-label="Filters">
        <label className="flex items-center gap-2">
          <span className="text-muted-foreground">Season</span>
          <select
            value={filters.season || ''}
            onChange={(e) => setFilter('season', e.target.value)}
            className="min-h-10 rounded-md border border-border bg-background px-2"
          >
            <option value="">All</option>
            {facets?.seasons.map((s) => (
              <option key={s.season} value={s.season}>
                {s.season}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2">
          <span className="text-muted-foreground">Topic</span>
          <select
            value={filters.cycle && filters.season ? filters.cycle : filters.cycle || ''}
            onChange={(e) => setFilter('cycle', e.target.value)}
            className="min-h-10 max-w-[18rem] rounded-md border border-border bg-background px-2"
          >
            <option value="">All topics</option>
            {cyclesForSeason.map((c) => (
              <option key={`${c.season}|${c.cycle}`} value={c.cycle} title={c.resolution}>
                {cycleLabel(c.cycle)} {c.season}
                {c.resolution ? ` · ${c.resolution.slice(0, 60)}${c.resolution.length > 60 ? '…' : ''}` : ''}
              </option>
            ))}
          </select>
        </label>
        <div role="radiogroup" aria-label="Side" className="flex overflow-hidden rounded-md border border-border">
          {['', 'Pro', 'Con'].map((side) => (
            <button
              key={side || 'all'}
              type="button"
              role="radio"
              aria-checked={(filters.side || '') === side}
              onClick={() => setFilter('side', side)}
              className={`min-h-10 px-3 font-semibold ${(filters.side || '') === side ? 'bg-foreground text-background' : 'hover:bg-secondary'}`}
            >
              {side || 'Both sides'}
            </button>
          ))}
        </div>
        <select
          aria-label="Document type"
          value={filters.kind || ''}
          onChange={(e) => setFilter('kind', e.target.value)}
          className="min-h-10 rounded-md border border-border bg-background px-2"
        >
          <option value="">Cases and rebuttals</option>
          <option value="case">Cases only</option>
          <option value="rebuttal">Rebuttals only</option>
        </select>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={Boolean(filters.highlighted)}
            onChange={(e) => setFilter('highlighted', e.target.checked)}
            className="size-4 accent-[var(--pen)]"
          />
          Highlighted only
        </label>
      </div>

      <p role="status" aria-live="polite" className="sr-only">
        {status}
      </p>
      {status && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-foreground px-4 py-2 text-sm font-semibold text-background shadow-lg" aria-hidden="true">
          {status}
        </div>
      )}

      {!available && (
        <p className="surface rounded-2xl p-4 text-sm text-muted-foreground">
          The card library hasn&apos;t been built on this server yet. Run <code>npm run build-card-index</code>.
        </p>
      )}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
        <section aria-label="Results" className={`flex flex-col gap-3 ${card ? 'hidden xl:flex' : ''}`}>
          <div className="flex items-center justify-between gap-2">
            <div role="tablist" aria-label="Card lists" className="flex gap-1 rounded-md bg-secondary p-1 text-sm">
              {(['search', 'saved'] as Tab[]).map((t) => (
                <button
                  key={t}
                  role="tab"
                  type="button"
                  aria-selected={tab === t}
                  onClick={() => setTab(t)}
                  className={`min-h-9 rounded px-3 font-semibold ${tab === t ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'}`}
                >
                  {t === 'search' ? `Results${total ? ` (${total.toLocaleString()})` : ''}` : `Saved (${saved.length})`}
                </button>
              ))}
            </div>
            {tab === 'saved' && saved.length > 0 && (
              <button type="button" onClick={copyAllSaved} className="press flex min-h-9 items-center gap-2 rounded-md px-3 text-sm font-semibold hover:bg-secondary">
                <ClipboardCopy className="size-4" aria-hidden="true" />
                Copy all
              </button>
            )}
          </div>

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          {tab === 'search' && !loading && !error && available && results.length === 0 && (
            <p className="text-sm text-muted-foreground">No cards match. Try fewer or different words, or clear a filter.</p>
          )}
          {tab === 'saved' && saved.length === 0 && (
            <p className="text-sm text-muted-foreground">Cards you save show up here, ready to copy into a file.</p>
          )}

          <ul className="flex flex-col gap-2">
            {list.map((row) => (
              <li key={row.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(row.id)}
                  aria-current={selectedId === row.id ? 'true' : undefined}
                  className={`press surface w-full rounded-2xl p-4 text-left transition ${selectedId === row.id ? 'ring-2 ring-pen' : 'hover:bg-secondary/60'}`}
                >
                  <p className="font-semibold leading-snug">{row.tag}</p>
                  <p className="mt-1 text-sm">
                    <span className="font-semibold">{row.cite}</span>
                    <span className="text-muted-foreground">
                      {' '}
                      · {row.team} · {row.side} · {cycleLabel(row.cycle)} {row.season}
                    </span>
                  </p>
                  {row.preview && <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{row.preview}</p>}
                </button>
              </li>
            ))}
          </ul>
          {tab === 'search' && results.length < total && (
            <button
              type="button"
              disabled={loading}
              onClick={() => runSearch(results.length)}
              className="press min-h-11 rounded-xl border border-border text-sm font-semibold hover:bg-secondary disabled:opacity-50"
            >
              {loading ? 'Loading…' : 'Show more'}
            </button>
          )}
          {loading && results.length === 0 && <p className="text-sm text-muted-foreground">Searching…</p>}
        </section>

        <section aria-label="Card" className={`${card || cardLoading ? '' : 'hidden xl:block'}`}>
          {cardLoading && !card && <p className="text-sm text-muted-foreground">Opening card…</p>}
          {!card && !cardLoading && (
            <div className="surface flex min-h-64 items-center justify-center rounded-3xl p-8 text-center text-sm text-muted-foreground">
              Pick a card to read it, copy it with formatting, or save it.
            </div>
          )}
          {card && (
            <article className="surface flex flex-col gap-4 rounded-3xl p-6 md:p-8">
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                className="press -ml-2 self-start rounded-md px-2 py-1 text-sm font-semibold hover:bg-secondary xl:hidden"
              >
                ← Back to results
              </button>
              <div className="flex flex-wrap gap-2">
                <Pill tone="pen">{card.side}</Pill>
                <Pill>
                  {cycleLabel(card.cycle)} {card.season}
                </Pill>
                <Pill>{card.kind === 'rebuttal' ? 'Rebuttal doc' : 'Case'}</Pill>
                {!card.hl && <Pill>No highlighting</Pill>}
              </div>
              <h2 className="font-display text-2xl font-semibold leading-snug tracking-tight">{card.tag}</h2>
              <p className="text-sm leading-relaxed">
                <span className="font-bold">{card.cite}</span>
                {card.fullCite.startsWith(card.cite) ? card.fullCite.slice(card.cite.length) : ` ${card.fullCite}`}
              </p>

              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={copyCard} className="press flex min-h-10 items-center gap-2 rounded-xl bg-foreground px-4 text-sm font-semibold text-background">
                  <Copy className="size-4" aria-hidden="true" />
                  Copy card
                </button>
                <button type="button" onClick={copyRead} className="press flex min-h-10 items-center gap-2 rounded-xl border border-border px-4 text-sm font-semibold hover:bg-secondary">
                  Copy read text
                </button>
                <button
                  type="button"
                  onClick={() => toggleSave(card)}
                  aria-pressed={isSaved(card.id)}
                  className="press flex min-h-10 items-center gap-2 rounded-xl border border-border px-4 text-sm font-semibold hover:bg-secondary"
                >
                  {isSaved(card.id) ? <BookmarkCheck className="size-4" aria-hidden="true" /> : <Bookmark className="size-4" aria-hidden="true" />}
                  {isSaved(card.id) ? 'Saved' : 'Save'}
                </button>
                <label className="ml-auto flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={shrink} onChange={(e) => setShrink(e.target.checked)} className="size-4 accent-[var(--pen)]" />
                  Shrink unread text
                </label>
              </div>

              <div className="card-body flex flex-col gap-3 text-[0.95rem] leading-relaxed">
                {cardParagraphs(card.body).map((segs, i) => (
                  <p key={i}>
                    {segs.map((s, j) =>
                      s.marked ? (
                        <mark key={j} className="card-read">
                          {s.text}
                        </mark>
                      ) : (
                        <span key={j} className={shrink && card.hl ? 'card-unread' : undefined}>
                          {s.text}
                        </span>
                      ),
                    )}
                  </p>
                ))}
              </div>

              <footer className="border-t border-border pt-4 text-sm text-muted-foreground">
                Read by <span className="font-semibold text-foreground">{card.team}</span> ({card.side})
                {card.tournaments.length ? ` at ${card.tournaments.join(', ').replace(/-{2,}/g, ' ')}` : ''}.
                {card.resolution && <span className="mt-1 block">Topic: {card.resolution}</span>}
                <span className="mt-1 block">
                  From a publicly disclosed case. Check the original source before reading it in a round.
                </span>
              </footer>
            </article>
          )}
        </section>
      </div>
    </div>
  )
}
