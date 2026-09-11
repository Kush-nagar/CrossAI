'use client'

// The ask half of the circular feedback loop (see scripts/lib/feedback.mjs).
// Mount one of these under an AI response: on mount it rolls a random number
// and, at SAMPLE_RATE odds, renders a small "was this helpful?" prompt. A
// thumbs-down asks why; the answer is stored server-side and fed back into
// every future system prompt, so complaints self-correct future responses.
// A failed roll renders nothing — keying the component to the response
// (message index / report id) guarantees exactly one roll per response.

import { useState } from 'react'
import { sendFeedback } from '@/lib/api'

// Mirrors the server's FEEDBACK_SAMPLE_RATE default (client-side roll is
// needed because chat responses stream rather than returning JSON).
const SAMPLE_RATE = 0.2

type Props = {
  route: 'chat' | 'drill' | 'stress-test' | 'strategy' | 'recording-insight'
  /** Short excerpt of the response being rated, for later interpretability. */
  preview: string
}

export function FeedbackPrompt({ route, preview }: Props) {
  // useState initializer = the one-time random roll for this response.
  const [rolled] = useState(() => Math.random() < SAMPLE_RATE)
  const [phase, setPhase] = useState<'ask' | 'why' | 'done' | 'hidden'>('ask')
  const [reason, setReason] = useState('')

  if (!rolled || phase === 'hidden') return null

  async function submit(satisfied: boolean, why?: string) {
    try {
      await sendFeedback({ satisfied, reason: why, route, preview: preview.slice(0, 200) })
    } catch {
      // Feedback is best-effort — never surface an error for it.
    }
    setPhase('done')
    setTimeout(() => setPhase('hidden'), 2500)
  }

  if (phase === 'done') {
    return <p className="mt-2 text-xs text-muted-foreground">Thanks, Cross adjusts from this.</p>
  }

  if (phase === 'why') {
    return (
      <div className="mt-2 flex max-w-md flex-col gap-2">
        <label className="text-xs text-muted-foreground">What was off about this response?</label>
        <textarea
          className="min-h-16 rounded-lg border border-border bg-background p-2 text-xs"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g. too long, ignored my judge's paradigm, generic advice…"
        />
        <div className="flex gap-2">
          <button
            className="rounded-lg bg-foreground px-3 py-1 text-xs text-card disabled:opacity-50"
            disabled={!reason.trim()}
            onClick={() => submit(false, reason)}
          >
            Send
          </button>
          <button
            className="rounded-lg px-3 py-1 text-xs text-muted-foreground"
            onClick={() => submit(false)}
          >
            Skip
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
      <span>Was this response helpful?</span>
      <button
        className="rounded-lg border border-border px-2 py-0.5 hover:bg-secondary"
        onClick={() => submit(true)}
        aria-label="Yes, helpful"
      >
        👍
      </button>
      <button
        className="rounded-lg border border-border px-2 py-0.5 hover:bg-secondary"
        onClick={() => setPhase('why')}
        aria-label="No, not helpful"
      >
        👎
      </button>
    </div>
  )
}
