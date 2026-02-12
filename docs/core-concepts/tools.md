# Tools

**Tools** give agents the ability to interact with the external world. They are functions that agents can call to gather information, perform actions, or access services.

## Overview

Tools are the bridge between **AI reasoning** and **real-world actions**:

```
┌─────────────┐
│  LLM Agent  │ ──┐
└─────────────┘   │
                  │ "I need to search for X"
                  │
                  ▼
         ┌────────────────┐
         │   Tool Layer   │
         │ (Type-checked, │
         │  validated)    │
         └────────┬───────┘
                  │
     ┌────────────┼────────────┐
     │            │            │
     ▼            ▼            ▼
┌─────────┐  ┌────────┐  ┌─────────┐
│Search API│ │Database│  │File I/O │
└─────────┘  └────────┘  └─────────┘
```

**Key capabilities:**
- **Type-safe** - Zod schemas validate inputs/outputs
- **Composable** - Combine tools into toolkits
- **Async** - Native async/await support
- **Error handling** - Graceful failure with error messages
- **Observable** - Track tool calls and results

---

## Tool Interface

### Basic Structure

```typescript
interface Tool {
  name: string                          // Unique identifier
  description: string                   // What the tool does
  parameters: z.ZodType<any>           // Input schema
  execute: (args: any) => Promise<any>  // Implementation
}
```

### TanStack AI Integration

Seashore tools use TanStack AI's `toolDefinition`:

```typescript
import { toolDefinition } from '@tanstack/ai'
import { z } from 'zod'

const searchTool = toolDefinition({
  name: 'web_search',
  description: 'Search the web for information',
  inputSchema: z.object({
    query: z.string().describe('Search query'),
    numResults: z.number().optional().default(10),
  }),
  outputSchema: z.object({
    results: z.array(z.object({
      title: z.string(),
      url: z.string(),
      snippet: z.string(),
    })),
  }),
}).server(async (input) => {
  // Implementation
  const results = await searchAPI(input.query)
  return { results }
})
```

---

## Creating Tools

### Simple Tool

```typescript
import { toolDefinition } from '@tanstack/ai'
import { z } from 'zod'

const calculatorTool = toolDefinition({
  name: 'calculator',
  description: 'Perform basic arithmetic operations',
  inputSchema: z.object({
    operation: z.enum(['add', 'subtract', 'multiply', 'divide']),
    a: z.number(),
    b: z.number(),
  }),
  outputSchema: z.number(),
}).server(async ({ operation, a, b }) => {
  switch (operation) {
    case 'add': return a + b
    case 'subtract': return a - b
    case 'multiply': return a * b
    case 'divide':
      if (b === 0) throw new Error('Division by zero')
      return a / b
  }
})
```

### Tool with External API

```typescript
const weatherTool = toolDefinition({
  name: 'get_weather',
  description: 'Get current weather for a location',
  inputSchema: z.object({
    location: z.string().describe('City name or zip code'),
    units: z.enum(['celsius', 'fahrenheit']).default('celsius'),
  }),
  outputSchema: z.object({
    temperature: z.number(),
    condition: z.string(),
    humidity: z.number(),
  }),
}).server(async ({ location, units }) => {
  const response = await fetch(
    `https://api.weather.com/v1/current?location=${location}&units=${units}`,
    {
      headers: {
        'Authorization': `Bearer ${process.env.WEATHER_API_KEY}`
      }
    }
  )

  if (!response.ok) {
    throw new Error(`Weather API error: ${response.statusText}`)
  }

  const data = await response.json()
  
  return {
    temperature: data.temp,
    condition: data.conditions,
    humidity: data.humidity,
  }
})
```

### Tool with Database Access

```typescript
const getUserTool = toolDefinition({
  name: 'get_user',
  description: 'Fetch user information from database',
  inputSchema: z.object({
    userId: z.string().uuid(),
  }),
  outputSchema: z.object({
    id: z.string(),
    name: z.string(),
    email: z.string().email(),
    createdAt: z.string(),
  }),
}).server(async ({ userId }) => {
  const user = await db.user.findUnique({
    where: { id: userId }
  })

  if (!user) {
    throw new Error(`User ${userId} not found`)
  }

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    createdAt: user.createdAt.toISOString(),
  }
})
```

---

## Parameter Schemas

### Basic Types

```typescript
z.object({
  string: z.string(),
  number: z.number(),
  boolean: z.boolean(),
  array: z.array(z.string()),
  object: z.object({ key: z.string() }),
})
```

### Optional Parameters

```typescript
z.object({
  required: z.string(),
  optional: z.string().optional(),
  withDefault: z.number().default(10),
})

