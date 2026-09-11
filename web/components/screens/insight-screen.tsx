'use client'

// Recording Insight: feedback on REAL round speeches — either one speech
// (upload or live take, graded directly) or an entire round recording, which
// Cross splits into individual speeches (no real speaker diarization exists
// in this stack, so the split is inferred from transcript content — see
// scripts/server.mjs's /api/insight/segment-round comment) before the
// debater marks which pieces are theirs and picks how to grade them: one
// specific speech, a holistic round debrief, or every marked speech
// individually. "Redo speech" always drops into the same focused
// single-speech flow, whichever mode produced the report being redone.

import { useState } from 'react'
import { ArrowRight } from 'lucide-react'
import { Field, InkButton, PageTitle } from '@/components/ui/primitives'
import {
  gradeInsight,
  gradeInsightRound,
  segmentRound,
  uploadFile,
  type InsightGradeResult,
  type InsightRoundContext,
  type InsightRoundGradeResult,
  type InsightSegment,
  type VoiceTone,
} from '@/lib/api'
import { AudioUpload } from '@/components/insight/audio-upload'
import { VoiceRecorderButton } from '@/components/voice/voice-recorder-button'
import { InsightReport } from '@/components/insight/insight-report'

type Mode = 'single' | 'full-round'
type Panel = 'context' | 'ready' | 'grading' | 'result' | 'segmenting' | 'segments' | 'grading-mode' | 'round-result'

const SPEECH_TYPES = ['Constructive', 'Rebuttal', 'Summary', 'Final Focus', 'Crossfire']

const EMPTY_CONTEXT: InsightRoundContext = { side: '', speechType: '', topic: '', judgeType: '', focusArea: '' }

type IndividualReport = { segment: InsightSegment; result: InsightGradeResult }

