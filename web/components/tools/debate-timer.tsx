'use client'

// Speech and prep timer for PF, LD and Policy. Times follow common NSDA
// high-school formats; prep is editable because tournaments vary.
// Keyboard: Space start/pause, R reset, N next speech. Timing uses wall-clock
// deltas (not interval counts) so it stays accurate when the tab is busy.

import { useCallback, useEffect, useRef, useState } from 'react'

type Speech = { name: string; seconds: number }
type Format = { id: string; label: string; prep: number; speeches: Speech[] }

const m = (min: number) => min * 60

const FORMATS: Format[] = [
  {
    id: 'pf',
    label: 'Public Forum',
    prep: m(3),
    speeches: [
      { name: 'First constructive', seconds: m(4) },
      { name: 'Second constructive', seconds: m(4) },
      { name: 'Crossfire', seconds: m(3) },
      { name: 'First rebuttal', seconds: m(4) },
      { name: 'Second rebuttal', seconds: m(4) },
      { name: 'Crossfire', seconds: m(3) },
      { name: 'First summary', seconds: m(3) },
      { name: 'Second summary', seconds: m(3) },
      { name: 'Grand crossfire', seconds: m(3) },
      { name: 'First final focus', seconds: m(2) },
      { name: 'Second final focus', seconds: m(2) },
    ],
  },
  {
    id: 'ld',
    label: 'Lincoln-Douglas',
    prep: m(4),
    speeches: [
      { name: 'Affirmative constructive', seconds: m(6) },
      { name: 'Cross-examination', seconds: m(3) },
      { name: 'Negative constructive', seconds: m(7) },
      { name: 'Cross-examination', seconds: m(3) },
      { name: 'First affirmative rebuttal', seconds: m(4) },
      { name: 'Negative rebuttal', seconds: m(6) },
      { name: 'Second affirmative rebuttal', seconds: m(3) },
    ],
  },
  {
    id: 'policy',
    label: 'Policy',
    prep: m(8),
    speeches: [
      { name: '1AC', seconds: m(8) },
      { name: 'Cross-ex', seconds: m(3) },
      { name: '1NC', seconds: m(8) },
      { name: 'Cross-ex', seconds: m(3) },
      { name: '2AC', seconds: m(8) },
      { name: 'Cross-ex', seconds: m(3) },
      { name: '2NC', seconds: m(8) },
      { name: 'Cross-ex', seconds: m(3) },
      { name: '1NR', seconds: m(5) },
      { name: '1AR', seconds: m(5) },
      { name: '2NR', seconds: m(5) },
      { name: '2AR', seconds: m(5) },
    ],
  },
]

