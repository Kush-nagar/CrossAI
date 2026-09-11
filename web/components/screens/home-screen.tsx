'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ChevronRight, Clock, Library } from 'lucide-react'
import { useAuth } from '@/components/auth/auth-gate'
import { getDeliveryHistory, getVoiceProfileStatus, type DeliverySnapshot, type VoiceProfileStatus } from '@/lib/api'
import { loadCaseRecords } from '@/lib/local-cases'
import { RecommendedSession } from '@/components/home/recommended-session'
import { SkillCurve } from '@/components/home/skill-curve'
import { PracticeCalendar } from '@/components/home/practice-calendar'
import { CalibrationProgress } from '@/components/home/calibration-progress'
import { ContinueShortcut } from '@/components/home/continue-shortcut'

const DAY_MS = 86400000

function greeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

function firstName(username: string | null): string {
  if (!username) return 'there'
  const token = username.split(/[\s._-]+/).filter(Boolean)[0] || username
  return token[0].toUpperCase() + token.slice(1)
}

function fmtDuration(totalSec: number): string {
  const h = Math.floor(totalSec / 3600)
  const m = Math.round((totalSec % 3600) / 60)
  if (h === 0 && m === 0) return '0m'
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

function MetricCard({
  icon: Icon,
  value,
  label,
  note,
  href,
}: {
  icon: typeof Clock
  value: string
  label: string
  note: string
  href: string
}) {
  return (
    <Link href={href} className="surface lift flex min-h-32 flex-col justify-between rounded-xl p-5">
      <div className="flex items-start justify-between">
        <span className="flex size-9 items-center justify-center rounded-md bg-secondary">
          <Icon className="size-4" />
        </span>
        <ChevronRight className="size-4 text-muted-foreground" />
      </div>
      <div>
        <p className="font-data text-2xl font-semibold">{value}</p>
        <p className="text-sm font-semibold">{label}</p>
        <p className="text-xs text-muted-foreground">{note}</p>
      </div>
    </Link>
  )
}

export function HomeScreen() {
  const { username } = useAuth()
  const [snapshots, setSnapshots] = useState<DeliverySnapshot[] | null>(null)
  const [calibration, setCalibration] = useState<VoiceProfileStatus | null>(null)
  const [caseCount, setCaseCount] = useState(0)

  useEffect(() => {
    getDeliveryHistory()
      .then((d) => setSnapshots(d.snapshots))
      .catch(() => setSnapshots([]))
    getVoiceProfileStatus()
      .then(setCalibration)
      .catch(() => setCalibration(null))
    setCaseCount(loadCaseRecords().length)
  }, [])

  const snaps = snapshots ?? []
  const now = Date.now()
  const thisWeek = snaps.filter((s) => now - new Date(s.date).getTime() < 7 * DAY_MS)
  const lastWeek = snaps.filter((s) => {
    const age = now - new Date(s.date).getTime()
    return age >= 7 * DAY_MS && age < 14 * DAY_MS
  })
  const thisWeekSec = thisWeek.reduce((sum, s) => sum + (s.durationSec ?? 0), 0)
  const lastWeekSec = lastWeek.reduce((sum, s) => sum + (s.durationSec ?? 0), 0)
  const weekDeltaMin = Math.round((thisWeekSec - lastWeekSec) / 60)

  return (
    <div className="page-enter stagger flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="font-display text-balance text-3xl font-semibold tracking-tight md:text-5xl">
          {greeting()}, {firstName(username)}.
        </h1>
        <p className="text-sm text-muted-foreground md:text-base">Your next round gets easier when today's practice has a purpose.</p>
      </header>

      {snapshots !== null && <RecommendedSession snapshots={snaps} calibration={calibration} />}

      <section className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">{snapshots !== null && <SkillCurve snapshots={snaps} />}</div>
        <div>{snapshots !== null && <PracticeCalendar snapshots={snaps} />}</div>
      </section>

      <section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          icon={Clock}
          value={fmtDuration(thisWeekSec)}
          label="Training this week"
          note={
            thisWeekSec === 0
              ? 'No practice logged yet this week'
              : lastWeek.length === 0
                ? 'First week with logged practice'
                : `${weekDeltaMin >= 0 ? '+' : ''}${weekDeltaMin}m vs last week`
          }
          href="/drill"
        />
        <MetricCard
          icon={Library}
          value={String(caseCount)}
          label="Cases prepared"
          note={caseCount === 0 ? 'No cases uploaded yet' : 'In your case library'}
          href="/prep"
        />
        <CalibrationProgress calibration={calibration} />
        <ContinueShortcut />
      </section>
    </div>
  )
}
