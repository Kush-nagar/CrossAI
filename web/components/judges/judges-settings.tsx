'use client'

// Settings › Judges — the two bins (Saved / Struck) plus per-judge notes.
// Everything here reads and writes the same localStorage the Judges screen
// uses (local-judges.ts), so edits made here show up on a judge's profile and
// vice versa.

import { useState } from 'react'
import { Ban, Bookmark, Trash2 } from 'lucide-react'
import {
  loadNotes,
  loadSaved,
  loadStruck,
  removeFromSaved,
  removeFromStruck,
  setNote,
  toggleSaved,
  toggleStruck,
  type JudgeEntry,
} from '@/lib/local-judges'

function sourceLabel(source?: string): string {
  return source === 'tournaments_tech' ? 'tournaments.tech' : 'Tabroom'
}

function BinItem({
  entry,
  bin,
  note,
  onNoteChange,
  onMove,
  onRemove,
}: {
  entry: JudgeEntry
  bin: 'saved' | 'struck'
  note: string
  onNoteChange: (text: string) => void
  onMove: () => void
  onRemove: () => void
}) {
  return (
    <div className="rounded-md border border-border p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-semibold">{entry.name}</p>
          <p className="truncate text-xs text-muted-foreground">
            {entry.affiliations ? `${entry.affiliations} · ${sourceLabel(entry.source)}` : sourceLabel(entry.source)}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={onMove}
            aria-label={bin === 'saved' ? 'Move to Struck' : 'Move to Saved'}
            title={bin === 'saved' ? 'Move to Struck' : 'Move to Saved'}
            className="press flex size-9 items-center justify-center rounded-md border border-border text-muted-foreground transition hover:bg-secondary"
          >
            {bin === 'saved' ? <Ban className="size-4" /> : <Bookmark className="size-4" />}
          </button>
          <button
            type="button"
            onClick={onRemove}
            aria-label="Remove from bin"
            title="Remove"
            className="press flex size-9 items-center justify-center rounded-md border border-border text-muted-foreground transition hover:bg-secondary hover:text-destructive"
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      </div>
      <textarea
        value={note}
        onChange={(e) => onNoteChange(e.target.value)}
        placeholder="Add a note…"
        rows={2}
        className="mt-3 w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-pen"
      />
    </div>
  )
}

function Bin({
  title,
  icon,
  entries,
  emptyText,
  bin,
  notes,
  onNoteChange,
  onMove,
  onRemove,
}: {
  title: string
  icon: React.ReactNode
  entries: JudgeEntry[]
  emptyText: string
  bin: 'saved' | 'struck'
  notes: Record<string, string>
  onNoteChange: (id: string, text: string) => void
  onMove: (entry: JudgeEntry) => void
  onRemove: (id: string) => void
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        {icon}
        <p className="eyebrow">{title}</p>
        <span className="tally text-xs">{entries.length}</span>
      </div>
      {entries.length === 0 ? (
        <p className="rounded-md border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">{emptyText}</p>
      ) : (
        <div className="flex flex-col gap-3">
          {entries.map((e) => (
            <BinItem
              key={e.id}
              entry={e}
              bin={bin}
              note={notes[e.id] ?? ''}
              onNoteChange={(text) => onNoteChange(e.id, text)}
              onMove={() => onMove(e)}
              onRemove={() => onRemove(e.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export function JudgesSettings() {
  const [saved, setSaved] = useState<JudgeEntry[]>(() => (typeof window === 'undefined' ? [] : loadSaved()))
  const [struck, setStruck] = useState<JudgeEntry[]>(() => (typeof window === 'undefined' ? [] : loadStruck()))
  const [notes, setNotes] = useState<Record<string, string>>(() => {
    if (typeof window === 'undefined') return {}
    return Object.fromEntries(Object.entries(loadNotes()).map(([id, n]) => [id, n.text]))
  })

  function refresh() {
    setSaved(loadSaved())
    setStruck(loadStruck())
  }

  function handleNoteChange(id: string, text: string) {
    setNotes((prev) => ({ ...prev, [id]: text }))
    setNote(id, text)
  }

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-muted-foreground">
        Save judges you want to remember and strike the ones you'd rather avoid. Notes are private and stored on this device.
      </p>
      <div className="grid gap-6 md:grid-cols-2">
        <Bin
          title="Saved"
          icon={<Bookmark className="size-4 text-pen" />}
          entries={saved}
          emptyText="No saved judges yet. Save one from a judge's profile."
          bin="saved"
          notes={notes}
          onNoteChange={handleNoteChange}
          onMove={(e) => {
            toggleStruck(e)
            refresh()
          }}
          onRemove={(id) => {
            removeFromSaved(id)
            refresh()
          }}
        />
        <Bin
          title="Struck"
          icon={<Ban className="size-4 text-destructive" />}
          entries={struck}
          emptyText="No struck judges yet. Strike one from a judge's profile."
          bin="struck"
          notes={notes}
          onNoteChange={handleNoteChange}
          onMove={(e) => {
            toggleSaved(e)
            refresh()
          }}
          onRemove={(id) => {
            removeFromStruck(id)
            refresh()
          }}
        />
      </div>
    </div>
  )
}
