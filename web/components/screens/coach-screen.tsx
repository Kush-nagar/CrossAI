'use client'

import { useEffect, useRef, useState } from 'react'
import { marked } from 'marked'
import { AlertTriangle, ArrowRight, Brain, FileText, Menu, Plus, RotateCcw, Sparkles, Trash2, X } from 'lucide-react'
import {
  streamChat,
  summarizeRound,
  uploadFile,
  type ChatMessage,
  type UploadResult,
} from '@/lib/api'
import {
  buildCrossChatMemory,
  clearAllMemory,
  deleteConversation,
  forgetConversationMemory,
  loadCoachMode,
  loadConversations,
  makeConversationId,
  memoryEntries,
  saveCoachMode,
  saveConversations,
  type Conversation,
} from '@/lib/local-conversations'
import { VoiceRecorderButton } from '@/components/voice/voice-recorder-button'
import { FeedbackPrompt } from '@/components/feedback/feedback-prompt'

type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'image'; source: { type: 'base64'; media_type: string; data: string } }
  | { type: 'document'; source: { type: 'base64'; media_type: string; data: string } }

function attachmentIcon(kind: UploadResult['kind']) {
  if (kind === 'image') return '🖼️'
  if (kind === 'audio') return '🎙️'
  if (kind === 'document') return '📄'
  return '📎'
}

function buildContent(text: string, attachments: UploadResult[]): string | ContentBlock[] {
  const blocks: ContentBlock[] = []
  for (const att of attachments) {
    if (att.kind === 'image') {
      blocks.push({ type: 'image', source: { type: 'base64', media_type: att.media_type, data: att.data } })
    } else if (att.kind === 'document') {
      blocks.push({ type: 'document', source: { type: 'base64', media_type: att.media_type, data: att.data } })
    } else if (att.kind === 'text') {
      blocks.push({ type: 'text', text: `<uploaded-file name="${att.filename}">\n${att.text}\n</uploaded-file>` })
    }
  }
  if (text) blocks.push({ type: 'text', text })
  return blocks.length === 1 && blocks[0].type === 'text' ? blocks[0].text : blocks
}

function renderMarkdown(text: string): string {
  return marked.parse(text, { breaks: true, async: false }) as string
}

function bubbleTextAndAttachments(content: unknown): { text: string; kind: 'text' | 'image' } {
  if (typeof content === 'string') return { text: content, kind: 'text' }
  if (Array.isArray(content)) {
    const textBlock = content.find((b) => b?.type === 'text')
    return { text: textBlock?.text || '', kind: 'text' }
  }
  return { text: '', kind: 'text' }
}

