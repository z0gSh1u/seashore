# Retrieval

Once documents are loaded and split, you need to retrieve relevant chunks for queries. This guide covers retrieval strategies and vector search.

## In-Memory Retriever

Simple in-memory retrieval with embeddings:

```typescript
import { createInMemoryRetriever } from '@seashore/rag'
import { openaiEmbed } from '@seashore/llm'

const embedder = openaiEmbed('text-embedding-3-small')

const retriever = createInMemoryRetriever({
  embed: async (texts) => {
    const results = await Promise.all(
      texts.map(text => embedder.embed(text))
    )
    return results.map(r => r.embedding)
  },
})

// Add documents
await retriever.addDocuments(chunks)

// Retrieve
const results = await retriever.retrieve('What is TypeScript?', {
  topK: 5,
})

console.log(results)
// [
//   { content: '...', score: 0.95, metadata: {...} },
//   { content: '...', score: 0.87, metadata: {...} },
// ]
```

## Vector Retriever

Use a vector database for scale:

```typescript
import { createVectorRetriever } from '@seashore/rag'
import { createVectorStore, openaiEmbed } from '@seashore/vectordb'

// Create vector store
const store = await createVectorStore({
  connectionString: process.env.DATABASE_URL,
})

const collection = await store.createCollection({
  name: 'docs',
  dimension: 1536, // OpenAI embedding dimension
})

const embedder = openaiEmbed('text-embedding-3-small')

const retriever = createVectorRetriever({
  collection,
  embed: (text) => embedder.embed(text),
})

// Retrieve
const results = await retriever.retrieve('Query here', {
  topK: 10,
  filter: { category: 'docs' }, // Optional metadata filter
})
```

## Similarity Scoring

Results include similarity scores:

```typescript
const results = await retriever.retrieve('Query')

results.forEach(result => {
  console.log(`Score: ${result.score}`)
  console.log(`Content: ${result.content.slice(0, 100)}...`)

  // Score ranges from 0 to 1
  // Higher = more similar
})
```

### Cosine Similarity

Default similarity metric:

```typescript
function cosineSimilarity(a: number[], b: number[]): number {
  const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0)
  const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0))
  const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0))
  return dotProduct / (magnitudeA * magnitudeB)
}
```

## Hybrid Retrieval

Combine semantic and keyword search:

```typescript
import { createHybridRetriever } from '@seashore/rag'

const hybridRetriever = createHybridRetriever({
  semanticRetriever: vectorRetriever,
  keywordRetriever: bm25Retriever,
  semanticWeight: 0.7,  // 70% semantic
  keywordWeight: 0.3,   // 30% keyword
})

const results = await hybridRetriever.retrieve('Query')
```

## Filtering

Filter by metadata:

```typescript
const results = await retriever.retrieve('Query', {
  topK: 10,
  filter: {
    category: 'documentation',
    year: 2024,
  },
})
```

### Complex Filters

```typescript
const results = await retriever.retrieve('Query', {
  filter: {
    category: { $in: ['docs', 'blog'] },
    date: { $gte: '2024-01-01' },
  },
})
```

## Thresholding

Only return results above a similarity threshold:

```typescript
const results = await retriever.retrieve('Query', {
  topK: 10,
  minScore: 0.7, // Only return results with score >= 0.7
})
```

## Reranking

Rerank results for better relevance:

```typescript
import { createReranker } from '@seashore/rag'

const reranker = createReranker({
  model: openaiText('gpt-4o'),
  prompt: (query, doc) => `
    Rate relevance of this document to the query.
    Query: ${query}
    Document: ${doc.content}
    Score (0-1):
  `,
})

const results = await retriever.retrieve('Query', { topK: 20 })
const reranked = await reranker.rerank('Query', results)
```

## Multiple Queries

Retrieve with multiple queries for better coverage:

```typescript
const queries = [
  'What is TypeScript?',
  'TypeScript features',
  'TypeScript vs JavaScript',
]

const allResults = await Promise.all(
  queries.map(q => retriever.retrieve(q, { topK: 5 }))
)

// Deduplicate by score or content
const uniqueResults = deduplicateResults(allResults)
```

## Best Practices

1. **Top-K Selection** — Start with 5-10 results
2. **Thresholds** — Use minScore to filter low-quality results
3. **Metadata Filtering** — Pre-filter to reduce search space
4. **Hybrid Search** — Combine semantic and keyword for best results
5. **Reranking** — Rerank for critical applications

## Next Steps

- [Complete Pipeline](./pipeline.md) — Build end-to-end RAG systems
- [Memory](../memory/index.md) — Combine RAG with memory
