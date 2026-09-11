'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ChevronRight, MessageCircle, Upload } from 'lucide-react'
import { loadConversations } from '@/lib/local-conversations'
import { loadCaseRecords } from '@/lib/local-cases'

function relativeTime(ms: number): string {
  const days = Math.floor((Date.now() - ms) / 86_400_000)
  if (days <= 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 30) return `${days}d ago`
  return `${Math.floor(days / 30)}mo ago`
}

type Last = { kind: 'chat'; title: string; updatedAt: number } | { kind: 'case'; title: string; updatedAt: number }

// Both sources are client-only (localStorage) — chats aren't stored
// server-side at all, and only PDF case uploads persist server-side, so
// this is the honest way to know what someone touched most recently.
function loadLast(): Last | null {
  const chat = loadConversations()
    .filter((c) => c.messages.length > 0)
    .sort((a, b) => b.updatedAt - a.updatedAt)[0]
  const kase = loadCaseRecords().sort((a, b) => b.uploadedAt - a.uploadedAt)[0]

  const candidates: Last[] = []
  if (chat) candidates.push({ kind: 'chat', title: chat.title || 'Untitled round', updatedAt: chat.updatedAt })
  if (kase) candidates.push({ kind: 'case', title: kase.filename, updatedAt: kase.uploadedAt })
  if (candidates.length === 0) return null
  return candidates.sort((a, b) => b.updatedAt - a.updatedAt)[0]
}

export function ContinueShortcut() {
  const [last, setLast] = useState<Last | null | undefined>(undefined)

  useEffect(() => {
    setLast(loadLast())
  }, [])

  const href = last?.kind === 'case' ? '/prep' : '/coach'
  const Icon = last?.kind === 'case' ? Upload : MessageCircle

  return (
    <Link href={href} className="surface lift flex min-h-32 flex-col justify-between rounded-xl p-5">
      <div className="flex items-start justify-between">
        <span className="flex size-9 items-center justify-center rounded-md bg-secondary">
          <Icon className="size-4" />
        </span>
        <ChevronRight className="size-4 text-muted-foreground" />
      </div>
      <div>
        <p className="truncate text-sm font-semibold">{last === undefined ? 'Loading...' : last === null ? 'Ask CrossCoach' : last.title}</p>
        <p className="text-xs text-muted-foreground">
          {last === undefined
            ? ''
            : last === null
              ? 'Start your first chat'
              : `Continue ${last.kind === 'case' ? 'this case' : 'this chat'} · ${relativeTime(last.updatedAt)}`}
        </p>
      </div>
    </Link>
  )
}
