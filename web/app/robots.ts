import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/seo'

// Everything public may be crawled, including by AI crawlers (being cited by
// AI search is a feature). /api is machine-only. App screens are crawlable
// but marked noindex per page (lib/seo.ts), which is what keeps them out of
// results — a robots.txt Disallow would hide that noindex from crawlers.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/api/', '/preview'] }],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  }
}
