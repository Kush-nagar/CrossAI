'use client'

import { useState } from 'react'
import { ArrowRight, Dices, Volume2 } from 'lucide-react'
import { InkButton, PageTitle, Pill, TallyBox } from '@/components/ui/primitives'
import { getDrillScenario, gradeDrill, uploadFile, drillSpeak, type DrillAnswerKey, type DrillGradeResult, type DrillScenario, type DrillSpeakResult } from '@/lib/api'
import { SpeechPlayer } from '@/components/drill/speech-player'
import { DRILL_FORMATS, DRILL_TOPICS, PF_FORMAT, randomFrom } from '@/lib/drill-topics'
import { TopicCombobox } from '@/components/drill/topic-combobox'
import { LedgerTable } from '@/components/drill/ledger-table'
import { VoiceRecorderButton } from '@/components/voice/voice-recorder-button'
import { FeedbackPrompt } from '@/components/feedback/feedback-prompt'
import { DeliveryTrends } from '@/components/drill/delivery-trends'

type Panel = 'setup' | 'loading' | 'scenario' | 'report'

const DIFFICULTIES = ['intro', 'standard', 'hard'] as const

// The drill is Public Forum only — no format selector. `format` is still sent
// to the API, which expects it, but it's a constant now.
const PF_CONFIG = DRILL_FORMATS[PF_FORMAT]

