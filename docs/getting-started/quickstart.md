# Quick Start

This guide walks you through creating your first AI agent with Seashore.

## 1. Create a Basic Agent

```typescript
import { createAgent } from '@seashore/agent'
import { openaiText } from '@seashore/llm'

const agent = createAgent({
  name: 'my-agent',
  model: openaiText('gpt-4o', { apiKey: process.env.OPENAI_API_KEY }),
  systemPrompt: 'You are a helpful assistant.',
})

const result = await agent.run({
  messages: [{ role: 'user', content: 'Hello!' }],
})

console.log(result.content)
```

## 2. Add Tools

```typescript
import { createAgent } from '@seashore/agent'
import { openaiText } from '@seashore/llm'
import { defineTool } from '@seashore/tool'
import { z } from 'zod'

const calculatorTool = defineTool({
  name: 'calculator',
  description: 'Perform basic math calculations',
  parameters: z.object({
    expression: z.string().describe('Math expression to evaluate'),
  }),
  execute: async ({ expression }) => {
    return { result: eval(expression) }
  },
})

const agent = createAgent({
  name: 'math-agent',
  model: openaiText('gpt-4o'),
  systemPrompt: 'You are a helpful math assistant.',
  tools: [calculatorTool],
})

const result = await agent.run({
  messages: [{ role: 'user', content: 'What is 15 * 7?' }],
})
```

## 3. Stream Responses

```typescript
for await (const chunk of agent.stream({
  messages: [{ role: 'user', content: 'Explain quantum computing' }],
})) {
  if (chunk.type === 'text') {
    process.stdout.write(chunk.content)
  } else if (chunk.type === 'tool_call') {
    console.log('Calling tool:', chunk.name)
  }
}
```

## 4. Use RAG

```typescript
import { createRAG, createVectorRetriever } from '@seashore/rag'
import { createVectorStore } from '@seashore/vectordb'
import { openaiText, openaiEmbedding } from '@seashore/llm'

// Create vector store
const vectorStore = await createVectorStore({
  connectionString: process.env.DATABASE_URL!,
})

// Create collection and embedding
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

// Add documents
await collection.addDocuments([
  { content: 'Our company was founded in 2020...', metadata: {} },
  { content: 'Our main product is...', metadata: {} },
])

// Query with LLM
const llm = openaiText('gpt-4o')
const context = await rag.retrieve('When was the company founded?')
const answer = await llm.chat({
  messages: [
    { role: 'system', content: context.systemPrompt },
    { role: 'user', content: 'When was the company founded?' },
  ],
})
```

## 5. Deploy as API

```typescript
import { createServer } from '@seashore/deploy'

const server = createServer({
  agents: { chat: agent },
  cors: { origin: '*' },
})

// Cloudflare Workers
export default { fetch: server.app.fetch }
```

## Next Steps

- [Concepts](./concepts.md) - Understand core concepts
- [Building Custom Tools](../guides/custom-tools.md) - Create your own tools
- [Creating Workflows](../guides/workflows.md) - Build complex pipelines
