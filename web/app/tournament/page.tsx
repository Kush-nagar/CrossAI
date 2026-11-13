import { appPageMetadata } from '@/lib/seo'
import { TournamentScreen } from '@/components/screens/tournament-screen'

export const metadata = appPageMetadata('Tournament')

export default function TournamentPage() {
  return <TournamentScreen />
}
