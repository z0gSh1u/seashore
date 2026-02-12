# RAG Pipeline

Build production-ready Retrieval-Augmented Generation (RAG) systems with proper document preparation, chunking strategies, embedding selection, search tuning, and performance optimization.

## Overview

RAG enhances LLM responses by retrieving relevant information from your knowledge base. This guide covers building robust RAG pipelines from document ingestion through production deployment.

**What you'll learn:**
- Document preparation and processing
- Chunking strategies and optimization
- Embedding model selection
- Vector search and retrieval tuning
- Query optimization
- Performance and scalability
- Evaluation and monitoring

---

## RAG Architecture

### Pipeline Overview

```
Documents → Preprocessing → Chunking → Embedding → Vector Store
                                                          ↓
User Query → Query Processing → Embedding → Vector Search → Reranking → Context
                                                                            ↓
                                                                    LLM Generation
```

### Seashore RAG Components

```typescript
import { createRAGPipeline, createVectorDB } from '@seashore/data'
import { createEmbeddingAdapter } from '@seashore/core'

// 1. Setup embeddings
const embeddings = createEmbeddingAdapter({
  provider: 'openai',
  model: 'text-embedding-3-small',
  apiKey: process.env.OPENAI_API_KEY!,
})

// 2. Setup vector database
const vectorDB = createVectorDB({
  connectionString: process.env.DATABASE_URL!,
  tableName: 'documents',
  dimensions: 1536, // Match embedding dimensions
})

// 3. Create RAG pipeline
const rag = createRAGPipeline({
  vectorDB,
  embeddings,
  chunkSize: 1000,
  chunkOverlap: 200,
  topK: 5,
})
```

---

## Document Preparation

### Document Types

Support multiple formats:

```typescript
import { DocumentLoader } from '@seashore/data'

const loader = new DocumentLoader()

// Text files
const txtDocs = await loader.loadText('./docs/manual.txt')

// Markdown
const mdDocs = await loader.loadMarkdown('./docs/*.md')

// PDF
const pdfDocs = await loader.loadPDF('./docs/report.pdf')

// Web pages
const webDocs = await loader.loadWeb('https://example.com/docs')

// Combine all
const allDocs = [...txtDocs, ...mdDocs, ...pdfDocs, ...webDocs]
```

### Preprocessing

Clean and normalize documents:

```typescript
import { DocumentProcessor } from '@seashore/data'

const processor = new DocumentProcessor({
  // Remove noise
  removeHeaders: true,
  removeFooters: true,
  removePageNumbers: true,
  
  // Normalize
  normalizeWhitespace: true,
  lowercaseHeaders: false,
  
  // Extract
  extractMetadata: true,
  extractCodeBlocks: true,
})

const processedDocs = await processor.process(allDocs)
```

### Custom Preprocessing

```typescript
interface Document {
  content: string
  metadata: Record<string, any>
}

function preprocessDocument(doc: Document): Document {
  let content = doc.content
  
  // 1. Remove redundant whitespace
  content = content.replace(/\s+/g, ' ')
  
  // 2. Remove page numbers
  content = content.replace(/Page \d+/g, '')
  
  // 3. Normalize quotes
  content = content.replace(/[""]/g, '"')
  content = content.replace(/['']/g, "'")
  
  // 4. Fix common OCR errors (if from PDF)
  if (doc.metadata.source === 'pdf') {
    content = content.replace(/\bl\b/g, 'I') // l → I
    content = content.replace(/\bO\b/g, '0') // O → 0
  }
  
  // 5. Extract and enhance metadata
  const metadata = {
    ...doc.metadata,
    wordCount: content.split(/\s+/).length,
    hasCode: /```/.test(content),
    language: detectLanguage(content),
  }
  
  return { content, metadata }
}

const cleaned = documents.map(preprocessDocument)
```

---

## Chunking Strategies

### Fixed-Size Chunking

Simple and predictable:

```typescript
function chunkBySize(
  text: string,
  chunkSize: number,
  overlap: number
): string[] {
  const chunks: string[] = []
  let position = 0
  
  while (position < text.length) {
    const chunk = text.slice(position, position + chunkSize)
    chunks.push(chunk)
    position += chunkSize - overlap
  }
  
  return chunks
}

