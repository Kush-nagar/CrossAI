// Ported verbatim from public/app.js's drill setup/randomizer/ledger logic.

import { DRILL_TOPICS, type DrillTopic } from './drill-topics-data.ts'

export { DRILL_TOPICS }
export type { DrillTopic }

export type DrillFormatConfig = { sides: string[]; speeches: string[]; defaultSpeech: string }

// The drill is Public Forum only. Sides are Pro/Con; the practice speeches are
// the three back-half speeches worth drilling (Constructive is pre-written, so
// it isn't a drill target). The default is Summary — PF's classic pressure
// speech, where the round is won or lost on collapse and weighing.
export const PF_FORMAT = 'Public Forum'

export const DRILL_FORMATS: Record<string, DrillFormatConfig> = {
  'Public Forum': { sides: ['Pro', 'Con'], speeches: ['Rebuttal', 'Summary', 'Final Focus'], defaultSpeech: 'Summary' },
}

// Every whitespace-separated keyword must appear somewhere in the topic
// (case-insensitive). A topic that matches nothing still works — it's sent
// verbatim as a custom topic.
export function drillTopicMatches(query: string, format: string): DrillTopic[] {
  const keywords = query.toLowerCase().split(/\s+/).filter(Boolean)
  const bank = DRILL_TOPICS[format] || []
  if (keywords.length === 0) return bank
  return bank.filter((topic) => {
    const haystack = `${topic.text} ${topic.season} ${topic.when || ''}`.toLowerCase()
    return keywords.every((kw) => haystack.includes(kw))
  })
}

export function randomFrom<T>(list: readonly T[]): T {
  return list[Math.floor(Math.random() * list.length)]
}

export function formatPct(probability: number): string {
  return `${Math.round(probability * 100)}%`
}

export function formatAdjustment(value: number): string {
  const n = Number(value) || 0
  return `${n >= 0 ? '+' : '−'}${Math.abs(n).toFixed(1)}`
}
