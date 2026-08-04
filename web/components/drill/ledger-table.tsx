import { formatAdjustment, formatPct } from '@/lib/drill-topics'
import type { DrillMoveFactor } from '@/lib/api'

// Renders one Bayesian ledger as a table: factor | why it applies | log-odds,
// with a prior -> final summary row. The full ledger is always shown — the
// transparency is the point. Ported from public/app.js's renderLedgerTable.
export function LedgerTable({
  prior,
  factors,
  probability,
}: {
  prior?: number
  factors: DrillMoveFactor[]
  probability: number
}) {
  return (
    <table className="w-full text-left text-sm">
      <thead>
        <tr className="border-b text-xs uppercase tracking-wide text-muted-foreground">
          <th className="py-2 pr-3 font-semibold">Factor</th>
          <th className="py-2 pr-3 font-semibold">Why it applies here</th>
          <th className="py-2 font-semibold">Log-odds</th>
        </tr>
      </thead>
      <tbody>
        {(factors || []).map((f, i) => (
          <tr key={i} className="border-b border-border/60">
            <td className="py-2 pr-3 font-medium">{f.name}</td>
            <td className="py-2 pr-3 text-muted-foreground">{f.why || ''}</td>
            <td className={`font-data py-2 font-semibold ${Number(f.adjustment) >= 0 ? 'text-foreground' : 'text-destructive'}`}>
              {formatAdjustment(f.adjustment)}
            </td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr>
          <td colSpan={3} className="font-data pt-3 text-sm font-semibold">
            Prior {formatPct(prior ?? 0.5)} → Final estimate {formatPct(probability)}
          </td>
        </tr>
      </tfoot>
    </table>
  )
}
