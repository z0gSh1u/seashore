import { toolDefinition } from '@tanstack/ai'
import { z } from 'zod'

export const serperSearchDefinition = toolDefinition({
  name: 'web_search',
  description: 'Search the web using Serper API and return relevant results',
  inputSchema: z.object({
    query: z.string().describe('The search query'),
    numResults: z.number().optional().default(10).describe('Number of results to return'),
    type: z
      .enum(['search', 'news', 'images'])
      .optional()
      .default('search')
      .describe('Type of search'),
  }),
  outputSchema: z.object({
    results: z.array(
      z.object({
        title: z.string(),
        link: z.string(),
        snippet: z.string(),
        position: z.number().optional(),
      }),
    ),
  }),
})

export interface SerperConfig {
  apiKey: string
  baseURL?: string
}

export function createSerperSearch(config: SerperConfig) {
  const baseURL = config.baseURL ?? 'https://google.serper.dev'

  return serperSearchDefinition.server(async (input: any) => {
    const response = await fetch(`${baseURL}/${input.type ?? 'search'}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': config.apiKey,
      },
      body: JSON.stringify({
        q: input.query,
        num: input.numResults ?? 10,
      }),
    })

    if (!response.ok) {
      const text = await response.text()
      throw new Error(`Serper API error (${response.status}): ${text}`)
    }

    const data = (await response.json()) as {
      organic?: Array<{
        title: string
        link: string
        snippet: string
        position: number
      }>
    }

    return {
      results: (data.organic ?? []).map((item) => ({
        title: item.title,
        link: item.link,
        snippet: item.snippet,
        position: item.position,
      })),
    }
  })
}
