import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { LandingFonts } from '@/components/landing/fonts'
import { Reveal } from '@/components/landing/reveal'
import { PreviewSwitcher } from './preview-switcher'
import '../landing.css'

export const metadata: Metadata = {
  title: 'Cross: landing directions',
  description: 'Alternate landing-page directions kept for reference. Preview only.',
  robots: { index: false, follow: false },
}

// Reference-only surface, never served in production (see below). Direction A shipped as the real landing page at "/",
// so the chooser and switcher point there rather than duplicating it here.
export default function PreviewLayout({ children }: { children: React.ReactNode }) {
  // Design mockups with placeholder people and invented copy: dev only. Shipping
  // them publicly would put fake team members and unverified claims on the
  // live domain.
  if (process.env.NODE_ENV === 'production') notFound()
  return (
    <>
      <LandingFonts previews />
      {children}
      <PreviewSwitcher />
      <Reveal />
    </>
  )
}
