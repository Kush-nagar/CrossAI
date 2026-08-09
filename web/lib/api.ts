// Thin client for the existing Express backend (scripts/server.mjs). Every
// endpoint here is an exact port of a contract already implemented and
// exercised by public/app.js — this file changes NOTHING server-side.
//
// Global 401 handling: apiFetch is the ONLY way screens should call the
// backend. On a 401 from any non-/api/auth/* path it fires
// "cross-session-expired" (AuthGate listens for this), mirroring
// public/auth.js's window.fetch monkeypatch without patching fetch globally.

export class SessionExpiredError extends Error {
  constructor() {
    super("Session expired")
    this.name = "SessionExpiredError"
  }
}

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = "ApiError"
    this.status = status
  }
}

async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(path, init)
  if (res.status === 401 && !path.startsWith("/api/auth/")) {
    window.dispatchEvent(new CustomEvent("cross-session-expired"))
    throw new SessionExpiredError()
  }
  return res
}

async function json<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await apiFetch(path, init)
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new ApiError(body?.error || `Request to ${path} failed`, res.status)
  return body as T
}

function postJson<T>(path: string, data: unknown): Promise<T> {
  return json<T>(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
}

// --- Auth ------------------------------------------------------------

export type CrossUser = {
  id: string
  email: string | null
  displayName: string | null
  consentVersion: number
}

export type AuthMe = {
  authenticated: boolean
  user: CrossUser | null
  // A linked Tabroom account is optional — it unlocks opponent scouting and
  // signed-in judge paradigm lookups. Everything else works without one.
  tabroom: { linked: boolean; username: string | null }
}

export function getAuthMe(): Promise<AuthMe> {
  // Never gated, never throws on 401 (there isn't one) — safe to call before
  // any session exists.
  return json<AuthMe>("/api/auth/me")
}

// A full-page navigation, not a fetch: the browser has to follow Supabase's
// redirect to Google and back to /api/auth/callback, which sets the session
// cookie server-side.
export function startGoogleSignIn(): void {
  window.location.href = "/api/auth/start/google"
}

// Always resolves when the address is well-formed, whether or not an account
// exists — the server deliberately doesn't say.
export function sendMagicLink(email: string): Promise<{ ok: true }> {
  return postJson("/api/auth/magic-link", { email })
}

export function logout(): Promise<{ ok: true }> {
  return postJson("/api/auth/logout", {})
}

// --- Tabroom link (optional) ---------------------------------------------

export function linkTabroom(
  username: string,
  password: string,
  remember: boolean,
  consentVersion: number,
): Promise<{ ok: true; username: string; judgeLookupsAuthenticated: boolean }> {
  return postJson("/api/auth/tabroom/link", { username, password, remember, consentVersion })
}

export function unlinkTabroom(): Promise<{ ok: true }> {
  return postJson("/api/auth/tabroom/unlink", {})
}

// --- Status / corpus ---------------------------------------------------

export function getStatus(): Promise<{ corpusCount: number }> {
  return json("/api/status")
}

// --- Upload (chat attachments) ------------------------------------------

export type ToneSegment = {
  text: string
  beginMs: number | null
  endMs: number | null
  top: { name: string; score: number }[]
}

export type VoiceTone = {
  top: { name: string; score: number }[]
  prompt: string
  // Per-utterance prosody (cloud transcription only) — lets the grader
  // localize delivery feedback to specific moments in the speech.
  segments?: ToneSegment[]
}

export type UploadResult =
  | { kind: "image"; filename: string; media_type: string; data: string }
  | { kind: "document"; filename: string; media_type: string; data: string }
  | { kind: "audio"; filename: string; url: string; transcript: string; tone?: VoiceTone | null }
  | { kind: "text"; filename: string; text: string }

export async function uploadFile(
  file: File | Blob,
  filename?: string,
  opts?: { rawTranscript?: boolean },
): Promise<UploadResult> {
  const form = new FormData()
  form.append("file", file, filename)
  // Calibration takes need the raw (correction-adjusted) Whisper output —
  // the server skips its Claude transcript-cleanup pass when this is set.
  if (opts?.rawTranscript) form.append("rawTranscript", "1")
  return json("/api/upload", { method: "POST", body: form })
}

// --- Response feedback (self-correction loop) ----------------------------

export function sendFeedback(input: {
  satisfied: boolean
  reason?: string
  route: "chat" | "drill" | "stress-test" | "strategy"
  preview?: string
}): Promise<{ count: number }> {
  return postJson("/api/feedback", input)
}

// --- Voice profile / calibration ----------------------------------------

export type VoiceProfileStatus = {
  sampleCount: number
  total: number
  calibrated: boolean
  correctionCount: number
  script: string
  pace: "normal" | "spread"
}

export type VoiceMismatch = { from: string; to: string }

export function getVoiceProfileStatus(): Promise<VoiceProfileStatus> {
  return json("/api/voice-profile/status")
}

export function submitVoiceSample(
  transcript: string,
): Promise<
  {
    wasCorrect: boolean
    corrections: VoiceMismatch[]
    rejected: boolean
    wer: number
    mismatches: VoiceMismatch[]
  } & VoiceProfileStatus
> {
  return postJson("/api/voice-profile/sample", { transcript })
}

export function resetVoiceProfile(): Promise<VoiceProfileStatus> {
  return postJson("/api/voice-profile/reset", {})
}

// --- Prep: case upload ----------------------------------------------------

export type CaseUploadResult =
  | { filename: string; kind: "docx"; text: string; html: string }
  | { filename: string; kind: "pdf"; text: string; url: string }
  | { filename: string; kind: "text"; text: string }

export async function uploadCase(file: File): Promise<CaseUploadResult> {
  const form = new FormData()
  form.append("file", file)
  return json("/api/case-upload", { method: "POST", body: form })
}

export function deleteCase(filename: string): Promise<{ ok: true }> {
  return apiFetch(`/api/case-upload/${encodeURIComponent(filename)}`, { method: "DELETE" }).then((res) =>
    res.json(),
  )
}

// --- Judges ---------------------------------------------------------------

export type JudgeResult = {
  name: string
  judge_id?: string
  source: string
  warning?: string
  paradigm: string
  tabroom_url: string
  results?: { name: string; judge_id: string }[]
}

export function lookupJudge(query: { name: string } | { judge_id: string }): Promise<JudgeResult> {
  return postJson("/api/judge", query)
}

export type JudgeSummaryBlock =
  | { kind: 'heading'; text: string }
  | { kind: 'bullets'; items: string[] }
  | { kind: 'callout'; text: string; tone: 'neutral' | 'warning' | 'tip' }
  | { kind: 'keyPrefs'; pairs: { label: string; value: string }[] }

export type JudgeSummarySection = { addressed: boolean; blocks: JudgeSummaryBlock[] }

export type StructuredJudgeSummary = {
  headline: string
  tags: string[]
  howToWin: string[]
  sections: {
    orientation: JudgeSummarySection
    delivery: JudgeSummarySection
    evidence: JudgeSummarySection
    weighing: JudgeSummarySection
    theory: JudgeSummarySection
    cx: JudgeSummarySection
    speakerPoints: JudgeSummarySection
    dealbreakers: JudgeSummarySection
  }
}

export type JudgeSummaryResult = JudgeResult & {
  summary: StructuredJudgeSummary | null
  summarySource: 'ai' | 'cache' | 'cache-revalidated' | 'cache-stale-fallback' | null
  cachedAt?: string | null
}

export function getJudgeSummary(input: { name?: string; judge_id?: string; forceRefresh?: boolean }): Promise<JudgeSummaryResult> {
  return postJson("/api/judge/summary", input)
}

// --- Prep: stress test ------------------------------------------------

export type StressTestCard = Record<string, unknown>

export function runStressTest(input: {
  title: string
  content: string
  mode: "skim" | "full"
}): Promise<{ score: number; cards: StressTestCard[] }> {
  return postJson("/api/stress-test", input)
}

// --- Drill ------------------------------------------------------------

export type DrillMoveFactor = { name: string; adjustment: number; why: string }
export type DrillMove = {
  name: string
  description: string
  prior: number
  factors: DrillMoveFactor[]
  probability: number
  optimal?: boolean
}
export type DrillScenario = {
  resolution: string
  format: string
  side: string
  speech: string
  roundHistory: { speech: string; summary: string }[]
  opponentProfile: string
  judgeParadigm: string
  task: string
}
export type DrillAnswerKey = {
  predictedOpponentMove: string
  hiddenNotes: string
  moves: DrillMove[]
}

export function getDrillScenario(input: {
  format: string
  side: string
  speech: string
  difficulty: string
  topic: string
}): Promise<{ scenario: DrillScenario; answerKey: DrillAnswerKey }> {
  return postJson("/api/drill/scenario", input)
}

export type ScoredLedger = { prior: number; factors: DrillMoveFactor[]; logOdds: number; probability: number }

export type DrillGradeResult = {
  speechScore: ScoredLedger
  optimalMove: Pick<DrillMove, "name" | "description" | "probability" | "prior" | "factors">
  predictedOpponentMove: string
  verdict: string
  roundVision: string
  lineByLine: { quote?: string; note?: string }[]
  topFixes: string[]
}

export function gradeDrill(input: {
  scenario: DrillScenario
  answerKey: DrillAnswerKey
  speechText: string
  speechMeta?: {
    transcribed?: boolean
    wpm?: number
    durationSec?: number
    tone?: string
    toneSegments?: ToneSegment[]
  }
}): Promise<DrillGradeResult> {
  return postJson("/api/drill/grade", input)
}

// AI voice box: the server authors an exemplar (or opponent-setup) speech for a
// drill scenario — built to the same construction criteria the grader scores
// against (scripts/lib/speechCriteria.mjs's buildAuthoringCriteria) — and voices
// it via TTS, returning the spoken MP3 (base64) plus its transcript. Consumed by
// <SpeechPlayer/> (web/components/drill/speech-player.tsx).
export type DrillSpeakResult = {
  audio: string // base64-encoded MP3
  mimeType?: string // defaults to audio/mpeg
  text: string // the generated speech transcript
}

export function drillSpeak(input: {
  scenario: DrillScenario
  // Which speech slot to author and voice (e.g. "Con Rebuttal") — drives both
  // the authoring criteria and the TTS acting directives, per speechCriteria.mjs.
  speech: string
}): Promise<DrillSpeakResult> {
  return postJson("/api/drill/speak", input)
}

// Tone-over-time snapshots recorded server-side after each graded spoken
// drill (scripts/lib/delivery.mjs) — newest last, capped at 500.
export type DeliverySnapshot = {
  date: string
  route: string
  wpm: number | null
  durationSec: number | null
  top: { name: string; score: number }[] | null
  segments: { text: string; top: { name: string; score: number }[] }[] | null
  score: number | null
}

export function getDeliveryHistory(): Promise<{ snapshots: DeliverySnapshot[] }> {
  return json("/api/drill/delivery-history")
}

// --- Chat -------------------------------------------------------------

export type ChatMessage = { role: "user" | "assistant"; content: unknown }

export function summarizeRound(messages: ChatMessage[]): Promise<{ title: string; summary: string }> {
  return postJson("/api/summarize-round", { messages })
}

// Structured, SAFE failure the server attaches to the end of a chat stream so
// the UI can show *why* a request failed and offer a retry. Never carries raw
// error text — see classifyChatFailure() in scripts/server.mjs.
export type ChatFailure = { code: string; reason: string; retryable: boolean }
export type ChatResult = { text: string; failure?: ChatFailure }

// Must match CHAT_ERROR_SENTINEL in scripts/server.mjs byte-for-byte. NUL-guarded
// so it can never appear inside model output; everything after it is the JSON
// failure trailer, stripped from the visible text before it's ever rendered.
const CHAT_ERROR_SENTINEL = "\u241E\u241ECROSS_CHAT_ERROR\u241E"

// Raw ReadableStream of plain-text chunks — NOT Server-Sent Events. Mirrors
// public/app.js's pushAndStream reader loop exactly; do not reach for
// EventSource/SSE parsing here. Resolves to { text, failure? }: on a failed
// request the backend streams a friendly message (text) plus a failure trailer.
export async function streamChat(
  input: { messages: ChatMessage[]; crossChatMemory?: string; mode: "general" | "preround" },
  onDelta: (fullTextSoFar: string) => void,
  signal?: AbortSignal,
): Promise<ChatResult> {
  const res = await apiFetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    signal,
  })
  if (!res.ok || !res.body) {
    const body = await res.json().catch(() => ({}))
    throw new ApiError(body?.error || "Chat request failed", res.status)
  }
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let text = ""
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    text += decoder.decode(value, { stream: true })
    // Never render the failure trailer: show only the text up to the sentinel.
    const cut = text.indexOf(CHAT_ERROR_SENTINEL)
    onDelta(cut === -1 ? text : text.slice(0, cut))
  }
  const cut = text.indexOf(CHAT_ERROR_SENTINEL)
  if (cut === -1) return { text }
  let failure: ChatFailure
  try {
    failure = JSON.parse(text.slice(cut + CHAT_ERROR_SENTINEL.length)) as ChatFailure
  } catch {
    failure = { code: "unknown", reason: "The reply ended unexpectedly.", retryable: true }
  }
  return { text: text.slice(0, cut), failure }
}

// --- Strategy mode (backend exists, no caller yet — deferred per plan) ----

export function getStrategyMode(input: {
  event: unknown
  flow: unknown
  judge: unknown
}): Promise<{ items: { title: string; rationale: string }[] }> {
  return postJson("/api/strategy-mode", input)
}
