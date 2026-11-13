import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/seo'
import { getTopics } from '@/lib/topics'

// Only pages meant to rank: landing, legal, and the public topic pages.
// The signed-in app is noindex (lib/seo.ts).
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date('2026-11-13')
  return [
    { url: `${SITE_URL}/`, lastModified, changeFrequency: 'weekly', priority: 1 },
    { url: `${SITE_URL}/privacy`, lastModified, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${SITE_URL}/terms`, lastModified, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${SITE_URL}/cookies`, lastModified, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${SITE_URL}/topics`, lastModified, changeFrequency: 'weekly', priority: 0.8 },
    ...getTopics().map((t) => ({
      url: `${SITE_URL}/topics/${t.slug}`,
      lastModified,
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    })),
  ]
}
