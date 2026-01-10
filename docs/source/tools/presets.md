# Preset Tools

Seashore includes preset tools for common operations like web search, web scraping, and more. Use these to quickly add capabilities to your agents.

## Available Presets

### Serper (Web Search)

Search the web using Google via Serper:

```typescript
import { serperTool } from '@seashore/tool'

const searchTool = serperTool({
  apiKey: process.env.SERPER_API_KEY,
})

const agent = createAgent({
  name: 'search-agent',
  model: openaiText('gpt-4o'),
  tools: [searchTool],
})

await agent.run('What are the latest AI news?')
```

### Firecrawl (Web Scraping)

Scrape web pages, extract content:

```typescript
import { firecrawlTool } from '@seashore/tool'

const scrapeTool = firecrawlTool({
  apiKey: process.env.FIRECRAWL_API_KEY,
})

const agent = createAgent({
  name: 'researcher',
  model: openaiText('gpt-4o'),
  tools: [scrapeTool],
})

await agent.run('Summarize the content of https://example.com')
```

## Using Preset Tools

### Installation

Preset tools are part of `@seashore/tool`:

```bash
pnpm add @seashore/tool
```

### Configuration

Each preset tool requires API keys:

```bash
# Serper (Google Search API)
export SERPER_API_KEY="..."

# Firecrawl (Web Scraping)
export FIRECRAWL_API_KEY="..."
```

Or pass them directly:

```typescript
const searchTool = serperTool({
  apiKey: 'your-api-key',
  country: 'us',      // Optional: country for results
  numResults: 10,     // Optional: number of results
})
```

### Adding to Agents

```typescript
const agent = createAgent({
  name: 'web-assistant',
  model: openaiText('gpt-4o'),
  systemPrompt: 'You are a web research assistant.',
  tools: [
    serperTool({ apiKey: process.env.SERPER_API_KEY }),
    firecrawlTool({ apiKey: process.env.FIRECRAWL_API_KEY }),
  ],
})
```

## Tool Capabilities

### Serper Tool

- **Search** the web
- **Get** search results with titles, snippets, URLs
- **Filter** by date, country, language

Example output:
```typescript
{
  query: "AI news 2024",
  results: [
    {
      title: "Latest AI Breakthroughs",
      url: "https://example.com/ai-news",
      snippet: "Recent advances in AI...",
      date: "2024-01-15"
    }
  ]
}
```

### Firecrawl Tool

- **Scrape** web pages
- **Extract** structured content
- **Handle** JavaScript rendering
- **Crawl** multiple pages

Example output:
```typescript
{
  url: "https://example.com",
  content: "Page content as text...",
  metadata: {
    title: "Page Title",
    description: "Meta description",
    keywords: ["tag1", "tag2"]
  }
}
```

## Combining Preset Tools

Create powerful agents by combining tools:

```typescript
const researcherAgent = createAgent({
  name: 'researcher',
  model: openaiText('gpt-4o'),
  systemPrompt: `
    You are a research assistant.
    1. Search for relevant information
    2. Scrape detailed content from top results
    3. Synthesize findings into a summary
  `,
  tools: [
    serperTool({ apiKey: process.env.SERPER_API_KEY }),
    firecrawlTool({ apiKey: process.env.FIRECRAWL_API_KEY }),
  ],
})

const result = await researcherAgent.run(
  'Research the latest developments in quantum computing and summarize the key findings.'
)
```

## Custom Wrappers

Wrap preset tools for custom behavior:

```typescript
import { serperTool } from '@seashore/tool'

const safeSearchTool = defineTool({
  name: 'safe_search',
  description: 'Search the web with safety filters',
  inputSchema: z.object({
    query: z.string(),
  }),
  execute: async ({ query }) => {
    // Add safety filtering to query
    const safeQuery = filterUnsafeTerms(query)

    // Call the preset tool
    const results = await serperTool({
      apiKey: process.env.SERPER_API_KEY,
    }).execute({ query: safeQuery })

    // Filter results
    results.results = results.results.filter(isSafeContent)

    return results
  },
})
```

## Best Practices

1. **API Keys** — Store in environment variables, never commit
2. **Rate Limits** — Be aware of API rate limits
3. **Caching** — Cache results to reduce API calls
4. **Error Handling** — Handle API failures gracefully
5. **Cost Management** — Monitor usage to control costs

## Next Steps

- [Workflows](../workflows/index.md) — Combine tools in workflows
- [RAG](../rag/index.md) — Build knowledge retrieval systems
