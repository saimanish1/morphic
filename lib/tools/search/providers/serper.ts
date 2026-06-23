import { SearchResults } from '@/lib/types'
import { sanitizeUrl } from '@/lib/utils'

import { BaseSearchProvider } from './base'

interface SerperOrganicResult {
  title?: string
  link?: string
  snippet?: string
}

interface SerperImageResult {
  imageUrl?: string
  title?: string
  source?: string
}

interface SerperResponse {
  organic?: SerperOrganicResult[]
  images?: SerperImageResult[]
  answerBox?: {
    title?: string
    snippet?: string
    link?: string
  }
  knowledgeGraph?: {
    title?: string
    description?: string
    website?: string
  }
  peopleAlsoAsk?: Array<{
    question?: string
    snippet?: string
    link?: string
  }>
}

export class SerperSearchProvider extends BaseSearchProvider {
  async search(
    query: string,
    maxResults: number = 10,
    _searchDepth: 'basic' | 'advanced' = 'basic',
    includeDomains: string[] = [],
    excludeDomains: string[] = []
  ): Promise<SearchResults> {
    const apiKey = process.env.SERPER_API_KEY
    this.validateApiKey(apiKey, 'SERPER')

    // Serper proxies Google — use site: operators for domain filtering
    // since the API itself has no include/exclude domain params.
    let effectiveQuery = query
    if (includeDomains.length > 0) {
      const siteFilter = includeDomains
        .map(d => `site:${d}`)
        .join(' OR ')
      effectiveQuery = `${siteFilter} ${query}`
    }
    if (excludeDomains.length > 0) {
      const excludeFilter = excludeDomains
        .map(d => `-site:${d}`)
        .join(' ')
      effectiveQuery = `${excludeFilter} ${effectiveQuery}`
    }

    const body: Record<string, unknown> = {
      q: effectiveQuery,
      num: Math.max(maxResults || 10, 1)
    }

    // Optional region/language settings
    if (process.env.SERPER_GL) {
      body.gl = process.env.SERPER_GL
    }
    if (process.env.SERPER_HL) {
      body.hl = process.env.SERPER_HL
    }

    const response = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: {
        'X-API-KEY': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(
        `Serper API error (${response.status}): ${errorText.slice(0, 200)}`
      )
      throw new Error('Search failed')
    }

    const data: SerperResponse = await response.json()

    // Map organic results
    const results = (data.organic || []).slice(0, maxResults).map(r => ({
      title: r.title || 'No title',
      url: sanitizeUrl(r.link || ''),
      content: r.snippet || ''
    }))

    // Map images
    const images = (data.images || []).map(img => {
      const url = sanitizeUrl(img.imageUrl || '')
      const description = img.title || img.source || ''
      return { url, description }
    })

    return {
      results,
      images,
      query,
      number_of_results: results.length
    }
  }
}
