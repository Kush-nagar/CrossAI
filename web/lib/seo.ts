import type { Metadata } from 'next'

// Canonical origin for absolute URLs in metadata (canonical links, Open
// Graph image, sitemap). Matches PUBLIC_BASE_URL on the server.
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://cross-ai.dev').replace(/\/+$/, '')

// The signed-in app screens all render the sign-in card to a crawler, so they
// are thin, duplicate pages to a search engine. Give each a real title for
// browser tabs and history, but keep them out of the index. Only the landing
// page and the legal pages are meant to rank.
export function appPageMetadata(title: string): Metadata {
  return { title, robots: { index: false, follow: true } }
}
