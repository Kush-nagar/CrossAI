'use client'

import { useEffect, useState } from 'react'
import { Gavel, Headphones, Heart, LogOut, Monitor, Moon, SlidersHorizontal, Sun } from 'lucide-react'
import { InkButton, PageTitle, SettingsGroup, Field, Toggle } from '@/components/ui/primitives'
import { getVoiceProfileStatus, resetVoiceProfile, type VoiceProfileStatus } from '@/lib/api'
import { useOnboarding } from '@/components/onboarding/onboarding-overlay'
import { defaultPrefs, loadLocalPrefs, saveLocalPrefs, type LocalPrefs, type Theme } from '@/lib/local-prefs'
import { useAuth } from '@/components/auth/auth-gate'
import { TabroomLink } from '@/components/auth/tabroom-link'
import { JudgesSettings } from '@/components/judges/judges-settings'

type SettingsTab = 'preferences' | 'judges'

const TABS: { value: SettingsTab; label: string; icon: typeof Gavel }[] = [
  { value: 'preferences', label: 'Preferences', icon: SlidersHorizontal },
  { value: 'judges', label: 'Judges', icon: Gavel },
]

const THEME_OPTIONS: { value: Theme; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'pink', label: 'Pink', icon: Heart },
  { value: 'system', label: 'System', icon: Monitor },
]

function calibrationStatusText(status: VoiceProfileStatus | null): string {
  if (!status) return "Couldn't load calibration status."
  if (status.calibrated) {
    return `Voice calibrated: ${status.sampleCount} takes recorded, ${status.correctionCount} correction${status.correctionCount === 1 ? '' : 's'} learned.`
  }
  if (status.sampleCount === 0) return `Not calibrated yet: 0 of ${status.total} takes recorded.`
  return `In progress: ${status.sampleCount} of ${status.total} takes recorded, ${status.correctionCount} correction${status.correctionCount === 1 ? '' : 's'} learned so far.`
}

function calibrationButtonLabel(status: VoiceProfileStatus | null, resetArmed: boolean): string {
  if (!status) return 'Start Calibration'
  if (status.calibrated) return resetArmed ? 'Click again to reset and restart' : 'Recalibrate'
  return status.sampleCount === 0 ? 'Start Calibration' : 'Continue Calibration'
}

