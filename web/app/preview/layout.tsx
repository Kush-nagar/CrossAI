import type { Metadata } from 'next'
import { LandingFonts } from '@/components/landing/fonts'
import { Reveal } from '@/components/landing/reveal'
import { PreviewSwitcher } from './preview-switcher'
import '../landing.css'

export const metadata: Metadata = {
  title: 'Cross: landing directions',
  description: 'Alternate landing-page directions kept for reference. Preview only.',
  robots: { index: false, follow: false },
}

// Reference-only surface. Direction A shipped as the real landing page at "/",
// so the chooser and switcher point there rather than duplicating it here.
export default function PreviewLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <LandingFonts previews />
      {children}
      <PreviewSwitcher />
      <Reveal />
    </>
  )
}
