# Seashore Agent Framework

A modern, modular agent framework for building AI-powered applications in TypeScript.

## Features

- 🤖 **ReAct Agent** - Intelligent agents with reasoning and tool use capabilities
- 🔧 **Tool System** - Extensible tool definition and execution
- 🧠 **LLM Integration** - Support for OpenAI, Anthropic, and more
- 🔄 **Workflows** - Visual workflow builder for complex agent pipelines
- 📚 **RAG** - Retrieval-augmented generation with vector search
- 💾 **Memory** - Short-term, mid-term, and long-term memory systems
- 🔗 **MCP** - Model Context Protocol client for external integrations
- 🎨 **GenUI** - React components for generative UI
- 📊 **Observability** - Tracing, logging, and token counting
- ✅ **Evaluation** - Agent output evaluation and metrics
- 🔒 **Security** - Guardrails, content filtering, and PII detection
- 🚀 **Deploy** - Hono-based deployment for Cloudflare Workers and Node.js

## Installation

```bash
# Install all packages
pnpm add @seashore/agent @seashore/llm @seashore/tool

# Or install individual packages
pnpm add @seashore/agent
pnpm add @seashore/llm
pnpm add @seashore/tool
pnpm add @seashore/workflow
pnpm add @seashore/rag
pnpm add @seashore/memory
pnpm add @seashore/storage
pnpm add @seashore/vectordb
pnpm add @seashore/mcp
pnpm add @seashore/genui
pnpm add @seashore/observability
pnpm add @seashore/evaluation
pnpm add @seashore/security
pnpm add @seashore/deploy
```

## Quick Start

### Basic Agent

```typescript
import { createAgent } from '@seashore/agent'
import { openaiText } from '@seashore/llm'
import { defineTool } from '@seashore/tool'
import { z } from 'zod'

// Define a tool
const weatherTool = defineTool({
  name: 'get_weather',
  description: 'Get weather for a location',
  parameters: z.object({
    location: z.string(),
  }),
  execute: async ({ location }) => {
    return { temperature: 72, condition: 'sunny' }
  },
})

// Create an agent
const agent = createAgent({
  name: 'weather-assistant',
  model: openaiText('gpt-4o', { apiKey: process.env.OPENAI_API_KEY }),
  tools: [weatherTool],
  systemPrompt: 'You are a helpful weather assistant.',
})

// Run the agent
const result = await agent.run({
  messages: [{ role: 'user', content: 'What is the weather in Tokyo?' }],
})

console.log(result.content)
```

### With Streaming

```typescript
import { createAgent } from '@seashore/agent'
import { openaiText } from '@seashore/llm'

const agent = createAgent({
  name: 'chat-agent',
  model: openaiText('gpt-4o'),
  systemPrompt: 'You are a helpful assistant.',
})

// Stream the response
for await (const chunk of agent.stream({
  messages: [{ role: 'user', content: 'Tell me a story' }],
})) {
  if (chunk.type === 'text') {
    process.stdout.write(chunk.content)
  }
}
```

### RAG (Retrieval-Augmented Generation)

```typescript
import { createRAG, createVectorRetriever } from '@seashore/rag'
import { createVectorStore } from '@seashore/vectordb'
import { openaiText, openaiEmbedding } from '@seashore/llm'

// Create vector store and collection
const vectorStore = await createVectorStore({
  connectionString: process.env.DATABASE_URL!,
})
const embedding = openaiEmbedding('text-embedding-3-small')
const collection = await vectorStore.createCollection({
  name: 'docs',
  dimension: 1536,
})

// Create retriever
const retriever = createVectorRetriever({
  collection,
  embed: (text) => embedding.embed(text),
})

// Create RAG pipeline
const rag = createRAG({ retriever })

// Index documents
await collection.addDocuments([
  { content: 'TypeScript is a typed superset of JavaScript...', metadata: {} },
  { content: 'React is a library for building user interfaces...', metadata: {} },
])

// Query with context
const llm = openaiText('gpt-4o')
const context = await rag.retrieve('What is TypeScript?')
const answer = await llm.chat({
  messages: [
    { role: 'system', content: context.systemPrompt },
    { role: 'user', content: 'What is TypeScript?' },
  ],
})
console.log(answer.content)
```

### Deploy to Cloudflare Workers

```typescript
// src/index.ts
import { createServer, cloudflareAdapter } from '@seashore/deploy'
import { createAgent } from '@seashore/agent'
import { openaiText } from '@seashore/llm'

export default {
  async fetch(request: Request, env: Env) {
    const agent = createAgent({
      name: 'api-agent',
      model: openaiText('gpt-4o', { apiKey: env.OPENAI_API_KEY }),
      systemPrompt: 'You are a helpful API assistant.',
    })

    const server = createServer({
      agents: { chat: agent },
      cors: { origin: '*' },
    })

    return cloudflareAdapter(server).fetch(request)
  },
}
```

## Packages

| Package | Description |
|---------|-------------|
| [@seashore/agent](./packages/agent) | Core ReAct agent implementation |
| [@seashore/llm](./packages/llm) | LLM adapters and utilities |
| [@seashore/tool](./packages/tool) | Tool definition and execution |
| [@seashore/workflow](./packages/workflow) | Visual workflow builder |
| [@seashore/rag](./packages/rag) | RAG pipeline |
| [@seashore/memory](./packages/memory) | Memory management |
| [@seashore/storage](./packages/storage) | Storage adapters |
| [@seashore/vectordb](./packages/vectordb) | Vector database |
| [@seashore/mcp](./packages/mcp) | MCP client |
| [@seashore/genui](./packages/genui) | Generative UI components |
| [@seashore/observability](./packages/observability) | Tracing and logging |
| [@seashore/evaluation](./packages/evaluation) | Evaluation metrics |
| [@seashore/security](./packages/security) | Security guardrails |
| [@seashore/deploy](./packages/deploy) | Deployment utilities |

## Development

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test

# Type check
pnpm typecheck
```

## Requirements

- Node.js >= 20
- pnpm >= 8

## License

MIT
