import Link from 'next/link'
import { ChevronRight, Mic } from 'lucide-react'
import { Progress } from '@/components/ui/primitives'
import type { VoiceProfileStatus } from '@/lib/api'

export function CalibrationProgress({ calibration }: { calibration: VoiceProfileStatus | null }) {
  const sampleCount = calibration?.sampleCount ?? 0
  const total = calibration?.total ?? 0
  const calibrated = calibration?.calibrated ?? false
  const pct = total > 0 ? Math.round((sampleCount / total) * 100) : 0

  return (
    <Link href="/settings" className="surface lift flex min-h-32 flex-col justify-between rounded-xl p-5">
      <div className="flex items-start justify-between">
        <span className="flex size-9 items-center justify-center rounded-md bg-secondary">
          <Mic className="size-4" />
        </span>
        <ChevronRight className="size-4 text-muted-foreground" />
      </div>
      <div>
        <p className="font-data text-2xl font-semibold">{calibration === null ? '—' : `${sampleCount}/${total}`}</p>
        <p className="text-sm font-semibold">Voice calibration</p>
        <p className="mb-2 text-xs text-muted-foreground">
          {calibration === null ? 'Loading...' : calibrated ? 'Fully calibrated' : `${total - sampleCount} take${total - sampleCount === 1 ? '' : 's'} left`}
        </p>
        <Progress value={calibrated ? 100 : pct} pen />
      </div>
    </Link>
  )
}
