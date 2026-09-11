import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { AppFrame } from '@/components/app-frame'
import './globals.css'

// App-wide type program: Zodiak (display) + Switzer (body) + Azeret Mono
// (data/tabular), loaded here so every route — landing and the signed-in
// app alike — shares one typographic identity instead of the landing page
// having a bespoke face and the app falling back to system UI fonts. Same
// Fontshare/Google stylesheets the landing page originally loaded on its
// own via <LandingFonts/> (web/components/landing/fonts.tsx), which now
// only adds the extra faces for the /preview alternate directions.
const BRAND_FONTSHARE =
  'https://api.fontshare.com/v2/css?f[]=zodiak@400,401,700,701&f[]=switzer@400,500,600&display=swap'
const BRAND_GOOGLE_FONTS = 'https://fonts.googleapis.com/css2?family=Azeret+Mono:wght@400;500&display=swap'

export const metadata: Metadata = {
  title: 'Cross: Debate training, intelligently focused',
  description: 'Prepare cases, practice under pressure, study judges, and improve with an AI debate coach.',
}

export const viewport: Viewport = {
  colorScheme: 'light dark',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f1ece1' },
    { media: '(prefers-color-scheme: dark)', color: '#08090c' },
  ],
  width: 'device-width',
  initialScale: 1,
  userScalable: true,
}

// Sets .dark/.light before first paint so the toggle in Settings/shell
// doesn't cause a flash of the wrong theme on load.
const noFlashScript = `(function(){try{var p=JSON.parse(localStorage.getItem('cross.localPrefs')||'{}');var t=p.theme||'system';if(t==='system'){var d=window.matchMedia('(prefers-color-scheme: dark)').matches;document.documentElement.classList.add(d?'dark':'light');document.documentElement.style.colorScheme=d?'dark':'light';}else{document.documentElement.classList.add(t);document.documentElement.style.colorScheme=t==='dark'?'dark':'light';}}catch(e){}})()`

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="bg-background" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: noFlashScript }} />
        <link rel="preconnect" href="https://api.fontshare.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="stylesheet" href={BRAND_FONTSHARE} />
        <link rel="stylesheet" href={BRAND_GOOGLE_FONTS} />
      </head>
      <body className="font-sans antialiased">
        <AppFrame>{children}</AppFrame>
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
