// Saved, Struck, Recent judge lookups + per-judge notes — client-only, no
// server-side history (same shape as local-conversations.ts). Entries are keyed
// by judge_id when the lookup returned one, else a normalized name — so
// re-searching the same judge by name still dedupes against a prior
// judge_id-keyed entry once one exists.
//
// Saved and Struck are the two bins surfaced in Settings › Judges. They're
// mutually exclusive: saving a struck judge moves them to Saved and vice versa,
// so a judge is never in both bins at once.

export type JudgeEntry = {
  id: string
  name: string
  judge_id?: string
  source?: string
  affiliations?: string
  lastOpenedAt: number
}

export type JudgeNote = { text: string; updatedAt: number }

const RECENT_KEY = 'cross.judges.recent'
const SAVED_KEY = 'cross.judges.saved'
const STRUCK_KEY = 'cross.judges.struck'
const NOTES_KEY = 'cross.judges.notes'
const RECENT_CAP = 15
const SAVED_CAP = 50
const STRUCK_CAP = 50

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

function removeFromBin(key: string, id: string) {
  const list = load(key)
  const next = list.filter((e) => e.id !== id)
  if (next.length !== list.length) save(key, next)
}

export function loadRecent(): JudgeEntry[] {
  return load(RECENT_KEY)
}

export function loadSaved(): JudgeEntry[] {
  return load(SAVED_KEY)
}

export function loadStruck(): JudgeEntry[] {
  return load(STRUCK_KEY)
}

export function isSaved(id: string): boolean {
  return loadSaved().some((e) => e.id === id)
}

export function isStruck(id: string): boolean {
  return loadStruck().some((e) => e.id === id)
}

type JudgeInput = { id: string; name: string; judge_id?: string; source?: string; affiliations?: string }

// Called after every successful unique judge lookup.
export function recordRecent(entry: JudgeInput): void {
  const existing = loadRecent().find((e) => e.id === entry.id)
  const next: JudgeEntry = { ...existing, ...entry, lastOpenedAt: Date.now() }
  const rest = loadRecent().filter((e) => e.id !== entry.id)
  save(RECENT_KEY, [next, ...rest].slice(0, RECENT_CAP))
  // Keep any saved/struck copy's metadata (name/source/affiliations) fresh too,
  // without changing which bin it's in.
  for (const key of [SAVED_KEY, STRUCK_KEY]) {
    const list = load(key)
    if (list.some((e) => e.id === entry.id)) {
      save(key, list.map((e) => (e.id === entry.id ? { ...e, ...entry, lastOpenedAt: Date.now() } : e)))
    }
  }
}

// Toggle a judge in a bin. Adding to one bin removes them from the other so the
// two bins stay mutually exclusive. Returns the new membership state.
function toggleBin(key: string, otherKey: string, cap: number, entry: JudgeInput): boolean {
  const list = load(key)
  if (list.some((e) => e.id === entry.id)) {
    save(key, list.filter((e) => e.id !== entry.id))
    return false
  }
  removeFromBin(otherKey, entry.id)
  const meta = loadRecent().find((e) => e.id === entry.id)
  const next: JudgeEntry = { ...meta, ...entry, lastOpenedAt: Date.now() }
  save(key, [next, ...list].slice(0, cap))
  return true
}

export function toggleSaved(entry: JudgeInput): boolean {
  return toggleBin(SAVED_KEY, STRUCK_KEY, SAVED_CAP, entry)
}

export function toggleStruck(entry: JudgeInput): boolean {
  return toggleBin(STRUCK_KEY, SAVED_KEY, STRUCK_CAP, entry)
}

// Remove a judge from a specific bin (used by the Settings management view).
export function removeFromSaved(id: string): void {
  removeFromBin(SAVED_KEY, id)
}

export function removeFromStruck(id: string): void {
  removeFromBin(STRUCK_KEY, id)
}

// --- Notes ----------------------------------------------------------------
// A single map of judge id -> note, shared between the judge profile and the
// Settings › Judges view.

export function loadNotes(): Record<string, JudgeNote> {
  try {
    const raw = JSON.parse(localStorage.getItem(NOTES_KEY) || 'null')
    return raw && typeof raw === 'object' ? raw : {}
  } catch {
    return {}
  }
}

export function getNote(id: string): string {
  return loadNotes()[id]?.text ?? ''
}

// Save (or, when text is blank, clear) the note for a judge.
export function setNote(id: string, text: string): void {
  const notes = loadNotes()
  const trimmed = text.trim()
  if (trimmed) {
    notes[id] = { text: trimmed, updatedAt: Date.now() }
  } else {
    delete notes[id]
  }
  try {
    localStorage.setItem(NOTES_KEY, JSON.stringify(notes))
  } catch {
    // localStorage unavailable/full — note just won't persist
  }
}
