import { toolDefinition } from '@tanstack/ai'
import { z } from 'zod'

export const firecrawlScrapeDefinition = toolDefinition({
  name: 'web_scrape',
  description: 'Scrape a web page and return its content as markdown',
  inputSchema: z.object({
    url: z.string().url().describe('The URL to scrape'),
    formats: z
      .array(z.enum(['markdown', 'html', 'rawHtml', 'screenshot']))
      .optional()
      .default(['markdown'])
      .describe('Output formats'),
  }),
  outputSchema: z.object({
    content: z.string(),
    metadata: z.object({
      title: z.string().optional(),
      description: z.string().optional(),
      sourceURL: z.string().optional(),
    }),
  }),
})

export interface FirecrawlConfig {
  apiKey: string
  baseURL?: string
}

export function createFirecrawlScrape(config: FirecrawlConfig) {
  const baseURL = config.baseURL ?? 'https://api.firecrawl.dev/v1'

  return firecrawlScrapeDefinition.server(async (input: any) => {
    const response = await fetch(`${baseURL}/scrape`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        url: input.url,
        formats: input.formats,
      }),
    })

    if (!response.ok) {
      const text = await response.text()
      throw new Error(`Firecrawl API error (${response.status}): ${text}`)
    }

    const data = (await response.json()) as {
      data: {
        markdown?: string
        html?: string
        metadata?: {
          title?: string
          description?: string
          sourceURL?: string
        }
      }
    }

    return {
      content: data.data.markdown ?? data.data.html ?? '',
      metadata: {
        title: data.data.metadata?.title,
        description: data.data.metadata?.description,
        sourceURL: data.data.metadata?.sourceURL,
      },
    }
  })
}
