import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/seo'
import { getTopics } from '@/lib/topics'
import { getGuides } from '@/lib/guides'
import { FEATURES } from '@/lib/features-data'

// Only pages meant to rank: landing, legal, topics, guides, tools, features.
// The signed-in app is noindex (lib/seo.ts).
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date('2026-11-13')
  return [
    { url: `${SITE_URL}/`, lastModified, changeFrequency: 'weekly', priority: 1 },
    { url: `${SITE_URL}/privacy`, lastModified, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${SITE_URL}/terms`, lastModified, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${SITE_URL}/cookies`, lastModified, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${SITE_URL}/topics`, lastModified, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${SITE_URL}/guides`, lastModified, changeFrequency: 'monthly', priority: 0.8 },
    ...getGuides().map((g) => ({ url: `${SITE_URL}/guides/${g.slug}`, lastModified, changeFrequency: 'monthly' as const, priority: 0.7 })),
    { url: `${SITE_URL}/glossary`, lastModified, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${SITE_URL}/tools`, lastModified, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${SITE_URL}/tools/break-calculator`, lastModified, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${SITE_URL}/tools/debate-timer`, lastModified, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${SITE_URL}/resolutions`, lastModified, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${SITE_URL}/features`, lastModified, changeFrequency: 'monthly', priority: 0.7 },
    ...FEATURES.map((f) => ({ url: `${SITE_URL}/features/${f.slug}`, lastModified, changeFrequency: 'monthly' as const, priority: 0.7 })),
    ...getTopics().map((t) => ({
      url: `${SITE_URL}/topics/${t.slug}`,
      lastModified,
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    })),
  ]
}
