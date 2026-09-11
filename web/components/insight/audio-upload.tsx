'use client'

// File picker / drag-and-drop for an existing audio recording from a real
// round — the second input path for Recording Insight alongside the shared
// VoiceRecorderButton (live mic). Reads the file's duration locally before
// handing it to the caller so an uploaded file still gets WPM/pace feedback,
// the same way a live recording's measured durationSec does.

import { useRef, useState } from 'react'
import { Upload } from 'lucide-react'

function readDurationSec(file: File): Promise<number> {
  return new Promise((resolve) => {
    const audio = document.createElement('audio')
    const url = URL.createObjectURL(file)
    audio.preload = 'metadata'
    audio.src = url
    let settled = false
    const done = (d: number) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      URL.revokeObjectURL(url)
      resolve(d)
    }
    // Some browsers report Infinity for certain webm/opus files until a seek
    // forces duration resolution — fall back to 0 (no WPM) rather than hang.
    audio.onloadedmetadata = () => done(Number.isFinite(audio.duration) ? audio.duration : 0)
    audio.onerror = () => done(0)
    // Belt-and-suspenders: a handful of real-world recordings (unusual m4a
    // containers especially) leave the element stuck at readyState 0 with
    // neither event ever firing — no metadata, no error. Without this, the
    // whole upload flow (this call is awaited before onSelect fires) hangs
    // forever with zero feedback and no way forward but reloading the page.
    // 0 duration just means no WPM gets reported — grading still proceeds.
    const timer = setTimeout(() => done(0), 8000)
  })
}

export function AudioUpload({
  onSelect,
  disabled,
}: {
  onSelect: (file: File, durationSec: number) => void | Promise<void>
  disabled?: boolean
}) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [error, setError] = useState('')

  async function handleFile(file: File | undefined | null) {
    if (!file || disabled) return
    if (!file.type.startsWith('audio/') && !/\.(mp3|m4a|wav|webm|ogg|aac|flac)$/i.test(file.name)) {
      setError("That doesn't look like an audio file: try an mp3, m4a, wav, or similar recording.")
      return
    }
    setError('')
    const durationSec = await readDurationSec(file)
    await onSelect(file, durationSec)
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault()
        if (!disabled) setDragOver(true)
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragOver(false)
        handleFile(e.dataTransfer.files?.[0])
      }}
      className={`flex min-h-32 flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-6 text-center transition-colors ${
        dragOver ? 'border-pen bg-pen/5' : 'border-border bg-secondary/40'
      } ${disabled ? 'opacity-50' : ''}`}
    >
      <Upload className="size-5 text-muted-foreground" />
      <p className="text-sm text-muted-foreground">Drag an audio file from your round here, or</p>
      <button
        type="button"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        className="press rounded-full border border-border px-4 py-1.5 text-sm font-semibold hover:bg-secondary disabled:opacity-50"
      >
        Choose a file
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="audio/*"
        className="sr-only"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
