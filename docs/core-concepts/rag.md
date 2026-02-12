# RAG (Retrieval-Augmented Generation)

**RAG** enhances LLM responses by retrieving relevant information from your own knowledge base. It combines **vector search**, **full-text search**, and **hybrid search** to find the most relevant documents for a given query.

## Overview

RAG solves the problem of **knowledge grounding**: giving LLMs access to specific, up-to-date information beyond their training data.

```
┌──────────────────┐
│   User Query     │
│ "How to use X?"  │
└────────┬─────────┘
         │
         ▼
┌────────────────────┐
│ Generate Embedding │ ← OpenAI/Cohere
└────────┬───────────┘
         │
         ▼
┌────────────────────┐
│  Vector Search     │
│  (pgvector HNSW)   │ ← Find similar docs
└────────┬───────────┘
         │
         ▼
┌────────────────────┐
│ Retrieve Top-K     │
│   Documents        │ ← Rank by relevance
└────────┬───────────┘
         │
         ▼
┌────────────────────┐
│  LLM Generation    │
│ (with retrieved    │ ← Augmented context
│  context)          │
└────────┬───────────┘
         │
         ▼
┌────────────────────┐
│ Grounded Response  │
└────────────────────┘
```

**Key Benefits:**
- **Accurate** - Responses based on your data
- **Current** - Information is up-to-date
- **Traceable** - Know which documents were used
- **Scalable** - Efficient vector search with HNSW index

---

## Core Components

### Vector Database

Seashore uses **pgvector** with PostgreSQL for vector storage and search.

**Features:**
- HNSW index for fast similarity search
- Full-text search with tsvector/tsquery
- Hybrid search with Reciprocal Rank Fusion (RRF)
- Metadata filtering
- Drizzle ORM integration

### Embeddings

**Embeddings** convert text into high-dimensional vectors that capture semantic meaning.

```typescript
import { createEmbeddingAdapter } from '@seashore/core'

const embedder = createEmbeddingAdapter({
  provider: 'openai',
  apiKey: process.env.OPENAI_API_KEY!,
})

const vectors = await embedder.embed([
  'Seashore is an agent framework',
  'Built on TanStack AI'
])

console.log(vectors.length)  // 2
console.log(vectors[0].length)  // 1536 (OpenAI embedding dimension)
```

### Chunking

**Chunking** splits large documents into smaller, manageable pieces.

**Strategies:**
- **Fixed** - Simple character-based chunking
- **Recursive** - Preserves paragraphs, sentences, words

```typescript
import { createChunker } from '@seashore/data'

const chunker = createChunker({
  strategy: 'recursive',
  chunkSize: 1000,
  overlap: 100,
})

const chunks = chunker.chunk(longDocument)
console.log(chunks.length)  // Number of chunks
```

---

## Setting Up RAG

### 1. Database Setup

Install PostgreSQL with pgvector:

```bash
# Using Docker
docker run -d \
  --name postgres-vectordb \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=seashore \
  -p 5432:5432 \
  ankane/pgvector

# Install pgvector extension
psql -U postgres -d seashore -c "CREATE EXTENSION IF NOT EXISTS vector"
```

### 2. Initialize Database

```typescript
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

const client = postgres(process.env.DATABASE_URL!)
const db = drizzle(client)
```

### 3. Create Vector DB Service

```typescript
import { createVectorDBService } from '@seashore/data'

const vectordb = createVectorDBService(db)
```

### 4. Create RAG Pipeline

```typescript
import { createRAG, createEmbeddingAdapter } from '@seashore/data'

const rag = createRAG({
  embedding: createEmbeddingAdapter({
    provider: 'openai',
    apiKey: process.env.OPENAI_API_KEY!,
  }),
  vectordb,
  collection: 'documentation',
  searchMode: 'hybrid',
  topK: 5,
  chunker: {
    strategy: 'recursive',
    chunkSize: 1000,
    overlap: 100,
  },
})
```

---

## RAG Pipeline API

### Configuration

