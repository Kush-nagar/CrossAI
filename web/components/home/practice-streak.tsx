import { Check, Zap } from 'lucide-react'
import type { DeliverySnapshot } from '@/lib/api'

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
}

function startOfDay(d: Date): Date {
  const copy = new Date(d)
  copy.setHours(0, 0, 0, 0)
  return copy
}

function computeStreaks(days: Set<string>, today: Date) {
  const sorted = [...days].map((k) => {
    const [y, m, d] = k.split('-').map(Number)
    return new Date(y, m - 1, d).getTime()
  }).sort((a, b) => a - b)

  let best = 0
  let run = 0
  let prev: number | null = null
  const DAY_MS = 86400000
  for (const t of sorted) {
    run = prev != null && t - prev === DAY_MS ? run + 1 : 1
    best = Math.max(best, run)
    prev = t
  }

  // Current streak: walk back from today; if today isn't practiced yet,
  // start from yesterday so an unpracticed-so-far today doesn't zero it out.
  let cursor = startOfDay(today)
  if (!days.has(dayKey(cursor))) cursor = new Date(cursor.getTime() - DAY_MS)
  let current = 0
  while (days.has(dayKey(cursor))) {
    current += 1
    cursor = new Date(cursor.getTime() - DAY_MS)
  }
  return { current, best }
}

export function PracticeStreak({ snapshots }: { snapshots: DeliverySnapshot[] }) {
  const today = new Date()
  const practicedDays = new Set(snapshots.map((s) => dayKey(new Date(s.date))))
  const { current, best } = computeStreaks(practicedDays, today)

  // Monday-start week, fixed regardless of locale — Cross's audience is
  // school debate teams that think in Mon-Sun tournament/practice weeks.
  const todayStart = startOfDay(today)
  const mondayOffset = (todayStart.getDay() + 6) % 7
  const monday = new Date(todayStart.getTime() - mondayOffset * 86400000)

  const week = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(monday.getTime() + i * 86400000)
    return {
      label: date.toLocaleDateString(undefined, { weekday: 'narrow' }),
      practiced: practicedDays.has(dayKey(date)),
      isToday: dayKey(date) === dayKey(today),
      isFuture: date.getTime() > todayStart.getTime(),
    }
  })

  return (
    <section className="surface flex flex-col rounded-xl p-6 md:p-7">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-display text-xl font-semibold">Practice streak</h3>
          <p className="text-xs text-muted-foreground">Your best: {best} day{best === 1 ? '' : 's'}</p>
        </div>
        <p className="font-data text-4xl font-semibold">{current}</p>
      </div>
      <div className="mt-6 flex flex-1 items-end justify-between gap-2">
        {week.map((day, i) => (
          <div key={i} className="flex flex-col items-center gap-2">
            <span
              className={`flex size-9 items-center justify-center rounded-full ${
                day.practiced
                  ? 'bg-foreground text-card'
                  : day.isToday
                    ? 'border-2 border-pen text-pen'
                    : day.isFuture
                      ? 'border border-dashed border-border text-muted-foreground opacity-50'
                      : 'border border-border text-muted-foreground'
              }`}
            >
              {day.practiced ? <Check className="size-4" /> : day.isToday ? <Zap className="size-4" /> : null}
            </span>
            <span className={`font-data text-[10px] uppercase text-muted-foreground ${day.isFuture ? 'opacity-50' : ''}`}>{day.label}</span>
          </div>
        ))}
      </div>
    </section>
  )
}