// Usage
const chunks = chunkBySize(document.content, 1000, 200)
```

### Semantic Chunking

Split by meaning:

```typescript
import { SemanticChunker } from '@seashore/data'

const chunker = new SemanticChunker({
  embeddings,
  similarityThreshold: 0.7, // Split when similarity drops
  minChunkSize: 100,
  maxChunkSize: 1000,
})

const semanticChunks = await chunker.chunk(document.content)
```

### Sentence-Based Chunking

```typescript
function chunkBySentences(
  text: string,
  sentencesPerChunk: number,
  overlapSentences: number
): string[] {
  // Split into sentences
  const sentences = text.match(/[^.!?]+[.!?]+/g) || []
  
  const chunks: string[] = []
  let i = 0
  
  while (i < sentences.length) {
    const chunk = sentences
      .slice(i, i + sentencesPerChunk)
      .join(' ')
      .trim()
    
    chunks.push(chunk)
    i += sentencesPerChunk - overlapSentences
  }
  
  return chunks
}
```

### Recursive Chunking

Split hierarchically:

```typescript
function recursiveChunk(
  text: string,
  maxSize: number,
  separators: string[] = ['\n\n', '\n', '. ', ' ']
): string[] {
  if (text.length <= maxSize) {
    return [text]
  }
  
  // Try each separator in order
  for (const separator of separators) {
    if (text.includes(separator)) {
      const parts = text.split(separator)
      const chunks: string[] = []
      let currentChunk = ''
      
      for (const part of parts) {
        if ((currentChunk + separator + part).length <= maxSize) {
          currentChunk += (currentChunk ? separator : '') + part
        } else {
          if (currentChunk) chunks.push(currentChunk)
          
          // If part is still too large, recurse
          if (part.length > maxSize) {
            chunks.push(...recursiveChunk(part, maxSize, separators.slice(1)))
          } else {
            currentChunk = part
          }
        }
      }
      
      if (currentChunk) chunks.push(currentChunk)
      return chunks
    }
  }
  
  // No separators found, force split
  return chunkBySize(text, maxSize, 0)
}
```

### Markdown-Aware Chunking

```typescript
function chunkMarkdown(content: string, maxSize: number): string[] {
  const chunks: string[] = []
  
  // Split by headers
  const sections = content.split(/^(#{1,6}\s+.+)$/m)
  
  let currentChunk = ''
  let currentHeader = ''
  
  for (let i = 0; i < sections.length; i++) {
    const section = sections[i]
    
    // Is this a header?
    if (/^#{1,6}\s+/.test(section)) {
      currentHeader = section
      continue
    }
    
    // Include header in chunk
    const withHeader = currentHeader + '\n' + section
    
    if (withHeader.length <= maxSize) {
      currentChunk = withHeader
      chunks.push(currentChunk)
    } else {
      // Split large sections
      const subchunks = recursiveChunk(section, maxSize - currentHeader.length)
      chunks.push(...subchunks.map(chunk => currentHeader + '\n' + chunk))
    }
  }
  
  return chunks
}
```

### Choosing a Strategy

| Strategy | Best For | Pros | Cons |
|----------|----------|------|------|
| Fixed-size | General text | Simple, predictable | May split mid-sentence |
| Semantic | Long documents | Preserves meaning | Slower, variable size |
| Sentence | Articles, docs | Natural boundaries | Variable length |
| Recursive | Mixed content | Flexible | Complex |
| Markdown | Technical docs | Structure-aware | Markdown only |

---

## Embedding Selection

### Model Comparison

```typescript
// OpenAI Ada 002 (legacy)
const ada002 = createEmbeddingAdapter({
  provider: 'openai',
  model: 'text-embedding-ada-002',
  dimensions: 1536,
  costPer1M: 0.10,
})

// OpenAI Small (recommended)
const small = createEmbeddingAdapter({
  provider: 'openai',
  model: 'text-embedding-3-small',
  dimensions: 1536, // Can reduce to 512
  costPer1M: 0.02, // 5x cheaper
})

// OpenAI Large (best quality)
const large = createEmbeddingAdapter({
  provider: 'openai',
  model: 'text-embedding-3-large',
  dimensions: 3072, // Can reduce to 256-1024
  costPer1M: 0.13,
})
```

### Dimension Reduction

Trade quality for speed/cost:

```typescript
const embeddings = createEmbeddingAdapter({
  provider: 'openai',
  model: 'text-embedding-3-large',
  dimensions: 1024, // Reduced from 3072
  apiKey: process.env.OPENAI_API_KEY!,
})

// Results in:
// - Smaller storage (3x less)
// - Faster search (3x faster)
// - Lower cost
// - Slightly lower quality (usually <5% impact)
```

### Batching for Performance

```typescript
async function embedDocuments(
  docs: string[],
  embeddings: EmbeddingAdapter,
  batchSize = 100
): Promise<number[][]> {
  const allEmbeddings: number[][] = []
  
  for (let i = 0; i < docs.length; i += batchSize) {
    const batch = docs.slice(i, i + batchSize)
    const batchEmbeddings = await embeddings.embedMany(batch)
    allEmbeddings.push(...batchEmbeddings)
    
    console.log(`Embedded ${i + batch.length}/${docs.length} documents`)
  }
  
  return allEmbeddings
}
```

---

## Vector Search

### Basic Search

```typescript
const results = await rag.search({
  query: 'How do I reset my password?',
  topK: 5, // Return top 5 results
})

// Results contain:
// - content: Chunk text
// - score: Similarity score (0-1)
// - metadata: Document metadata
```

### Advanced Search

```typescript
const results = await rag.search({
  query: 'password reset',
  topK: 10,
  
  // Metadata filters
  filter: {
    category: 'authentication',
    language: 'en',
    updatedAfter: '2024-01-01',
  },
  
  // Minimum similarity threshold
  minScore: 0.7,
  
  // Diversity (avoid similar results)
  diversityPenalty: 0.3,
})
```

### Hybrid Search

Combine vector and keyword search:

```typescript
import { HybridSearch } from '@seashore/data'

const hybrid = new HybridSearch({
  vectorDB,
  embeddings,
  
  // Weighting
  vectorWeight: 0.7, // 70% vector similarity
  keywordWeight: 0.3, // 30% keyword match
})

const results = await hybrid.search({
  query: 'database optimization techniques',
  topK: 10,
})
```

### Reranking

Improve results with reranking:

```typescript
import { Reranker } from '@seashore/data'

const reranker = new Reranker({
  model: 'cross-encoder/ms-marco-MiniLM-L-12-v2',
})

// Initial search
const candidates = await rag.search({
  query: 'machine learning best practices',
  topK: 50, // Get more candidates
})

// Rerank top candidates
const reranked = await reranker.rerank({
  query: 'machine learning best practices',
  documents: candidates,
  topK: 5, // Return top 5 after reranking
})
```

---

## Query Optimization

### Query Expansion

Improve recall with related terms:

```typescript
async function expandQuery(
  query: string,
  llm: LLMAdapter
): Promise<string[]> {
  const response = await llm.chat([
    {
      role: 'system',
      content: 'Generate 3 alternative phrasings of the user query.',
    },
    {
      role: 'user',
      content: query,
    },
  ])
  
  const alternatives = response.content
    .split('\n')
    .filter(line => line.trim())
  
  return [query, ...alternatives]
}

// Usage
const queries = await expandQuery('How to deploy Seashore?', llm)
// ['How to deploy Seashore?', 'Seashore deployment guide', 'Deploy Seashore to production', ...]

// Search with all queries
const allResults = await Promise.all(
  queries.map(q => rag.search({ query: q, topK: 10 }))
)

// Deduplicate and merge
const merged = deduplicateResults(allResults.flat())
```

### Query Decomposition

Break complex queries into sub-queries:

```typescript
async function decompose Query(
  query: string,
  llm: LLMAdapter
): Promise<string[]> {
  const response = await llm.chat([
    {
      role: 'system',
      content: 'Break down complex questions into simpler sub-questions.',
    },
    {
      role: 'user',
      content: query,
    },
  ])
  
  return response.content.split('\n').filter(line => line.trim())
}

// Usage
const complex = 'How do I set up authentication with OAuth and deploy to AWS?'
const subQueries = await decomposeQuery(complex, llm)
// ['How to set up OAuth authentication?', 'How to deploy to AWS?']

// Answer each sub-query
const subAnswers = await Promise.all(
  subQueries.map(async (q) => {
    const results = await rag.search({ query: q, topK: 3 })
    return { query: q, context: results }
  })
)
```

### Hypothetical Document Embeddings (HyDE)

Generate hypothetical answer, embed it:

```typescript
async function hydeSearch(
  query: string,
  rag: RAGPipeline,
  llm: LLMAdapter
): Promise<SearchResult[]> {
  // Generate hypothetical answer
  const hypothetical = await llm.chat([
    {
      role: 'system',
      content: 'Write a detailed answer to the question.',
    },
    {
      role: 'user',
      content: query,
    },
  ])
  
  // Search using hypothetical answer
  return await rag.search({
    query: hypothetical.content,
    topK: 5,
  })
}
```

---

## Ingestion Pipeline

### Complete Ingestion Flow

```typescript
import { createRAGPipeline } from '@seashore/data'

async function ingestDocuments(
  files: string[],
  rag: RAGPipeline
): Promise<void> {
  console.log(`Ingesting ${files.length} documents...`)
  
  // 1. Load documents
  const loader = new DocumentLoader()
  const documents = await Promise.all(
    files.map(file => loader.load(file))
  )
  console.log(`Loaded ${documents.length} documents`)
  
  // 2. Preprocess
  const processor = new DocumentProcessor()
  const processed = await processor.process(documents.flat())
  console.log(`Processed ${processed.length} documents`)
  
  // 3. Chunk
  const chunks = processed.flatMap(doc => 
    rag.chunk(doc.content, {
      chunkSize: 1000,
      overlap: 200,
      metadata: doc.metadata,
    })
  )
  console.log(`Created ${chunks.length} chunks`)
  
  // 4. Embed (with batching)
  const batchSize = 100
  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize)
    await rag.ingest(batch)
    console.log(`Ingested ${i + batch.length}/${chunks.length}`)
  }
  
  console.log('Ingestion complete!')
}
```

### Incremental Updates

```typescript
async function updateDocument(
  docId: string,
  newContent: string,
  rag: RAGPipeline
): Promise<void> {
  // 1. Delete old chunks
  await rag.deleteByMetadata({ documentId: docId })
  
  // 2. Chunk new content
  const chunks = rag.chunk(newContent, {
    metadata: { documentId: docId, updatedAt: new Date().toISOString() },
  })
  
  // 3. Ingest new chunks
  await rag.ingest(chunks)
}
```

---

## Production Patterns

### Caching

```typescript
import { LRUCache } from 'lru-cache'

