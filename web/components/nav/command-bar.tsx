'use client'

import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { Search } from 'lucide-react'
import { navItems, commandActions } from './nav-config'

type Entry = { id: string; label: string; icon: (typeof navItems)[number]['icon']; href: string }

const CommandBarContext = createContext<{ open: boolean; setOpen: React.Dispatch<React.SetStateAction<boolean>> }>({
  open: false,
  setOpen: () => {},
})
export const useCommandBar = () => useContext(CommandBarContext)

export function CommandBarProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <CommandBarContext.Provider value={{ open, setOpen }}>
      {children}
      <CommandBar />
    </CommandBarContext.Provider>
  )
}

function CommandBar() {
  const { open, setOpen } = useCommandBar()
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  const entries: Entry[] = useMemo(
    () => [...navItems, ...commandActions].map((e) => ({ id: e.id, label: e.label, icon: e.icon, href: e.href })),
    [],
  )
  const filtered = entries.filter((e) => e.label.toLowerCase().includes(query.toLowerCase()))

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen((v) => !v)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  useEffect(() => {
    if (open) {
      setQuery('')
      setActiveIndex(0)
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [open])

  useEffect(() => setActiveIndex(0), [query])

  function run(entry: Entry) {
    setOpen(false)
    router.push(entry.href)
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') setOpen(false)
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((i) => Math.min(i + 1, filtered.length - 1))
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => Math.max(i - 1, 0))
    }
    if (e.key === 'Enter' && filtered[activeIndex]) {
      e.preventDefault()
      run(filtered[activeIndex])
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-50 flex items-start justify-center bg-foreground/15 pt-24"
          onClick={() => setOpen(false)}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Command bar"
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, scale: 0.96, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: -4 }}
            transition={{ type: 'spring', stiffness: 300, damping: 26 }}
            className="glass w-full max-w-lg rounded-xl p-3"
          >
            <label className="flex min-h-12 items-center gap-3 rounded-md border border-border bg-background px-4">
              <Search className="size-4 text-muted-foreground" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Jump to a screen or action…"
                className="w-full bg-transparent text-sm outline-none"
              />
            </label>
            <div className="mt-2 flex max-h-80 flex-col gap-1 overflow-y-auto">
              {filtered.map((entry, i) => {
                const Icon = entry.icon
                return (
                  <button
                    key={entry.id}
                    onClick={() => run(entry)}
                    onMouseEnter={() => setActiveIndex(i)}
                    className={`flex min-h-11 items-center gap-3 rounded-md border-l-2 px-3 text-left text-sm font-medium transition ${
                      i === activeIndex ? 'border-pen bg-secondary text-foreground' : 'border-transparent hover:bg-secondary/60'
                    }`}
                  >
                    <Icon className="size-4" />
                    {entry.label}
                  </button>
                )
              })}
              {filtered.length === 0 && <p className="px-3 py-4 text-sm text-muted-foreground">No matches.</p>}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