// Valid inputs:
// { required: "hello" }
// { required: "hello", optional: "world" }
// { required: "hello", withDefault: 20 }
```

### Enums

```typescript
z.object({
  type: z.enum(['search', 'news', 'images']),
  color: z.union([
    z.literal('red'),
    z.literal('blue'),
    z.literal('green')
  ]),
})
```

### Nested Objects

```typescript
z.object({
  user: z.object({
    name: z.string(),
    age: z.number(),
    address: z.object({
      street: z.string(),
      city: z.string(),
      zip: z.string(),
    }),
  }),
})
```

### Arrays

```typescript
z.object({
  simpleArray: z.array(z.string()),
  objectArray: z.array(z.object({
    id: z.string(),
    value: z.number(),
  })),
  minMaxArray: z.array(z.string()).min(1).max(10),
})
```

### Refinements

```typescript
z.object({
  email: z.string().email(),
  url: z.string().url(),
  uuid: z.string().uuid(),
  positiveNumber: z.number().positive(),
  minMax: z.number().min(0).max(100),
  customValidation: z.string().refine(
    (val) => val.startsWith('prefix_'),
    { message: 'Must start with prefix_' }
  ),
})
```

### Descriptions

Help LLMs understand parameters:

```typescript
z.object({
  query: z.string().describe('The search query to execute'),
  maxResults: z.number()
    .min(1)
    .max(100)
    .default(10)
    .describe('Maximum number of results to return (1-100)'),
  sortBy: z.enum(['relevance', 'date', 'popularity'])
    .default('relevance')
    .describe('How to sort the results'),
})
```

---

## Tool Execution

### Synchronous Execution

```typescript
const result = await calculatorTool.execute({
  operation: 'add',
  a: 5,
  b: 3
})

console.log(result)  // 8
```

### Error Handling

```typescript
try {
  const result = await weatherTool.execute({
    location: 'InvalidCity'
  })
} catch (error) {
  if (error instanceof Error) {
    console.error('Tool error:', error.message)
  }
}
```

### Validation Errors

Zod automatically validates inputs:

```typescript
try {
  await calculatorTool.execute({
    operation: 'add',
    a: 'not a number',  // Invalid!
    b: 5
  })
} catch (error) {
  console.error(error)
  // ZodError: Expected number, received string
}
```

---

## Toolkits

**Toolkits** are collections of related tools.

### Creating a Toolkit

```typescript
import { createToolkit } from '@seashore/core'

const mathToolkit = createToolkit([
  calculatorTool,
  statisticsTool,
  algebraTool,
])

const webToolkit = createToolkit([
  searchTool,
  scrapeTool,
  summarizeTool,
])
```

### Using Toolkits with Agents

```typescript
import { createReActAgent } from '@seashore/agent'

const agent = createReActAgent({
  model: () => llm('gpt-4o'),
  systemPrompt: 'You are a research assistant.',
  tools: [
    ...webToolkit,
    ...mathToolkit,
  ],
})
```

### Conditional Tool Access

```typescript
function createUserToolkit(role: 'admin' | 'user') {
  const baseTools = [searchTool, calculatorTool]
  
  if (role === 'admin') {
    return createToolkit([
      ...baseTools,
      deleteUserTool,
      modifySettingsTool,
    ])
  }
  
  return createToolkit(baseTools)
}

const adminAgent = createReActAgent({
  model: () => llm('gpt-4o'),
  systemPrompt: 'You are an admin assistant.',
  tools: createUserToolkit('admin'),
})
```

---

## Built-in Tools

Seashore provides pre-built tools for common tasks.

### Serper Search

Web search powered by Serper API:

```typescript
import { createSerperSearch } from '@seashore/core'

const searchTool = createSerperSearch({
  apiKey: process.env.SERPER_API_KEY!,
})

