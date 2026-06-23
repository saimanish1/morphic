import { SearchResultItem, SearchResults } from '@/lib/types'

import { ContentProviderType,createContentProvider } from './providers'

/**
 * Content enrichment mode for search results:
 * - provider: never scrape; use search-provider content only
 * - scrape: always scrape top N URLs with CONTENT_API
 * - auto: scrape only when provider content is missing/thin/snippet-like
 */
type SearchContentMode = 'provider' | 'scrape' | 'auto'

function getContentMode(): SearchContentMode {
  const mode = process.env.SEARCH_CONTENT_MODE
  if (mode === 'provider' || mode === 'scrape' || mode === 'auto') {
    return mode
  }
  return 'provider' // Default: never scrape
}

function getScrapeLimit(): number {
  const limit = parseInt(process.env.SEARCH_SCRAPE_LIMIT || '5', 10)
  return Math.max(1, isNaN(limit) ? 5 : limit)
}

function getContentMinLength(): number {
  const minLength = parseInt(process.env.CONTENT_MIN_LENGTH || '800', 10)
  return isNaN(minLength) ? 800 : minLength
}

function shouldScrapeResult(
  result: SearchResultItem,
  mode: SearchContentMode
): boolean {
  if (mode === 'provider') return false
  if (mode === 'scrape') return true
  // auto: scrape only when content is missing or thin
  if (!result.content || result.content.length < getContentMinLength()) {
    return true
  }
  return false
}

/**
 * Enrich search results by scraping top results with the configured content provider.
 * Does NOT fail the whole search if individual scrapes fail.
 */
export async function enrichSearchResults(
  searchResults: SearchResults
): Promise<SearchResults> {
  const mode = getContentMode()

  // If mode is provider, don't scrape anything
  if (mode === 'provider') {
    return searchResults
  }

  const limit = getScrapeLimit()
  const contentProvider = createContentProvider(
    process.env.CONTENT_API as ContentProviderType
  )

  // Filter to results that have a URL and need scraping
  const candidates = searchResults.results
    .filter(r => r.url && shouldScrapeResult(r, mode))
    .slice(0, limit)

  if (candidates.length === 0) {
    return searchResults
  }

  // Build a map of URL -> index for updating results
  const urlToIndex = new Map<string, number>()
  searchResults.results.forEach((r, i) => {
    if (r.url) urlToIndex.set(r.url, i)
  })

  // Scrape concurrently with a small concurrency limit
  const concurrency = 2
  for (let i = 0; i < candidates.length; i += concurrency) {
    const batch = candidates.slice(i, i + concurrency)
    const scrapeResults = await Promise.allSettled(
      batch.map(r =>
        contentProvider
          .fetch(r.url)
          .catch(() => null)
      )
    )

    for (let j = 0; j < batch.length; j++) {
      const result = scrapeResults[j]
      if (result.status === 'fulfilled' && result.value) {
        const scraped = result.value
        const idx = urlToIndex.get(batch[j].url)
        if (idx !== undefined && idx < searchResults.results.length) {
          // Preserve original title if scraped title is empty
          const originalTitle = searchResults.results[idx].title
          searchResults.results[idx] = {
            ...searchResults.results[idx],
            title: scraped.title || originalTitle,
            content: scraped.content,
            url: scraped.url || searchResults.results[idx].url
          }
        }
      }
    }
  }

  return searchResults
}