export function CoachScreen() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [currentId, setCurrentId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [assistantDraft, setAssistantDraft] = useState('')
  // Check-back mechanism: when a chat request fails, keep the reason (safe,
  // internals-free — see classifyChatFailure in server.mjs) and the exact turn
  // to replay so the debater can see why and retry, instead of a dead reply.
  const [sendError, setSendError] = useState<{ reason: string; retryable: boolean } | null>(null)
  const [lastAttempt, setLastAttempt] = useState<
    { messages: ChatMessage[]; roundId: string | null; isFirstMessageOfRound: boolean } | null
  >(null)
  const [attachments, setAttachments] = useState<UploadResult[]>([])
  const [mode, setMode] = useState<'general' | 'preround'>('general')
  const [historyOpen, setHistoryOpen] = useState(false)
  const [memoryOpen, setMemoryOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const loaded = loadConversations()
    setConversations(loaded)
    setMode(loadCoachMode())
    const mostRecent = [...loaded].sort((a, b) => b.updatedAt - a.updatedAt)[0]
    if (mostRecent && mostRecent.messages.length === 0) {
      setCurrentId(mostRecent.id)
    } else {
      const id = makeConversationId()
      const blank: Conversation = { id, title: 'New round', summary: '', messages: [], updatedAt: Date.now() }
      const next = [blank, ...loaded]
      setConversations(next)
      saveConversations(next)
      setCurrentId(id)
    }
  }, [])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [messages, assistantDraft])

  function persistCurrent(nextMessages: ChatMessage[]) {
    setConversations((prev) => {
      const next = prev.map((c) => (c.id === currentId ? { ...c, messages: nextMessages, updatedAt: Date.now() } : c))
      saveConversations(next)
      return next
    })
  }

  function settleOutgoing() {
    if (messages.length > 0) {
      persistCurrent(messages)
    } else if (currentId) {
      setConversations((prev) => {
        const next = prev.filter((c) => c.id !== currentId)
        saveConversations(next)
        return next
      })
    }
  }

  function startNewConversation() {
    if (streaming) return
    settleOutgoing()
    const id = makeConversationId()
    const blank: Conversation = { id, title: 'New round', summary: '', messages: [], updatedAt: Date.now() }
    setConversations((prev) => {
      const next = [blank, ...prev]
      saveConversations(next)
      return next
    })
    setCurrentId(id)
    setMessages([])
    setAttachments([])
    setAssistantDraft('')
    setSendError(null)
    setHistoryOpen(false)
  }

  function loadConversation(id: string) {
    if (streaming || id === currentId) return
    settleOutgoing()
    const record = conversations.find((c) => c.id === id)
    if (!record) return
    setCurrentId(id)
    setMessages(JSON.parse(JSON.stringify(record.messages)))
    setSendError(null)
    setHistoryOpen(false)
  }

  function updateMode(next: 'general' | 'preround') {
    setMode(next)
    saveCoachMode(next)
  }

  // Summarize a round into cross-chat memory. keepTitle=true on refreshes so a
  // growing round doesn't churn its sidebar label. Best-effort — a failed
  // summary just leaves the prior memory in place.
  function refreshMemory(roundId: string, msgs: ChatMessage[], keepTitle: boolean) {
    summarizeRound(msgs)
      .then((result) => {
        setConversations((prev) => {
          const next = prev.map((c) =>
            c.id === roundId
              ? { ...c, title: keepTitle ? c.title : result.title || c.title, summary: result.summary || c.summary }
              : c,
          )
          saveConversations(next)
          return next
        })
      })
      .catch(() => {})
  }

  // Delete a chat entirely (removes it from cross-chat memory too). If it's the
  // open one, fall back to the most recent remaining chat, or a fresh blank.
  function handleDeleteConversation(id: string) {
    if (streaming) return
    const target = conversations.find((c) => c.id === id)
    if (!target) return
    if (
      target.messages.length > 0 &&
      !window.confirm(`Delete "${target.title || 'this chat'}"? It's also removed from CrossCoach's cross-chat memory.`)
    ) {
      return
    }

    const remaining = deleteConversation(conversations, id)
    if (id === currentId) {
      const fallback = [...remaining].sort((a, b) => b.updatedAt - a.updatedAt)[0]
      if (fallback) {
        saveConversations(remaining)
        setConversations(remaining)
        setCurrentId(fallback.id)
        setMessages(JSON.parse(JSON.stringify(fallback.messages)))
      } else {
        const blankId = makeConversationId()
        const blank: Conversation = { id: blankId, title: 'New round', summary: '', messages: [], updatedAt: Date.now() }
        const seeded = [blank]
        saveConversations(seeded)
        setConversations(seeded)
        setCurrentId(blankId)
        setMessages([])
      }
      setAttachments([])
      setAssistantDraft('')
    } else {
      saveConversations(remaining)
      setConversations(remaining)
    }
    setSendError(null)
  }

  // Drop one round's memory but keep the chat.
  function handleForgetMemory(id: string) {
    const next = forgetConversationMemory(conversations, id)
    saveConversations(next)
    setConversations(next)
  }

  // Wipe cross-chat memory without deleting any chats.
  function handleClearAllMemory() {
    if (!window.confirm('Clear everything CrossCoach remembers across your chats? Your chats stay; only the shared memory is wiped.')) return
    const next = clearAllMemory(conversations)
    saveConversations(next)
    setConversations(next)
  }

  // Streams one assistant turn for a conversation that already ends in the
  // user's message. Shared by send() (new turn) and retryLast() (replay the
  // same turn) so both funnel through identical success/failure handling.
  async function runChat(nextMessages: ChatMessage[], roundId: string | null, isFirstMessageOfRound: boolean) {
    setStreaming(true)
    setAssistantDraft('')
    setSendError(null)

    try {
      const { text: finalText, failure } = await streamChat(
        { messages: nextMessages, crossChatMemory: buildCrossChatMemory(conversations, currentId), mode },
        (soFar) => setAssistantDraft(soFar),
      )
      const withAssistant: ChatMessage[] = finalText ? [...nextMessages, { role: 'assistant', content: finalText }] : nextMessages
      setMessages(withAssistant)
      persistCurrent(withAssistant)

      if (failure) {
        // The friendly reply is already in the thread; surface the reason +
        // retry below it, and remember this turn so retry can replay it.
        setSendError({ reason: failure.reason, retryable: failure.retryable })
        setLastAttempt({ messages: nextMessages, roundId, isFirstMessageOfRound })
      } else if (isFirstMessageOfRound && finalText && roundId) {
        // First exchange sets the round's title + initial memory.
        refreshMemory(roundId, withAssistant, false)
      } else if (finalText && roundId && withAssistant.length >= 4 && withAssistant.length % 4 === 0) {
        // Keep cross-chat memory current as a round grows — refresh the summary
        // (keep the title) every couple of exchanges. Background, best-effort.
        refreshMemory(roundId, withAssistant, true)
      }
    } catch (err) {
      // Pre-stream failure (never reached the model, e.g. network/session/500):
      // no friendly reply exists, so keep the user's turn and show the reason.
      setAssistantDraft('')
      setMessages(nextMessages)
      persistCurrent(nextMessages)
      const reason = err instanceof Error ? err.message : 'Something went wrong reaching CrossCoach.'
      setSendError({ reason, retryable: true })
      setLastAttempt({ messages: nextMessages, roundId, isFirstMessageOfRound })
    } finally {
      setStreaming(false)
      setAssistantDraft('')
    }
  }

  async function send(rawText: string, sendAttachments: UploadResult[] = attachments) {
    const text = rawText.trim()
    if ((!text && sendAttachments.length === 0) || streaming) return

    const roundId = currentId
    const isFirstMessageOfRound = messages.length === 0
    const content = buildContent(text, sendAttachments)
    const nextMessages: ChatMessage[] = [...messages, { role: 'user', content }]
    setMessages(nextMessages)
    setInput('')
    setAttachments([])
    await runChat(nextMessages, roundId, isFirstMessageOfRound)
  }

  // "Check back" — replay the last failed turn. Drops the failed reply (if the
  // model produced a friendly one) so the retry cleanly replaces it.
  function retryLast() {
    if (!lastAttempt || streaming) return
    const { messages: nextMessages, roundId, isFirstMessageOfRound } = lastAttempt
    setMessages(nextMessages)
    setSendError(null)
    runChat(nextMessages, roundId, isFirstMessageOfRound)
  }

  async function handleAttach(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      const result = await uploadFile(file, file.name)
      setAttachments((prev) => [...prev, result])
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Upload failed.')
    }
  }

  async function handleVoiceSubmit({ blob }: { blob: Blob; durationSec: number }) {
    const file = new File([blob], `voice-${Date.now()}.webm`, { type: blob.type || 'audio/webm' })
    const uploaded = await uploadFile(file)
    if (uploaded.kind === 'audio' && uploaded.transcript.trim()) {
      // Tone summary (Hume prosody) rides along visibly so Cross can coach
      // vocal delivery, not just content. Absent on the local-Whisper fallback.
      const toneSuffix = uploaded.tone?.prompt ? `\n\n[${uploaded.tone.prompt}]` : ''
      send(uploaded.transcript.trim() + toneSuffix)
    }
  }

  const showEmptyState = messages.length === 0
  const entries = memoryEntries(conversations)

  return (
    <div className="page-enter relative flex h-[calc(100vh-8rem)] min-h-[650px] overflow-hidden rounded-xl border border-border bg-card">
      {historyOpen && (
        <button
          aria-label="Close conversation history"
          onClick={() => setHistoryOpen(false)}
          className="fixed inset-0 z-30 bg-foreground/20 md:hidden"
        />
      )}
      <aside
        className={`absolute inset-y-0 left-0 z-40 flex w-72 shrink-0 flex-col border-r bg-background p-3 transition-transform duration-300 md:static md:z-auto md:w-64 md:translate-x-0 ${historyOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <button
          onClick={startNewConversation}
          className="press flex min-h-11 w-full items-center justify-start gap-2 rounded-xl bg-secondary px-4 text-sm font-semibold text-secondary-foreground"
        >
          <Plus className="size-4" />
          New chat
        </button>
        <nav aria-label="Conversation history" className="mt-6 flex flex-1 flex-col gap-1 overflow-y-auto">
          {conversations.length === 0 && (
            <p className="px-3 text-sm text-muted-foreground">No past rounds yet — they'll show up here once you start chatting.</p>
          )}
          {[...conversations]
            .sort((a, b) => b.updatedAt - a.updatedAt)
            .map((c) => (
              <div
                key={c.id}
                className={`group relative flex min-h-10 items-center rounded-xl text-sm transition ${
                  c.id === currentId ? 'bg-secondary font-medium' : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                }`}
              >
                <button onClick={() => loadConversation(c.id)} className="min-w-0 flex-1 truncate px-3 py-2 text-left">
                  <span className="truncate">{c.title}</span>
                </button>
                <button
                  onClick={() => handleDeleteConversation(c.id)}
                  aria-label={`Delete ${c.title || 'chat'}`}
                  className="mr-1 flex size-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground opacity-0 transition hover:bg-background hover:text-destructive focus:opacity-100 group-hover:opacity-100"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            ))}
        </nav>
        <div className="mt-2 flex flex-col gap-1 border-t border-border pt-2">
          <button
            onClick={() => setMemoryOpen(true)}
            className="press flex min-h-10 w-full items-center gap-2 rounded-xl px-3 text-left text-sm text-muted-foreground transition hover:bg-secondary hover:text-foreground"
          >
            <Brain className="size-4 shrink-0" />
            <span className="flex-1 truncate">Memory</span>
            {entries.length > 0 && <span className="font-data text-xs opacity-70">{entries.length}</span>}
          </button>
          <div className="flex items-center gap-2 rounded-xl px-3 py-2">
            <label className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
              <input
                type="checkbox"
                checked={mode === 'preround'}
                onChange={(e) => updateMode(e.target.checked ? 'preround' : 'general')}
                className="size-4"
              />
              Pre-Round mode
            </label>
          </div>
        </div>
      </aside>
      <section className="flex min-w-0 flex-1 flex-col bg-card">
        <header className="flex h-16 shrink-0 items-center justify-between border-b px-3 md:px-5">
          <div className="flex min-w-0 items-center gap-2">
            <button
              onClick={() => setHistoryOpen(true)}
              aria-label="Open conversation history"
              className="flex size-10 shrink-0 items-center justify-center rounded-xl transition hover:bg-secondary md:hidden"
            >
              <Menu className="size-5" />
            </button>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{conversations.find((c) => c.id === currentId)?.title || 'New round'}</p>
              <p className="truncate text-xs text-muted-foreground">CrossCoach · {mode === 'preround' ? 'Pre-Round' : 'General'}</p>
            </div>
          </div>
          <button
            aria-label="Start new chat"
            onClick={startNewConversation}
            className="flex size-10 items-center justify-center rounded-xl transition hover:bg-secondary md:hidden"
          >
            <Plus className="size-5" />
          </button>
        </header>
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6 md:px-8 md:py-10">
          <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
            {showEmptyState && (
              <div className="flex min-h-[18rem] flex-col items-center justify-center gap-7 py-6 text-center">
                <span className="flex size-12 items-center justify-center rounded-2xl bg-foreground text-card shadow-lg">
                  <Sparkles className="size-5" />
                </span>
                <div className="flex max-w-xl flex-col gap-2">
                  <h1 className="font-display text-balance text-2xl font-semibold tracking-tight md:text-3xl">
                    How can I help with your round?
                  </h1>
                </div>
              </div>
            )}
            {messages.map((m, i) => {
              const { text } = bubbleTextAndAttachments(m.content)
              return (
                <div key={i} className={`chat-message flex gap-3 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {m.role === 'assistant' && (
                    <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-xl bg-foreground text-card">
                      <Sparkles className="size-3.5" />
                    </span>
                  )}
                  {m.role === 'user' ? (
                    <div className="max-w-[85%] whitespace-pre-wrap rounded-3xl bg-secondary px-5 py-3.5 text-sm leading-6 md:max-w-[72%]">
                      {text}
                    </div>
                  ) : (
                    <div className="flex min-w-0 flex-col">
                      <div
                        className="max-w-2xl text-[15px] leading-7 text-foreground/90 [&_p]:mb-3 [&_ul]:list-disc [&_ul]:pl-5"
                        dangerouslySetInnerHTML={{ __html: renderMarkdown(text) }}
                      />
                      {i === messages.length - 1 && !streaming && (
                        <FeedbackPrompt key={`feedback-${i}`} route="chat" preview={text} />
                      )}
                    </div>
                  )}
                </div>
              )
            })}
            {sendError && !streaming && (
              <div className="chat-message flex justify-start" role="alert" aria-live="polite">
                <div className="flex w-full max-w-2xl flex-col gap-3 rounded-2xl border border-destructive/25 bg-destructive/5 px-4 py-3.5">
                  <div className="flex items-start gap-2.5">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
                    <div className="flex flex-col gap-1">
                      <p className="text-sm font-medium text-foreground">That message didn&apos;t go through</p>
                      <p className="text-sm leading-6 text-muted-foreground">{sendError.reason}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 pl-[26px]">
                    {sendError.retryable && (
                      <button
                        onClick={retryLast}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-foreground px-3 py-1.5 text-xs font-medium text-card transition hover:opacity-85"
                      >
                        <RotateCcw className="size-3.5" /> Try again
                      </button>
                    )}
                    <button
                      onClick={() => setSendError(null)}
                      className="rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:bg-secondary"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              </div>
            )}
            {streaming && (
              <div className="chat-message flex items-center gap-3">
                <span className="flex size-8 items-center justify-center rounded-xl bg-foreground text-card">
                  <Sparkles className="size-3.5" />
                </span>
                {assistantDraft ? (
                  <div
                    className="max-w-2xl text-[15px] leading-7 text-foreground/90 [&_p]:mb-3"
                    dangerouslySetInnerHTML={{ __html: renderMarkdown(assistantDraft) }}
                  />
                ) : (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>Thinking</span>
                    <span className="thinking-dots flex gap-1" aria-hidden="true">
                      <i />
                      <i />
                      <i />
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        <div className="shrink-0 bg-card px-3 pb-4 pt-2 md:px-8 md:pb-6">
          <div className="mx-auto max-w-3xl">
            {attachments.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-2">
                {attachments.map((att, i) => (
                  <span key={i} className="flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-xs text-muted-foreground">
                    {attachmentIcon(att.kind)} {'filename' in att ? att.filename : 'file'}
                    <button onClick={() => setAttachments((prev) => prev.filter((_, idx) => idx !== i))} aria-label="Remove attachment">
                      <X className="size-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="chat-composer rounded-xl border border-border bg-background p-2 transition-all">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault()
                    send(input)
                  }
                }}
                rows={2}
                placeholder="Message CrossCoach"
                aria-label="Message CrossCoach"
                className="max-h-36 w-full resize-none bg-transparent px-3 py-2.5 text-sm leading-6 outline-none placeholder:text-muted-foreground"
              />
              <div className="flex items-center justify-between gap-2 px-1">
                <div className="flex items-center gap-1">
                  <input ref={fileInputRef} type="file" hidden onChange={handleAttach} />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    aria-label="Attach context"
                    className="flex size-9 items-center justify-center rounded-full transition hover:bg-secondary"
                  >
                    <FileText className="size-4" />
                  </button>
                </div>
                <div className="flex items-center gap-1">
                  <VoiceRecorderButton onSubmit={handleVoiceSubmit} submitLabel="Send" />
                  <button
                    onClick={() => send(input)}
                    disabled={(!input.trim() && attachments.length === 0) || streaming}
                    aria-label="Send message"
                    className="flex size-9 items-center justify-center rounded-full bg-foreground text-card transition hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    <ArrowRight className="size-4" />
                  </button>
                </div>
              </div>
            </div>
            <p className="mt-2 text-center text-[10px] leading-relaxed text-muted-foreground">
              CrossCoach can make mistakes. Check important evidence against your sources.
            </p>
          </div>
        </div>
      </section>

      {memoryOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button aria-label="Close memory" onClick={() => setMemoryOpen(false)} className="absolute inset-0 bg-foreground/30" />
          <div className="relative z-10 flex max-h-[80vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-xl">
            <header className="flex items-center justify-between border-b px-5 py-4">
              <div className="flex items-center gap-2">
                <Brain className="size-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold">Cross-chat memory</h2>
              </div>
              <button
                onClick={() => setMemoryOpen(false)}
                aria-label="Close memory"
                className="flex size-8 items-center justify-center rounded-lg transition hover:bg-secondary"
              >
                <X className="size-4" />
              </button>
            </header>
            <p className="shrink-0 px-5 pt-3 text-xs leading-5 text-muted-foreground">
              What CrossCoach remembers from each round. It travels with every chat, so facts and decisions from one
              round are available in any other — open a chat, or forget a memory to leave it out.
            </p>
            <div className="flex-1 overflow-y-auto px-3 py-3">
              {entries.length === 0 ? (
                <p className="px-2 py-8 text-center text-sm text-muted-foreground">
                  No memory yet — it builds up as you chat through rounds.
                </p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {entries.map((e) => (
                    <li key={e.id} className="rounded-xl border border-border bg-secondary/40 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <button
                          onClick={() => {
                            setMemoryOpen(false)
                            loadConversation(e.id)
                          }}
                          className="min-w-0 flex-1 text-left"
                        >
                          <span className="block truncate text-sm font-medium hover:underline">{e.title}</span>
                        </button>
                        <button
                          onClick={() => handleForgetMemory(e.id)}
                          aria-label={`Forget memory of ${e.title}`}
                          className="shrink-0 rounded-md px-2 py-1 text-xs text-muted-foreground transition hover:bg-secondary hover:text-foreground"
                        >
                          Forget
                        </button>
                      </div>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">{e.summary}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {entries.length > 0 && (
              <footer className="flex shrink-0 items-center justify-between border-t px-5 py-3">
                <span className="text-xs text-muted-foreground">
                  {entries.length} {entries.length === 1 ? 'round' : 'rounds'} remembered
                </span>
                <button onClick={handleClearAllMemory} className="text-xs font-medium text-destructive transition hover:underline">
                  Clear all memory
                </button>
              </footer>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
