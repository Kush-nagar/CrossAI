// Zodiak/Switzer/Azeret Mono (the landing page's original type program) now
// load app-wide from web/app/layout.tsx, so every route shares one identity.
// This component is left for the /preview route only, to add the extra faces
// the two unused alternate directions (B: Clash Display/Supreme, C: Boska/
// Satoshi) need on top of the base set layout.tsx already loaded.

const PREVIEW_FONTSHARE =
  'https://api.fontshare.com/v2/css?f[]=clash-display@600,700&f[]=supreme@400,500&f[]=boska@300,301,400,401&f[]=satoshi@400,500,700&display=swap'
const PREVIEW_GOOGLE =
  'https://fonts.googleapis.com/css2?family=Martian+Mono:wght@400;500&family=Spline+Sans+Mono:wght@400;500&display=swap'

export function LandingFonts({ previews = false }: { previews?: boolean }) {
  if (!previews) return null
  return (
    <>
      <link rel="stylesheet" href={PREVIEW_FONTSHARE} />
      <link rel="stylesheet" href={PREVIEW_GOOGLE} />
    </>
  )
}
