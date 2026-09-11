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
  const sorted = [...days]
    .map((k) => {
      const [y, m, d] = k.split('-').map(Number)
      return new Date(y, m - 1, d).getTime()
    })
    .sort((a, b) => a - b)

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

// Heat step for a day's session count, matching the 4-stop scale everyone
// recognizes from GitHub-style contribution grids.
function heatClass(count: number): string {
  if (count <= 0) return 'bg-secondary'
  if (count === 1) return 'bg-pen/35'
  if (count === 2) return 'bg-pen/65'
  return 'bg-pen'
}

const WEEKDAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

export function PracticeCalendar({ snapshots }: { snapshots: DeliverySnapshot[] }) {
  const today = new Date()
  const todayStart = startOfDay(today)

  const countsByDay = new Map<string, number>()
  for (const s of snapshots) {
    const key = dayKey(new Date(s.date))
    countsByDay.set(key, (countsByDay.get(key) ?? 0) + 1)
  }
  const practicedDays = new Set(countsByDay.keys())
  const { current, best } = computeStreaks(practicedDays, today)

  // Current calendar month, Monday-start weeks — matches practice's
  // tournament/practice-week convention rather than locale default.
  const year = today.getFullYear()
  const month = today.getMonth()
  const firstOfMonth = new Date(year, month, 1)
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const leadingBlanks = (firstOfMonth.getDay() + 6) % 7

  const cells: Array<{ date: Date; count: number; isToday: boolean; isFuture: boolean } | null> = []
  for (let i = 0; i < leadingBlanks; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month, d)
    cells.push({
      date,
      count: countsByDay.get(dayKey(date)) ?? 0,
      isToday: dayKey(date) === dayKey(today),
      isFuture: date.getTime() > todayStart.getTime(),
    })
  }
  const trailingBlanks = (7 - (cells.length % 7)) % 7
  for (let i = 0; i < trailingBlanks; i++) cells.push(null)

  const monthLabel = today.toLocaleDateString(undefined, { month: 'long' })
  const practicedThisMonth = cells.filter((c) => c && !c.isFuture && c.count > 0).length

  return (
    <section className="surface flex flex-col rounded-xl p-6 md:p-7">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-display text-xl font-semibold">Practice calendar</h3>
          <p className="text-xs text-muted-foreground">
            {monthLabel} · {practicedThisMonth} day{practicedThisMonth === 1 ? '' : 's'} practiced · best streak {best}
          </p>
        </div>
        <p className="font-data text-4xl font-semibold">{current}</p>
      </div>

      <div className="mt-6 grid grid-cols-7 gap-1.5">
        {WEEKDAY_LABELS.map((label, i) => (
          <span key={i} className="text-center font-data text-[10px] uppercase text-muted-foreground">
            {label}
          </span>
        ))}
        {cells.map((cell, i) =>
          cell === null ? (
            <div key={i} />
          ) : (
            <div
              key={i}
              title={`${cell.date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}${
                cell.count > 0 ? ` — ${cell.count} session${cell.count === 1 ? '' : 's'}` : ''
              }`}
              className={`flex aspect-square items-center justify-center rounded-md text-[10px] ${
                cell.isFuture
                  ? 'border border-dashed border-border text-muted-foreground opacity-50'
                  : cell.isToday
                    ? `${heatClass(cell.count)} ring-2 ring-pen ring-offset-1 ring-offset-card`
                    : heatClass(cell.count)
              } ${cell.count >= 2 && !cell.isFuture ? 'text-card' : 'text-muted-foreground'}`}
            >
              {cell.date.getDate()}
            </div>
          ),
        )}
      </div>
    </section>
  )
}
