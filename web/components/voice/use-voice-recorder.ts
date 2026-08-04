'use client'

// Ports public/app.js's captureAudio()/fixRecordedPlayback() verbatim — this
// is proven browser-quirk handling (Chrome's MediaRecorder omits a WebM
// duration header, leaving <audio> with duration=Infinity until a seek past
// the end forces it to compute the real value). Used at 3 call sites (chat
// composer, calibration, drill speech) via this one shared hook.

import { useCallback, useRef, useState } from 'react'

async function captureAudio() {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
  const chunks: Blob[] = []
  const recorder = new MediaRecorder(stream)
  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) chunks.push(event.data)
  }
  const startedAt = Date.now()
  recorder.start()

  return {
    stop(): Promise<{ blob: Blob; durationSec: number }> {
      return new Promise((resolve) => {
        const finish = () => {
          stream.getTracks().forEach((track) => track.stop())
          resolve({
            blob: new Blob(chunks, { type: recorder.mimeType || 'audio/webm' }),
            durationSec: (Date.now() - startedAt) / 1000,
          })
        }
        if (recorder.state !== 'inactive') {
          recorder.onstop = finish
          recorder.stop()
        } else {
          finish()
        }
      })
    },
  }
}

export function fixRecordedPlayback(audio: HTMLAudioElement) {
  audio.addEventListener('loadedmetadata', () => {
    if (Number.isFinite(audio.duration)) return
    const restore = () => {
      audio.removeEventListener('timeupdate', restore)
      audio.currentTime = 0
    }
    audio.addEventListener('timeupdate', restore)
    audio.currentTime = 1e7
  })
}

export type VoiceRecorderStatus = 'idle' | 'requesting' | 'recording' | 'reviewing'

export function useVoiceRecorder() {
  const [status, setStatus] = useState<VoiceRecorderStatus>('idle')
  const [blob, setBlob] = useState<Blob | null>(null)
  const [url, setUrl] = useState<string | null>(null)
  const [durationSec, setDurationSec] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const recorderRef = useRef<Awaited<ReturnType<typeof captureAudio>> | null>(null)
  // Bumped on every start/stop/discard. If the user cancels while
  // getUserMedia() is still pending, the stale start discards its recorder
  // instead of leaving a hot mic orphaned.
  const sessionRef = useRef(0)

  const discard = useCallback(() => {
    sessionRef.current += 1
    if (url) URL.revokeObjectURL(url)
    setBlob(null)
    setUrl(null)
    setDurationSec(0)
    setStatus('idle')
  }, [url])

  const start = useCallback(async () => {
    if (status === 'requesting' || status === 'recording') return
    discard()
    const session = ++sessionRef.current
    setError(null)
    setStatus('requesting')
    try {
      const recorder = await captureAudio()
      if (session !== sessionRef.current) {
        recorder.stop()
        return
      }
      recorderRef.current = recorder
      setStatus('recording')
    } catch {
      setError('Microphone access was denied or unavailable.')
      setStatus('idle')
    }
  }, [status, discard])

  const stop = useCallback(async () => {
    const recorder = recorderRef.current
    if (!recorder) return
    const session = sessionRef.current
    const result = await recorder.stop()
    if (session !== sessionRef.current) return // discarded/cancelled mid-stop
    recorderRef.current = null
    setBlob(result.blob)
    setUrl(URL.createObjectURL(result.blob))
    setDurationSec(result.durationSec)
    setStatus('reviewing')
  }, [])

  return { status, blob, url, durationSec, error, start, stop, discard }
}
