# Embeddings

Embeddings convert text into numerical vectors that capture semantic meaning. They're essential for search, RAG, and similarity comparisons.

## Creating Embeddings

### OpenAI Embeddings

```typescript
import { openaiEmbed } from '@seashore/llm'

const embedder = openaiEmbed('text-embedding-3-small')

const result = await embedder.embed('Hello, world!')

console.log(result.embedding) // number[] - 1536 dimensions
console.log(result.usage)     // token usage info
```

### Gemini Embeddings

```typescript
import { geminiEmbed } from '@seashore/llm'

const embedder = geminiEmbed('text-embedding-004')

const result = await embedder.embed('Semantic search is powerful')
```

## Batch Embeddings

Generate multiple embeddings efficiently:

```typescript
import { generateBatchEmbeddings } from '@seashore/llm'

const texts = [
  'The cat sat on the mat',
  'The dog chased the ball',
  'Artificial intelligence is advancing',
]

const embedder = openaiEmbed('text-embedding-3-small')
const result = await generateBatchEmbeddings(embedder, texts)

console.log(result.embeddings) // number[][]
console.log(result.usage)      // total token usage
```

## Using Embeddings for Search

```typescript
import { openaiEmbed } from '@seashore/llm'

const embedder = openaiEmbed('text-embedding-3-small')

// Embed your documents
const documents = [
  { text: 'TypeScript adds types to JavaScript', embedding: await embedder.embed('TypeScript adds types to JavaScript') },
  { text: 'React is a UI library', embedding: await embedder.embed('React is a UI library') },
  { text: 'Node.js runs JS on servers', embedding: await embedder.embed('Node.js runs JS on servers') },
]

// Embed the query
const query = 'What is TypeScript?'
const queryEmbedding = await embedder.embed(query)

// Find similar documents using cosine similarity
function cosineSimilarity(a: number[], b: number[]): number {
  const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0)
  const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0))
  const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0))
  return dotProduct / (magnitudeA * magnitudeB)
}

const similarities = documents.map(doc => ({
  text: doc.text,
  similarity: cosineSimilarity(queryEmbedding.embedding, doc.embedding),
}))

similarities.sort((a, b) => b.similarity - a.similarity)

console.log(similarities[0]) // Most similar document
```

## Embedding Dimensions

Different models have different dimensions:

| Model | Dimensions |
|-------|------------|
| text-embedding-3-small | 1536 |
| text-embedding-3-large | 3072 |
| text-embedding-004 | 768 |

You can truncate dimensions for smaller vectors:

```typescript
const embedder = openaiEmbed('text-embedding-3-small')

const result = await embedder.embed('Hello', {
  dimensions: 512, // Truncate to 512 dimensions
})
```

## Use Cases

### Semantic Search

Find documents by meaning, not keywords:

```typescript
const searchResults = await semanticSearch('programming languages')
// Returns documents about coding, even without the word "programming"
```

### Clustering

Group similar items:

```typescript
const clusters = await clusterDocuments(documents)
// Groups related topics automatically
```

### Recommendation Systems

Suggest similar content:

```typescript
const recommendations = await findSimilarArticles(currentArticle)
// Suggests articles on similar topics
```

### RAG (Retrieval-Augmented Generation)

Provide context to LLMs:

```typescript
const relevantDocs = await search(query)
const context = relevantDocs.map(d => d.text).join('\n')

const agent = createAgent({
  name: 'qa-bot',
  model: openaiText('gpt-4o'),
  systemPrompt: `Answer using this context:\n${context}`,
})
```

## Best Practices

1. **Batch Requests** — More efficient than individual calls
2. **Cache Embeddings** — Same text always produces same embedding
3. **Choose Right Model** — Balance quality vs cost vs speed
4. **Normalize Vectors** — For cosine similarity
5. **Dimensionality Reduction** — Smaller dimensions = faster search

## Next Steps

- [RAG](../rag/index.md) — Build retrieval-augmented generation systems
- [VectorDB](../rag/retrieval.md) — Use vector databases for scale