// Use with agent
const agent = createReActAgent({
  model: () => llm('gpt-4o'),
  systemPrompt: 'You are a research assistant.',
  tools: [searchTool],
})

// Search usage
const response = await agent.run([
  { role: 'user', content: 'What is the capital of France?' }
])
```

**Search options:**
```typescript
const searchTool = createSerperSearch({
  apiKey: process.env.SERPER_API_KEY!,
  baseURL: 'https://google.serper.dev',  // Optional
})

// Search types: 'search', 'news', 'images'
// Returns: { title, link, snippet, position }[]
```

### Firecrawl Scraper

Web scraping with Firecrawl:

```typescript
import { createFirecrawlScrape } from '@seashore/core'

const scrapeTool = createFirecrawlScrape({
  apiKey: process.env.FIRECRAWL_API_KEY!,
})

const agent = createReActAgent({
  model: () => llm('gpt-4o'),
  systemPrompt: 'You can scrape web pages.',
  tools: [scrapeTool],
})

// Scrape usage
const response = await agent.run([
  { role: 'user', content: 'Scrape https://example.com and summarize' }
])
```

**Scrape options:**
```typescript
const scrapeTool = createFirecrawlScrape({
  apiKey: process.env.FIRECRAWL_API_KEY!,
  baseURL: 'https://api.firecrawl.dev/v1',  // Optional
})

// Formats: 'markdown', 'html', 'rawHtml', 'screenshot'
// Returns: { content, metadata: { title, description, sourceURL } }
```

---

## Advanced Patterns

### Tool Chaining

Tools that call other tools:

```typescript
const researchTool = toolDefinition({
  name: 'research_topic',
  description: 'Research a topic using multiple sources',
  inputSchema: z.object({
    topic: z.string(),
  }),
  outputSchema: z.object({
    summary: z.string(),
    sources: z.array(z.string()),
  }),
}).server(async ({ topic }) => {
  // Search for information
  const searchResults = await searchTool.execute({
    query: topic,
    numResults: 5
  })

  // Scrape top results
  const scrapedContent = await Promise.all(
    searchResults.results.slice(0, 3).map(r =>
      scrapeTool.execute({ url: r.url })
    )
  )

  // Combine and summarize
  const allContent = scrapedContent
    .map(s => s.content)
    .join('\n\n')

  return {
    summary: summarize(allContent),
    sources: searchResults.results.map(r => r.url),
  }
})
```

### Caching Tool Results

```typescript
const cache = new Map<string, any>()

const cachedSearchTool = toolDefinition({
  name: 'cached_search',
  description: 'Search with caching',
  inputSchema: z.object({
    query: z.string(),
  }),
  outputSchema: z.object({
    results: z.array(z.any()),
  }),
}).server(async ({ query }) => {
  const cacheKey = `search:${query}`
  
  if (cache.has(cacheKey)) {
    console.log('Cache hit!')
    return cache.get(cacheKey)
  }

  const results = await performSearch(query)
  cache.set(cacheKey, results)
  
  return results
})
```

### Rate-Limited Tools

```typescript
import pLimit from 'p-limit'

const limit = pLimit(5)  // Max 5 concurrent calls

const rateLimitedTool = toolDefinition({
  name: 'rate_limited_api',
  description: 'API with rate limiting',
  inputSchema: z.object({
    endpoint: z.string(),
  }),
  outputSchema: z.any(),
}).server(async ({ endpoint }) => {
  return limit(async () => {
    return await fetch(`https://api.example.com/${endpoint}`)
  })
})
```

### Tool with Streaming

```typescript
const streamingTool = toolDefinition({
  name: 'stream_data',
  description: 'Stream large dataset',
  inputSchema: z.object({
    source: z.string(),
  }),
  outputSchema: z.object({
    chunks: z.array(z.any()),
  }),
}).server(async ({ source }) => {
  const chunks: any[] = []
  
  for await (const chunk of streamDataSource(source)) {
    chunks.push(chunk)
  }
  
  return { chunks }
})
```

### Tool with Context

Pass shared context to tools:

```typescript
interface ToolContext {
  userId: string
  sessionId: string
  db: Database
}

