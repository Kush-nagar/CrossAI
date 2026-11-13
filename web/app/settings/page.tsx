import { appPageMetadata } from '@/lib/seo'
import { SettingsScreen } from '@/components/screens/settings-screen'

export const metadata = appPageMetadata('Settings')

export default function SettingsPage() {
  return <SettingsScreen />
}
