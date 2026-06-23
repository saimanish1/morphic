import { ContentProvider, ContentResult } from './base'

const CONTENT_CHARACTER_LIMIT = 50000
const TITLE_CHARACTER_LIMIT = 100

export class RegularContentProvider implements ContentProvider {
  name = 'regular'

  async fetch(url: string): Promise<ContentResult> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000)

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; Morphic/1.0)',
          Accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        }
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const contentType = response.headers.get('content-type') || ''
      if (
        !contentType.includes('text/html') &&
        !contentType.includes('text/plain')
      ) {
        throw new Error(`Unsupported content type: ${contentType}`)
      }

      const html = await response.text()

      // Extract title
      const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i)
      const rawTitle = titleMatch ? titleMatch[1].trim() : new URL(url).hostname
      const title =
        rawTitle.length > TITLE_CHARACTER_LIMIT
          ? rawTitle.substring(0, TITLE_CHARACTER_LIMIT) + '...'
          : rawTitle

      // Process HTML content
      let processedHtml = html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')

      // Replace img tags with alt text or [IMAGE] markers
      processedHtml = processedHtml
        .replace(
          /<img[^>]+alt\s*=\s*["']([^"']+)["'][^>]*>/gi,
          ' [IMAGE: $1] '
        )
        .replace(/<img[^>]+src\s*=\s*["']([^"']+)["'][^>]*>/gi, ' [IMAGE] ')
        .replace(/<img[^>]*>/gi, ' [IMAGE] ')

      // Extract text content
      const textContent = processedHtml
        .replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()

      const truncatedContent =
        textContent.length > CONTENT_CHARACTER_LIMIT
          ? textContent.substring(0, CONTENT_CHARACTER_LIMIT) + '...[truncated]'
          : textContent

      return {
        title,
        content: truncatedContent,
        url
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Request timeout after 10 seconds')
      }
      console.error('Regular fetch error:', error)
      throw error instanceof Error ? error : new Error('Unknown fetch error')
    }
  }
}
