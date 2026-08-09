// The public landing page runs its own typeface program, deliberately unlike
// the app's system-font stack (see globals.css) — Zodiak for display, Switzer
// for body, Azeret Mono for ledger and data. React hoists these into <head>,
// and they load only on the routes that render this component, so the
// signed-in app still downloads no webfonts.

const LANDING_FONTSHARE =
  'https://api.fontshare.com/v2/css?f[]=zodiak@400,401,700,701&f[]=switzer@400,500,600&display=swap'
const LANDING_GOOGLE =
  'https://fonts.googleapis.com/css2?family=Azeret+Mono:wght@400;500&display=swap'

// The remaining direction previews (B and C) need their own faces on top.
const PREVIEW_FONTSHARE =
  'https://api.fontshare.com/v2/css?f[]=clash-display@600,700&f[]=supreme@400,500&f[]=boska@300,301,400,401&f[]=satoshi@400,500,700&display=swap'
const PREVIEW_GOOGLE =
  'https://fonts.googleapis.com/css2?family=Martian+Mono:wght@400;500&family=Spline+Sans+Mono:wght@400;500&display=swap'

export function LandingFonts({ previews = false }: { previews?: boolean }) {
  return (
    <>
      <link rel="preconnect" href="https://api.fontshare.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link rel="stylesheet" href={LANDING_FONTSHARE} />
      <link rel="stylesheet" href={LANDING_GOOGLE} />
      {previews && (
        <>
          <link rel="stylesheet" href={PREVIEW_FONTSHARE} />
          <link rel="stylesheet" href={PREVIEW_GOOGLE} />
        </>
      )}
    </>
  )
}
