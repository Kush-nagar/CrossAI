import { appPageMetadata } from '@/lib/seo'
import { PrepScreen } from '@/components/screens/prep-screen'

export const metadata = appPageMetadata('Prep')

export default function PrepPage() {
  return <PrepScreen />
}
