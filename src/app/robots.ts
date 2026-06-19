import type { MetadataRoute } from 'next'

// Block all search engine crawling — site should be invisible on Google.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      disallow: '/',
    },
  }
}
