// Ported verbatim from public/app.js. Tabroom paradigms are often one
// unbroken block of text with no line breaks at all — split on real breaks
// / "---" dividers where present, otherwise chunk by sentence groups so the
// reader isn't handed a single wall of text.

// Splits on ./!/?/: so a short label-like lead-in ("Judging philosophy:")
// doesn't glue onto the sentence that follows it — a colon-terminated
// fragment is a heading, not part of the next sentence.
function splitFragments(block: string): string[] {
  return (block.match(/[^.!?:]+[.!?:]+(?:\s+|$)|[^.!?:]+$/g) || [block]).map((s) => s.trim()).filter(Boolean)
}

// Real, quotable sentences only — drops colon-terminated heading fragments.
function splitSentences(text: string): string[] {
  return splitFragments(text).filter((s) => /[.!?]$/.test(s))
}

export function paradigmToParagraphs(text: string | null | undefined): string[] {
  const raw = String(text || '').trim()
  if (!raw) return []
  const blocks = raw
    .split(/\n\s*\n|\s+---+\s+/)
    .map((b) => b.trim())
    .filter(Boolean)
  const paragraphs: string[] = []
  blocks.forEach((block) => {
    if (/\n/.test(block)) {
      block
        .split(/\n+/)
        .map((l) => l.trim())
        .filter(Boolean)
        .forEach((l) => paragraphs.push(l))
      return
    }
    const fragments = splitFragments(block)
    const perParagraph = 3
    for (let i = 0; i < fragments.length; i += perParagraph) {
      const chunk = fragments.slice(i, i + perParagraph).join(' ').trim()
      if (chunk) paragraphs.push(chunk)
    }
  })
  return paragraphs
}

export function initials(name: string | null | undefined): string {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase()
}

export function extractEmails(text: string | null | undefined): string[] {
  const matches = String(text || '').match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi) || []
  return [...new Set(matches)]
}

// One strong pull-quote — a sentence that signals a real preference/weighing/
// speed/theory stance, so the reader gets the gist before the full paragraphs.
const PULL_QUOTE_SIGNALS = [
  'speed', 'spread', 'clarity', 'theory', 'topicality', 'framework', 'weigh',
  'impact', 'offense', 'tabula rasa', 'tech over truth', 'truth over tech',
  'flow', 'line-by-line', 'line by line', 'voter', 'ballot', 'drop the argument',
  'k debate', 'critical', 'condo', 'disclosure', 'evidence', 'card',
]

// Non-AI fallback for the "interpretation" block when /api/judge/interpret
// fails or is unavailable — plain keyword matching, labeled as a heuristic
// (never presented as an AI read) so the UI stays honest about its source.
const HEURISTIC_TAGS: { pattern: RegExp; tag: string }[] = [
  { pattern: /\bspread(ing)?\b|\bspeed\b/i, tag: 'Comfortable with speed' },
  { pattern: /\btabula rasa\b/i, tag: 'Tabula rasa' },
  { pattern: /\bpolicy\s?maker\b/i, tag: 'Policymaker' },
  { pattern: /\bcritical\b|\bk debate\b|\bkritik/i, tag: 'Open to K debate' },
  { pattern: /\btopicality\b|\btheory\b/i, tag: 'Theory-friendly' },
  { pattern: /dislikes?\s+theory|no\s+theory/i, tag: 'Dislikes theory' },
  { pattern: /line[- ]by[- ]line/i, tag: 'Line-by-line' },
  { pattern: /\bevidence\b|\bcards?\b/i, tag: 'Evidence quality' },
  { pattern: /truth\s+over\s+tech/i, tag: 'Truth over tech' },
  { pattern: /tech\s+over\s+truth/i, tag: 'Tech over truth' },
  { pattern: /\bweigh(ing)?\b|\bimpact calculus\b/i, tag: 'Values weighing' },
]

export function heuristicJudgeInterpretation(text: string | null | undefined): { summary: string; tags: string[] } {
  const raw = String(text || '').trim()
  const tags = HEURISTIC_TAGS.filter(({ pattern }) => pattern.test(raw)).map(({ tag }) => tag).slice(0, 6)
  const firstSentence = splitSentences(raw)[0]?.slice(0, 200) || raw.slice(0, 200)
  return { summary: firstSentence, tags }
}

// `exclude` skips a sentence already shown elsewhere (e.g. the interpretation
// summary) so the quote doesn't just repeat it.
export function extractPullQuote(text: string | null | undefined, exclude?: string | null): string | null {
  const raw = String(text || '').trim()
  if (!raw) return null
  const sentences = splitSentences(raw).filter((s) => s.length >= 40 && s.length <= 220 && s !== exclude)
  if (sentences.length === 0) return null

  let best: { sentence: string; score: number } | null = null
  for (const sentence of sentences) {
    const lower = sentence.toLowerCase()
    const score = PULL_QUOTE_SIGNALS.reduce((n, signal) => (lower.includes(signal) ? n + 1 : n), 0)
    if (score > 0 && (!best || score > best.score)) best = { sentence, score }
  }
  return best?.sentence ?? null
}
