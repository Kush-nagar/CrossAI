'use client'

// Audio player for /api/drill/speak results: play/pause + seekable progress
// plus the spoken transcript. Styled to the Ballot/ink system — paper
// surface, hairline rules, mono timecodes (see design-system/cross/MASTER.md).

import { useEffect, useMemo, useRef, useState } from 'react'
import { Pause, Play } from 'lucide-react'
import { Pill } from '@/components/ui/primitives'
import type { DrillSpeakResult } from '@/lib/api'

function formatTime(sec: number) {
  if (!Number.isFinite(sec) || sec < 0) return '0:00'
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function SpeechPlayer({ result, label }: { result: DrillSpeakResult; label: string }) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [playing, setPlaying] = useState(false)
  const [time, setTime] = useState(0)
  const [duration, setDuration] = useState(0)

  // Base64 MP3 -> Blob URL (kept off the DOM as a data: URL — multi-MB data
  // URLs make attribute diffing sluggish).
  const src = useMemo(() => {
    const binary = atob(result.audio)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    return URL.createObjectURL(new Blob([bytes], { type: result.mimeType || 'audio/mpeg' }))
  }, [result])
  useEffect(() => () => URL.revokeObjectURL(src), [src])

  function toggle() {
    const audio = audioRef.current
    if (!audio) return
    if (audio.paused) void audio.play()
    else audio.pause()
  }

  function seek(next: number) {
    const audio = audioRef.current
    if (!audio) return
    audio.currentTime = next
    setTime(next)
  }

  return (
    <div className="rounded-2xl border border-border bg-secondary/60 p-4">
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        onDurationChange={(e) => setDuration(e.currentTarget.duration)}
      />
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={toggle}
          aria-label={playing ? 'Pause' : 'Play'}
          className="press flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"
        >
          {playing ? <Pause className="size-5" /> : <Play className="size-5 translate-x-px" />}
        </button>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex items-baseline justify-between gap-3">
            <Pill tone="pen">{label}</Pill>
            <span className="font-data text-xs text-muted-foreground">
              {formatTime(time)} / {formatTime(duration)}
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={Number.isFinite(duration) && duration > 0 ? duration : 0}
            step={0.1}
            value={Math.min(time, duration || 0)}
            onChange={(e) => seek(Number(e.target.value))}
            aria-label="Seek"
            className="h-1.5 w-full cursor-pointer accent-[var(--pen)]"
          />
        </div>
      </div>
      <details className="mt-3 border-t border-border pt-3" open>
        <summary className="eyebrow cursor-pointer select-none text-xs">Transcript</summary>
        <p className="mt-2 max-h-64 overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
          {result.text}
        </p>
      </details>
    </div>
  )
}