```typescript
interface RAGConfig {
  embedding: EmbeddingAdapter
  vectordb: VectorDBService
  collection: string
  searchMode?: 'vector' | 'text' | 'hybrid'
  topK?: number
  hybridWeights?: { vector: number; text: number }
  chunker?: ChunkerConfig
}
```

### Ingesting Documents

```typescript
await rag.ingest([
  {
    content: 'Seashore is an agent framework...',
    metadata: { source: 'docs', category: 'intro' }
  },
  {
    content: 'Built on TanStack AI...',
    metadata: { source: 'docs', category: 'architecture' }
  }
])
```

**With chunking:**
```typescript
// Long document will be automatically chunked
await rag.ingest([
  {
    content: longDocument,  // 50,000 characters
    metadata: { source: 'whitepaper.pdf' }
  }
])

// Result: Multiple chunks with metadata preserved
// Each chunk: ~1000 characters with 100 character overlap
```

### Retrieving Documents

```typescript
const results = await rag.retrieve('How do I build agents?')

results.forEach(result => {
  console.log('Score:', result.score)
  console.log('Content:', result.content)
  console.log('Metadata:', result.metadata)
})
```

---

## Search Modes

### Vector Search

**Semantic similarity** using cosine distance:

```typescript
const rag = createRAG({
  embedding: embedder,
  vectordb,
  collection: 'docs',
  searchMode: 'vector',  // Pure vector search
  topK: 5,
})

const results = await rag.retrieve('agent frameworks')
// Returns documents semantically similar to "agent frameworks"
// Even if they don't contain those exact words
```

**Strengths:**
- Captures semantic meaning
- Handles synonyms and paraphrases
- Works across languages

**Use cases:**
- Conceptual queries ("what is an agent?")
- Cross-lingual search
- Finding related concepts

### Text Search

**Keyword-based** using PostgreSQL full-text search:

```typescript
const rag = createRAG({
  embedding: embedder,
  vectordb,
  collection: 'docs',
  searchMode: 'text',  // Full-text search
  topK: 5,
})

const results = await rag.retrieve('createReActAgent')
// Returns documents containing the exact term "createReActAgent"
```

**Strengths:**
- Fast for exact matches
- Good for technical terms
- No embedding overhead

**Use cases:**
- API function names
- Exact terminology
- Code search

### Hybrid Search

**Best of both worlds** using Reciprocal Rank Fusion (RRF):

```typescript
const rag = createRAG({
  embedding: embedder,
  vectordb,
  collection: 'docs',
  searchMode: 'hybrid',  // Combine vector + text
  topK: 5,
  hybridWeights: {
    vector: 0.7,  // 70% semantic similarity
    text: 0.3,    // 30% keyword matching
  },
})

const results = await rag.retrieve('how to use createReActAgent')
// Combines:
// - Semantic understanding ("how to use")
// - Exact matching ("createReActAgent")
```

**How RRF works:**
```
Vector results:     Text results:
1. Doc A (0.95)     1. Doc C (rank 1)
2. Doc B (0.89)     2. Doc A (rank 2)
3. Doc D (0.82)     3. Doc E (rank 3)

RRF Score = w_v * 1/(k + rank_v) + w_t * 1/(k + rank_t)
where k = 60 (constant)

Combined ranking:
1. Doc A (high in both)
2. Doc C (high in text)
3. Doc B (high in vector)
```

**Strengths:**
- Balanced results
- Handles both concepts and exact terms
- Best for production

**Use cases:**
- General Q&A
- Documentation search
- Mixed query types

---

## Chunking Strategies

### Fixed Chunking

Simple character-based splitting:

```typescript
const chunker = createChunker({
  strategy: 'fixed',
  chunkSize: 1000,
  overlap: 100,
})

const chunks = chunker.chunk(document)
```

**How it works:**
```
Document: "ABCDEFGHIJK..."
Chunk 1: "ABCDEFGHIJ" (0-1000)
Chunk 2: "JKLMNOPQRS" (900-1900, 100 char overlap)
Chunk 3: "STUVWXYZ" (1800-2800, 100 char overlap)
```

