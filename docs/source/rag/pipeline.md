# Complete RAG Pipeline

Combine loading, splitting, retrieval, and generation into a complete RAG system.

## Basic RAG Pipeline

```typescript
import {
  createStringLoader,
  createRecursiveSplitter,
  createInMemoryRetriever,
  createRAG,
} from '@seashore/rag'
import { openaiEmbed, openaiText } from '@seashore/llm'
import { createAgent } from '@seashore/agent'

// 1. Load documents
const loader = createStringLoader(knowledgeBase)
const docs = await loader.load()

// 2. Split documents
const splitter = createRecursiveSplitter({
  chunkSize: 1000,
  chunkOverlap: 200,
})
const chunks = await splitter.split(docs[0])

// 3. Create retriever
const embedder = openaiEmbed('text-embedding-3-small')
const retriever = createInMemoryRetriever({
  embed: async (texts) => {
    const results = await Promise.all(
      texts.map(t => embedder.embed(t))
    )
    return results.map(r => r.embedding)
  },
})
await retriever.addDocuments(chunks)

// 4. Create RAG pipeline
const rag = createRAG({
  retriever,
  template: `Answer using this context:
{context}

Question: {query}
Answer:`,
})

// 5. Use with agent
const agent = createAgent({
  name: 'qa-bot',
  model: openaiText('gpt-4o'),
  tools: [rag.tool], // RAG as a tool
})

const result = await agent.run('What is Seashore?')
```

## Custom RAG Template

Customize how context is formatted:

```typescript
const rag = createRAG({
  retriever,
  template: async (query, context) => {
    const chunks = context.map(c => c.content).join('\n\n---\n\n')
    return `
You are a helpful assistant. Answer the question using the context below.

Context:
${chunks}

Question: ${query}

Provide a concise answer.
`
  },
  topK: 5,
  minScore: 0.7,
})
```

## RAG with Citations

Include source citations in responses:

```typescript
const rag = createRAG({
  retriever,
  template: (query, context) => {
    const chunks = context.map(c => ({
      content: c.content,
      source: c.metadata.source,
      page: c.metadata.page,
    }))

    return `
Answer: ${query}

Sources:
${chunks.map(c => `- ${c.source} (page ${c.page})`).join('\n')}
`
  },
  returnSources: true, // Include sources in response
})

const result = await rag.query('What is TypeScript?')
console.log(result.answer)
console.log(result.sources) // Array of sources
```

## Streaming RAG

Stream RAG responses:

```typescript
const rag = createRAG({
  retriever,
  stream: true,
})

for await (const chunk of rag.stream('Explain RAG')) {
  if (chunk.type === 'content') {
    process.stdout.write(chunk.content)
  }
}
```

## Multi-Source RAG

Combine multiple retrievers:

```typescript
const docsRetriever = createInMemoryRetriever({ ... })
const webRetriever = createWebRetriever({ ... })
const codeRetriever = createCodeRetriever({ ... })

const rag = createRAG({
  retrievers: [
    { retriever: docsRetriever, weight: 0.5 },
    { retriever: webRetriever, weight: 0.3 },
    { retriever: codeRetriever, weight: 0.2 },
  ],
})
```

## RAG with Memory

Combine RAG with conversation memory:

```typescript
import { createShortTermMemory } from '@seashore/memory'

const memory = createShortTermMemory({
  maxEntries: 20,
  ttlMs: 1000 * 60 * 30,
})

const ragWithMemory = createRAG({
  retriever,
  template: async (query, context) => {
    // Get conversation history
    const history = memory.queryByAgent('qa-bot', {
      threadId: currentThreadId,
    })

    return `
Conversation history:
${history.map(m => m.content).join('\n')}

Context:
${context.join('\n')}

Question: ${query}
`
  },
})
```

## RAG Evaluation

Evaluate RAG quality:

```typescript
import { evaluateRAG } from '@seashore/rag'

const metrics = await evaluateRAG({
  rag,
  queries: testQueries,
  expectedAnswers: groundTruth,
  metrics: ['relevance', 'faithfulness', 'correctness'],
})

console.log(metrics)
// {
//   relevance: 0.85,
//   faithfulness: 0.92,
//   correctness: 0.78,
// }
```

## Hybrid Search RAG

Combine semantic and keyword search:

```typescript
import { createHybridRetriever } from '@seashore/rag'

const hybridRetriever = createHybridRetriever({
  semanticRetriever: vectorRetriever,
  keywordRetriever: bm25Retriever,
  semanticWeight: 0.7,
  keywordWeight: 0.3,
})

const rag = createRAG({
  retriever: hybridRetriever,
})
```

## RAG Chatbot

Complete RAG chatbot:

```typescript
import { createAgent } from '@seashore/agent'
import { openaiText } from '@seashore/llm'

const rag = createRAG({
  retriever,
  systemPrompt: 'You are a helpful assistant. Use the provided context to answer questions.',
})

const chatbot = createAgent({
  name: 'rag-chatbot',
  model: openaiText('gpt-4o'),
  systemPrompt: 'You are a knowledgeable assistant.',
  tools: [rag.tool],
})

// Multi-turn conversation
const conversation = [
  { role: 'user', content: 'What is Seashore?' },
  { role: 'assistant', content: (await chatbot.run('What is Seashore?')).content },
  { role: 'user', content: 'How do I install it?' },
]

const response = await chatbot.run({ messages: conversation })
```

## Best Practices

1. **Chunk Size** — 500-1500 characters works well
2. **Top-K** — 5-10 results for most queries
3. **Overlap** — 10-20% overlap provides context
4. **Templates** — Clear instructions improve answers
5. **Evaluation** — Continuously measure quality
6. **Updating** — Refresh index when docs change

## Next Steps

- [Memory](../memory/index.md) — Add conversation memory
- [Deployment](../integrations/deploy.md) — Deploy RAG applications
- [Evaluation](../security/evaluation.md) — Measure RAG quality