function createContextualTool(ctx: ToolContext) {
  return toolDefinition({
    name: 'get_user_data',
    description: 'Get current user data',
    inputSchema: z.object({}),
    outputSchema: z.object({
      name: z.string(),
      email: z.string(),
    }),
  }).server(async () => {
    return await ctx.db.user.findUnique({
      where: { id: ctx.userId }
    })
  })
}

// Usage
const ctx = { userId: '123', sessionId: 'abc', db }
const tool = createContextualTool(ctx)
```

---

## Error Handling

### Throwing Errors

Provide helpful error messages:

```typescript
const tool = toolDefinition({
  name: 'safe_divide',
  description: 'Divide two numbers',
  inputSchema: z.object({
    a: z.number(),
    b: z.number(),
  }),
  outputSchema: z.number(),
}).server(async ({ a, b }) => {
  if (b === 0) {
    throw new Error('Cannot divide by zero. Please provide a non-zero denominator.')
  }
  
  if (!Number.isFinite(a) || !Number.isFinite(b)) {
    throw new Error('Both numbers must be finite values.')
  }
  
  return a / b
})
```

### Returning Error States

Alternative: return error info instead of throwing:

```typescript
const tool = toolDefinition({
  name: 'fetch_data',
  description: 'Fetch data from API',
  inputSchema: z.object({
    url: z.string().url(),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    data: z.any().optional(),
    error: z.string().optional(),
  }),
}).server(async ({ url }) => {
  try {
    const response = await fetch(url)
    const data = await response.json()
    
    return {
      success: true,
      data,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
})
```

### Retry Logic

```typescript
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  delayMs = 1000
): Promise<T> {
  let lastError: Error | undefined
  
  for (let i = 0; i <= maxRetries; i++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      if (i < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, delayMs * (i + 1)))
      }
    }
  }
  
  throw lastError
}

const resilientTool = toolDefinition({
  name: 'resilient_api',
  description: 'API call with retry',
  inputSchema: z.object({
    endpoint: z.string(),
  }),
  outputSchema: z.any(),
}).server(async ({ endpoint }) => {
  return withRetry(() => fetch(`/api/${endpoint}`), 3, 1000)
})
```

---

## Best Practices

### 1. Clear Tool Names

```typescript
// ❌ BAD: Vague name
name: 'search'

// ✅ GOOD: Specific name
name: 'web_search'
name: 'search_company_documents'
name: 'search_user_database'
```

### 2. Descriptive Descriptions

```typescript
// ❌ BAD: Minimal description
description: 'Search'

// ✅ GOOD: Clear description with context
description: 'Search the company knowledge base for articles, policies, and FAQs. Returns the top 10 most relevant documents.'
```

### 3. Document Parameters

```typescript
// ✅ GOOD: Well-documented parameters
inputSchema: z.object({
  query: z.string()
    .min(3)
    .describe('Search query (minimum 3 characters)'),
  maxResults: z.number()
    .min(1)
    .max(50)
    .default(10)
    .describe('Maximum number of results to return (1-50, default: 10)'),
  category: z.enum(['all', 'docs', 'code', 'issues'])
    .default('all')
    .describe('Filter results by category'),
})
```

### 4. Validate Inputs

```typescript
inputSchema: z.object({
  email: z.string().email(),
  age: z.number().int().positive(),
  url: z.string().url(),
  date: z.string().refine(
    (val) => !isNaN(Date.parse(val)),
    { message: 'Invalid date format' }
  ),
})
```

### 5. Return Structured Data

```typescript
// ❌ BAD: Unstructured string
outputSchema: z.string()

// ✅ GOOD: Structured, parseable data
outputSchema: z.object({
  results: z.array(z.object({
    id: z.string(),
    title: z.string(),
    relevance: z.number(),
  })),
  totalCount: z.number(),
  hasMore: z.boolean(),
})
```

### 6. Handle Edge Cases

```typescript
.server(async ({ query }) => {
  // Handle empty query
  if (!query.trim()) {
    return { results: [], message: 'Empty query provided' }
  }

  // Handle no results
  const results = await search(query)
  if (results.length === 0) {
    return {
      results: [],
      message: 'No results found. Try different keywords.'
    }
  }

  // Handle API errors
  try {
    const enriched = await enrichResults(results)
    return { results: enriched }
  } catch (error) {
    // Fallback to basic results
    return { results }
  }
})
```

### 7. Add Timeouts

```typescript
async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number
): Promise<T> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('Timeout')), timeoutMs)
  )
  return Promise.race([promise, timeout])
}

