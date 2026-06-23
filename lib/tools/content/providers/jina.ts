import { ContentProvider, ContentResult } from './base'

const CONTENT_CHARACTER_LIMIT = 50000

export class JinaContentProvider implements ContentProvider {
  name = 'jina'

  async fetch(url: string): Promise<ContentResult> {
    const response = await fetch(`https://r.jina.ai/${url}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'X-With-Generated-Alt': 'true',
        ...(process.env.JINA_API_KEY
          ? { Authorization: `Bearer ${process.env.JINA_API_KEY}` }
          : {})
      }
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(
        `Jina Reader API error (${response.status}): ${errorText.slice(0, 200)}`
      )
    }

    const json = await response.json()
    if (!json.data || !json.data.content) {
      throw new Error('No content returned from Jina Reader API')
    }

    const content = (json.data.content as string).slice(
      0,
      CONTENT_CHARACTER_LIMIT
    )

    return {
      title: json.data.title || '',
      content,
      url: json.data.url || url
    }
  }
}
