// Single source of truth for navigation — replaces the old public/app.js
// pattern of three independently-maintained registries (nav-rail buttons,
// tab-bar buttons, and a separate ⌘K `commands` array). AppRail, MobileNav,
// and CommandBar all render from this one list.

import {
  AudioLines,
  Bot,
  Home,
  Library,
  Mic,
  Plus,
  Settings,
  Sparkles,
  Target,
  Trophy,
  Upload,
  Users,
  type LucideIcon,
} from 'lucide-react'

export type NavItem = {
  id: string
  label: string
  href: string
  icon: LucideIcon
  primary: boolean
  mobile: boolean
}

// Lets a scoped-down build (e.g. an MVP demo) hide the drill feature
// entirely — default true so this changes nothing for normal dev work; only
// a build that explicitly sets NEXT_PUBLIC_DRILL_FEATURE_ENABLED=false hides
// it. Client-side code can only read build-time NEXT_PUBLIC_ vars (unlike
// the backend's DRILL_FEATURE_ENABLED in scripts/server.mjs, which is a
// separate env var in a separate process) — both need to be set together
// for a real demo build.
const DRILL_FEATURE_ENABLED = process.env.NEXT_PUBLIC_DRILL_FEATURE_ENABLED !== 'false'

export const navItems: NavItem[] = [
  { id: 'home', label: 'Home', href: '/home', icon: Home, primary: true, mobile: true },
  { id: 'prep', label: 'Prep', href: '/prep', icon: Library, primary: true, mobile: true },
  ...(DRILL_FEATURE_ENABLED
    ? [{ id: 'drill', label: 'Drill', href: '/drill', icon: Target, primary: true, mobile: true }]
    : []),
  { id: 'insight', label: 'Insight', href: '/insight', icon: AudioLines, primary: true, mobile: true },
  { id: 'judges', label: 'Judges', href: '/judges', icon: Users, primary: true, mobile: false },
  { id: 'coach', label: 'CrossCoach', href: '/coach', icon: Bot, primary: true, mobile: true },
  { id: 'tournament', label: 'Tournament', href: '/tournament', icon: Trophy, primary: false, mobile: false },
  { id: 'settings', label: 'Settings', href: '/settings', icon: Settings, primary: false, mobile: false },
]

export const primaryNavItems = navItems.filter((i) => i.primary)
export const secondaryNavItems = navItems.filter((i) => !i.primary)
export const mobileNavItems = navItems.filter((i) => i.mobile)

// Command-bar-only entries that don't correspond to a nav destination on
// their own — they run an action, sometimes landing on a screen afterward.
export type CommandAction = {
  id: string
  label: string
  icon: LucideIcon
  href: string
}

export const commandActions: CommandAction[] = [
  ...(DRILL_FEATURE_ENABLED
    ? [{ id: 'record-speech', label: 'Record a speech', icon: Mic, href: '/drill' }]
    : []),
  { id: 'get-insight', label: 'Get feedback on a round speech', icon: AudioLines, href: '/insight' },
  { id: 'new-case', label: 'Upload a new case', icon: Upload, href: '/prep' },
  { id: 'ask-coach', label: 'Ask CrossCoach', icon: Sparkles, href: '/coach' },
  { id: 'new-chat', label: 'Start a new chat', icon: Plus, href: '/coach' },
]