export function SettingsScreen() {
  const { username, email, signOut } = useAuth()
  const onboarding = useOnboarding()
  const [status, setStatus] = useState<VoiceProfileStatus | null>(null)
  const [resetArmed, setResetArmed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [prefs, setPrefs] = useState<LocalPrefs>(defaultPrefs)
  const [saved, setSaved] = useState(false)
  const [tab, setTab] = useState<SettingsTab>('preferences')

  useEffect(() => {
    getVoiceProfileStatus()
      .then(setStatus)
      .catch(() => setStatus(null))
    setPrefs(loadLocalPrefs())
  }, [])

  function refreshStatus() {
    setResetArmed(false)
    getVoiceProfileStatus()
      .then(setStatus)
      .catch(() => setStatus(null))
  }

  async function handleCalibrateClick() {
    if (!status?.calibrated) {
      onboarding.show()
      return
    }
    if (!resetArmed) {
      setResetArmed(true)
      return
    }
    setResetArmed(false)
    setBusy(true)
    try {
      await resetVoiceProfile()
      onboarding.show()
    } finally {
      setBusy(false)
      refreshStatus()
    }
  }

  function updatePrefs(next: Partial<LocalPrefs>) {
    const merged = { ...prefs, ...next }
    setPrefs(merged)
    saveLocalPrefs(merged)
  }

  function handleSave() {
    saveLocalPrefs(prefs)
    setSaved(true)
    setTimeout(() => setSaved(false), 1800)
  }

  return (
    <div className="page-enter mx-auto flex max-w-4xl flex-col gap-7">
      <PageTitle
        eyebrow="Preferences"
        title="Make Cross yours."
        description="Tune your debate context, voice calibration, and accessibility preferences."
      />

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Settings sections">
        {TABS.map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={tab === value}
            onClick={() => setTab(value)}
            className={`press flex min-h-11 items-center gap-2 rounded-md border px-4 text-sm font-semibold transition ${
              tab === value ? 'border-pen text-pen' : 'border-border text-muted-foreground hover:bg-secondary'
            }`}
          >
            <Icon className="size-4" />
            {label}
          </button>
        ))}
      </div>

      {tab === 'judges' && (
        <SettingsGroup title="Judges">
          <JudgesSettings />
        </SettingsGroup>
      )}

      <div className={`flex flex-col gap-5 ${tab === 'preferences' ? '' : 'hidden'}`}>
        <SettingsGroup title="Account">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <span>
              <b className="block text-sm">{username || 'Signed in'}</b>
              <span className="text-xs text-muted-foreground">{email || 'Cross account'}</span>
            </span>
            <button
              type="button"
              onClick={signOut}
              className="press flex min-h-11 items-center gap-2 rounded-xl border border-border px-4 text-sm font-semibold hover:bg-secondary"
            >
              <LogOut className="size-4" />
              Sign out
            </button>
          </div>
        </SettingsGroup>

        <SettingsGroup title="Tabroom account">
          <TabroomLink />
        </SettingsGroup>

        <SettingsGroup title="Profile & debate">
          <Field label="Display name">
            <input
              value={prefs.displayName || username || ''}
              onChange={(e) => updatePrefs({ displayName: e.target.value })}
              className="w-full rounded-xl border bg-background px-4 py-3 outline-none focus:ring-2 focus:ring-pen"
            />
          </Field>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Primary format">
              <select
                value={prefs.format}
                onChange={(e) => updatePrefs({ format: e.target.value })}
                className="w-full rounded-xl border bg-background px-4 py-3"
              >
                <option>Policy</option>
                <option>Lincoln-Douglas</option>
                <option>Public Forum</option>
                <option>Parliamentary</option>
              </select>
            </Field>
            <Field label="Experience level">
              <select
                value={prefs.experience}
                onChange={(e) => updatePrefs({ experience: e.target.value })}
                className="w-full rounded-xl border bg-background px-4 py-3"
              >
                <option>Varsity</option>
                <option>Junior varsity</option>
                <option>Novice</option>
              </select>
            </Field>
          </div>
        </SettingsGroup>

        <SettingsGroup title="Voice calibration">
          <p className="text-sm text-muted-foreground">{calibrationStatusText(status)}</p>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={busy}
              onClick={handleCalibrateClick}
              className="press flex min-h-11 items-center gap-2 rounded-xl bg-secondary px-4 text-sm font-semibold text-secondary-foreground hover:bg-border disabled:opacity-50"
            >
              <Headphones className="size-4" />
              {calibrationButtonLabel(status, resetArmed)}
            </button>
          </div>
          <Toggle
            label="Training reminders"
            detail="Get a nudge when your plan is falling behind (local only, not yet backed by real notifications)"
            checked={prefs.notifications}
            onClick={() => updatePrefs({ notifications: !prefs.notifications })}
          />
        </SettingsGroup>

        <SettingsGroup title="Appearance">
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Theme">
            {THEME_OPTIONS.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={prefs.theme === value}
                onClick={() => updatePrefs({ theme: value })}
                className={`press flex min-h-11 items-center gap-2 rounded-md border px-4 text-sm font-semibold transition ${
                  prefs.theme === value ? 'border-pen text-foreground' : 'border-border text-muted-foreground hover:bg-secondary'
                }`}
              >
                <Icon className="size-4" />
                {label}
              </button>
            ))}
          </div>
        </SettingsGroup>

        <SettingsGroup title="Accessibility">
          <Toggle
            label="Reduce motion"
            detail="Disable animation and transitions app-wide"
            checked={prefs.reducedMotion}
            onClick={() => updatePrefs({ reducedMotion: !prefs.reducedMotion })}
          />
          <Toggle
            label="Increase contrast"
            detail="Strengthen borders and secondary text"
            checked={prefs.highContrast}
            onClick={() => updatePrefs({ highContrast: !prefs.highContrast })}
          />
        </SettingsGroup>

        <div className="flex items-center justify-end gap-3">
          <span role="status" className={`text-sm text-muted-foreground transition ${saved ? 'opacity-100' : 'opacity-0'}`}>
            Changes saved
          </span>
          <InkButton onClick={handleSave}>
            Save preferences
          </InkButton>
        </div>
      </div>
    </div>
  )
}
