'use client'

// Delivery trends panel: charts the tone-over-time snapshots that graded
// spoken drills record server-side (GET /api/drill/delivery-history).
// Two single-series line charts — pace and score live on different scales,
// so they get separate plots sharing one crosshair, never a dual axis.
// A table view keeps every value reachable without hovering.

import { useEffect, useMemo, useRef, useState } from 'react'
import { Pill } from '@/components/ui/primitives'
import { getDeliveryHistory, type DeliverySnapshot } from '@/lib/api'

type Take = {
  date: Date
  wpm: number | null
  durationSec: number | null
  scorePct: number | null
  tone: string | null
}

type Hover = { idx: number; chart: string } | null

const MAX_TAKES = 30
const WPM_CEILING = 200 // grader treats ~200 WPM as the comprehensibility ceiling

function fmtDate(d: Date) {
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

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

function TrendChart({
  id,
  title,
  takes,
  values,
  yDomain,
  yTicks,
  refLine,
  hover,
  onHover,
}: {
  id: string
  title: string
  takes: Take[]
  values: (number | null)[]
  yDomain: [number, number]
  yTicks: number[]
  refLine?: { value: number; label: string }
  hover: Hover
  onHover: (h: Hover) => void
}) {
  const [wrapRef, width] = useWidth<HTMLDivElement>()
  const height = 128
  const pad = { l: 36, r: 14, t: 12, b: 20 }
  const innerW = Math.max(width - pad.l - pad.r, 1)
  const innerH = height - pad.t - pad.b
  const n = takes.length
  const x = (i: number) => (n > 1 ? pad.l + (i * innerW) / (n - 1) : pad.l + innerW / 2)
  const y = (v: number) => pad.t + (1 - (v - yDomain[0]) / (yDomain[1] - yDomain[0])) * innerH

  // Split the line at nulls so missing takes leave a gap instead of a lie.
  const segments: { idxs: number[] }[] = []
  let run: number[] = []
  values.forEach((v, i) => {
    if (v == null) {
      if (run.length) segments.push({ idxs: run })
      run = []
    } else run.push(i)
  })
  if (run.length) segments.push({ idxs: run })

  const linePath = (idxs: number[]) => idxs.map((i, k) => `${k ? 'L' : 'M'}${x(i)},${y(values[i]!)}`).join(' ')
  const areaPath = (idxs: number[]) =>
    idxs.length > 1
      ? `${linePath(idxs)} L${x(idxs[idxs.length - 1])},${pad.t + innerH} L${x(idxs[0])},${pad.t + innerH} Z`
      : ''

  function hoverFromPointer(e: React.PointerEvent<SVGSVGElement>) {
    const px = e.nativeEvent.offsetX
    const idx = n > 1 ? Math.round(((px - pad.l) / innerW) * (n - 1)) : 0
    onHover({ idx: Math.max(0, Math.min(n - 1, idx)), chart: id })
  }
  function hoverFromKey(e: React.KeyboardEvent<SVGSVGElement>) {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
    e.preventDefault()
    const cur = hover?.idx ?? n - 1
    const next = Math.max(0, Math.min(n - 1, cur + (e.key === 'ArrowRight' ? 1 : -1)))
    onHover({ idx: next, chart: id })
  }

  const hovered = hover ? takes[hover.idx] : null
  const lastIdx = segments.length ? segments[segments.length - 1].idxs.at(-1)! : null
  const tooltipX = hover ? Math.max(60, Math.min(width - 60, x(hover.idx))) : 0

  return (
    <div>
      <p className="text-xs font-semibold text-muted-foreground">{title}</p>
      <div ref={wrapRef} className="relative mt-1">
        <svg
          width="100%"
          height={height}
          role="img"
          aria-label={`${title} across your last ${n} graded takes`}
          tabIndex={0}
          className="block outline-none focus-visible:rounded-lg focus-visible:ring-2 focus-visible:ring-ring/50"
          onPointerMove={hoverFromPointer}
          onPointerLeave={() => onHover(null)}
          onFocus={() => onHover({ idx: n - 1, chart: id })}
          onBlur={() => onHover(null)}
          onKeyDown={hoverFromKey}
        >
          {yTicks.map((t) => (
            <g key={t}>
              <line x1={pad.l} x2={width - pad.r} y1={y(t)} y2={y(t)} stroke="var(--border)" strokeWidth="1" />
              <text x={pad.l - 6} y={y(t) + 3} textAnchor="end" fontSize="10" fill="var(--muted-foreground)">
                {t}
              </text>
            </g>
          ))}
          {refLine && refLine.value >= yDomain[0] && refLine.value <= yDomain[1] && (
            <g>
              <line
                x1={pad.l}
                x2={width - pad.r}
                y1={y(refLine.value)}
                y2={y(refLine.value)}
                stroke="var(--destructive)"
                strokeOpacity="0.35"
                strokeWidth="1"
              />
              <text x={width - pad.r} y={y(refLine.value) - 4} textAnchor="end" fontSize="9" fill="var(--muted-foreground)">
                {refLine.label}
              </text>
            </g>
          )}
          {segments.map(({ idxs }, s) => (
            <g key={s}>
              {idxs.length > 1 && <path d={areaPath(idxs)} fill="var(--primary)" fillOpacity="0.1" />}
              <path d={linePath(idxs)} fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
            </g>
          ))}
          {hover && (
            <line x1={x(hover.idx)} x2={x(hover.idx)} y1={pad.t} y2={pad.t + innerH} stroke="var(--border)" strokeWidth="1" />
          )}
          {[...new Set([hover?.idx, lastIdx])]
            .filter((i): i is number => i != null && values[i] != null)
            .map((i) => (
              <circle key={i} cx={x(i)} cy={y(values[i]!)} r="4.5" fill="var(--primary)" stroke="var(--card)" strokeWidth="2" />
            ))}
          <text x={pad.l} y={height - 5} fontSize="10" fill="var(--muted-foreground)">
            {fmtDate(takes[0].date)}
          </text>
          {n > 1 && (
            <text x={width - pad.r} y={height - 5} textAnchor="end" fontSize="10" fill="var(--muted-foreground)">
              {fmtDate(takes[n - 1].date)}
            </text>
          )}
        </svg>
        {hover && hover.chart === id && hovered && (
          <div
            className="pointer-events-none absolute top-0 z-10 w-max -translate-x-1/2 rounded-lg border bg-card px-3 py-2 text-xs shadow-md"
            style={{ left: tooltipX }}
          >
            <p className="font-semibold">{fmtDate(hovered.date)}</p>
            <p className="mt-0.5 text-muted-foreground">
              Pace <b className="text-foreground">{hovered.wpm != null ? `${hovered.wpm} WPM` : '—'}</b>
              {' · '}Score <b className="text-foreground">{hovered.scorePct != null ? `${hovered.scorePct}%` : '—'}</b>
            </p>
            {hovered.tone && (
              <p className="text-muted-foreground">
                Tone <b className="text-foreground">{hovered.tone}</b>
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export function DeliveryTrends({ className = '' }: { className?: string }) {
  const [snapshots, setSnapshots] = useState<DeliverySnapshot[] | null>(null)
  const [hover, setHover] = useState<Hover>(null)
  const [view, setView] = useState<'chart' | 'table'>('chart')

  useEffect(() => {
    let alive = true
    getDeliveryHistory()
      .then((d) => alive && setSnapshots(d.snapshots))
      .catch(() => alive && setSnapshots([]))
    return () => {
      alive = false
    }
  }, [])

  const takes = useMemo<Take[]>(
    () =>
      (snapshots ?? []).slice(-MAX_TAKES).map((s) => ({
        date: new Date(s.date),
        wpm: Number.isFinite(s.wpm) ? s.wpm : null,
        durationSec: Number.isFinite(s.durationSec) ? s.durationSec : null,
        scorePct: s.score != null && Number.isFinite(s.score) ? Math.round(s.score * 100) : null,
        tone: s.top?.[0]?.name ?? null,
      })),
    [snapshots],
  )

  // Mean top emotions across the last 5 takes that have tone data.
  const recentTone = useMemo(() => {
    const withTone = (snapshots ?? []).filter((s) => s.top?.length).slice(-5)
    const sums = new Map<string, number>()
    for (const s of withTone) for (const { name, score } of s.top!) sums.set(name, (sums.get(name) ?? 0) + score)
    return [...sums.entries()]
      .map(([name, sum]) => ({ name, score: sum / withTone.length }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
  }, [snapshots])

  if (!snapshots || takes.length === 0) return null

  const wpmValues = takes.map((t) => t.wpm)
  const scoreValues = takes.map((t) => t.scorePct)
  const wpms = wpmValues.filter((v): v is number => v != null)
  const wpmLo = wpms.length ? Math.max(0, Math.floor((Math.min(...wpms, WPM_CEILING) - 15) / 25) * 25) : 0
  const wpmHi = wpms.length ? Math.ceil((Math.max(...wpms, WPM_CEILING) + 15) / 25) * 25 : 250
  const wpmMid = Math.round((wpmLo + wpmHi) / 2 / 5) * 5

  const latest = takes[takes.length - 1]
  const prev = takes.length > 1 ? takes[takes.length - 2] : null
  const delta = (cur: number | null, before: number | null, unit: string) =>
    cur != null && before != null && cur !== before ? `${cur > before ? '+' : ''}${cur - before}${unit} vs previous` : null

  return (
    <section className={`surface rounded-3xl p-6 md:p-8 ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h3 className="font-display text-xl font-semibold">Delivery trends</h3>
          <Pill tone="pen">
            {takes.length} take{takes.length === 1 ? '' : 's'}
          </Pill>
        </div>
        <button
          type="button"
          onClick={() => setView(view === 'chart' ? 'table' : 'chart')}
          className="press rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-muted-foreground"
        >
          {view === 'chart' ? 'View as table' : 'View as charts'}
        </button>
      </div>

      <div className="mt-4 flex flex-wrap gap-x-8 gap-y-2">
        <div>
          <p className="text-xs font-semibold text-muted-foreground">Latest pace</p>
          <p className="font-data text-lg font-semibold">{latest.wpm != null ? `${latest.wpm} WPM` : '—'}</p>
          {prev && delta(latest.wpm, prev.wpm, ' WPM') && (
            <p className="text-xs text-muted-foreground">{delta(latest.wpm, prev.wpm, ' WPM')}</p>
          )}
        </div>
        <div>
          <p className="text-xs font-semibold text-muted-foreground">Latest score</p>
          <p className="font-data text-lg font-semibold">{latest.scorePct != null ? `${latest.scorePct}%` : '—'}</p>
          {prev && delta(latest.scorePct, prev.scorePct, '%') && (
            <p className="text-xs text-muted-foreground">{delta(latest.scorePct, prev.scorePct, '%')}</p>
          )}
        </div>
        {recentTone.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground">Recent measured tone</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {recentTone.map((t) => (
                <Pill key={t.name}>{t.name}</Pill>
              ))}
            </div>
          </div>
        )}
      </div>

      {view === 'chart' ? (
        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <TrendChart
            id="wpm"
            title="Pace (WPM)"
            takes={takes}
            values={wpmValues}
            yDomain={[wpmLo, wpmHi]}
            yTicks={[wpmLo, wpmMid, wpmHi]}
            refLine={{ value: WPM_CEILING, label: `${WPM_CEILING} WPM ceiling` }}
            hover={hover}
            onHover={setHover}
          />
          <TrendChart
            id="score"
            title="Speech score (%)"
            takes={takes}
            values={scoreValues}
            yDomain={[0, 100]}
            yTicks={[0, 50, 100]}
            hover={hover}
            onHover={setHover}
          />
        </div>
      ) : (
        <div className="mt-5 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground">
                <th className="py-1.5 pr-4 font-semibold">Date</th>
                <th className="py-1.5 pr-4 font-semibold">Pace</th>
                <th className="py-1.5 pr-4 font-semibold">Length</th>
                <th className="py-1.5 pr-4 font-semibold">Score</th>
                <th className="py-1.5 font-semibold">Dominant tone</th>
              </tr>
            </thead>
            <tbody>
              {[...takes].reverse().map((t, i) => (
                <tr key={i} className="border-t">
                  <td className="py-1.5 pr-4">{fmtDate(t.date)}</td>
                  <td className="py-1.5 pr-4 tabular-nums">{t.wpm != null ? `${t.wpm} WPM` : '—'}</td>
                  <td className="py-1.5 pr-4 tabular-nums">{t.durationSec != null ? `${t.durationSec}s` : '—'}</td>
                  <td className="py-1.5 pr-4 tabular-nums">{t.scorePct != null ? `${t.scorePct}%` : '—'}</td>
                  <td className="py-1.5 text-muted-foreground">{t.tone ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