**Pros:**
- Simple and predictable
- Fast processing
- Consistent chunk sizes

**Cons:**
- May split sentences mid-word
- Loses semantic boundaries

### Recursive Chunking

Intelligent splitting that preserves structure:

```typescript
const chunker = createChunker({
  strategy: 'recursive',
  chunkSize: 1000,
  overlap: 100,
})

const chunks = chunker.chunk(document)
```

**Split hierarchy:**
1. Try paragraphs (`\n\n`)
2. Fall back to sentences (`. `)
3. Fall back to words (` `)
4. Fall back to characters (fixed)

**Example:**
```
Document:
"Introduction\n\nSeashore is an agent framework.\n\nIt provides tools for building agents."

Chunks:
1. "Introduction\n\nSeashore is an agent framework."
2. "It provides tools for building agents."
```

**Pros:**
- Preserves semantic boundaries
- Better context for embeddings
- More meaningful chunks

**Cons:**
- Variable chunk sizes
- Slightly slower

### Choosing Chunk Size

**Small chunks (500-1000 chars):**
- More precise retrieval
- Higher total chunks
- Better for specific questions

**Medium chunks (1000-2000 chars):**
- Balanced precision/context
- Good for most use cases
- Recommended default

**Large chunks (2000-4000 chars):**
- More context per chunk
- Fewer total chunks
- Better for broad questions

### Chunk Overlap

Overlap ensures continuity across chunk boundaries:

```typescript
// 10% overlap
chunkSize: 1000,
overlap: 100,  // Last 100 chars of chunk N = first 100 chars of chunk N+1
```

**Why overlap matters:**
```
Without overlap:
Chunk 1: "...Seashore is an agent"
Chunk 2: "framework built on TanStack..."
Problem: "agent framework" is split across chunks

With overlap (100 chars):
Chunk 1: "...Seashore is an agent framework..."
Chunk 2: "...agent framework built on TanStack..."
Benefit: "agent framework" appears in both chunks
```

---

## Using RAG with Agents

### Basic RAG Agent

```typescript
import { createReActAgent } from '@seashore/agent'
import { createRAG } from '@seashore/data'

// Create RAG pipeline
const rag = createRAG({
  embedding: embedder,
  vectordb,
  collection: 'docs',
  searchMode: 'hybrid',
  topK: 3,
})

// Create retrieval tool
const retrieveTool = toolDefinition({
  name: 'search_knowledge_base',
  description: 'Search the documentation knowledge base',
  inputSchema: z.object({
    query: z.string(),
  }),
  outputSchema: z.object({
    results: z.array(z.object({
      content: z.string(),
      score: z.number(),
    })),
  }),
}).server(async ({ query }) => {
  const results = await rag.retrieve(query)
  return {
    results: results.map(r => ({
      content: r.content,
      score: r.score,
    })),
  }
})

// Create agent with RAG tool
const agent = createReActAgent({
  model: () => llm('gpt-4o'),
  systemPrompt: `You are a helpful assistant with access to a knowledge base.
Always search the knowledge base before answering questions.
Base your answers on the retrieved information.`,
  tools: [retrieveTool],
})

// Use the agent
const response = await agent.run([
  { role: 'user', content: 'How do I create a ReAct agent?' }
])
```

### Auto-RAG Pattern

Automatically augment queries with relevant context:

```typescript
async function chatWithRAG(userQuery: string) {
  // 1. Retrieve relevant documents
  const docs = await rag.retrieve(userQuery)
  
  // 2. Build context from top results
  const context = docs
    .slice(0, 3)
    .map(d => d.content)
    .join('\n\n---\n\n')
  
  // 3. Augment user query with context
  const augmentedMessages = [
    {
      role: 'system' as const,
      content: `Use the following context to answer questions:\n\n${context}`
    },
    {
      role: 'user' as const,
      content: userQuery
    }
  ]
  
  // 4. Get LLM response
  const response = await agent.run(augmentedMessages)
  
  return {
    answer: response.result.content,
    sources: docs.map(d => d.metadata),
  }
}

// Usage
const result = await chatWithRAG('What is Seashore?')
console.log(result.answer)
console.log('Sources:', result.sources)
```

