import Link from 'next/link'

export const PUBLIC_NAV = [
  { href: '/topics', label: 'Topics' },
  { href: '/guides', label: 'Guides' },
  { href: '/tools', label: 'Tools' },
  { href: '/features', label: 'Features' },
]

// Frame for public, indexable pages (topics, guides, tools, features). Renders outside the sign-in
// gate (see app-frame.tsx PUBLIC_ROUTES) using the app's color tokens.
export function PublicShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <a
        href="#public-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:rounded-md focus:bg-background focus:px-3 focus:py-2 focus:outline focus:outline-2"
      >
        Skip to content
      </a>
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4">
          <Link href="/" className="font-display text-lg font-semibold">
            Cross
          </Link>
          <nav aria-label="Main" className="flex flex-wrap items-center justify-end gap-x-5 gap-y-2 text-sm">
            {PUBLIC_NAV.map((item) => (
              <Link key={item.href} className="underline-offset-4 hover:underline" href={item.href}>
                {item.label}
              </Link>
            ))}
            <Link href="/home" className="rounded-full bg-foreground px-4 py-2 font-semibold text-background">
              Sign in
            </Link>
          </nav>
        </div>
      </header>
      <main id="public-content" className="mx-auto max-w-5xl px-4 py-10">
        {children}
      </main>
      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-5xl flex-wrap gap-x-5 gap-y-2 px-4 py-6 text-sm text-muted-foreground">
          <span>© 2026 Cross AI</span>
          <Link className="underline-offset-2 hover:underline" href="/glossary">
            Glossary
          </Link>
          <Link className="underline-offset-2 hover:underline" href="/resolutions">
            Past resolutions
          </Link>
          <Link className="underline-offset-2 hover:underline" href="/privacy">
            Privacy
          </Link>
          <Link className="underline-offset-2 hover:underline" href="/terms">
            Terms
          </Link>
          <Link className="underline-offset-2 hover:underline" href="/cookies">
            Cookies
          </Link>
          <span>Not affiliated with the NSDA, Tabroom.com or openCaselist.</span>
        </div>
      </footer>
    </div>
  )
}
