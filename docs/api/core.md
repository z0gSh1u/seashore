# @seashore/core API Reference

The `@seashore/core` package provides foundational utilities for building AI agents, including LLM adapters, embedding generation, tool integration, and context engineering.

## Table of Contents

- [LLM Adapters](#llm-adapters)
  - [createLLMAdapter](#createllmadapter)
  - [LLMAdapterConfig](#llmadapterconfig)
  - [LLMProvider](#llmprovider)
- [Embedding Adapters](#embedding-adapters)
  - [createEmbeddingAdapter](#createembeddingadapter)
  - [EmbeddingConfig](#embeddingconfig)
  - [EmbeddingAdapter](#embeddingadapter)
- [Tools](#tools)
  - [createToolkit](#createtoolkit)
  - [createSerperSearch](#createserpersearch)
  - [createFirecrawlScrape](#createfirecrawlscrape)
- [Context Engineering](#context-engineering)
  - [systemPrompt](#systemprompt)
  - [fewShotMessages](#fewshotmessages)

---

## LLM Adapters

### createLLMAdapter

Creates a factory function for generating LLM adapters compatible with TanStack AI.

```typescript
function createLLMAdapter(config: LLMAdapterConfig): LLMAdapterFactory
```

**Parameters:**
- `config` (`LLMAdapterConfig`): Configuration for the LLM adapter

**Returns:**
- `LLMAdapterFactory`: A function that takes a model name and returns a TanStack AI-compatible adapter

**Example:**

```typescript
import { createLLMAdapter } from '@seashore/core'

// OpenAI
const openaiAdapter = createLLMAdapter({
  provider: 'openai',
  apiKey: process.env.OPENAI_API_KEY!,
})
const gpt4 = openaiAdapter('gpt-4o')

// Anthropic
const anthropicAdapter = createLLMAdapter({
  provider: 'anthropic',
  apiKey: process.env.ANTHROPIC_API_KEY!,
})
const claude = anthropicAdapter('claude-sonnet-4')

// Gemini
const geminiAdapter = createLLMAdapter({
  provider: 'gemini',
  apiKey: process.env.GOOGLE_API_KEY!,
})
const geminiPro = geminiAdapter('gemini-2.0-flash-exp')

// Custom base URL (e.g., Azure OpenAI)
const azureAdapter = createLLMAdapter({
  provider: 'openai',
  apiKey: process.env.AZURE_API_KEY!,
  baseURL: 'https://your-resource.openai.azure.com/openai/deployments',
})
```

---

### LLMAdapterConfig

Configuration interface for LLM adapters.

```typescript
interface LLMAdapterConfig {
  provider: LLMProvider
  apiKey: string
  baseURL?: string
}
```

**Properties:**
- `provider` (`LLMProvider`): The LLM provider to use (`'openai'` | `'anthropic'` | `'gemini'`)
- `apiKey` (`string`): API key for authentication
- `baseURL` (`string`, optional): Custom base URL for API requests (e.g., for Azure OpenAI or local proxies)

---

### LLMProvider

Type union of supported LLM providers.

```typescript
type LLMProvider = 'openai' | 'anthropic' | 'gemini'
```

**Supported Providers:**
- `'openai'`: OpenAI models (GPT-4, GPT-4o, etc.)
- `'anthropic'`: Anthropic models (Claude 3, Claude Sonnet 4, etc.)
- `'gemini'`: Google Gemini models (Gemini 2.0 Flash, etc.)

---

## Embedding Adapters

### createEmbeddingAdapter

Creates an embedding adapter for generating vector embeddings from text.

```typescript
function createEmbeddingAdapter(config: EmbeddingConfig): EmbeddingAdapter
```

**Parameters:**
- `config` (`EmbeddingConfig`): Configuration for the embedding adapter

**Returns:**
- `EmbeddingAdapter`: An adapter with an `embed` method for generating embeddings

**Example:**

```typescript
import { createEmbeddingAdapter } from '@seashore/core'

// OpenAI embeddings
const embedder = createEmbeddingAdapter({
  provider: 'openai',
  model: 'text-embedding-3-small',
  apiKey: process.env.OPENAI_API_KEY!,
})

// Single text
const [embedding] = await embedder.embed('Hello world')
console.log(embedding.length) // 1536 dimensions

// Multiple texts
const embeddings = await embedder.embed([
  'First document',
  'Second document',
  'Third document',
])
console.log(embeddings.length) // 3

// Custom dimensions (OpenAI only)
const smallEmbedder = createEmbeddingAdapter({
  provider: 'openai',
  model: 'text-embedding-3-small',
  apiKey: process.env.OPENAI_API_KEY!,
  dimensions: 512, // Reduce from default 1536
})

// Gemini embeddings
const geminiEmbedder = createEmbeddingAdapter({
  provider: 'gemini',
  model: 'text-embedding-004',
  apiKey: process.env.GOOGLE_API_KEY!,
})
```

**Note:** Anthropic does not currently offer an embedding API. Use OpenAI or Gemini for embeddings.

---

### EmbeddingConfig

Configuration interface for embedding adapters.

```typescript
interface EmbeddingConfig {
  provider: EmbeddingProvider
  model: string
  apiKey: string
  baseURL?: string
  dimensions?: number
}
```

**Properties:**
- `provider` (`EmbeddingProvider`): The embedding provider (`'openai'` | `'gemini'` | `'anthropic'`)
- `model` (`string`): The embedding model to use (e.g., `'text-embedding-3-small'`, `'text-embedding-004'`)
- `apiKey` (`string`): API key for authentication
- `baseURL` (`string`, optional): Custom base URL for API requests
- `dimensions` (`number`, optional): Number of dimensions for embeddings (OpenAI only)

**Common Models:**
- OpenAI: `'text-embedding-3-small'`, `'text-embedding-3-large'`, `'text-embedding-ada-002'`
- Gemini: `'text-embedding-004'`, `'embedding-001'`

---

### EmbeddingAdapter

Interface for embedding adapters returned by `createEmbeddingAdapter`.

```typescript
interface EmbeddingAdapter {
  embed(input: string | string[]): Promise<number[][]>
}
```

**Methods:**
- `embed(input: string | string[])`: Generate embeddings for one or more texts
  - **Parameters:**
    - `input`: Single string or array of strings to embed
  - **Returns:** Promise resolving to array of embeddings (each embedding is a `number[]`)

---

## Tools

### createToolkit

Creates a typed toolkit from an array of TanStack AI tools. This is a helper function that provides type safety.

```typescript
function createToolkit<T extends ServerTool[]>(tools: T): T
```

**Parameters:**
- `tools` (`T extends ServerTool[]`): Array of TanStack AI server tools

**Returns:**
- `T`: The same array of tools with preserved types

**Example:**

```typescript
import { createToolkit } from '@seashore/core'
import { toolDefinition } from '@tanstack/ai'
import { z } from 'zod'

const weatherTool = toolDefinition({
  name: 'get_weather',
  description: 'Get current weather for a location',
  inputSchema: z.object({
    location: z.string(),
    units: z.enum(['celsius', 'fahrenheit']).optional(),
  }),
  outputSchema: z.object({
    temperature: z.number(),
    conditions: z.string(),
  }),
}).server(async (input) => {
  // Implementation
  return { temperature: 72, conditions: 'sunny' }
})

const calculatorTool = toolDefinition({
  name: 'calculator',
  description: 'Perform mathematical calculations',
  inputSchema: z.object({
    expression: z.string(),
  }),
  outputSchema: z.object({
    result: z.number(),
  }),
}).server(async (input) => {
  return { result: eval(input.expression) }
})

// Create typed toolkit
const toolkit = createToolkit([weatherTool, calculatorTool])
```

---

### createSerperSearch

Creates a web search tool powered by Serper API.

```typescript
function createSerperSearch(config: SerperConfig): ServerTool
```

**Parameters:**
- `config` (`SerperConfig`): Configuration for Serper API

**Returns:**
- `ServerTool`: A TanStack AI server tool for web search

**Tool Definition:**

```typescript
const serperSearchDefinition = toolDefinition({
  name: 'web_search',
  description: 'Search the web using Serper API and return relevant results',
  inputSchema: z.object({
    query: z.string().describe('The search query'),
    numResults: z.number().optional().default(10).describe('Number of results to return'),
    type: z.enum(['search', 'news', 'images']).optional().default('search').describe('Type of search'),
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
```

**Example:**

```typescript
import { createSerperSearch, createToolkit } from '@seashore/core'

const searchTool = createSerperSearch({
  apiKey: process.env.SERPER_API_KEY!,
})

const toolkit = createToolkit([searchTool])

// Use with agent
import { createReActAgent } from '@seashore/agent'
import { createLLMAdapter } from '@seashore/core'

const agent = createReActAgent({
  model: createLLMAdapter({ provider: 'openai', apiKey: '...' })('gpt-4o'),
  systemPrompt: 'You are a helpful research assistant with web search capabilities.',
  tools: toolkit,
})

const response = await agent.run([
  { role: 'user', content: 'What are the latest developments in AI?' },
])
```

---

### SerperConfig

Configuration interface for Serper search tool.

```typescript
interface SerperConfig {
  apiKey: string
  baseURL?: string
}
```

**Properties:**
- `apiKey` (`string`): Serper API key (get one at [serper.dev](https://serper.dev))
- `baseURL` (`string`, optional): Custom base URL (defaults to `'https://google.serper.dev'`)

---

### createFirecrawlScrape

Creates a web scraping tool powered by Firecrawl API.

```typescript
function createFirecrawlScrape(config: FirecrawlConfig): ServerTool
```

**Parameters:**
- `config` (`FirecrawlConfig`): Configuration for Firecrawl API

**Returns:**
- `ServerTool`: A TanStack AI server tool for web scraping

**Tool Definition:**

```typescript
const firecrawlScrapeDefinition = toolDefinition({
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
```

**Example:**

```typescript
import { createFirecrawlScrape, createToolkit } from '@seashore/core'

const scrapeTool = createFirecrawlScrape({
  apiKey: process.env.FIRECRAWL_API_KEY!,
})

const toolkit = createToolkit([scrapeTool])

// Use with agent
import { createReActAgent } from '@seashore/agent'
import { createLLMAdapter } from '@seashore/core'

const agent = createReActAgent({
  model: createLLMAdapter({ provider: 'openai', apiKey: '...' })('gpt-4o'),
  systemPrompt: 'You are a helpful assistant that can scrape web pages.',
  tools: toolkit,
})

const response = await agent.run([
  { role: 'user', content: 'Scrape https://example.com and summarize it' },
])
```

---

### FirecrawlConfig

Configuration interface for Firecrawl scraping tool.

```typescript
interface FirecrawlConfig {
  apiKey: string
  baseURL?: string
}
```

**Properties:**
- `apiKey` (`string`): Firecrawl API key (get one at [firecrawl.dev](https://firecrawl.dev))
- `baseURL` (`string`, optional): Custom base URL (defaults to `'https://api.firecrawl.dev/v1'`)

---

## Context Engineering

### systemPrompt

Creates a builder for constructing structured system prompts.

```typescript
function systemPrompt(): SystemPromptBuilder
```

**Returns:**
- `SystemPromptBuilder`: A builder with chainable methods for constructing prompts

**SystemPromptBuilder Interface:**

```typescript
interface SystemPromptBuilder {
  role(description: string): SystemPromptBuilder
  instruction(text: string): SystemPromptBuilder
  constraint(text: string): SystemPromptBuilder
  example(example: { input: string; output: string }): SystemPromptBuilder
  outputFormat(format: 'json' | 'code' | 'markdown' | 'text', options?: { language?: string }): SystemPromptBuilder
  build(): string
}
```

**Methods:**
- `role(description)`: Set the role/persona for the AI
- `instruction(text)`: Add an instruction (can be called multiple times)
- `constraint(text)`: Add a constraint or rule (can be called multiple times)
- `example(example)`: Add an input/output example (can be called multiple times)
- `outputFormat(format, options?)`: Specify the desired output format
- `build()`: Generate the final prompt string

**Example:**

```typescript
import { systemPrompt } from '@seashore/core'

// Basic prompt
const prompt = systemPrompt()
  .role('You are an expert Python programmer')
  .instruction('Write clean, well-documented code')
  .instruction('Follow PEP 8 style guidelines')
  .constraint('Do not use deprecated libraries')
  .constraint('Always include type hints')
  .build()

// Prompt with examples
const translatorPrompt = systemPrompt()
  .role('You are a professional translator')
  .instruction('Translate the input text to French')
  .example({ input: 'Hello world', output: 'Bonjour le monde' })
  .example({ input: 'Good morning', output: 'Bonjour' })
  .outputFormat('text')
  .build()

// JSON output format
const jsonPrompt = systemPrompt()
  .role('You are a data extraction assistant')
  .instruction('Extract structured data from the input')
  .outputFormat('json')
  .build()

// Code output format
const codePrompt = systemPrompt()
  .role('You are a code generator')
  .instruction('Generate production-ready code')
  .outputFormat('code', { language: 'typescript' })
  .build()

// Use with agent
import { createReActAgent } from '@seashore/agent'
import { createLLMAdapter } from '@seashore/core'

const agent = createReActAgent({
  model: createLLMAdapter({ provider: 'openai', apiKey: '...' })('gpt-4o'),
  systemPrompt: prompt,
  tools: [],
})
```

**Output Format Options:**
- `'json'`: Instructs the model to respond with valid JSON only
- `'code'`: Instructs the model to respond with a code block (optionally specify language)
- `'markdown'`: Instructs the model to format response in Markdown
- `'text'`: Instructs the model to respond with plain text

---

### fewShotMessages

Creates a message array from few-shot examples for in-context learning.

```typescript
function fewShotMessages(examples: FewShotExample[]): Message[]
```

**Parameters:**
- `examples` (`FewShotExample[]`): Array of example interactions

**Returns:**
- `Message[]`: Array of user/assistant message pairs

**Types:**

```typescript
interface FewShotExample {
  user: string
  assistant: string
}

interface Message {
  role: 'user' | 'assistant'
  content: string
}
```

**Example:**

```typescript
import { fewShotMessages } from '@seashore/core'
import { createReActAgent } from '@seashore/agent'
import { createLLMAdapter } from '@seashore/core'

const examples = fewShotMessages([
  {
    user: 'Translate "hello" to Spanish',
    assistant: 'Hola',
  },
  {
    user: 'Translate "goodbye" to Spanish',
    assistant: 'Adiós',
  },
  {
    user: 'Translate "thank you" to Spanish',
    assistant: 'Gracias',
  },
])

// Use as initial messages in agent
const agent = createReActAgent({
  model: createLLMAdapter({ provider: 'openai', apiKey: '...' })('gpt-4o'),
  systemPrompt: 'You are a translation assistant',
  tools: [],
})

const response = await agent.run([
  ...examples,
  { role: 'user', content: 'Translate "good morning" to Spanish' },
])
// Expected: "Buenos días"

// Or prepend to existing conversation
const conversation = [
  { role: 'user' as const, content: 'Translate "please" to Spanish' },
]

const responseWithExamples = await agent.run([
  ...examples,
  ...conversation,
])
```

---

## Complete Usage Example

```typescript
import {
  createLLMAdapter,
  createEmbeddingAdapter,
  createToolkit,
  createSerperSearch,
  createFirecrawlScrape,
  systemPrompt,
  fewShotMessages,
} from '@seashore/core'

// 1. Create LLM adapter
const llmAdapter = createLLMAdapter({
  provider: 'openai',
  apiKey: process.env.OPENAI_API_KEY!,
})

// 2. Create embedding adapter
const embedder = createEmbeddingAdapter({
  provider: 'openai',
  model: 'text-embedding-3-small',
  apiKey: process.env.OPENAI_API_KEY!,
})

// 3. Create tools
const searchTool = createSerperSearch({
  apiKey: process.env.SERPER_API_KEY!,
})

const scrapeTool = createFirecrawlScrape({
  apiKey: process.env.FIRECRAWL_API_KEY!,
})

const toolkit = createToolkit([searchTool, scrapeTool])

// 4. Build system prompt
const prompt = systemPrompt()
  .role('You are an expert research assistant')
  .instruction('Search the web for accurate, up-to-date information')
  .instruction('Cite your sources with URLs')
  .constraint('Only use verified information from reputable sources')
  .constraint('If unsure, say so rather than making up information')
  .outputFormat('markdown')
  .build()

// 5. Create few-shot examples
const examples = fewShotMessages([
  {
    user: 'What is the capital of France?',
    assistant: 'The capital of France is Paris. [Source: Wikipedia]',
  },
])

// 6. Use with agent (see @seashore/agent documentation)
import { createReActAgent } from '@seashore/agent'

const agent = createReActAgent({
  model: llmAdapter('gpt-4o'),
  systemPrompt: prompt,
  tools: toolkit,
})

const response = await agent.run([
  ...examples,
  { role: 'user', content: 'Research the latest AI breakthroughs in 2026' },
])
```

---

## Type Exports

All types are exported for use in your application:

```typescript
import type {
  LLMAdapterConfig,
  LLMAdapterFactory,
  LLMProvider,
  EmbeddingConfig,
  EmbeddingAdapter,
  EmbeddingProvider,
  SerperConfig,
  FirecrawlConfig,
} from '@seashore/core'
```

---

## Error Handling

All functions in this package throw errors for invalid configurations or API failures:

```typescript
import { createLLMAdapter, createEmbeddingAdapter } from '@seashore/core'

try {
  const adapter = createLLMAdapter({
    provider: 'invalid' as any, // TypeScript will catch this
    apiKey: '...',
  })
} catch (error) {
  console.error('Unsupported provider:', error)
}

try {
  const embedder = createEmbeddingAdapter({
    provider: 'anthropic',
    model: 'any-model',
    apiKey: '...',
  })
  await embedder.embed('test')
} catch (error) {
  console.error('Anthropic does not offer an embedding API')
}
```

---

## Best Practices

1. **Store API keys securely**: Never hardcode API keys. Use environment variables or secret management services.

2. **Choose appropriate models**: Use smaller, faster models (e.g., `gpt-4o-mini`) for development and testing, and larger models (e.g., `gpt-4o`) for production.

3. **Batch embeddings**: When generating multiple embeddings, pass an array to `embed()` rather than calling it multiple times.

4. **Reuse adapters**: Create adapters once and reuse them throughout your application.

5. **Structure prompts**: Use the `systemPrompt()` builder for complex prompts to maintain consistency.

6. **Provide examples**: Use `fewShotMessages()` to improve model accuracy for specific tasks.

7. **Error handling**: Always wrap API calls in try/catch blocks to handle rate limits and network errors gracefully.