function clock(totalMs: number): string {
  const neg = totalMs < 0
  const s = Math.ceil(Math.abs(totalMs) / 1000)
  return `${neg ? '−' : ''}${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/** A countdown that can run past zero (shown in red as overtime). */
function useCountdown(seconds: number) {
  const [remaining, setRemaining] = useState(seconds * 1000)
  const [running, setRunning] = useState(false)
  const endsAt = useRef<number | null>(null)

  useEffect(() => {
    if (!running) return
    endsAt.current = Date.now() + remaining
    const id = window.setInterval(() => setRemaining(endsAt.current! - Date.now()), 200)
    return () => window.clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running])

  const reset = useCallback(
    (to = seconds) => {
      setRunning(false)
      setRemaining(to * 1000)
    },
    [seconds],
  )
  return { remaining, running, setRunning, reset }
}

function beep() {
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ctx = new AC()
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.frequency.value = 880
    g.gain.setValueAtTime(0.25, ctx.currentTime)
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8)
    o.connect(g).connect(ctx.destination)
    o.start()
    o.stop(ctx.currentTime + 0.8)
  } catch {
    // audio unavailable — the visual cue still shows
  }
}

function PrepClock({ label, seconds, resetKey }: { label: string; seconds: number; resetKey: string }) {
  const t = useCountdown(seconds)
  const { reset } = t
  useEffect(() => reset(seconds), [resetKey, seconds, reset])
  const over = t.remaining <= 0
  return (
    <div className="surface flex flex-col items-center gap-2 rounded-2xl p-4">
      <p className="text-sm font-semibold text-muted-foreground">{label}</p>
      <p className={`font-data text-4xl font-semibold tabular-nums ${over ? 'text-destructive' : ''}`}>{clock(t.remaining)}</p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => t.setRunning(!t.running)}
          className="press min-h-10 rounded-xl bg-foreground px-4 text-sm font-semibold text-background"
        >
          {t.running ? 'Pause' : 'Use prep'}
        </button>
        <button type="button" onClick={() => t.reset()} className="press min-h-10 rounded-xl border border-border px-3 text-sm font-semibold hover:bg-secondary">
          Reset
        </button>
      </div>
    </div>
  )
}

export function DebateTimer() {
  const [formatId, setFormatId] = useState('pf')
  const format = FORMATS.find((f) => f.id === formatId)!
  const [index, setIndex] = useState(0)
  const [prepMinutes, setPrepMinutes] = useState(format.prep / 60)
  const speech = format.speeches[index]
  const t = useCountdown(speech.seconds)
  const { reset } = t
  const [announce, setAnnounce] = useState('')
  const warned = useRef({ thirty: false, zero: false })

  // New format: back to the first speech and that format's default prep.
  useEffect(() => {
    setIndex(0)
    setPrepMinutes(format.prep / 60)
  }, [formatId, format.prep])

  useEffect(() => {
    reset(speech.seconds)
    warned.current = { thirty: false, zero: false }
  }, [formatId, index, speech.seconds, reset])

  // Screen-reader cues and a beep at time; nothing announced every second.
  useEffect(() => {
    if (!t.running) return
    if (!warned.current.thirty && t.remaining <= 30_000 && t.remaining > 0) {
      warned.current.thirty = true
      setAnnounce('30 seconds left')
    }
    if (!warned.current.zero && t.remaining <= 0) {
      warned.current.zero = true
      setAnnounce('Time')
      beep()
    }
  }, [t.remaining, t.running])

  // Keep the screen awake while a speech is running (where supported).
  useEffect(() => {
    if (!t.running || !('wakeLock' in navigator)) return
    let lock: { release: () => Promise<void> } | null = null
    ;(navigator as unknown as { wakeLock: { request: (k: string) => Promise<{ release: () => Promise<void> }> } }).wakeLock
      .request('screen')
      .then((l) => (lock = l))
      .catch(() => {})
    return () => {
      lock?.release().catch(() => {})
    }
  }, [t.running])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName
      if (['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON'].includes(tag)) return
      if (e.key === ' ') {
        e.preventDefault()
        t.setRunning(!t.running)
      } else if (e.key === 'r' || e.key === 'R') t.reset()
      else if (e.key === 'n' || e.key === 'N') setIndex((i) => Math.min(format.speeches.length - 1, i + 1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [t, format.speeches.length])

  const over = t.remaining <= 0
  const prepSeconds = Math.max(0, Math.round(prepMinutes * 60))

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end gap-4">
        <div role="radiogroup" aria-label="Format" className="flex overflow-hidden rounded-md border border-border">
          {FORMATS.map((f) => (
            <button
              key={f.id}
              type="button"
              role="radio"
              aria-checked={formatId === f.id}
              onClick={() => setFormatId(f.id)}
              className={`min-h-11 px-4 text-sm font-semibold ${formatId === f.id ? 'bg-foreground text-background' : 'hover:bg-secondary'}`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm font-semibold">
          Prep (minutes each)
          <input
            type="number"
            min={0}
            max={20}
            step={0.5}
            value={prepMinutes}
            onChange={(e) => setPrepMinutes(Number(e.target.value))}
            className="min-h-11 w-20 rounded-md border border-border bg-background px-2 font-normal"
          />
        </label>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <section aria-label="Speech timer" className="surface flex flex-col items-center gap-4 rounded-3xl p-8 text-center">
          <p className="text-sm font-semibold text-muted-foreground">
            Speech {index + 1} of {format.speeches.length}
          </p>
          <h2 className="font-display text-3xl font-semibold">{speech.name}</h2>
          <p
            className={`font-data text-7xl font-semibold tabular-nums md:text-8xl ${over ? 'text-destructive' : ''}`}
            aria-label={`Time remaining ${clock(t.remaining)}`}
          >
            {clock(t.remaining)}
          </p>
          {over && <p className="font-semibold text-destructive">Time. Finish your sentence.</p>}
          <div className="flex flex-wrap justify-center gap-2">
            <button type="button" onClick={() => t.setRunning(!t.running)} className="press min-h-12 rounded-xl bg-foreground px-6 font-semibold text-background">
              {t.running ? 'Pause' : 'Start'}
            </button>
            <button type="button" onClick={() => t.reset()} className="press min-h-12 rounded-xl border border-border px-5 font-semibold hover:bg-secondary">
              Reset
            </button>
            <button
              type="button"
              disabled={index === format.speeches.length - 1}
              onClick={() => setIndex(index + 1)}
              className="press min-h-12 rounded-xl border border-border px-5 font-semibold hover:bg-secondary disabled:opacity-40"
            >
              Next speech
            </button>
          </div>
          <p className="text-xs text-muted-foreground">Keyboard: Space start/pause · R reset · N next speech</p>
          <p role="status" aria-live="assertive" className="sr-only">
            {announce}
          </p>
        </section>

        <div className="flex flex-col gap-4">
          <PrepClock label={formatId === 'pf' ? 'First-speaking team prep' : 'Affirmative prep'} seconds={prepSeconds} resetKey={formatId} />
          <PrepClock label={formatId === 'pf' ? 'Second-speaking team prep' : 'Negative prep'} seconds={prepSeconds} resetKey={formatId} />
        </div>
      </div>

      <nav aria-label="Speeches" className="flex flex-wrap gap-2">
        {format.speeches.map((s, i) => (
          <button
            key={`${s.name}-${i}`}
            type="button"
            onClick={() => setIndex(i)}
            aria-current={i === index ? 'step' : undefined}
            className={`min-h-10 rounded-full px-3 text-sm ${i === index ? 'bg-foreground font-semibold text-background' : 'bg-secondary hover:bg-border'}`}
          >
            {s.name} · {s.seconds / 60}m
          </button>
        ))}
      </nav>
    </div>
  )
}
