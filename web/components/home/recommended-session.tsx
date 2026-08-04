import Link from 'next/link'
import { ArrowRight, Zap } from 'lucide-react'
import { InkButton, Pill } from '@/components/ui/primitives'
import type { DeliverySnapshot, VoiceProfileStatus } from '@/lib/api'

function Ring({ percent, value, label, sub }: { percent: number; value: string; label: string; sub: string }) {
  const r = 30
  const c = 2 * Math.PI * r
  const offset = c * (1 - Math.max(0, Math.min(100, percent)) / 100)
  return (
    <div className="surface flex shrink-0 items-center gap-4 rounded-xl p-4">
      <div className="relative flex size-[72px] shrink-0 items-center justify-center">
        <svg width="72" height="72" viewBox="0 0 72 72" className="-rotate-90">
          <circle cx="36" cy="36" r={r} fill="none" stroke="var(--border)" strokeWidth="5" />
          <circle
            cx="36"
            cy="36"
            r={r}
            fill="none"
            stroke="var(--pen)"
            strokeWidth="5"
            strokeDasharray={c}
            strokeDashoffset={offset}
            strokeLinecap="round"
          />
        </svg>
        <span className="font-data absolute text-lg font-semibold">{value}</span>
      </div>
      <div>
        <p className="text-sm font-semibold">{label}</p>
        <p className="text-xs text-muted-foreground">{sub}</p>
      </div>
    </div>
  )
}

export function RecommendedSession({
  snapshots,
  calibration,
}: {
  snapshots: DeliverySnapshot[]
  calibration: VoiceProfileStatus | null
}) {
  const scored = snapshots.filter((s) => s.score != null)

  let eyebrowMinutes = '15 min'
  let title = 'Record your first speech.'
  let body = "Cross grades your transcript automatically — once there's a baseline, we'll point you at what to fix next."
  let cta = 'Start a drill'
  let href = '/drill'
  let ring: React.ReactNode = null

  if (scored.length === 0) {
    // defaults above already cover this case
  } else if (calibration && !calibration.calibrated) {
    title = 'Calibrate your voice.'
    body = `Cross grades delivery more accurately once it knows your baseline pace and phrasing — ${calibration.sampleCount} of ${calibration.total} takes recorded so far.`
    cta = 'Continue calibration'
    href = '/settings'
    eyebrowMinutes = 'Quick'
    ring = (
      <Ring
        percent={(calibration.sampleCount / Math.max(calibration.total, 1)) * 100}
        value={`${calibration.sampleCount}/${calibration.total}`}
        label="Voice calibration"
        sub="Takes recorded"
      />
    )
  } else {
    const latest = scored[scored.length - 1]
    const priorWindow = scored.slice(Math.max(0, scored.length - 6), scored.length - 1)
    const priorAvg = priorWindow.length
      ? priorWindow.reduce((sum, s) => sum + (s.score ?? 0), 0) / priorWindow.length
      : latest.score!
    const latestPct = Math.round((latest.score ?? 0) * 100)
    const deltaPct = Math.round(latestPct - priorAvg * 100)

    if (priorWindow.length === 0 || deltaPct >= 0) {
      title = 'Keep building on your last round.'
      body = `Your last graded speech scored ${latestPct}% — another drill locks that in before it slips.`
    } else {
      title = 'Close the gap from your last round.'
      body = `Your last graded speech scored ${latestPct}%, down ${Math.abs(deltaPct)} points versus your recent average — a targeted drill can correct course.`
    }
    cta = 'Start a drill'
    href = '/drill'
    ring = (
      <Ring
        percent={latestPct}
        value={`${latestPct}`}
        label="Speech score"
        sub={priorWindow.length ? `${deltaPct >= 0 ? 'Up' : 'Down'} ${Math.abs(deltaPct)} pts vs recent avg` : 'First graded take'}
      />
    )
  }

  return (
    <section className="surface paper-grain relative overflow-hidden rounded-xl p-6 md:p-9">
      <div className="absolute left-0 top-0 h-full w-1 bg-pen" />
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex max-w-xl flex-col gap-4">
          <div className="flex items-center gap-2">
            <Pill tone="pen">
              <Zap className="size-3" /> Recommended session
            </Pill>
            <span className="text-xs text-muted-foreground">{eyebrowMinutes}</span>
          </div>
          <h2 className="font-display text-balance text-2xl font-semibold md:text-4xl">{title}</h2>
          <p className="leading-relaxed text-muted-foreground">{body}</p>
          <Link href={href}>
            <InkButton>
              {cta} <ArrowRight className="size-4" />
            </InkButton>
          </Link>
        </div>
        {ring}
      </div>
    </section>
  )
}
