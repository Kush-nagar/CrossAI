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

// --- Central cross-chat memory --------------------------------------------
// Memory is unsiloed: every round contributes its summary to one shared pool
// that both rides along on each chat turn (buildCrossChatMemory above, sent as
// crossChatMemory) AND is viewable/manageable by the debater in the Memory
// panel. A round appears in memory once it has a summary. Deleting a round
// removes it entirely; forgetting a round drops its memory but keeps the chat.

export type MemoryEntry = { id: string; title: string; summary: string; updatedAt: number }

// Flat, newest-first view of everything remembered across all chats.
export function memoryEntries(conversations: Conversation[]): MemoryEntry[] {
  return conversations
    .filter((c) => c.summary)
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .map((c) => ({ id: c.id, title: c.title || 'Untitled round', summary: c.summary, updatedAt: c.updatedAt }))
}

// Remove a whole conversation (chat + its memory).
export function deleteConversation(conversations: Conversation[], id: string): Conversation[] {
  return conversations.filter((c) => c.id !== id)
}

// Drop one round's memory but keep the chat itself.
export function forgetConversationMemory(conversations: Conversation[], id: string): Conversation[] {
  return conversations.map((c) => (c.id === id ? { ...c, summary: '' } : c))
}

// Wipe cross-chat memory without deleting any chats.
export function clearAllMemory(conversations: Conversation[]): Conversation[] {
  return conversations.map((c) => (c.summary ? { ...c, summary: '' } : c))
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
