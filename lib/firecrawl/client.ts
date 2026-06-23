import {
  FirecrawlImageSearchOptions,
  FirecrawlImageSearchResponse,
  FirecrawlSearchOptions,
  FirecrawlSearchResponse
} from './types'

export class FirecrawlClient {
  private readonly apiKey: string
  private readonly baseUrl: string

  constructor(apiKey: string) {
    this.apiKey = apiKey
    this.baseUrl = (
      process.env.FIRECRAWL_API_URL || 'https://api.firecrawl.dev/v2'
    ).replace(/\/$/, '')
  }

  async search(
    options: FirecrawlSearchOptions
  ): Promise<FirecrawlSearchResponse> {
    const body = JSON.stringify({
      query: options.query,
      sources: options.sources || ['web'],
      limit: options.limit || 10,
      location: options.location,
      tbs: options.tbs,
      scrapeOptions: {
        formats: ['markdown'],
        proxy: 'auto',
        blockAds: true
      }
    })
    const response = await fetch(`${this.baseUrl}/search`, {
      method: 'POST',
      headers: this.getHeaders(),
      body
    })

    return this.handleResponse<FirecrawlSearchResponse>(response)
  }

  async searchImages(
    options: FirecrawlImageSearchOptions
  ): Promise<FirecrawlImageSearchResponse> {
    const body = JSON.stringify({
      query: options.query,
      sources: ['images'],
      limit: options.limit || 8
    })

    const response = await fetch(`${this.baseUrl}/search`, {
      method: 'POST',
      headers: this.getHeaders(),
      body
    })

    return this.handleResponse<FirecrawlImageSearchResponse>(response)
  }

  async getImagesForQuery(
    query: string,
    maxResults: number = 8
  ): Promise<{ url: string; description: string }[]> {
    try {
      const searchResponse = await this.searchImages({
        query,
        limit: maxResults
      })

      const data = searchResponse.data

      if (!searchResponse.success || !data.images) return []

      return data.images.map(image => ({
        url: image.imageUrl,
        description: image.title ?? ''
      }))
    } catch (error) {
      console.error('Firecrawl image search error:', error)
      return []
    }
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    }

    if (this.apiKey) {
      headers.Authorization = `Bearer ${this.apiKey}`
    }

    return headers
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(
        `Firecrawl status: ${response.status}, reason error: ${errorText}`
      )
    }
    return response.json()
  }
}
