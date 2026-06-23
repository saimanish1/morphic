import { ContentProvider, ContentResult } from './base'

const DEFAULT_API_URL = 'http://localhost:9377'

interface CamofoxTabResponse {
  tabId: string
  url: string
}

interface CamofoxSnapshotResponse {
  url: string
  snapshot: string
  refsCount: number
}

interface CamofoxEvaluateResponse<T> {
  ok: boolean
  result: T
}

interface CamofoxPageText {
  title?: string
  url?: string
  content?: string
}

export class CamofoxContentProvider implements ContentProvider {
  name = 'camofox'
  private apiUrl: string
  private apiKey: string | undefined

  constructor() {
    this.apiUrl = (process.env.CAMOFOX_API_URL || DEFAULT_API_URL).replace(
      /\/$/,
      ''
    )
    this.apiKey = process.env.CAMOFOX_API_KEY
  }

  async fetch(url: string): Promise<ContentResult> {
    const userId = 'morphic'
    const sessionKey = 'fetch'
    let tabId: string | null = null

    try {
      // Step 1: Create a tab and navigate to URL
      const tabResponse = await this.request<CamofoxTabResponse>(
        'POST',
        '/tabs',
        {
          userId,
          sessionKey,
          url
        }
      )
      tabId = tabResponse.tabId

      // Let the page render before extracting. Reddit and other protected
      // sites show a brief Cloudflare interstitial that takes 1-3 seconds.
      await new Promise(r => setTimeout(r, 2000))

      // Step 2: Prefer real rendered page text via evaluate.
      let pageContent: CamofoxPageText = {}
      let evaluateAttempts = 0

      while (evaluateAttempts < 2) {
        try {
          const evaluated = await this.request<
            CamofoxEvaluateResponse<CamofoxPageText>
          >('POST', `/tabs/${tabId}/evaluate`, {
            userId,
            expression: `(() => {
              const blockedSelectors = 'script,style,noscript,svg,canvas';
              document.querySelectorAll(blockedSelectors).forEach(el => el.remove());
              const content = document.body?.innerText || document.documentElement?.textContent || '';
              return {
                title: document.title || '',
                url: window.location.href,
                content
              };
            })()`
          })

          pageContent = evaluated.result || {}
          break
        } catch (error) {
          evaluateAttempts++
          if (evaluateAttempts < 2) {
            // Page may still be rendering — wait longer and retry
            await new Promise(r => setTimeout(r, 3000))
          }
        }
      }

      const content = this.truncate(pageContent.content || '')

      // If content looks like a blocked/verification page, try snapshot as fallback
      if (content.trim().length > 0 && !this.looksBlocked(content)) {
        return {
          title: pageContent.title || this.fallbackTitle(pageContent.url || url),
          content,
          url: pageContent.url || url
        }
      }

      if (content.trim().length > 0 && this.looksBlocked(content)) {
        console.warn(
          `Camofox evaluate returned blocked content for ${url}, trying snapshot`
        )
      }

      // Step 3: Snapshot fallback when evaluate is unavailable or empty.
      const snapshotResponse = await this.request<CamofoxSnapshotResponse>(
        'GET',
        `/tabs/${tabId}/snapshot?userId=${encodeURIComponent(userId)}`
      )

      const snapshot = snapshotResponse.snapshot || ''
      const title =
        this.extractTitleFromSnapshot(snapshot) ||
        this.fallbackTitle(snapshotResponse.url || url)

      return {
        title,
        content: this.truncate(snapshot),
        url: snapshotResponse.url || url
      }
    } finally {
      // Step 4: Always close the tab
      if (tabId) {
        try {
          await this.request(
            'DELETE',
            `/tabs/${tabId}?userId=${encodeURIComponent(userId)}`
          )
        } catch (e) {
          console.error(
            `Camofox: Failed to close tab ${tabId}:`,
            (e as Error).message
          )
        }
      }
    }
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    }

    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`
    }

    const url = `${this.apiUrl}${path}`

    const options: RequestInit = { method, headers }

    if (body && (method === 'POST' || method === 'DELETE')) {
      options.body = JSON.stringify(body)
    }

    const response = await fetch(url, options)

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error')
      throw new Error(
        `Camofox API error (${response.status}): ${errorText.slice(0, 500)}`
      )
    }

    return response.json()
  }

  private truncate(content: string): string {
    const maxLength = 50000
    return content.length > maxLength
      ? content.substring(0, maxLength) + '...[truncated]'
      : content
  }

  private fallbackTitle(url: string): string {
    try {
      return new URL(url).hostname
    } catch {
      return url
    }
  }

  private extractTitleFromSnapshot(snapshot: string): string | null {
    return (
      snapshot.match(/^\s*-\s+heading\s+"([^"]*)"/)?.[1] ||
      snapshot.match(/\[heading\]\s+([^\[]+)/)?.[1]?.trim() ||
      null
    )
  }

  private looksBlocked(content: string): boolean {
    const lower = content.toLowerCase().trim()
    const markers = [
      'please wait for verification',
      'checking your browser',
      'enable javascript and cookies',
      'access denied',
      'are you a robot',
      'cf-browser-verification',
      'cf-challenge',
      'attention required',
      'just a moment',
      'ddos protection'
    ]
    return markers.some(m => lower.includes(m)) || lower.length < 100
  }
}