const searchCache = new LRUCache<string, SearchResult[]>({
  max: 1000, // Cache 1000 queries
  ttl: 1000 * 60 * 30, // 30 minute TTL
})

async function cachedSearch(
  query: string,
  rag: RAGPipeline
): Promise<SearchResult[]> {
  const cacheKey = query.toLowerCase().trim()
  
  // Check cache
  const cached = searchCache.get(cacheKey)
  if (cached) {
    console.log('Cache hit:', query)
    return cached
  }
  
  // Search
  const results = await rag.search({ query, topK: 5 })
  
  // Cache results
  searchCache.set(cacheKey, results)
  
  return results
}
```

### Async Ingestion

```typescript
import { Queue } from 'bullmq'

const ingestionQueue = new Queue('document-ingestion', {
  connection: { host: 'localhost', port: 6379 },
})

// Add documents to queue
async function queueDocuments(files: string[]): Promise<void> {
  for (const file of files) {
    await ingestionQueue.add('ingest', { file })
  }
}

// Process queue
const worker = new Worker('document-ingestion', async (job) => {
  const { file } = job.data
  await ingestSingleDocument(file, rag)
}, {
  connection: { host: 'localhost', port: 6379 },
  concurrency: 5, // Process 5 documents at a time
})
```

### Monitoring

```typescript
class MonitoredRAG {
  private metrics = {
    searches: 0,
    cacheHits: 0,
    avgLatency: 0,
    errors: 0,
  }
  
