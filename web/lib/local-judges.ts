// Saved & Recent judge lookups — client-only, no server-side history (same
// shape as local-conversations.ts). Entries are keyed by judge_id when the
// lookup returned one, else a normalized name — so re-searching the same
// judge by name still dedupes against a prior judge_id-keyed entry once one
// exists.

export type JudgeEntry = {
  id: string
  name: string
  judge_id?: string
  source?: string
  lastOpenedAt: number
}

const RECENT_KEY = 'cross.judges.recent'
const SAVED_KEY = 'cross.judges.saved'
const RECENT_CAP = 15
const SAVED_CAP = 20

export function judgeKey(input: { judge_id?: string; name: string }): string {
  return input.judge_id ? `id:${input.judge_id}` : `name:${input.name.trim().toLowerCase()}`
}

function load(key: string): JudgeEntry[] {
  try {
    const raw = JSON.parse(localStorage.getItem(key) || 'null')
    return Array.isArray(raw) ? raw : []
  } catch {
    return []
  }
}

function save(key: string, entries: JudgeEntry[]) {
  try {
    localStorage.setItem(key, JSON.stringify(entries))
  } catch {
    // localStorage unavailable/full — history just won't persist
  }
}

export function loadRecent(): JudgeEntry[] {
  return load(RECENT_KEY)
}

export function loadSaved(): JudgeEntry[] {
  return load(SAVED_KEY)
}

export function isSaved(id: string): boolean {
  return loadSaved().some((e) => e.id === id)
}

// Called after every successful unique judge lookup.
export function recordRecent(entry: { id: string; name: string; judge_id?: string; source?: string }): void {
  const existing = loadRecent().find((e) => e.id === entry.id)
  const next: JudgeEntry = { ...existing, ...entry, lastOpenedAt: Date.now() }
  const rest = loadRecent().filter((e) => e.id !== entry.id)
  save(RECENT_KEY, [next, ...rest].slice(0, RECENT_CAP))
  // Keep a saved copy's metadata (name/source) fresh too, without changing pin state.
  const savedExisting = loadSaved().find((e) => e.id === entry.id)
  if (savedExisting) {
    save(
      SAVED_KEY,
      loadSaved().map((e) => (e.id === entry.id ? { ...e, ...entry, lastOpenedAt: Date.now() } : e)),
    )
  }
}

export function toggleSaved(entry: { id: string; name: string; judge_id?: string; source?: string }): boolean {
  const saved = loadSaved()
  const existing = saved.find((e) => e.id === entry.id)
  if (existing) {
    save(SAVED_KEY, saved.filter((e) => e.id !== entry.id))
    return false
  }
  const fromRecent = loadRecent().find((e) => e.id === entry.id)
  const next: JudgeEntry = { ...fromRecent, ...entry, lastOpenedAt: Date.now() }
  save(SAVED_KEY, [next, ...saved].slice(0, SAVED_CAP))
  return true
}
