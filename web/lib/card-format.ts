// Card text → on-screen segments and clipboard formats.
//
// A card body is plain text with highlighted (read-aloud) runs wrapped in
// <mark>…</mark>, one paragraph per line. Nothing else in it is markup, so it
// is parsed into segments here and rendered as React text — never injected
// as HTML — and escaped when building the clipboard copy.

import type { CardDetail } from '@/lib/api'

export type Segment = { text: string; marked: boolean }

/** Paragraphs of segments; marked = highlighted in the original doc. */
export function cardParagraphs(body: string): Segment[][] {
  const paras: Segment[][] = []
  let marked = false
  for (const line of body.split('\n')) {
    const segs: Segment[] = []
    for (const part of line.split(/(<\/?mark>)/)) {
      if (part === '<mark>') marked = true
      else if (part === '</mark>') marked = false
      else if (part) segs.push({ text: part, marked })
    }
    if (segs.some((s) => s.text.trim())) paras.push(segs)
  }
  return paras
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const FONT = "font-family:Calibri,'Times New Roman',serif;"

/**
 * Verbatim-style rich text: bold 13pt tag, cite with the author/year bold,
 * read text underlined + highlighted at 11pt, unread text shrunk to 8pt
 * (or kept 11pt when shrink is off). Pastes cleanly into Word and Google Docs.
 */
export function cardToHtml(card: CardDetail, { shrink = true }: { shrink?: boolean } = {}): string {
  const short = card.cite
  const rest = card.fullCite.startsWith(short) ? card.fullCite.slice(short.length) : ` ${card.fullCite}`
  const unread = shrink ? 'font-size:8pt;' : 'font-size:11pt;'
  const paras = cardParagraphs(card.body)
    .map(
      (segs) =>
        `<p style="${FONT}margin:0 0 6pt 0;">${segs
          .map((s) =>
            s.marked
              ? `<span style="font-size:11pt;font-weight:bold;text-decoration:underline;background-color:#ffff00;">${esc(s.text)}</span>`
              : `<span style="${unread}">${esc(s.text)}</span>`,
          )
          .join('')}</p>`,
    )
    .join('')
  return (
    `<p style="${FONT}font-size:13pt;font-weight:bold;margin:0 0 2pt 0;">${esc(card.tag)}</p>` +
    `<p style="${FONT}font-size:11pt;margin:0 0 6pt 0;"><b style="font-size:13pt;">${esc(short)}</b>${esc(rest)}</p>` +
    paras
  )
}

export function cardToPlain(card: CardDetail): string {
  const body = cardParagraphs(card.body)
    .map((segs) => segs.map((s) => s.text).join(''))
    .join('\n')
  return `${card.tag}\n${card.fullCite}\n${body}`
}

/** Just the highlighted (read-aloud) words, joined — what gets spoken. */
export function cardReadText(card: CardDetail): string {
  return cardParagraphs(card.body)
    .flatMap((segs) => segs.filter((s) => s.marked).map((s) => s.text))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Writes rich HTML + plain text to the clipboard, falling back to plain. */
export async function copyRich(html: string, plain: string): Promise<void> {
  try {
    if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html': new Blob([html], { type: 'text/html' }),
          'text/plain': new Blob([plain], { type: 'text/plain' }),
        }),
      ])
      return
    }
  } catch {
    // fall through to plain text
  }
  await navigator.clipboard.writeText(plain)
}
