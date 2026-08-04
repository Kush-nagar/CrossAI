import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Fraunces, JetBrains_Mono, Newsreader } from 'next/font/google'
import { AuthGate } from '@/components/auth/auth-gate'
import { AppShell } from '@/components/nav/app-shell'
import './globals.css'

const bodyFont = Newsreader({ subsets: ['latin'], variable: '--font-body' })
const displayFont = Fraunces({ subsets: ['latin'], variable: '--font-display', weight: ['500', '600', '700'] })
const dataFont = JetBrains_Mono({ subsets: ['latin'], variable: '--font-data', weight: ['500', '600'] })

export const metadata: Metadata = {
  title: 'Cross — Debate training, intelligently focused',
  description: 'Prepare cases, practice under pressure, study judges, and improve with an AI debate coach.',
}

export const viewport: Viewport = {
  colorScheme: 'light dark',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#e9e8e1' },
    { media: '(prefers-color-scheme: dark)', color: '#17181a' },
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
      <body className={`${bodyFont.variable} ${displayFont.variable} ${dataFont.variable} font-sans antialiased`}>
        <AuthGate>
          <AppShell>{children}</AppShell>
        </AuthGate>
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