export function InsightScreen() {
  const [mode, setMode] = useState<Mode>('single')
  const [panel, setPanel] = useState<Panel>('context')
  const [loadingText, setLoadingText] = useState('Grading your speech…')
  const [roundContext, setRoundContext] = useState<InsightRoundContext>(EMPTY_CONTEXT)
  const [recordStatus, setRecordStatus] = useState('')
  const [recordError, setRecordError] = useState(false)
  const [busy, setBusy] = useState(false)

  // Single-speech result (also used for a speech picked out of a full round).
  const [report, setReport] = useState<InsightGradeResult | null>(null)
  const [previousInsight, setPreviousInsight] = useState<{ verdict: string; topFixes: string[] } | null>(null)

  // Full-round state.
  const [segments, setSegments] = useState<InsightSegment[]>([])
  const [markedLabels, setMarkedLabels] = useState<Set<string>>(new Set())
  const [pickingOneOf, setPickingOneOf] = useState(false)
  const [roundReport, setRoundReport] = useState<InsightRoundGradeResult | null>(null)
  const [individualReports, setIndividualReports] = useState<IndividualReport[]>([])
  const [redoingIndex, setRedoingIndex] = useState<number | null>(null)
  const [redoBusy, setRedoBusy] = useState(false)

  const markedSegments = segments.filter((s) => markedLabels.has(s.label))

  // --- Single-speech grading (also reused for a speech extracted from a full round) ---

  async function runGrading(transcript: string, durationSec: number, tone?: VoiceTone | null) {
    setBusy(true)
    setLoadingText('Grading your speech…')
    setPanel('grading')
    try {
      const minutes = durationSec > 0 ? durationSec / 60 : 0
      const wordCount = transcript.split(/\s+/).filter(Boolean).length
      const speechMeta = {
        transcribed: true,
        durationSec: Math.round(durationSec),
        ...(minutes > 0 ? { wpm: Math.round(wordCount / minutes) } : {}),
        ...(tone?.prompt ? { tone: tone.prompt } : {}),
        ...(tone?.segments?.length ? { toneSegments: tone.segments } : {}),
      }
      const data = await gradeInsight({
        speechText: transcript,
        speechMeta,
        roundContext,
        ...(previousInsight ? { previousInsight } : {}),
      })
      setReport(data)
      setRecordStatus('')
      setRecordError(false)
      setPanel('result')
    } catch (err) {
      setRecordStatus(err instanceof Error ? err.message : 'Something went wrong.')
      setRecordError(true)
      setPanel('ready')
    } finally {
      setBusy(false)
    }
  }

  async function handleGetInsight({ blob, durationSec }: { blob: Blob; durationSec: number }) {
    setBusy(true)
    setRecordStatus('Transcribing speech…')
    setRecordError(false)
    try {
      const ext = blob.type.includes('ogg') ? 'ogg' : blob.type.includes('mp4') ? 'm4a' : 'webm'
      const file = new File([blob], `insight-speech-${Date.now()}.${ext}`, { type: blob.type })
      const attachment = await uploadFile(file)
      const transcript = attachment.kind === 'audio' ? attachment.transcript.trim() : ''
      if (!transcript) throw new Error('No speech detected in that recording: try again closer to the mic.')
      if (mode === 'full-round') await startSegmentation(transcript)
      else await runGrading(transcript, durationSec, attachment.kind === 'audio' ? attachment.tone : null)
    } catch (err) {
      setBusy(false)
      setRecordStatus(err instanceof Error ? err.message : 'Something went wrong.')
      setRecordError(true)
      setPanel('ready')
    }
  }

  async function handleFileUpload(file: File, durationSec: number) {
    setBusy(true)
    setRecordStatus('Transcribing speech…')
    setRecordError(false)
    try {
      const attachment = await uploadFile(file, file.name)
      const transcript = attachment.kind === 'audio' ? attachment.transcript.trim() : ''
      if (!transcript) throw new Error('No speech detected in that file: try a clearer recording.')
      if (mode === 'full-round') await startSegmentation(transcript)
      else await runGrading(transcript, durationSec, attachment.kind === 'audio' ? attachment.tone : null)
    } catch (err) {
      setBusy(false)
      setRecordStatus(err instanceof Error ? err.message : 'Something went wrong.')
      setRecordError(true)
      setPanel('ready')
    }
  }

  function handleRedo() {
    if (report) setPreviousInsight({ verdict: report.verdict, topFixes: report.topFixes })
    setReport(null)
    setRecordStatus('')
    setRecordError(false)
    setPanel('ready')
  }

  // --- Full round: segment, mark, then grade one of three ways ---

  async function startSegmentation(transcript: string) {
    setLoadingText('Splitting the round into speeches…')
    setPanel('segmenting')
    try {
      const { segments: found } = await segmentRound({ transcript })
      setSegments(found)
      setMarkedLabels(new Set())
      setPickingOneOf(false)
      setPanel('segments')
    } catch (err) {
      setRecordStatus(err instanceof Error ? err.message : 'Something went wrong.')
      setRecordError(true)
      setPanel('ready')
    } finally {
      setBusy(false)
    }
  }

  function toggleMarked(label: string) {
    setMarkedLabels((prev) => {
      const next = new Set(prev)
      if (next.has(label)) next.delete(label)
      else next.add(label)
      return next
    })
  }

  // Grading one specific speech out of a segmented round is just the normal
  // single-speech flow, pre-filled with that segment — so Redo afterward
  // works exactly like it does everywhere else in this screen.
  async function chooseOneSpecificSpeech(seg: InsightSegment) {
    const nextContext = { ...roundContext, side: seg.side, speechType: seg.speechType }
    setMode('single')
    setRoundContext(nextContext)
    setPreviousInsight(null)
    setLoadingText('Grading your speech…')
    setPanel('grading')
    try {
      const data = await gradeInsight({ speechText: seg.text, roundContext: nextContext })
      setReport(data)
      setPanel('result')
    } catch (err) {
      setRecordStatus(err instanceof Error ? err.message : 'Something went wrong.')
      setRecordError(true)
      setPanel('ready')
    }
  }

  async function chooseRoundDebrief() {
    setLoadingText('Building your round debrief…')
    setPanel('grading')
    try {
      const data = await gradeInsightRound({
        speeches: markedSegments.map((s) => ({ label: s.label, side: s.side, speechType: s.speechType, text: s.text })),
        roundContext: { topic: roundContext.topic, judgeType: roundContext.judgeType, focusArea: roundContext.focusArea },
      })
      setRoundReport(data)
      setIndividualReports([])
      setPanel('round-result')
    } catch (err) {
      setRecordStatus(err instanceof Error ? err.message : 'Something went wrong.')
      setPanel('grading-mode')
    }
  }

  async function chooseAllIndividually() {
    setLoadingText('Grading all your speeches…')
    setPanel('grading')
    try {
      const results = await Promise.all(
        markedSegments.map(async (seg) => {
          const result = await gradeInsight({
            speechText: seg.text,
            roundContext: {
              side: seg.side,
              speechType: seg.speechType,
              topic: roundContext.topic,
              judgeType: roundContext.judgeType,
              focusArea: roundContext.focusArea,
            },
          })
          return { segment: seg, result }
        }),
      )
      setIndividualReports(results)
      setRoundReport(null)
      setPanel('round-result')
    } catch (err) {
      setRecordStatus(err instanceof Error ? err.message : 'Something went wrong.')
      setPanel('grading-mode')
    }
  }

  function startRedoIndividual(i: number) {
    setRedoingIndex(i)
    setRecordStatus('')
    setRecordError(false)
  }

  function cancelRedoIndividual() {
    setRedoingIndex(null)
    setRecordStatus('')
    setRecordError(false)
  }

  async function regradeIndividual(i: number, transcript: string) {
    const item = individualReports[i]
    setRecordStatus('Grading…')
    setRecordError(false)
    try {
      const data = await gradeInsight({
        speechText: transcript,
        roundContext: {
          side: item.segment.side,
          speechType: item.segment.speechType,
          topic: roundContext.topic,
          judgeType: roundContext.judgeType,
          focusArea: roundContext.focusArea,
        },
        previousInsight: { verdict: item.result.verdict, topFixes: item.result.topFixes },
      })
      setIndividualReports((list) => list.map((entry, idx) => (idx === i ? { ...entry, result: data } : entry)))
      setRedoingIndex(null)
      setRecordStatus('')
    } catch (err) {
      setRecordStatus(err instanceof Error ? err.message : 'Something went wrong.')
      setRecordError(true)
    } finally {
      setRedoBusy(false)
    }
  }

  // These three guard on redoBusy so a slow transcription/grade call can't be
  // fired twice from the same redo panel (the file input and voice recorder
  // otherwise stay clickable the whole time this is in flight).
  async function redoIndividualUpload(i: number, file: File) {
    if (redoBusy) return
    setRedoBusy(true)
    setRecordStatus('Transcribing speech…')
    setRecordError(false)
    try {
      const attachment = await uploadFile(file, file.name)
      const transcript = attachment.kind === 'audio' ? attachment.transcript.trim() : ''
      if (!transcript) throw new Error('No speech detected in that file: try a clearer recording.')
      await regradeIndividual(i, transcript)
    } catch (err) {
      setRecordStatus(err instanceof Error ? err.message : 'Something went wrong.')
      setRecordError(true)
      setRedoBusy(false)
    }
  }

  async function redoIndividualRecord(i: number, blob: Blob) {
    if (redoBusy) return
    setRedoBusy(true)
    setRecordStatus('Transcribing speech…')
    setRecordError(false)
    try {
      const ext = blob.type.includes('ogg') ? 'ogg' : blob.type.includes('mp4') ? 'm4a' : 'webm'
      const file = new File([blob], `insight-redo-${Date.now()}.${ext}`, { type: blob.type })
      const attachment = await uploadFile(file)
      const transcript = attachment.kind === 'audio' ? attachment.transcript.trim() : ''
      if (!transcript) throw new Error('No speech detected in that recording: try again closer to the mic.')
      await regradeIndividual(i, transcript)
    } catch (err) {
      setRecordStatus(err instanceof Error ? err.message : 'Something went wrong.')
      setRecordError(true)
      setRedoBusy(false)
    }
  }

  // A leftover error from one mode (e.g. "couldn't split that recording")
  // reads as confusing, stale copy if it's still showing after switching to
  // the other mode — clear it along with the mode itself.
  function switchMode(next: Mode) {
    setMode(next)
    setRecordStatus('')
    setRecordError(false)
  }

  function resetFullRound() {
    setSegments([])
    setMarkedLabels(new Set())
    setRoundReport(null)
    setIndividualReports([])
    setPickingOneOf(false)
    setRedoingIndex(null)
    setRedoBusy(false)
    setRecordStatus('')
    setRecordError(false)
    setPanel('context')
  }

  return (
    <div className="page-enter flex flex-col gap-7">
      <PageTitle
        eyebrow="Round feedback"
        title={panel === 'result' || panel === 'round-result' ? "Here's what Cross heard." : 'Get insight on a real round.'}
        description={
          panel === 'context'
            ? 'A little round context sharpens the feedback: side, speech, topic, judge. All optional.'
            : panel === 'ready'
              ? mode === 'full-round'
                ? 'Upload or record the ENTIRE round: Cross will split it into speeches for you to confirm.'
                : 'Upload a recording from your round, or record a fresh take, then press Get Insight.'
              : ''
        }
      />

      {panel === 'context' && (
        <div className="mx-auto grid w-full max-w-3xl gap-5">
          <section className="surface rounded-3xl p-6 md:p-8">
            <div className="mb-5 inline-flex rounded-full bg-secondary p-1">
              <button
                type="button"
                onClick={() => switchMode('single')}
                className={`press rounded-full px-4 py-1.5 text-sm font-semibold transition ${mode === 'single' ? 'bg-background shadow-sm' : 'text-muted-foreground'}`}
              >
                Single speech
              </button>
              <button
                type="button"
                onClick={() => switchMode('full-round')}
                className={`press rounded-full px-4 py-1.5 text-sm font-semibold transition ${mode === 'full-round' ? 'bg-background shadow-sm' : 'text-muted-foreground'}`}
              >
                Full round recording
              </button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {mode === 'single' && (
                <>
                  <Field label="Side (optional)">
                    <select
                      value={roundContext.side}
                      onChange={(e) => setRoundContext((c) => ({ ...c, side: e.target.value }))}
                      className="rounded-xl border bg-background px-4 py-3"
                    >
                      <option value="">Not specified</option>
                      <option value="Pro">Pro</option>
                      <option value="Con">Con</option>
                    </select>
                  </Field>
                  <Field label="Speech (optional)">
                    <select
                      value={roundContext.speechType}
                      onChange={(e) => setRoundContext((c) => ({ ...c, speechType: e.target.value }))}
                      className="rounded-xl border bg-background px-4 py-3"
                    >
                      <option value="">Not specified</option>
                      {SPEECH_TYPES.map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </Field>
                </>
              )}
              <Field label="Judge (optional)">
                <select
                  value={roundContext.judgeType}
                  onChange={(e) => setRoundContext((c) => ({ ...c, judgeType: e.target.value }))}
                  className="rounded-xl border bg-background px-4 py-3"
                >
                  <option value="">Not specified</option>
                  <option value="Lay / parent judge">Lay / parent judge</option>
                  <option value="Flow / tech judge">Flow / tech judge</option>
                </select>
              </Field>
              <Field label="Resolution / topic (optional)">
                <input
                  value={roundContext.topic}
                  onChange={(e) => setRoundContext((c) => ({ ...c, topic: e.target.value }))}
                  placeholder="e.g. Resolved: ..."
                  className="rounded-xl border bg-background px-4 py-3"
                />
              </Field>
            </div>
            <div className="mt-4">
              <Field label="What do you want feedback on? (optional)">
                <textarea
                  value={roundContext.focusArea}
                  onChange={(e) => setRoundContext((c) => ({ ...c, focusArea: e.target.value }))}
                  placeholder="e.g. did my weighing land, was my collapse clean…"
                  className="min-h-20 rounded-xl border bg-background px-4 py-3"
                />
              </Field>
            </div>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => setPanel('ready')}
                className="press flex min-h-11 items-center gap-2 rounded-md border border-border px-4 text-sm font-semibold hover:bg-secondary"
              >
                Skip: just grade it
              </button>
              <InkButton onClick={() => setPanel('ready')}>
                Continue <ArrowRight className="size-4" />
              </InkButton>
            </div>
          </section>
        </div>
      )}

      {(panel === 'grading' || panel === 'segmenting') && (
        <div className="surface mx-auto flex w-full max-w-3xl flex-col items-center gap-4 rounded-3xl p-10 text-center">
          <span className="size-8 animate-spin rounded-full border-2 border-border border-t-primary" />
          <p className="text-sm text-muted-foreground">{loadingText}</p>
        </div>
      )}

      {panel === 'ready' && (
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
          <section className="surface rounded-3xl p-6 md:p-10">
            <h2 className="font-display text-xl font-semibold">
              {mode === 'full-round' ? 'Feed in the whole round' : 'Feed in a round recording'}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {mode === 'full-round'
                ? 'Upload a recording of the entire round, or record it live: Cross will split it into speeches and let you mark which ones are yours.'
                : 'Upload a recording from your round, or record a fresh take right now: Cross grades the transcript either way.'}
            </p>

            <div className="mt-6 flex flex-col gap-4">
              <AudioUpload onSelect={handleFileUpload} disabled={busy} />
              <div className="flex items-center justify-between rounded-2xl bg-secondary/60 p-4">
                <span className="text-sm text-muted-foreground">Or record live</span>
                <VoiceRecorderButton onSubmit={handleGetInsight} submitLabel="Get Insight" />
              </div>
              {recordStatus && (
                <p className={`text-xs ${recordError ? 'text-destructive' : 'text-muted-foreground'}`}>{recordStatus}</p>
              )}
            </div>

            <button
              type="button"
              onClick={() => setPanel('context')}
              className="press mt-5 text-xs font-semibold text-muted-foreground underline-offset-2 hover:underline"
            >
              Edit round context
            </button>
          </section>
        </div>
      )}

      {panel === 'segments' && (
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
          <section className="surface rounded-3xl p-6 md:p-10">
            <p className="text-sm text-muted-foreground">
              Cross split this recording into speeches by reading the transcript. There's no real speaker
              recognition here, so double-check these before continuing.
            </p>
            {segments.filter((s) => s.speechType !== 'Crossfire').length === 0 ? (
              <div className="mt-5 rounded-xl bg-secondary/40 p-4 text-sm text-muted-foreground">
                Cross couldn&apos;t make out any individual speeches in that recording. Try a clearer recording, or
                switch to single-speech mode and grade one take at a time.
              </div>
            ) : (
              <div className="mt-5 flex flex-col gap-3">
                {segments.map((seg) =>
                  seg.speechType === 'Crossfire' ? (
                    <div key={seg.label} className="rounded-xl bg-secondary/30 p-4 opacity-60">
                      <span className="text-sm font-semibold">{seg.label}</span>
                      <span className="ml-2 text-xs text-muted-foreground">not gradable individually</span>
                    </div>
                  ) : (
                    <label key={seg.label} className="flex cursor-pointer items-start gap-3 rounded-xl bg-secondary/60 p-4">
                      <input
                        type="checkbox"
                        checked={markedLabels.has(seg.label)}
                        onChange={() => toggleMarked(seg.label)}
                        className="mt-1 size-4"
                      />
                      <span>
                        <span className="block text-sm font-semibold">
                          {seg.label} <span className="font-normal text-muted-foreground">· {seg.wordCount} words</span>
                        </span>
                        <span className="mt-1 block text-xs text-muted-foreground">
                          {seg.text.slice(0, 140)}
                          {seg.text.length > 140 ? '…' : ''}
                        </span>
                      </span>
                    </label>
                  ),
                )}
              </div>
            )}

            <button
              type="button"
              onClick={() => {
                setMode('single')
                setPanel('ready')
              }}
              className="press mt-5 block text-xs font-semibold text-muted-foreground underline-offset-2 hover:underline"
            >
              This doesn&apos;t look right: switch to single-speech mode
            </button>

            <div className="mt-4">
              <InkButton onClick={() => setPanel('grading-mode')} disabled={markedLabels.size === 0}>
                Continue with {markedLabels.size} speech{markedLabels.size === 1 ? '' : 'es'}
              </InkButton>
            </div>
          </section>
        </div>
      )}

      {panel === 'grading-mode' && (
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
          <section className="surface rounded-3xl p-6 md:p-10">
            <h2 className="font-display text-xl font-semibold">How should Cross grade these?</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              You marked {markedSegments.length} speech{markedSegments.length === 1 ? '' : 'es'} as yours:{' '}
              {markedSegments.map((s) => s.label).join(', ')}.{' '}
              <button
                type="button"
                onClick={() => {
                  setPickingOneOf(false)
                  setPanel('segments')
                }}
                className="press font-semibold underline-offset-2 hover:underline"
              >
                Change which speeches
              </button>
            </p>

            {!pickingOneOf ? (
              <div className="mt-6 flex flex-col gap-3">
                <button
                  type="button"
                  onClick={() => (markedSegments.length === 1 ? chooseOneSpecificSpeech(markedSegments[0]) : setPickingOneOf(true))}
                  className="press rounded-xl border border-border p-4 text-left hover:bg-secondary"
                >
                  <span className="block text-sm font-semibold">Grade one specific speech</span>
                  <span className="text-xs text-muted-foreground">Pick a single speech for a detailed grade.</span>
                </button>
                <button type="button" onClick={chooseRoundDebrief} className="press rounded-xl border border-border p-4 text-left hover:bg-secondary">
                  <span className="block text-sm font-semibold">Give me an overall round debrief</span>
                  <span className="text-xs text-muted-foreground">
                    One combined debrief across everything you marked: what won or lost the round, and the throughline between your speeches.
                  </span>
                </button>
                <button type="button" onClick={chooseAllIndividually} className="press rounded-xl border border-border p-4 text-left hover:bg-secondary">
                  <span className="block text-sm font-semibold">Grade all my speeches individually</span>
                  <span className="text-xs text-muted-foreground">A separate detailed grade for each speech you marked.</span>
                </button>
              </div>
            ) : (
              <div className="mt-6 flex flex-col gap-2">
                {markedSegments.map((seg) => (
                  <button
                    key={seg.label}
                    type="button"
                    onClick={() => chooseOneSpecificSpeech(seg)}
                    className="press rounded-xl border border-border p-4 text-left hover:bg-secondary"
                  >
                    <span className="block text-sm font-semibold">{seg.label}</span>
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setPickingOneOf(false)}
                  className="press mt-2 self-start text-xs font-semibold text-muted-foreground underline-offset-2 hover:underline"
                >
                  Back
                </button>
              </div>
            )}

            {recordStatus && <p className="mt-4 text-xs text-destructive">{recordStatus}</p>}
          </section>
        </div>
      )}

      {panel === 'result' && report && (
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
          <InsightReport
            verdict={report.verdict}
            strengths={report.strengths}
            weaknesses={report.weaknesses}
            topFixes={report.topFixes}
            improvedFromLastTime={report.improvedFromLastTime}
            onRedo={handleRedo}
          />
        </div>
      )}

      {panel === 'round-result' && roundReport && (
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
          <InsightReport
            title="Round debrief"
            verdict={roundReport.verdict}
            strengths={roundReport.strengths}
            weaknesses={roundReport.weaknesses}
            topFixes={roundReport.topFixes}
            perSpeechNotes={roundReport.perSpeechNotes}
          />
          <InkButton onClick={resetFullRound}>Grade another round</InkButton>
        </div>
      )}

      {panel === 'round-result' && individualReports.length > 0 && (
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
          {individualReports.map((item, i) => (
            <div key={item.segment.label} className="flex flex-col gap-3">
              <InsightReport
                title={item.segment.label}
                verdict={item.result.verdict}
                strengths={item.result.strengths}
                weaknesses={item.result.weaknesses}
                topFixes={item.result.topFixes}
                improvedFromLastTime={item.result.improvedFromLastTime}
                onRedo={() => startRedoIndividual(i)}
                redoLabel="Redo this speech"
              />
              {redoingIndex === i && (
                <section className="surface rounded-3xl p-6">
                  <p className="text-sm text-muted-foreground">Redo {item.segment.label}: upload a new take or record one live.</p>
                  <div className="mt-4 flex flex-col gap-4">
                    <AudioUpload onSelect={(file) => redoIndividualUpload(i, file)} disabled={redoBusy} />
                    <div className="flex items-center justify-between rounded-2xl bg-secondary/60 p-4">
                      <span className="text-sm text-muted-foreground">Or record live</span>
                      <VoiceRecorderButton onSubmit={({ blob }) => redoIndividualRecord(i, blob)} submitLabel="Get Insight" />
                    </div>
                    {recordStatus && (
                      <p className={`text-xs ${recordError ? 'text-destructive' : 'text-muted-foreground'}`}>{recordStatus}</p>
                    )}
                    {!redoBusy && (
                      <button
                        type="button"
                        onClick={cancelRedoIndividual}
                        className="press self-start text-xs font-semibold text-muted-foreground underline-offset-2 hover:underline"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </section>
              )}
            </div>
          ))}
          <InkButton onClick={resetFullRound}>Grade another round</InkButton>
        </div>
      )}
    </div>
  )
}
