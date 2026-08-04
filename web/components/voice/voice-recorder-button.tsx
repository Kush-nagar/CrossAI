'use client'

// Thin presentational wrapper around useVoiceRecorder — parameterized by
// onSubmit so the 3 call sites (chat composer, calibration, drill speech)
// can each do their own thing with the recorded blob (upload+chat,
// upload+calibration-sample, upload+WPM-then-grade) without duplicating the
// record/stop/review/discard state machine three times.

import { useEffect, useRef, useState } from 'react'
import { Mic, Play, Trash2, Square } from 'lucide-react'
import { useVoiceRecorder, fixRecordedPlayback } from './use-voice-recorder'

export function VoiceRecorderButton({
  onSubmit,
  submitLabel = 'Submit',
}: {
  onSubmit: (result: { blob: Blob; durationSec: number }) => void | Promise<void>
  submitLabel?: string
}) {
  const { status, blob, url, durationSec, error, start, stop, discard } = useVoiceRecorder()
  const [submitting, setSubmitting] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    if (audioRef.current) fixRecordedPlayback(audioRef.current)
  }, [url])

  if (status === 'idle') {
    return (
      <button
        type="button"
        onClick={start}
        aria-label="Start voice recording"
        className="press flex size-9 items-center justify-center rounded-full transition hover:bg-secondary"
      >
        <Mic className="size-4" />
        {error && <span className="sr-only">{error}</span>}
      </button>
    )
  }

  if (status === 'requesting') {
    return (
      <button disabled aria-label="Requesting microphone access" className="flex size-9 items-center justify-center rounded-full opacity-50">
        <Mic className="size-4" />
      </button>
    )
  }

  if (status === 'recording') {
    return (
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1" aria-hidden="true">
          {[10, 22, 15, 30, 18].map((h, i) => (
            <span key={i} className="wave w-1 rounded-full bg-primary" style={{ height: h, animationDelay: `${i * 60}ms` }} />
          ))}
        </div>
        <button
          type="button"
          onClick={stop}
          aria-label="Stop recording"
          className="press flex size-9 items-center justify-center rounded-full bg-destructive/10 text-destructive"
        >
          <Square className="size-3.5" />
        </button>
      </div>
    )
  }

  // reviewing
  return (
    <div className="flex items-center gap-2">
      {url && (
        <audio ref={audioRef} src={url} controls className="h-8 max-w-40">
          <track kind="captions" />
        </audio>
      )}
      <button
        type="button"
        onClick={discard}
        aria-label="Discard recording"
        className="press flex size-9 items-center justify-center rounded-full transition hover:bg-secondary"
      >
        <Trash2 className="size-4" />
      </button>
      <button
        type="button"
        disabled={submitting}
        onClick={async () => {
          if (!blob) return
          setSubmitting(true)
          try {
            await onSubmit({ blob, durationSec })
            discard()
          } finally {
            setSubmitting(false)
          }
        }}
        className="press flex min-h-9 items-center gap-1.5 rounded-full bg-foreground px-3 text-xs font-semibold text-card disabled:opacity-50"
      >
        <Play className="size-3.5" />
        {submitting ? 'Submitting…' : submitLabel}
      </button>
    </div>
  )
}
