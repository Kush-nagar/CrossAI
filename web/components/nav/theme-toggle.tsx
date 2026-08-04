'use client'

import { useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'
import { loadLocalPrefs, saveLocalPrefs, type Theme } from '@/lib/local-prefs'

function isDarkNow(): boolean {
  if (typeof document === 'undefined') return false
  return document.documentElement.classList.contains('dark')
}

export function ThemeToggle({ className = '' }: { className?: string }) {
  const [dark, setDark] = useState(isDarkNow)

  useEffect(() => setDark(isDarkNow()), [])

  function toggle() {
    const next: Theme = dark ? 'light' : 'dark'
    saveLocalPrefs({ ...loadLocalPrefs(), theme: next })
    setDark(!dark)
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}
      aria-pressed={dark}
      className={`press flex size-9 items-center justify-center rounded-md border border-border text-muted-foreground transition hover:border-pen hover:text-foreground ${className}`}
    >
      {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </button>
  )
}
