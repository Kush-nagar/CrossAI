'use client'

// Ported from public/app.js's topic combobox (drillTopicMatches/renderDrillTopicList/
// moveDrillTopicActive) — keyword filter over the real per-format topic bank,
// keyboard nav, free-text fallback (an unmatched topic is still sent verbatim).

import { useState } from 'react'
import { drillTopicMatches } from '@/lib/drill-topics'

export function TopicCombobox({
  format,
  value,
  onChange,
  disabled,
}: {
  format: string
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const matches = drillTopicMatches(value.trim(), format)

  function choose(text: string) {
    onChange(text)
    setOpen(false)
    setActiveIndex(-1)
  }

  return (
    <div className="relative">
      <input
        value={value}
        disabled={disabled}
        onChange={(e) => {
          onChange(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={(e) => {
          if (!open) return
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            setActiveIndex((i) => (matches.length ? (i + 1) % matches.length : -1))
          } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setActiveIndex((i) => (matches.length ? (i - 1 + matches.length) % matches.length : -1))
          } else if (e.key === 'Enter' && activeIndex >= 0 && matches[activeIndex]) {
            e.preventDefault()
            choose(matches[activeIndex].text)
          } else if (e.key === 'Escape') {
            setOpen(false)
          }
        }}
        placeholder={disabled ? 'Choose an event to browse its topics' : 'Leave blank for a surprise, or type keywords to pick a topic'}
        className="w-full rounded-xl border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-pen disabled:opacity-50"
      />
      {open && !disabled && (
        <div className="surface absolute z-10 mt-1 max-h-64 w-full overflow-y-auto rounded-2xl p-1">
          {matches.length === 0 && (
            <p className="px-3 py-2 text-xs text-muted-foreground">No past topics match: your text will be used as a custom topic.</p>
          )}
          {matches.map((topic, i) => (
            <button
              key={topic.text}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => choose(topic.text)}
              className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-sm ${
                i === activeIndex ? 'bg-primary text-primary-foreground' : 'hover:bg-secondary'
              }`}
            >
              <span className="truncate">{topic.text}</span>
              <span className="shrink-0 text-xs opacity-70">{topic.when ? `${topic.season} · ${topic.when}` : topic.season}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
