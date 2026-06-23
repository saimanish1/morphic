import { ContentProvider } from './base'
import { CamofoxContentProvider } from './camofox'
import { FirecrawlScrapeContentProvider } from './firecrawl-scrape'
import { JinaContentProvider } from './jina'
import { RegularContentProvider } from './regular'
import { TavilyExtractContentProvider } from './tavily-extract'

export type ContentProviderType =
  | 'regular'
  | 'camofox'
  | 'jina'
  | 'tavily-extract'
  | 'firecrawl-scrape'

const DEFAULT_CONTENT_PROVIDER: ContentProviderType = 'regular'

export function createContentProvider(
  type?: ContentProviderType
): ContentProvider {
  const providerType =
    type ||
    (process.env.CONTENT_API as ContentProviderType) ||
    DEFAULT_CONTENT_PROVIDER

  switch (providerType) {
    case 'regular':
      return new RegularContentProvider()
    case 'camofox':
      return new CamofoxContentProvider()
    case 'jina':
      return new JinaContentProvider()
    case 'tavily-extract':
      return new TavilyExtractContentProvider()
    case 'firecrawl-scrape':
      return new FirecrawlScrapeContentProvider()
    default:
      return new RegularContentProvider()
  }
}

export type { ContentProvider } from './base'
export { CamofoxContentProvider } from './camofox'
export { FirecrawlScrapeContentProvider } from './firecrawl-scrape'
export { JinaContentProvider } from './jina'
export { RegularContentProvider } from './regular'
export { TavilyExtractContentProvider } from './tavily-extract'
