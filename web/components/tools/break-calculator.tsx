'use client'

// Estimates which prelim record breaks. Model: with power-matching, the share
// of teams at each record after R rounds is close to binomial with p = 0.5,
// so expected teams at w wins = N * C(R, w) / 2^R. Real tournaments vary
// (byes, uneven pools, tiebreaks), so this is an estimate and says so.

import { useMemo, useState } from 'react'

const BREAK_SIZES = [
  { size: 2, label: 'Finals (2)' },
  { size: 4, label: 'Semifinals (4)' },
  { size: 8, label: 'Quarterfinals (8)' },
  { size: 16, label: 'Octafinals (16)' },
  { size: 32, label: 'Double octas (32)' },
  { size: 64, label: 'Triple octas (64)' },
]

function choose(n: number, k: number): number {
  let r = 1
  for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i
  return r
}

export function BreakCalculator() {
  const [entries, setEntries] = useState(120)
  const [rounds, setRounds] = useState(6)
  const [breakSize, setBreakSize] = useState(32)

  const result = useMemo(() => {
    const N = Math.max(2, Math.min(2000, Math.round(entries) || 0))
    const R = Math.max(1, Math.min(12, Math.round(rounds) || 0))
    const B = Math.max(1, Math.min(N, Math.round(breakSize) || 0))
    const rows = []
    let above = 0
    let bubble: { wins: number; teams: number; spots: number } | null = null
    for (let w = R; w >= 0; w--) {
      const teams = (N * choose(R, w)) / 2 ** R
      const spots = Math.max(0, Math.min(teams, B - above))
      rows.push({ wins: w, losses: R - w, teams, breaks: spots >= teams - 1e-9 ? 'all' : spots > 0 ? 'some' : 'none', share: teams ? spots / teams : 0 })
      if (!bubble && spots > 0 && spots < teams - 1e-9) bubble = { wins: w, teams, spots }
      above += teams
    }
    const clear = rows.filter((r) => r.breaks === 'all')
    const safest = clear.length ? clear[clear.length - 1] : null
    return { N, R, B, rows, bubble, safest }
  }, [entries, rounds, breakSize])

  const fmt = (x: number) => (x >= 10 ? Math.round(x).toString() : x.toFixed(1))

  return (
    <div className="flex flex-col gap-6">
      <form className="surface grid gap-4 rounded-2xl p-5 sm:grid-cols-3" onSubmit={(e) => e.preventDefault()}>
        <label className="flex flex-col gap-1.5 text-sm font-semibold">
          Entries
          <input
            type="number"
            min={2}
            max={2000}
            value={entries}
            onChange={(e) => setEntries(Number(e.target.value))}
            className="min-h-11 rounded-md border border-border bg-background px-3 text-base font-normal"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-semibold">
          Prelim rounds
          <input
            type="number"
            min={1}
            max={12}
            value={rounds}
            onChange={(e) => setRounds(Number(e.target.value))}
            className="min-h-11 rounded-md border border-border bg-background px-3 text-base font-normal"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-semibold">
          Break to
          <select
            value={BREAK_SIZES.some((b) => b.size === breakSize) ? breakSize : ''}
            onChange={(e) => setBreakSize(Number(e.target.value))}
            className="min-h-11 rounded-md border border-border bg-background px-3 text-base font-normal"
          >
            {BREAK_SIZES.map((b) => (
              <option key={b.size} value={b.size}>
                {b.label}
              </option>
            ))}
          </select>
        </label>
      </form>

      <div className="surface rounded-2xl p-5" aria-live="polite">
        <p className="font-display text-2xl font-semibold leading-snug">
          {result.safest
            ? `${result.safest.wins}-${result.safest.losses} and better should break.`
            : `Only some ${result.R}-0 teams break.`}
        </p>
        {result.bubble && (
          <p className="mt-2 text-[0.95rem] text-muted-foreground">
            At {result.bubble.wins}-{result.R - result.bubble.wins}, about {fmt(result.bubble.spots)} of roughly {fmt(result.bubble.teams)} teams
            break, usually decided by speaker points.
          </p>
        )}
      </div>

      <table className="w-full border-collapse text-left text-[0.95rem]">
        <caption className="sr-only">Estimated teams at each record and whether they break</caption>
        <thead>
          <tr className="border-b border-border text-sm text-muted-foreground">
            <th scope="col" className="py-2 pr-4 font-semibold">Record</th>
            <th scope="col" className="py-2 pr-4 font-semibold">Est. teams</th>
            <th scope="col" className="py-2 font-semibold">Breaks?</th>
          </tr>
        </thead>
        <tbody>
          {result.rows.map((r) => (
            <tr key={r.wins} className="border-b border-border/60">
              <td className="py-2 pr-4 font-semibold">
                {r.wins}-{r.losses}
              </td>
              <td className="py-2 pr-4">{fmt(r.teams)}</td>
              <td className="py-2">
                {r.breaks === 'all' ? 'Yes' : r.breaks === 'some' ? `About ${Math.round(r.share * 100)}% (on speaks)` : 'No'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-sm text-muted-foreground">
        An estimate: it assumes every team has an even chance each round under power-matching. Byes, uneven pools and
        tiebreak rules change the real cutoff, so check the tournament&apos;s own rules.
      </p>
    </div>
  )
}
