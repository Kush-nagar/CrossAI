import { appPageMetadata } from '@/lib/seo'
import { CoachScreen } from '@/components/screens/coach-screen'

export const metadata = appPageMetadata('CrossCoach')

export default function CoachPage() {
  return <CoachScreen />
}
