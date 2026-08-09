// Cross's live "thought process", styled after Claude's streaming UI: the
// active step is a single line of text with a bright glint sweeping across it
// (the `.text-shimmer` gradient), and finished steps sit above it dimmed and
// checked off. Driven by the NUL-delimited FLOW frames the chat and
// drill-scenario routes interleave into their streams (see readFramedStream in
// lib/api.ts).
//
// Shared by the coach chat and the drill loading panel so the two read as the
// same thing happening, not two different waits.
export function FlowSteps({
  steps,
  fallback = 'Thinking',
  max = 4,
}: {
  steps: string[]
  fallback?: string
  max?: number
}) {
  // Cap the live list: as work stacks up, keep the most recent `max` steps
  // (the active one plus the last few checked off) so the panel stays compact
  // instead of growing unbounded down the screen.
  const source = steps.length > 0 ? steps : [fallback]
  const shown = source.slice(-max)
  return (
    <div className="flex flex-col gap-1.5 text-sm" aria-live="polite">
      {shown.map((step, i, arr) => {
        const active = i === arr.length - 1
        return (
          <div key={i} className="flex items-center gap-2">
            {!active && (
              <span className="text-foreground/40" aria-hidden="true">
                ✓
              </span>
            )}
            <span className={active ? 'text-shimmer font-medium' : 'text-muted-foreground/60'}>{step}</span>
          </div>
        )
      })}
    </div>
  )
}
