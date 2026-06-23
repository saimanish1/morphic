import { DeepPartial } from 'ai'
import { z } from 'zod'

export const fetchSchema = z.object({
  url: z.string().describe('The URL to retrieve content from'),
  type: z
    .enum(['regular', 'camofox', 'api'])
    .default('regular')
    .describe(
      'Fetch method: "regular" (default) = fast direct HTML fetch for simple web pages (does NOT support PDFs), "camofox" = browser-rendered content via Camofox (requires CAMOFOX_API_URL), "api" = advanced extraction for PDFs and complex JavaScript-rendered pages (requires Jina or Tavily API keys)'
    )
})

export type PartialInquiry = DeepPartial<typeof fetchSchema>
