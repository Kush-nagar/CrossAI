import { appPageMetadata } from '@/lib/seo'
import { JudgesScreen } from '@/components/screens/judges-screen'

export const metadata = appPageMetadata('Judges')

export default function JudgesPage() {
  return <JudgesScreen />
}
