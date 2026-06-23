import { ContentProvider, ContentResult } from './base'

const CONTENT_CHARACTER_LIMIT = 50000
const TITLE_CHARACTER_LIMIT = 100

export class TavilyExtractContentProvider implements ContentProvider {
  name = 'tavily-extract'

  async fetch(url: string): Promise<ContentResult> {
    const apiKey = process.env.TAVILY_API_KEY
    if (!apiKey) {
      throw new Error('TAVILY_API_KEY is not set')
    }

    const response = await fetch('https://api.tavily.com/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: apiKey, urls: [url] })
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(
        `Tavily Extract API error (${response.status}): ${errorText.slice(0, 200)}`
      )
    }

    const json = await response.json()
    if (!json.results || json.results.length === 0) {
      throw new Error('No results returned from Tavily Extract')
    }

    const result = json.results[0]
    const content = (result.raw_content || '').slice(0, CONTENT_CHARACTER_LIMIT)

    let title = result.title || ''
    if (!title) {
      title = content.slice(0, TITLE_CHARACTER_LIMIT)
    }

    return {
      title,
      content,
      url: result.url || url
    }
  }
}
