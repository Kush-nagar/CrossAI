// Chat history is client-only (no server-side chat storage) — ported from
// public/app.js's CONVERSATIONS_KEY logic verbatim.

import type { ChatMessage } from './api'

export type Conversation = {
  id: string
  title: string
  summary: string
  messages: ChatMessage[]
  updatedAt: number
}

const CONVERSATIONS_KEY = 'cross-conversations'
const MODE_KEY = 'cross.coachMode'

export function loadConversations(): Conversation[] {
  try {
    const raw = JSON.parse(localStorage.getItem(CONVERSATIONS_KEY) || 'null')
    return Array.isArray(raw) ? raw : []
  } catch {
    return []
  }
}

export function saveConversations(conversations: Conversation[]) {
  try {
    localStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(conversations))
  } catch {
    // localStorage unavailable/full — history just won't persist across reloads
  }
}

export function makeConversationId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

// Digest of every other round's summary, sent on each chat turn so the coach
// can recall facts/decisions from separate rounds.
export function buildCrossChatMemory(conversations: Conversation[], currentId: string | null): string {
  const others = conversations
    .filter((c) => c.id !== currentId && c.summary)
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, 12)
  if (others.length === 0) return ''
  return others
    .map((c) => `- ${c.title || 'Untitled round'}: ${c.summary}`)
    .join('\n')
    .slice(0, 6000)
}

export function loadCoachMode(): 'general' | 'preround' {
  try {
    return localStorage.getItem(MODE_KEY) === 'preround' ? 'preround' : 'general'
  } catch {
    return 'general'
  }
}

export function saveCoachMode(mode: 'general' | 'preround') {
  try {
    localStorage.setItem(MODE_KEY, mode)
  } catch {
    // ignore
  }
}
