// Saved cards — client-only, like saved judges (local-judges.ts). Stores just
// enough to list and re-open a card; the text is fetched fresh by id. The
// "cross." key prefix means account deletion clears it (clearLocalCrossData).

import type { CardRow } from '@/lib/api'

export type SavedCard = Pick<CardRow, 'id' | 'tag' | 'cite' | 'team' | 'side' | 'season' | 'cycle'> & { savedAt: number }

const KEY = 'cross.cards.saved'
const CAP = 300

export function loadSavedCards(): SavedCard[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || 'null')
    return Array.isArray(raw) ? raw : []
  } catch {
    return []
  }
}

function store(cards: SavedCard[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(cards.slice(0, CAP)))
  } catch {
    // storage full or blocked — saving is best-effort
  }
}

export function isSaved(id: string): boolean {
  return loadSavedCards().some((c) => c.id === id)
}

/** Adds the card if missing, removes it if present. Returns the new list. */
export function toggleSavedCard(card: CardRow): SavedCard[] {
  const list = loadSavedCards()
  const next = list.some((c) => c.id === card.id)
    ? list.filter((c) => c.id !== card.id)
    : [
        { id: card.id, tag: card.tag, cite: card.cite, team: card.team, side: card.side, season: card.season, cycle: card.cycle, savedAt: Date.now() },
        ...list,
      ]
  store(next)
  return next
}