  async search(query: string): Promise<SearchResult[]> {
    const start = Date.now()
    this.metrics.searches++
    
    try {
      const results = await this.rag.search({ query, topK: 5 })
      
      const latency = Date.now() - start
      this.metrics.avgLatency = 
        (this.metrics.avgLatency * (this.metrics.searches - 1) + latency) / 
        this.metrics.searches
      
      return results
    } catch (error) {
      this.metrics.errors++
      throw error
    }
  }
  
  getMetrics() {
    return {
      ...this.metrics,
      cacheHitRate: this.metrics.cacheHits / this.metrics.searches,
      errorRate: this.metrics.errors / this.metrics.searches,
    }
  }
}
```

---

## Evaluation

### Retrieval Metrics

```typescript
interface EvaluationResult {
  precision: number
  recall: number
  f1: number
  mrr: number // Mean Reciprocal Rank
  ndcg: number // Normalized Discounted Cumulative Gain
}

function evaluateRetrieval(
  results: SearchResult[],
  relevantDocs: Set<string>
): EvaluationResult {
  const retrieved = new Set(results.map(r => r.id))
  
  // Precision: % of retrieved that are relevant
  const relevant = results.filter(r => relevantDocs.has(r.id))
  const precision = relevant.length / results.length
  
  // Recall: % of relevant that were retrieved
  const recall = relevant.length / relevantDocs.size
  
  // F1 Score
  const f1 = 2 * (precision * recall) / (precision + recall)
  
  // MRR: 1 / rank of first relevant result
  const firstRelevantRank = results.findIndex(r => relevantDocs.has(r.id)) + 1
  const mrr = firstRelevantRank > 0 ? 1 / firstRelevantRank : 0
  
  // NDCG
  const dcg = results.reduce((sum, r, i) => {
    const relevance = relevantDocs.has(r.id) ? 1 : 0
    return sum + relevance / Math.log2(i + 2)
  }, 0)
  const idealDCG = Array.from(relevantDocs).reduce((sum, _, i) => {
    return sum + 1 / Math.log2(i + 2)
  }, 0)
  const ndcg = dcg / idealDCG
  
  return { precision, recall, f1, mrr, ndcg }
}
```

### End-to-End Evaluation

```typescript
async function evaluateRAGPipeline(
  testQueries: Array<{ query: string; expectedDocs: string[] }>,
  rag: RAGPipeline
): Promise<void> {
  const results = await Promise.all(
    testQueries.map(async ({ query, expectedDocs }) => {
      const retrieved = await rag.search({ query, topK: 10 })
      return evaluateRetrieval(retrieved, new Set(expectedDocs))
    })
  )
  
  // Aggregate metrics
  const avgMetrics = {
    precision: results.reduce((sum, r) => sum + r.precision, 0) / results.length,
    recall: results.reduce((sum, r) => sum + r.recall, 0) / results.length,
    f1: results.reduce((sum, r) => sum + r.f1, 0) / results.length,
    mrr: results.reduce((sum, r) => sum + r.mrr, 0) / results.length,
    ndcg: results.reduce((sum, r) => sum + r.ndcg, 0) / results.length,
  }
  
  console.table(avgMetrics)
}
```

---

## Best Practices Checklist

### Document Preparation
- [ ] Clean and normalize text
- [ ] Extract meaningful metadata
- [ ] Handle multiple formats
- [ ] Remove noise (headers, footers, etc.)

### Chunking
- [ ] Choose appropriate strategy for content type
- [ ] Use overlap to preserve context
- [ ] Keep chunks focused and coherent
- [ ] Include metadata with each chunk

### Embeddings
- [ ] Select model based on quality/cost trade-off
- [ ] Use consistent model for queries and documents
- [ ] Batch embed for performance
- [ ] Consider dimension reduction

### Search
- [ ] Tune topK based on context window
- [ ] Use metadata filters when possible
- [ ] Consider hybrid search for better recall
- [ ] Implement reranking for quality

### Performance
- [ ] Cache frequent queries
- [ ] Use async ingestion for large datasets
- [ ] Monitor latency and errors
- [ ] Scale horizontally (multiple vector DB replicas)

---

## Next Steps

- **[Evaluation Guide](./evaluation.md)** - Test RAG quality
- **[Performance Guide](./performance.md)** - Optimize for production
- **[Building Agents](./building-agents.md)** - Use RAG in agents

---

## Additional Resources

- **[Core Concepts: RAG](/docs/core-concepts/rag.md)** - Detailed documentation
- **[API Reference](/docs/api/data.md)** - Complete API
- **[Examples](/examples/)** - Code examples
