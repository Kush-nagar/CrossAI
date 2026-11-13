import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/seo'

// Only pages meant to rank. The signed-in app is noindex (lib/seo.ts).
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date('2026-11-13')
  return [
    { url: `${SITE_URL}/`, lastModified, changeFrequency: 'weekly', priority: 1 },
    { url: `${SITE_URL}/privacy`, lastModified, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${SITE_URL}/terms`, lastModified, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${SITE_URL}/cookies`, lastModified, changeFrequency: 'yearly', priority: 0.2 },
  ]
}
