import { redirect } from 'next/navigation'
import { DrillScreen } from '@/components/screens/drill-screen'

// Same flag as nav-config.ts: a build that hides the drill nav entry also
// blocks the route directly, so a guessed/bookmarked /drill URL doesn't land
// on a screen whose backend calls all 404.
const DRILL_FEATURE_ENABLED = process.env.NEXT_PUBLIC_DRILL_FEATURE_ENABLED !== 'false'

export default function DrillPage() {
  if (!DRILL_FEATURE_ENABLED) redirect('/home')
  return <DrillScreen />
}