const tool = toolDefinition({
  name: 'external_api',
  description: 'Call external API',
  inputSchema: z.object({ url: z.string() }),
  outputSchema: z.any(),
}).server(async ({ url }) => {
  return withTimeout(
    fetch(url),
    5000  // 5 second timeout
  )
})
```

---

## Common Pitfalls

### 1. Overly Generic Tools

```typescript
// ❌ BAD: Too generic, agent won't know when to use
const tool = toolDefinition({
  name: 'do_thing',
  description: 'Does something',
  inputSchema: z.object({ data: z.any() }),
  outputSchema: z.any(),
})

// ✅ GOOD: Specific purpose
const tool = toolDefinition({
  name: 'search_customer_orders',
  description: 'Search customer orders by email or order ID',
  inputSchema: z.object({
    searchTerm: z.string(),
    searchType: z.enum(['email', 'orderId']),
  }),
  outputSchema: z.array(z.object({
    orderId: z.string(),
    customerEmail: z.string(),
    status: z.enum(['pending', 'shipped', 'delivered']),
  })),
})
```

### 2. Missing Error Messages

```typescript
// ❌ BAD: Silent failures
.server(async ({ userId }) => {
  const user = await db.user.findUnique({ where: { id: userId } })
  return user  // undefined if not found
})

// ✅ GOOD: Clear error messages
.server(async ({ userId }) => {
  const user = await db.user.findUnique({ where: { id: userId } })
  
  if (!user) {
    throw new Error(`User with ID ${userId} not found. Please verify the user ID and try again.`)
  }
  
  return user
})
```

### 3. Returning Too Much Data

```typescript
// ❌ BAD: Returns entire dataset (overwhelms context)
.server(async ({ query }) => {
  return await db.article.findMany({ where: { content: { contains: query } } })
})

// ✅ GOOD: Returns summary
.server(async ({ query }) => {
  const articles = await db.article.findMany({
    where: { content: { contains: query } },
    take: 10,  // Limit results
  })
  
  return articles.map(a => ({
    id: a.id,
    title: a.title,
    snippet: a.content.slice(0, 200),  // Truncate content
    relevance: calculateRelevance(a, query),
  }))
})
```

### 4. Blocking Async Operations

```typescript
// ❌ BAD: Sequential (slow)
.server(async ({ urls }) => {
  const results = []
  for (const url of urls) {
    results.push(await fetch(url))
  }
  return results
})

// ✅ GOOD: Parallel (fast)
.server(async ({ urls }) => {
  return await Promise.all(urls.map(url => fetch(url)))
})
```

---

## Testing Tools

### Unit Tests

```typescript
import { describe, it, expect } from 'vitest'

describe('calculatorTool', () => {
  it('should add two numbers', async () => {
    const result = await calculatorTool.execute({
      operation: 'add',
      a: 5,
      b: 3
    })
    expect(result).toBe(8)
  })

  it('should handle division by zero', async () => {
    await expect(
      calculatorTool.execute({
        operation: 'divide',
        a: 10,
        b: 0
      })
    ).rejects.toThrow('Division by zero')
  })
})
```

### Mocking External APIs

```typescript
import { vi } from 'vitest'

describe('weatherTool', () => {
  it('should fetch weather data', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        temp: 22,
        conditions: 'sunny',
        humidity: 60
      })
    })

    const result = await weatherTool.execute({
      location: 'San Francisco'
    })

    expect(result.temperature).toBe(22)
    expect(result.condition).toBe('sunny')
  })
})
```

---

## Related Concepts

- **[Agents](./agents.md)** - Using tools with ReAct agents
- **[Workflows](./workflows.md)** - Tools in workflow steps
- **[MCP Integration](../guides/mcp.md)** - Model Context Protocol tools

---

## Next Steps

- **[Create Your First Tool](../getting-started/first-tool.md)**
- **[Tool Examples](../../examples/tools/)**
- **[MCP Tool Integration](../guides/mcp.md)**
