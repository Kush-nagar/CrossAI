import type { JudgeEntry } from '@/lib/local-judges'

function sourceLabel(source?: string): string {
  return source === 'tournaments_tech' ? 'tournaments.tech' : 'Tabroom paradigm'
}

function rowSubtitle(entry: JudgeEntry): string {
  return sourceLabel(entry.source)
}

function Row({ entry, active, onSelect }: { entry: JudgeEntry; active: boolean; onSelect: (e: JudgeEntry) => void }) {
  return (
    <button
      onClick={() => onSelect(entry)}
      className={`flex min-h-16 w-full flex-col justify-center gap-0.5 rounded-md px-4 text-left transition ${
        active ? 'bg-foreground text-card' : 'hover:bg-secondary'
      }`}
    >
      <span className="truncate font-semibold">{entry.name}</span>
      <span className={`truncate text-xs ${active ? 'text-card/60' : 'text-muted-foreground'}`}>{rowSubtitle(entry)}</span>
    </button>
  )
}

export function JudgeSidebar({
  saved,
  recent,
  activeId,
  onSelect,
}: {
  saved: JudgeEntry[]
  recent: JudgeEntry[]
  activeId: string | null
  onSelect: (entry: JudgeEntry) => void
}) {
  const recentOnly = recent.filter((e) => !saved.some((s) => s.id === e.id))

  return (
    <aside className="surface flex flex-col gap-4 rounded-xl p-4 md:sticky md:top-6">
      <p className="eyebrow px-1">Saved & recent</p>
      {saved.length === 0 && recentOnly.length === 0 && (
        <p className="px-4 py-6 text-center text-sm text-muted-foreground">Judges you look up will show up here.</p>
      )}
      {saved.length > 0 && (
        <div className="flex flex-col gap-1">
          {saved.map((e) => (
            <Row key={e.id} entry={e} active={e.id === activeId} onSelect={onSelect} />
          ))}
        </div>
      )}
      {recentOnly.length > 0 && (
        <div className="flex flex-col gap-1">
          {recentOnly.map((e) => (
            <Row key={e.id} entry={e} active={e.id === activeId} onSelect={onSelect} />
          ))}
        </div>
      )}
    </aside>
  )
}
