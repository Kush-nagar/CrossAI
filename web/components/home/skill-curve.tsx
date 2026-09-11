'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { InkButton } from '@/components/ui/primitives'
import type { DeliverySnapshot } from '@/lib/api'

const WINDOW = 7

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [width, setWidth] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver((entries) => setWidth(entries[0].contentRect.width))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, width] as const
}

export function SkillCurve({ snapshots }: { snapshots: DeliverySnapshot[] }) {
  const [wrapRef, width] = useWidth<HTMLDivElement>()
  const takes = snapshots.filter((s) => s.score != null).slice(-WINDOW)

  if (takes.length === 0) {
    // Recording Insight (real round feedback) logs practice with no score to
    // plot — this chart is drill-only. Say so instead of implying no
    // practice has happened at all when snapshots exist from that route.
    const practicedElsewhere = snapshots.length > 0
    return (
      <section className="surface flex flex-col items-start gap-3 rounded-xl p-6 md:p-7">
        <div>
          <h3 className="font-display text-xl font-semibold">Skill curve</h3>
          <p className="text-xs text-muted-foreground">Last {WINDOW} sessions</p>
        </div>
        <p className="max-w-sm text-sm text-muted-foreground">
          {practicedElsewhere
            ? "You've logged practice through round feedback, but nothing's been graded yet. A scored drill will start this chart."
            : 'No graded speeches yet: record a spoken drill and Cross will chart your score over time here.'}
        </p>
        <Link href="/drill">
          <InkButton>Record a drill</InkButton>
        </Link>
      </section>
    )
  }

  const values = takes.map((t) => Math.round((t.score ?? 0) * 100))
  const height = 170
  const pad = { l: 8, r: 8, t: 14, b: 22 }
  const innerW = Math.max(width - pad.l - pad.r, 1)
  const innerH = height - pad.t - pad.b
  const n = values.length
  const lo = Math.max(0, Math.min(...values) - 8)
  const hi = Math.min(100, Math.max(...values) + 8)
  const x = (i: number) => (n > 1 ? pad.l + (i * innerW) / (n - 1) : pad.l + innerW / 2)
  const y = (v: number) => pad.t + (1 - (v - lo) / Math.max(hi - lo, 1)) * innerH
  const linePath = values.map((v, i) => `${i ? 'L' : 'M'}${x(i)},${y(v)}`).join(' ')
  const areaPath = n > 1 ? `${linePath} L${x(n - 1)},${pad.t + innerH} L${x(0)},${pad.t + innerH} Z` : ''

  const delta = n >= 2 ? values[n - 1] - values[0] : null

  return (
    <section className="surface flex flex-col rounded-xl p-6 md:p-7">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-display text-xl font-semibold">Skill curve</h3>
          <p className="text-xs text-muted-foreground">Last {takes.length} session{takes.length === 1 ? '' : 's'}</p>
        </div>
        {delta != null && (
          <span className="font-data rounded-sm border border-pen/40 px-2.5 py-1 text-xs font-semibold text-pen">
            {delta >= 0 ? '+' : ''}
            {delta}%
          </span>
        )}
      </div>
      <div ref={wrapRef} className="mt-2 flex-1">
        <svg width="100%" height={height} role="img" aria-label={`Speech score across your last ${n} graded takes`}>
          {n > 1 && <path d={areaPath} fill="var(--pen)" fillOpacity="0.08" />}
          <path d={linePath} fill="none" stroke="var(--pen)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
          {values.map((v, i) => (
            <circle key={i} cx={x(i)} cy={y(v)} r="3.5" fill="var(--pen)" stroke="var(--card)" strokeWidth="1.5" />
          ))}
          {takes.map((t, i) => (
            <text key={i} x={x(i)} y={height - 6} textAnchor="middle" fontSize="10" fill="var(--muted-foreground)">
              {new Date(t.date).toLocaleDateString(undefined, { weekday: 'narrow' })}
            </text>
          ))}
        </svg>
      </div>
    </section>
  )
}
