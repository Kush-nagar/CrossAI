// Client-only preferences with no backend (per migration plan: only voice
// calibration is a real server-backed Settings feature). Reduced-motion and
// contrast are applied for real via document.documentElement classes that
// hook into the same CSS rules as the OS-level prefers-reduced-motion query.

export type Theme = 'light' | 'dark' | 'pink' | 'system'

export type LocalPrefs = {
  displayName: string
  format: string
  experience: string
  notifications: boolean
  reducedMotion: boolean
  highContrast: boolean
  theme: Theme
}

const KEY = 'cross.localPrefs'

export const defaultPrefs: LocalPrefs = {
  displayName: '',
  format: 'Public Forum',
  experience: 'Varsity',
  notifications: true,
  reducedMotion: false,
  highContrast: false,
  theme: 'system',
}

export function loadLocalPrefs(): LocalPrefs {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return defaultPrefs
    return { ...defaultPrefs, ...JSON.parse(raw) }
  } catch {
    return defaultPrefs
  }
}

export function saveLocalPrefs(prefs: LocalPrefs) {
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs))
  } catch {
    // private-mode storage failure — prefs just don't persist this session
  }
  applyAccessibilityClasses(prefs)
  applyTheme(prefs.theme)
}

export function applyAccessibilityClasses(prefs: Pick<LocalPrefs, 'reducedMotion' | 'highContrast'>) {
  document.documentElement.classList.toggle('force-reduced-motion', prefs.reducedMotion)
  document.documentElement.classList.toggle('force-high-contrast', prefs.highContrast)
}

export function applyTheme(theme: Theme) {
  const root = document.documentElement
  root.classList.remove('light', 'dark', 'pink')
  if (theme !== 'system') root.classList.add(theme)
  const dark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  // Pink is a light-family palette (see globals.css's `:root.pink`) — the OS
  // colorScheme hint only distinguishes light/dark chrome, so it reports
  // 'light' the same as the plain light theme.
  root.style.colorScheme = dark ? 'dark' : 'light'
}