### Agentic RAG

Let the agent decide when to retrieve:

```typescript
const agent = createReActAgent({
  model: () => llm('gpt-4o'),
  systemPrompt: `You are a documentation assistant.
When you don't know something, use the search_knowledge_base tool.
Always cite your sources.`,
  tools: [retrieveTool],
})

// Agent will automatically call retrieveTool when needed
const response = await agent.run([
  { role: 'user', content: 'How do workflows work?' }
])

// Agent execution:
// 1. Recognizes it needs information
// 2. Calls search_knowledge_base({ query: "workflows" })
// 3. Receives retrieved documents
// 4. Formulates answer based on results
```

---

## Advanced Patterns

### Multi-Collection RAG

Search across multiple collections:

```typescript
const docsRAG = createRAG({
  embedding: embedder,
  vectordb,
  collection: 'documentation',
  searchMode: 'hybrid',
  topK: 3,
})

const codeRAG = createRAG({
  embedding: embedder,
  vectordb,
  collection: 'code-examples',
  searchMode: 'vector',
  topK: 2,
})

async function multiCollectionSearch(query: string) {
  const [docsResults, codeResults] = await Promise.all([
    docsRAG.retrieve(query),
    codeRAG.retrieve(query),
  ])
  
  // Combine and re-rank
  const combined = [...docsResults, ...codeResults]
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
  
  return combined
}
```

### Contextual Compression

Compress retrieved documents to save tokens:

```typescript
async function compressContext(docs: SearchResult[]) {
  const summaryAgent = createReActAgent({
    model: () => llm('gpt-4o-mini'),  // Cheaper model
    systemPrompt: 'Summarize the following text in 2-3 sentences.',
    tools: [],
  })
  
  const compressed = await Promise.all(
    docs.map(async doc => {
      const summary = await summaryAgent.run([
        { role: 'user', content: doc.content }
      ])
      return {
        ...doc,
        content: summary.result.content,
      }
    })
  )
  
  return compressed
}
```

### Metadata Filtering

Filter by metadata during retrieval:

```typescript
// Ingest with metadata
await rag.ingest([
  {
    content: 'Agent documentation...',
    metadata: {
      type: 'guide',
      version: '1.0',
      tags: ['agents', 'core'],
    }
  },
])

// Search with filter (requires custom implementation)
const results = await vectordb.search('docs', {
  mode: 'hybrid',
  vector: await embedder.embed(['agents'])[0],
  text: 'agents',
  topK: 5,
  filter: {
    type: 'guide',
    version: '1.0',
  },
})
```

### Reranking

Use a dedicated reranker for better results:

```typescript
import { createReranker } from 'some-reranker-library'

const reranker = createReranker({
  model: 'cross-encoder',
})

async function searchWithRerank(query: string) {
  // 1. Initial retrieval (get more results)
  const candidates = await rag.retrieve(query)  // topK: 20
  
  // 2. Rerank with cross-encoder
  const reranked = await reranker.rerank(query, candidates)
  
  // 3. Return top results
  return reranked.slice(0, 5)
}
```

---

## Best Practices

### 1. Choose Appropriate Search Mode

```typescript
// Technical documentation → Hybrid
const techDocsRAG = createRAG({
  searchMode: 'hybrid',
  hybridWeights: { vector: 0.6, text: 0.4 },
})

// General knowledge → Vector
const generalRAG = createRAG({
  searchMode: 'vector',
})

// API reference → Text
const apiRefRAG = createRAG({
  searchMode: 'text',
})
```

### 2. Optimize Chunk Size for Content Type

```typescript
// Short Q&A → Small chunks
const qnaChunker = createChunker({
  strategy: 'recursive',
  chunkSize: 500,
  overlap: 50,
})

// Technical articles → Medium chunks
const articleChunker = createChunker({
  strategy: 'recursive',
  chunkSize: 1500,
  overlap: 150,
})

// Books/Whitepapers → Large chunks
const bookChunker = createChunker({
  strategy: 'recursive',
  chunkSize: 3000,
  overlap: 300,
})
```

