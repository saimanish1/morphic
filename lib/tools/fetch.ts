import { tool, UIToolInvocation } from 'ai'

import { fetchSchema } from '@/lib/schema/fetch'
import { SearchResults as SearchResultsType } from '@/lib/types'
import { logToolPayload } from '@/lib/utils/usage-logging'

import {
  ContentProviderType,
  createContentProvider
} from './content/providers'

/**
 * Heuristic: detect when a "regular" fetch was silently blocked
 * (Cloudflare challenge, empty body, bot-detection interstitial).
 */
function looksBlocked(content: string): boolean {
  const lower = content.toLowerCase().trim()
  if (lower.length < 200) return true
  const markers = [
    'please wait for verification',
    'checking your browser',
    'enable javascript and cookies',
    'access denied',
    'are you a robot',
    'cf-browser-verification',
    'cf-challenge',
    'attention required'
  ]
  return markers.some(m => lower.includes(m))
}

async function fetchWithProvider(
  url: string,
  providerType: ContentProviderType
): Promise<SearchResultsType> {
  const provider = createContentProvider(providerType)
  const result = await provider.fetch(url)

  return {
    results: [
      {
        title: result.title,
        content: result.content,
        url: result.url
      }
    ],
    query: '',
    images: []
  }
}

export const fetchTool = tool({
  description:
    'Fetch content from any URL. Supports types: "regular" (fast direct HTML fetch), "camofox" (browser-based fetch via Camofox with anti-bot detection — use for sites that block regular fetch like Reddit, Twitter, Amazon), "api" (Jina Reader or Tavily Extract for PDFs and complex JS pages). When "regular" fails or returns blocked/empty content, it automatically retries with the configured CONTENT_API provider.',
  inputSchema: fetchSchema,
  async *execute({ url, type = 'regular' }) {
    yield {
      state: 'fetching' as const,
      url
    }

    let results: SearchResultsType
    let usedFallback = false

    try {
      if (type === 'camofox') {
        results = await fetchWithProvider(url, 'camofox')
      } else if (type === 'api') {
        const useJina = process.env.JINA_API_KEY
        results = await fetchWithProvider(
          url,
          useJina ? 'jina' : 'tavily-extract'
        )
      } else {
        // Default: regular HTTP fetch
        results = await fetchWithProvider(url, 'regular')

        // Auto-fallback: if regular fetch looks blocked/empty and a
        // different CONTENT_API is configured, retry with it.
        const fallbackProvider = process.env
          .CONTENT_API as ContentProviderType

        if (
          fallbackProvider &&
          fallbackProvider !== 'regular' &&
          results.results[0] &&
          looksBlocked(results.results[0].content)
        ) {
          console.warn(
            `[fetch] Regular fetch blocked for ${url}, retrying with ${fallbackProvider}`
          )
          try {
            results = await fetchWithProvider(url, fallbackProvider)
            usedFallback = true
          } catch (fallbackErr) {
            console.warn(
              `[fetch] Fallback to ${fallbackProvider} also failed:`,
              fallbackErr
            )
            // Keep the original regular results
          }
        }
      }
    } catch (error) {
      // Last-resort: if the primary type throws and CONTENT_API is
      // configured differently, try that before giving up.
      const fallbackProvider = process.env
        .CONTENT_API as ContentProviderType

      if (
        fallbackProvider &&
        fallbackProvider !== 'regular' &&
        type !== fallbackProvider
      ) {
        console.warn(
          `[fetch] ${type} fetch failed for ${url}, retrying with ${fallbackProvider}`
        )
        try {
          results = await fetchWithProvider(url, fallbackProvider)
          usedFallback = true
        } catch {
          throw error // Re-throw original error
        }
      } else {
        throw error
      }
    }

    if (usedFallback) {
      logToolPayload('fetch', url, {
        results: results.results,
        fallback: true
      })
    } else {
      logToolPayload('fetch', url, { results: results.results })
    }

    yield {
      state: 'complete' as const,
      ...results
    }
  }
})

// Export type for UI tool invocation
export type FetchUIToolInvocation = UIToolInvocation<typeof fetchTool>
