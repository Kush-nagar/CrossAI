import { appPageMetadata } from '@/lib/seo'
import { HomeScreen } from '@/components/screens/home-screen'

export const metadata = appPageMetadata('Home')

export default function HomePage() {
  return <HomeScreen />
}
