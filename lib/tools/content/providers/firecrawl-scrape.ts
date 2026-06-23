// TODO: Implement Firecrawl scrape content provider.
// Firecrawl's cloud API (/v2/scrape) can be used to extract content from a URL.
// When FIRECRAWL_API_KEY is set and FIRECRAWL_API_URL is configured for self-hosted,
// use the Firecrawl scrape endpoint.
//
// The existing FirecrawlClient does not expose a scrape method, so this
// provider currently falls back to the regular provider. Implement when needed.
//
// Example implementation:
//   POST {baseUrl}/scrape with body { url, formats: ['markdown'] }
//   Returns { data: { markdown, title, url } }

import { ContentProvider, ContentResult } from './base'
import { RegularContentProvider } from './regular'

export class FirecrawlScrapeContentProvider implements ContentProvider {
  name = 'firecrawl-scrape'
  private fallback: RegularContentProvider

  constructor() {
    this.fallback = new RegularContentProvider()
  }

  async fetch(url: string): Promise<ContentResult> {
    // When Firecrawl scrape is properly implemented, use it here.
    // For now, fall back to regular HTTP fetch.
    console.warn(
      '[firecrawl-scrape] Full scrape not yet implemented. Falling back to regular fetch.'
    )
    return this.fallback.fetch(url)
  }
}
