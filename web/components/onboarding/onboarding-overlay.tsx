'use client'

// Ports public/app.js's onboarding calibration wizard: auto-shown on first
// run (unless already calibrated or explicitly skipped), and re-openable any
// time from Settings ("Start/Continue/Recalibrate Calibration") regardless
// of prior skip state. The debater reads a fixed script; every take is
// diffed automatically against ground truth server-side.

import { createContext, useContext, useEffect, useState } from 'react'
import { getVoiceProfileStatus, submitVoiceSample, uploadFile, type VoiceProfileStatus } from '@/lib/api'
import { VoiceRecorderButton } from '@/components/voice/voice-recorder-button'

const SKIP_KEY = 'cross-calibration-skipped'

const OnboardingContext = createContext<{ show: () => void }>({ show: () => {} })
export const useOnboarding = () => useContext(OnboardingContext)

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const [status, setStatus] = useState<VoiceProfileStatus | null>(null)
  const [message, setMessage] = useState('')

  async function refreshAndShow() {
    const s = await getVoiceProfileStatus().catch(() => null)
    if (!s) return
    setStatus(s)
    setMessage('')
    setOpen(true)
  }

  useEffect(() => {
    getVoiceProfileStatus()
      .then((s) => {
        if (!s.calibrated && localStorage.getItem(SKIP_KEY) !== '1') {
          setStatus(s)
          setOpen(true)
        }
      })
      .catch(() => {})
    // First-run check only — Settings' "show()" call is the re-entry path afterward.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function skip() {
    try {
      localStorage.setItem(SKIP_KEY, '1')
    } catch {
      // private-mode storage failure — overlay just re-prompts next load
    }
    setOpen(false)
  }

  async function handleSubmit({ blob }: { blob: Blob; durationSec: number }) {
    const file = new File([blob], `calibration-${Date.now()}.webm`, { type: blob.type || 'audio/webm' })
    let transcript = ''
    try {
      const uploaded = await uploadFile(file, undefined, { rawTranscript: true })
      transcript = uploaded.kind === 'audio' ? uploaded.transcript.trim() : ''
    } catch (err) {
      setMessage(err instanceof Error ? `Couldn't process the recording: ${err.message}` : 'Couldn’t process the recording.')
      return
    }
    if (!transcript) {
      setMessage('No speech detected — try again.')
      return
    }
    try {
      const next = await submitVoiceSample(transcript)
      setStatus(next)
      if (next.rejected) {
        const werPct = Math.round(next.wer * 100)
        const hint = next.mismatches.length
          ? ` Misheard: ${next.mismatches.slice(0, 4).map((m) => `"${m.from}"→"${m.to}"`).join(', ')}.`
          : ''
        setMessage(`Take not recorded — too far off script (${werPct}% word error). Try again.${hint}`)
        return
      }
      if (next.calibrated) {
        setOpen(false)
        return
      }
      setMessage(
        next.wasCorrect
          ? 'Take recorded — matched the script exactly.'
          : `Take recorded — ${next.corrections.length} correction(s) noted.`,
      )
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Couldn't save this take.")
    }
  }

  const take = Math.min((status?.sampleCount ?? 0) + 1, status?.total ?? 12)

  return (
    <OnboardingContext.Provider value={{ show: refreshAndShow }}>
      {children}
      {open && status && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/30 p-4 backdrop-blur-sm">
          <div className="glass page-enter w-full max-w-md rounded-3xl p-8">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl font-semibold">Voice calibration</h2>
              <span className="text-xs text-muted-foreground">
                Take {take} of {status.total}
              </span>
            </div>
            <p className="mt-4 text-sm text-muted-foreground">
              {status.pace === 'spread'
                ? 'Read this aloud at spread/competition speed — as fast as you would in a real technical round:'
                : 'Read this aloud, at your normal debate pace:'}
            </p>
            <p className="surface mt-3 rounded-2xl p-4 text-base leading-relaxed">{status.script}</p>
            <div className="mt-6 flex items-center justify-between">
              <VoiceRecorderButton onSubmit={handleSubmit} submitLabel="Submit take" />
              <button
                type="button"
                onClick={skip}
                className="press rounded-xl px-3 py-2 text-sm font-semibold text-muted-foreground hover:bg-secondary"
              >
                Skip for now
              </button>
            </div>
            {message && <p className="mt-4 text-sm text-muted-foreground">{message}</p>}
          </div>
        </div>
      )}
    </OnboardingContext.Provider>
  )
}
