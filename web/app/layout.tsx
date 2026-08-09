import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { AppFrame } from '@/components/app-frame'
import './globals.css'

// ponytail: type is the SF/system stack defined in globals.css — no webfont
// requests, and it renders as the real thing on Apple devices.

export const metadata: Metadata = {
  title: 'Cross — Debate training, intelligently focused',
  description: 'Prepare cases, practice under pressure, study judges, and improve with an AI debate coach.',
}

export const viewport: Viewport = {
  colorScheme: 'light dark',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f5f5f7' },
    { media: '(prefers-color-scheme: dark)', color: '#000000' },
  ],
  width: 'device-width',
  initialScale: 1,
  userScalable: true,
}

// Sets .dark/.light before first paint so the toggle in Settings/shell
// doesn't cause a flash of the wrong theme on load.
const noFlashScript = `(function(){try{var p=JSON.parse(localStorage.getItem('cross.localPrefs')||'{}');var t=p.theme||'system';var d=t==='dark'||(t!=='light'&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.add(d?'dark':'light');document.documentElement.style.colorScheme=d?'dark':'light';}catch(e){}})()`

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="bg-background" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: noFlashScript }} />
      </head>
      <body className="font-sans antialiased">
        <AppFrame>{children}</AppFrame>
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