export function DrillScreen() {
  const [panel, setPanel] = useState<Panel>('setup')
  const [loadingText, setLoadingText] = useState('')
  const format = PF_FORMAT
  const [side, setSide] = useState(PF_CONFIG.sides[0])
  const [speech, setSpeech] = useState(PF_CONFIG.defaultSpeech)
  const [difficulty, setDifficulty] = useState<(typeof DIFFICULTIES)[number]>('standard')
  const [topic, setTopic] = useState('')
  const [scenario, setScenario] = useState<DrillScenario | null>(null)
  const [answerKey, setAnswerKey] = useState<DrillAnswerKey | null>(null)
  const [report, setReport] = useState<DrillGradeResult | null>(null)
  const [setupError, setSetupError] = useState('')
  const [recordStatus, setRecordStatus] = useState('')
  const [recordError, setRecordError] = useState(false)
  const [grading, setGrading] = useState(false)
  // Spoken exemplar of the optimal speech — only offered in the report panel
  // (after the answer key is revealed), so it never spoils the drill.
  const [speakResult, setSpeakResult] = useState<DrillSpeakResult | null>(null)
  const [speaking, setSpeaking] = useState(false)
  const [speakError, setSpeakError] = useState('')

  function randomize() {
    setSide(randomFrom(PF_CONFIG.sides))
    setSpeech(randomFrom(PF_CONFIG.speeches))
    setDifficulty(randomFrom(DIFFICULTIES))
    const bank = DRILL_TOPICS[PF_FORMAT] || []
    if (bank.length > 0) setTopic(randomFrom(bank).text)
  }

  async function generate() {
    setLoadingText('Building a scenario and computing the hidden answer key…')
    setSetupError('')
    setPanel('loading')
    try {
      const data = await getDrillScenario({ format, side, speech, difficulty, topic: topic.trim() })
      setScenario(data.scenario)
      setAnswerKey(data.answerKey)
      setReport(null)
      setSpeakResult(null)
      setSpeakError('')
      setRecordStatus('')
      setRecordError(false)
      setPanel('scenario')
    } catch (err) {
      setSetupError(err instanceof Error ? err.message : "Couldn't generate a scenario.")
      setPanel('setup')
    }
  }

  async function handleSpeak() {
    if (!scenario) return
    setSpeaking(true)
    setSpeakError('')
    try {
      // Compact { scenario, speech } contract — the server authors an exemplar
      // of this speech slot to the grader's construction criteria and voices it.
      const result = await drillSpeak({ scenario, speech: scenario.speech })
      setSpeakResult(result)
    } catch (err) {
      setSpeakError(err instanceof Error ? err.message : "Couldn't deliver that speech aloud.")
    } finally {
      setSpeaking(false)
    }
  }

  async function handleGrade({ blob, durationSec }: { blob: Blob; durationSec: number }) {
    if (!scenario || !answerKey) return
    setGrading(true)
    setRecordStatus('Transcribing speech…')
    setRecordError(false)
    try {
      const ext = blob.type.includes('ogg') ? 'ogg' : blob.type.includes('mp4') ? 'm4a' : 'webm'
      const file = new File([blob], `drill-speech-${Date.now()}.${ext}`, { type: blob.type })
      const attachment = await uploadFile(file)
      const transcript = attachment.kind === 'audio' ? attachment.transcript.trim() : ''
      if (!transcript) throw new Error('No speech detected in that recording: try again closer to the mic.')
      const minutes = durationSec / 60
      const wordCount = transcript.split(/\s+/).filter(Boolean).length
      const speechMeta = {
        transcribed: true,
        durationSec: Math.round(durationSec),
        wpm: minutes > 0 ? Math.round(wordCount / minutes) : 0,
        // Vocal tone (Hume prosody) — present only on cloud transcription.
        // Per-segment scores let the grader localize delivery feedback.
        ...(attachment.kind === 'audio' && attachment.tone?.prompt ? { tone: attachment.tone.prompt } : {}),
        ...(attachment.kind === 'audio' && attachment.tone?.segments?.length
          ? { toneSegments: attachment.tone.segments }
          : {}),
      }
      setRecordStatus('')
      setLoadingText('Grading your speech against the hidden answer key…')
      setPanel('loading')
      const data = await gradeDrill({ scenario, answerKey, speechText: transcript, speechMeta })
      setReport(data)
      setPanel('report')
    } catch (err) {
      setRecordStatus(err instanceof Error ? err.message : 'Something went wrong.')
      setRecordError(true)
      setPanel('scenario')
    } finally {
      setGrading(false)
    }
  }

  function restart() {
    setScenario(null)
    setAnswerKey(null)
    setReport(null)
    setSpeakResult(null)
    setSpeakError('')
    setRecordStatus('')
    setRecordError(false)
    setSetupError('')
    setPanel('setup')
  }

  return (
    <div className="page-enter flex flex-col gap-7">
      <PageTitle
        eyebrow="Deliberate practice"
        title={panel === 'report' ? 'Graded against the hidden answer key.' : 'Train under real round pressure.'}
        description={panel === 'scenario' ? 'Record your speech aloud: Cross grades the transcript.' : 'Pick a side and speech. Cross builds a live Public Forum scenario.'}
      />

      {panel === 'setup' && (
        <div className="mx-auto grid w-full max-w-3xl gap-5">
          <section className="surface rounded-3xl p-6 md:p-8">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-1.5 text-sm font-semibold">
                Side
                <select value={side} onChange={(e) => setSide(e.target.value)} className="rounded-xl border bg-background px-4 py-3">
                  {PF_CONFIG.sides.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1.5 text-sm font-semibold">
                Speech
                <select value={speech} onChange={(e) => setSpeech(e.target.value)} className="rounded-xl border bg-background px-4 py-3">
                  {PF_CONFIG.speeches.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1.5 text-sm font-semibold">
                Difficulty
                <select value={difficulty} onChange={(e) => setDifficulty(e.target.value as typeof difficulty)} className="rounded-xl border bg-background px-4 py-3">
                  {DIFFICULTIES.map((d) => (
                    <option key={d} value={d}>
                      {d[0].toUpperCase() + d.slice(1)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="mt-4 flex flex-col gap-1.5 text-sm font-semibold">
              Topic (optional)
              <TopicCombobox format={format} value={topic} onChange={setTopic} />
            </label>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button type="button" onClick={randomize} className="press flex min-h-11 items-center gap-2 rounded-md border border-border px-4 text-sm font-semibold hover:bg-secondary">
                <Dices className="size-4" />
                Randomize
              </button>
              <InkButton onClick={generate}>
                Generate scenario <ArrowRight className="size-4" />
              </InkButton>
            </div>
            {setupError && <p className="mt-3 text-xs text-destructive">{setupError}</p>}
          </section>
          <DeliveryTrends />
        </div>
      )}

      {panel === 'loading' && (
        <div className="surface mx-auto flex w-full max-w-3xl flex-col items-center gap-4 rounded-3xl p-10 text-center">
          <span className="size-8 animate-spin rounded-full border-2 border-border border-t-primary" />
          <p className="text-sm text-muted-foreground">{loadingText}</p>
        </div>
      )}

      {panel === 'scenario' && scenario && (
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
          <section className="surface rounded-3xl p-6 md:p-10">
            <div className="flex flex-wrap gap-2">
              <Pill tone="pen">{scenario.format}</Pill>
              <Pill>{scenario.side}</Pill>
              <Pill>Next: {scenario.speech}</Pill>
            </div>
            <h2 className="font-display mt-4 text-xl font-semibold">{scenario.resolution}</h2>
            <div className="mt-6 flex flex-col gap-3">
              {scenario.roundHistory.map((h, i) => (
                <div key={i} className="rounded-xl bg-secondary/60 p-4">
                  <strong className="text-sm">{h.speech}</strong>
                  <p className="mt-1 text-sm text-muted-foreground">{h.summary}</p>
                </div>
              ))}
            </div>
            <p className="mt-4 text-sm text-muted-foreground">
              <b className="text-foreground">Opponent: </b>
              {scenario.opponentProfile}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              <b className="text-foreground">Judge: </b>
              {scenario.judgeParadigm}
            </p>
            <p className="mt-5 text-base font-semibold">{scenario.task}</p>

            <div className="mt-6 flex items-center justify-between rounded-2xl bg-secondary/60 p-4">
              <span className={`text-sm ${recordError ? 'text-destructive' : 'text-muted-foreground'}`}>
                {recordStatus || 'Record your speech aloud, then submit for grading.'}
              </span>
              <VoiceRecorderButton onSubmit={handleGrade} submitLabel="Submit for grading" />
            </div>
            {grading && <p className="mt-2 text-xs text-muted-foreground">Working…</p>}
          </section>
        </div>
      )}

      {panel === 'report' && report && (
        <div className="mx-auto grid w-full max-w-4xl gap-5 lg:grid-cols-2">
          <section className="surface rounded-3xl p-6 md:p-8">
            <Pill tone="pen">Your speech</Pill>
            <div className="mt-3">
              <TallyBox value={`${Math.round(report.speechScore.probability * 100)}%`} label="Win prob." />
            </div>
            <p className="mt-2 text-sm text-muted-foreground">{report.verdict}</p>
            <div className="mt-5 overflow-x-auto">
              <LedgerTable {...report.speechScore} />
            </div>
          </section>
          <section className="surface rounded-3xl p-6 md:p-8">
            <Pill tone="highlight">Optimal play: {report.optimalMove.name}</Pill>
            <div className="mt-3">
              <TallyBox value={`${Math.round(report.optimalMove.probability * 100)}%`} label="Win prob." />
            </div>
            <p className="mt-2 text-sm text-muted-foreground">{report.optimalMove.description}</p>
            <div className="mt-5 overflow-x-auto">
              <LedgerTable prior={report.optimalMove.prior} factors={report.optimalMove.factors} probability={report.optimalMove.probability} />
            </div>
            <div className="mt-5 border-t border-border pt-5">
              {speakResult ? (
                <SpeechPlayer result={speakResult} label={`Model ${scenario?.speech ?? 'speech'}`} />
              ) : (
                <InkButton onClick={handleSpeak} disabled={speaking}>
                  <Volume2 className="size-4" />
                  {speaking ? 'Writing & voicing…' : 'Hear the model deliver this speech'}
                </InkButton>
              )}
              {speakError && <p className="mt-2 text-xs text-destructive">{speakError}</p>}
            </div>
          </section>
          <section className="surface rounded-3xl p-6 md:p-8 lg:col-span-2">
            <h3 className="font-display text-xl font-semibold">Round vision</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {[report.predictedOpponentMove && `Predicted opponent move: ${report.predictedOpponentMove}`, report.roundVision].filter(Boolean).join('. ')}
            </p>
            {report.lineByLine.length > 0 && (
              <div className="mt-5 flex flex-col gap-3">
                {report.lineByLine.map((entry, i) => (
                  <div key={i} className="rounded-xl bg-secondary/60 p-4">
                    <blockquote className="text-sm italic text-muted-foreground">{entry.quote}</blockquote>
                    <p className="mt-1 text-sm">{entry.note}</p>
                  </div>
                ))}
              </div>
            )}
            {report.topFixes.length > 0 && (
              <ol className="mt-5 list-decimal pl-5 text-sm">
                {report.topFixes.map((fix, i) => (
                  <li key={i} className="mb-1.5">
                    {fix}
                  </li>
                ))}
              </ol>
            )}
            <FeedbackPrompt key={report.verdict} route="drill" preview={report.verdict} />
            <InkButton onClick={restart} className="mt-6">
              Train again
            </InkButton>
          </section>
          <DeliveryTrends className="lg:col-span-2" />
        </div>
      )}
    </div>
  )
}