### 3. Include Metadata

```typescript
await rag.ingest([
  {
    content: 'Document content...',
    metadata: {
      title: 'Getting Started',
      url: 'https://docs.example.com/getting-started',
      author: 'Jane Doe',
      date: '2025-02-01',
      version: '1.0',
      tags: ['tutorial', 'beginner'],
    }
  }
])
```

### 4. Tune topK

```typescript
// Precise queries → Fewer results
const preciseRAG = createRAG({
  ...config,
  topK: 3,  // "What is the exact syntax for X?"
})

// Exploratory queries → More results
const exploratoryRAG = createRAG({
  ...config,
  topK: 10,  // "Tell me about Y"
})
```

### 5. Monitor Retrieval Quality

```typescript
const results = await rag.retrieve(query)

console.log('Top result score:', results[0]?.score)
console.log('Avg score:', results.reduce((sum, r) => sum + r.score, 0) / results.length)

if (results[0]?.score < 0.5) {
  console.warn('Low confidence retrieval - may need more data or query refinement')
}
```

---

## Common Pitfalls

### 1. Chunks Too Large

```typescript
// ❌ BAD: 10,000 character chunks
const chunker = createChunker({
  strategy: 'fixed',
  chunkSize: 10000,  // Too large!
  overlap: 100,
})

// ✅ GOOD: 1,000-2,000 character chunks
const chunker = createChunker({
  strategy: 'recursive',
  chunkSize: 1500,
  overlap: 150,
})
```

### 2. No Overlap

```typescript
// ❌ BAD: No overlap
chunkSize: 1000,
overlap: 0,  // Context is lost at boundaries

// ✅ GOOD: 10% overlap
chunkSize: 1000,
overlap: 100,
```

### 3. Wrong Search Mode

```typescript
// ❌ BAD: Vector search for API names
searchMode: 'vector',  // Won't match "createReActAgent" well

// ✅ GOOD: Hybrid for API names
searchMode: 'hybrid',
hybridWeights: { vector: 0.4, text: 0.6 },  // Favor text matching
```

### 4. Ignoring Metadata

```typescript
// ❌ BAD: No metadata
await rag.ingest([
  { content: 'Some content' }  // No source tracking
])

// ✅ GOOD: Include metadata
await rag.ingest([
  {
    content: 'Some content',
    metadata: { source: 'doc.pdf', page: 42 }
  }
])
```

---

## Performance Optimization

### Batch Ingestion

```typescript
// ❌ BAD: One at a time
for (const doc of documents) {
  await rag.ingest([doc])
}

// ✅ GOOD: Batch processing
const BATCH_SIZE = 100
for (let i = 0; i < documents.length; i += BATCH_SIZE) {
  const batch = documents.slice(i, i + BATCH_SIZE)
  await rag.ingest(batch)
}
```

### Caching Embeddings

```typescript
const embeddingCache = new Map<string, number[]>()

async function cachedEmbed(text: string) {
  if (embeddingCache.has(text)) {
    return embeddingCache.get(text)!
  }
  
  const embedding = (await embedder.embed([text]))[0]!
  embeddingCache.set(text, embedding)
  return embedding
}
```

### HNSW Index Tuning

```sql
-- Create HNSW index with tuned parameters
CREATE INDEX embeddings_hnsw_idx 
ON seashore_embeddings 
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- Higher m = better recall, slower build
-- Higher ef_construction = better quality, slower build
```

---

## Related Concepts

- **[Agents](./agents.md)** - Using RAG with ReAct agents
- **[Context](./context.md)** - Prompt engineering for RAG
- **[Architecture](./architecture.md)** - Understanding the data layer

---

## Next Steps

- **[Build a RAG System](../getting-started/first-rag.md)**
- **[RAG Examples](../../examples/rag/)**
- **[Advanced RAG Patterns](../guides/advanced-rag.md)**
