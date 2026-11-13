import Link from 'next/link'

// Shared shell for /privacy, /terms and /cookies. Public (listed in
// app-frame.tsx's PUBLIC_ROUTES), so it renders without the sign-in gate or
// app chrome, and uses only the app's color tokens so light/dark both work.

export const LEGAL_EFFECTIVE_DATE = 'November 13, 2026'
export const CONTACT_EMAIL = 'support@cross-ai.dev'

export function LegalPage({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <a
        href="#legal-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:rounded-md focus:bg-background focus:px-3 focus:py-2 focus:outline focus:outline-2"
      >
        Skip to content
      </a>
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-4">
          <Link href="/" className="font-display text-lg font-semibold">
            Cross
          </Link>
          <nav aria-label="Legal" className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
            <Link className="underline-offset-4 hover:underline" href="/privacy">
              Privacy
            </Link>
            <Link className="underline-offset-4 hover:underline" href="/terms">
              Terms
            </Link>
            <Link className="underline-offset-4 hover:underline" href="/cookies">
              Cookies
            </Link>
          </nav>
        </div>
      </header>
      <main id="legal-content" className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="font-display text-3xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">Effective {LEGAL_EFFECTIVE_DATE}</p>
        <div className="legal-prose mt-8">{children}</div>
      </main>
      <footer className="border-t border-border">
        <div className="mx-auto max-w-3xl px-4 py-6 text-sm text-muted-foreground">
          Questions? Email{' '}
          <a className="font-semibold text-foreground underline underline-offset-2" href={`mailto:${CONTACT_EMAIL}`}>
            {CONTACT_EMAIL}
          </a>
          .
        </div>
      </footer>
    </div>
  )
}
