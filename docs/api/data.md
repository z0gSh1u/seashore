# @seashore/data API Reference

The `@seashore/data` package provides data persistence, vector search, and RAG (Retrieval-Augmented Generation) capabilities using PostgreSQL with pgvector.

## Table of Contents

- [Storage Service](#storage-service)
  - [createStorageService](#createstorageservice)
  - [StorageService](#storageservice)
  - [Database Schema](#database-schema)
- [Vector Database](#vector-database)
  - [createVectorDBService](#createvectordbservice)
  - [VectorDBService](#vectordbservice)
  - [Search Modes](#search-modes)
- [RAG Pipeline](#rag-pipeline)
  - [createRAG](#createrag)
  - [createChunker](#createchunker)
  - [RAGPipeline](#ragpipeline)
  - [Chunker](#chunker)

---

## Storage Service

### createStorageService

Creates a storage service for managing conversation threads, messages, and workflow runs using Drizzle ORM.

```typescript
function createStorageService(db: PostgresJsDatabase): StorageService
```

**Parameters:**
- `db` (`PostgresJsDatabase`): Drizzle database instance

**Returns:**
- `StorageService`: Storage service instance

**Example:**

```typescript
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { createStorageService } from '@seashore/data'

// Create PostgreSQL client
const client = postgres(process.env.DATABASE_URL!)
const db = drizzle(client)

// Create storage service
const storage = createStorageService(db)

// Create a thread
const thread = await storage.createThread({
  title: 'Customer Support Chat',
  metadata: { userId: '123', department: 'support' },
})

// Add messages
await storage.addMessage(thread.id, {
  role: 'user',
  content: 'How do I reset my password?',
})

await storage.addMessage(thread.id, {
  role: 'assistant',
  content: 'To reset your password, click on...',
  tokenUsage: {
    promptTokens: 150,
    completionTokens: 200,
    totalTokens: 350,
  },
})

// Get messages
const messages = await storage.getMessages(thread.id)
console.log(messages)

// List all threads
const threads = await storage.listThreads({ limit: 10, offset: 0 })
```

---

### StorageService

Interface for the storage service with methods for managing threads, messages, and workflow runs.

```typescript
interface StorageService {
  // Threads
  createThread(opts?: { title?: string; metadata?: Record<string, unknown> }): Promise<Thread>
  getThread(id: string): Promise<Thread | undefined>
  listThreads(opts?: PaginationOpts): Promise<Thread[]>
  deleteThread(id: string): Promise<void>

  // Messages
  addMessage(threadId: string, message: NewMessage): Promise<Message>
  getMessages(threadId: string, opts?: PaginationOpts): Promise<Message[]>

  // Workflow Runs
  saveWorkflowRun(run: Partial<WorkflowRun> & { id?: string }): Promise<WorkflowRun>
  getWorkflowRun(id: string): Promise<WorkflowRun | undefined>
  updateWorkflowRun(id: string, data: Partial<WorkflowRun>): Promise<void>
}
```

#### Thread Methods

##### createThread

```typescript
createThread(opts?: {
  title?: string
  metadata?: Record<string, unknown>
}): Promise<Thread>
```

Creates a new conversation thread.

**Example:**

```typescript
const thread = await storage.createThread({
  title: 'Bug Report Discussion',
  metadata: {
    issueId: 'BUG-123',
    priority: 'high',
    assignee: 'john@example.com',
  },
})
```

##### getThread

```typescript
getThread(id: string): Promise<Thread | undefined>
```

Retrieves a thread by ID.

##### listThreads

```typescript
listThreads(opts?: PaginationOpts): Promise<Thread[]>
```

Lists threads with pagination, ordered by most recently updated.

**Example:**

```typescript
const recentThreads = await storage.listThreads({ limit: 20, offset: 0 })
const nextPage = await storage.listThreads({ limit: 20, offset: 20 })
```

##### deleteThread

```typescript
deleteThread(id: string): Promise<void>
```

Deletes a thread and all its messages (cascade delete).

#### Message Methods

##### addMessage

```typescript
addMessage(threadId: string, message: NewMessage): Promise<Message>
```

Adds a message to a thread and updates the thread's `updatedAt` timestamp.

**NewMessage Interface:**

```typescript
interface NewMessage {
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: unknown  // Can be string, object, or array
  toolCalls?: unknown[]
  toolResults?: unknown[]
  tokenUsage?: {
    promptTokens?: number
    completionTokens?: number
    totalTokens?: number
  }
}
```

**Example:**

```typescript
// Simple message
await storage.addMessage(thread.id, {
  role: 'user',
  content: 'What is the weather today?',
})

// Message with token usage
await storage.addMessage(thread.id, {
  role: 'assistant',
  content: 'The weather is sunny with a temperature of 72°F.',
  tokenUsage: {
    promptTokens: 50,
    completionTokens: 20,
    totalTokens: 70,
  },
})

// Message with tool calls
await storage.addMessage(thread.id, {
  role: 'assistant',
  content: '',
  toolCalls: [
    {
      id: 'call_123',
      name: 'get_weather',
      arguments: { location: 'San Francisco' },
    },
  ],
})

// Tool result message
await storage.addMessage(thread.id, {
  role: 'tool',
  content: '',
  toolResults: [
    {
      toolCallId: 'call_123',
      result: { temperature: 72, conditions: 'sunny' },
    },
  ],
})
```

##### getMessages

```typescript
getMessages(threadId: string, opts?: PaginationOpts): Promise<Message[]>
```

Retrieves messages for a thread, ordered chronologically.

#### Workflow Run Methods

##### saveWorkflowRun

```typescript
saveWorkflowRun(
  run: Partial<WorkflowRun> & { id?: string }
): Promise<WorkflowRun>
```

Saves a workflow run state to the database.

**Example:**

```typescript
const workflowRun = await storage.saveWorkflowRun({
  workflowName: 'data-processing',
  status: 'running',
  state: {
    currentStep: 'fetch',
    progress: 0.3,
  },
  currentStep: 'fetch',
})
```

##### getWorkflowRun

```typescript
getWorkflowRun(id: string): Promise<WorkflowRun | undefined>
```

Retrieves a workflow run by ID.

##### updateWorkflowRun

```typescript
updateWorkflowRun(id: string, data: Partial<WorkflowRun>): Promise<void>
```

Updates an existing workflow run.

**Example:**

```typescript
await storage.updateWorkflowRun(workflowRun.id, {
  status: 'completed',
  currentStep: 'save',
  state: {
    ...workflowRun.state,
    progress: 1.0,
  },
})
```

---

### Database Schema

The storage service uses three main tables:

#### threads Table

```typescript
{
  id: uuid (primary key, auto-generated)
  title: text | null
  metadata: jsonb (Record<string, unknown>)
  createdAt: timestamp with timezone (auto-generated)
  updatedAt: timestamp with timezone (auto-generated)
}
```

**Schema Definition:**

```typescript
import { threads } from '@seashore/data'

// Use in Drizzle queries
const allThreads = await db.select().from(threads)
```

#### messages Table

```typescript
{
  id: uuid (primary key, auto-generated)
  threadId: uuid (foreign key -> threads.id, cascade delete)
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: jsonb (any JSON-serializable content)
  toolCalls: jsonb (unknown[])
  toolResults: jsonb (unknown[])
  tokenUsage: jsonb ({
    promptTokens?: number
    completionTokens?: number
    totalTokens?: number
  })
  createdAt: timestamp with timezone (auto-generated)
}
```

**Schema Definition:**

```typescript
import { messages } from '@seashore/data'
```

#### workflowRuns Table

```typescript
{
  id: uuid (primary key, auto-generated)
  workflowName: text
  status: 'running' | 'pending' | 'completed' | 'failed'
  state: jsonb (Record<string, unknown>)
  currentStep: text | null
  error: text | null
  createdAt: timestamp with timezone (auto-generated)
  updatedAt: timestamp with timezone (auto-generated)
}
```

**Schema Definition:**

```typescript
import { workflowRuns } from '@seashore/data'
```

#### Running Migrations

```typescript
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'

const client = postgres(process.env.DATABASE_URL!, { max: 1 })
const db = drizzle(client)

await migrate(db, { migrationsFolder: './drizzle' })
await client.end()
```

---

## Vector Database

### createVectorDBService

Creates a vector database service with pgvector for semantic search, full-text search, and hybrid search.

```typescript
function createVectorDBService(db: PostgresJsDatabase): VectorDBService
```

**Parameters:**
- `db` (`PostgresJsDatabase`): Drizzle database instance

**Returns:**
- `VectorDBService`: Vector database service instance

**Example:**

```typescript
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { createVectorDBService } from '@seashore/data'
import { createEmbeddingAdapter } from '@seashore/core'

const client = postgres(process.env.DATABASE_URL!)
const db = drizzle(client)
const vectordb = createVectorDBService(db)

const embedder = createEmbeddingAdapter({
  provider: 'openai',
  model: 'text-embedding-3-small',
  apiKey: process.env.OPENAI_API_KEY!,
})

// Insert documents
await vectordb.upsert('documentation', [
  {
    content: 'Seashore is an agent framework built on TanStack AI',
    metadata: { category: 'overview', version: '0.1.0' },
  },
  {
    content: 'createReActAgent creates a reasoning and acting agent',
    metadata: { category: 'api', package: '@seashore/agent' },
  },
  {
    content: 'Vector search uses pgvector with HNSW indexing',
    metadata: { category: 'data', feature: 'search' },
  },
], embedder)

// Vector search
const queryVector = (await embedder.embed(['agent framework']))[0]!
const results = await vectordb.search('documentation', {
  mode: 'vector',
  topK: 5,
  vector: queryVector,
})

console.log(results)
```

---

### VectorDBService

Interface for vector database operations.

```typescript
interface VectorDBService {
  upsert(
    collection: string,
    docs: DocumentInput[],
    embeddingAdapter: EmbeddingAdapter
  ): Promise<void>
  
  search(
    collection: string,
    query: SearchQuery
  ): Promise<SearchResult[]>
  
  delete(
    collection: string,
    filter?: MetadataFilter
  ): Promise<void>
}
```

#### upsert

```typescript
upsert(
  collection: string,
  docs: DocumentInput[],
  embeddingAdapter: EmbeddingAdapter
): Promise<void>
```

Inserts or updates documents in the vector database with embeddings.

**DocumentInput Interface:**

```typescript
interface DocumentInput {
  content: string
  metadata?: Record<string, unknown>
}
```

**Example:**

```typescript
await vectordb.upsert('knowledge-base', [
  {
    content: 'Python is a high-level programming language',
    metadata: { topic: 'programming', language: 'python' },
  },
  {
    content: 'React is a JavaScript library for building UIs',
    metadata: { topic: 'web', framework: 'react' },
  },
], embedder)
```

#### search

```typescript
search(
  collection: string,
  query: SearchQuery
): Promise<SearchResult[]>
```

Searches the vector database using vector similarity, full-text search, or hybrid search.

**SearchQuery Interface:**

```typescript
interface SearchQuery {
  vector?: number[]
  text?: string
  mode: 'vector' | 'text' | 'hybrid'
  topK: number
  filter?: Record<string, unknown>
  hybridWeights?: { vector: number; text: number }
}
```

**SearchResult Interface:**

```typescript
interface SearchResult {
  id: string
  content: string
  metadata: Record<string, unknown> | null
  score: number
}
```

**Examples:**

```typescript
// Vector search (semantic similarity)
const vectorResults = await vectordb.search('knowledge-base', {
  mode: 'vector',
  topK: 5,
  vector: await embedder.embed(['what is Python?'])[0],
})

// Text search (full-text)
const textResults = await vectordb.search('knowledge-base', {
  mode: 'text',
  topK: 5,
  text: 'programming language',
})

// Hybrid search (combines vector + text)
const hybridResults = await vectordb.search('knowledge-base', {
  mode: 'hybrid',
  topK: 5,
  vector: await embedder.embed(['web frameworks'])[0],
  text: 'React JavaScript',
  hybridWeights: { vector: 0.7, text: 0.3 },
})
```

#### delete

```typescript
delete(
  collection: string,
  filter?: MetadataFilter
): Promise<void>
```

Deletes documents from a collection.

**MetadataFilter Interface:**

```typescript
interface MetadataFilter {
  collection?: string
  metadata?: Record<string, unknown>
}
```

**Example:**

```typescript
// Delete entire collection
await vectordb.delete('old-docs')

// Delete with filter (future enhancement)
// await vectordb.delete('docs', { metadata: { archived: true } })
```

---

### Search Modes

The vector database supports three search modes:

#### Vector Search

Uses pgvector's HNSW index for fast approximate nearest neighbor search based on cosine similarity.

```typescript
const results = await vectordb.search('docs', {
  mode: 'vector',
  topK: 10,
  vector: queryEmbedding,
})
```

**Best for:**
- Semantic similarity
- Finding conceptually related content
- When exact keyword matches aren't important

#### Text Search

Uses PostgreSQL's built-in full-text search with tsvector and tsquery.

```typescript
const results = await vectordb.search('docs', {
  mode: 'text',
  topK: 10,
  text: 'agent framework tools',
})
```

**Best for:**
- Keyword-based search
- Exact term matching
- Boolean queries

#### Hybrid Search

Combines vector and text search using Reciprocal Rank Fusion (RRF) for best-of-both-worlds results.

```typescript
const results = await vectordb.search('docs', {
  mode: 'hybrid',
  topK: 10,
  vector: queryEmbedding,
  text: 'agent framework',
  hybridWeights: { vector: 0.7, text: 0.3 },
})
```

**Best for:**
- Balanced semantic and keyword relevance
- Production search systems
- When you want both conceptual and literal matches

**How it works:**
1. Runs vector search and text search independently
2. Ranks results from each search
3. Combines ranks using RRF: `score = w_v * 1/(k + rank_v) + w_t * 1/(k + rank_t)`
4. Returns top results by combined score

---

## RAG Pipeline

### createRAG

Creates a RAG (Retrieval-Augmented Generation) pipeline that combines document chunking, embedding, and hybrid search.

```typescript
function createRAG(config: RAGConfig): RAGPipeline
```

**Parameters:**
- `config` (`RAGConfig`): RAG pipeline configuration

**Returns:**
- `RAGPipeline`: RAG pipeline instance

**RAGConfig Interface:**

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

**Example:**

```typescript
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { createRAG, createVectorDBService } from '@seashore/data'
import { createEmbeddingAdapter } from '@seashore/core'

const client = postgres(process.env.DATABASE_URL!)
const db = drizzle(client)

const rag = createRAG({
  embedding: createEmbeddingAdapter({
    provider: 'openai',
    model: 'text-embedding-3-small',
    apiKey: process.env.OPENAI_API_KEY!,
  }),
  vectordb: createVectorDBService(db),
  collection: 'documentation',
  searchMode: 'hybrid',
  topK: 5,
  hybridWeights: { vector: 0.7, text: 0.3 },
  chunker: {
    strategy: 'recursive',
    chunkSize: 1000,
    overlap: 100,
  },
})

// Ingest documents (automatically chunked)
await rag.ingest([
  {
    content: `# Seashore Documentation
    
Seashore is a modern agent framework built on TanStack AI...

[Long documentation content here]
`,
    metadata: { source: 'docs', page: 'intro' },
  },
])

// Retrieve relevant context
const context = await rag.retrieve('How do I create an agent?')
console.log(context) // Top 5 most relevant chunks
```

---

### RAGPipeline

Interface for RAG pipeline operations.

```typescript
interface RAGPipeline {
  ingest(docs: DocumentInput[]): Promise<void>
  retrieve(query: string): Promise<SearchResult[]>
}
```

#### ingest

```typescript
ingest(docs: DocumentInput[]): Promise<void>
```

Ingests documents into the RAG system. If a chunker is configured, documents are automatically split into smaller chunks before embedding.

**Example:**

```typescript
// Ingest large documents
await rag.ingest([
  {
    content: fs.readFileSync('long-document.md', 'utf-8'),
    metadata: { filename: 'long-document.md', type: 'documentation' },
  },
  {
    content: fs.readFileSync('api-reference.md', 'utf-8'),
    metadata: { filename: 'api-reference.md', type: 'api' },
  },
])
```

#### retrieve

```typescript
retrieve(query: string): Promise<SearchResult[]>
```

Retrieves the most relevant documents/chunks for a query using the configured search mode.

**Example:**

```typescript
const context = await rag.retrieve('What are guardrails?')

// Use with agent
import { createReActAgent } from '@seashore/agent'
import { createLLMAdapter, systemPrompt } from '@seashore/core'

const contextStr = context.map(r => r.content).join('\n\n')

const agent = createReActAgent({
  model: createLLMAdapter({ provider: 'openai', apiKey: '...' })('gpt-4o'),
  systemPrompt: systemPrompt()
    .role('You are a helpful documentation assistant')
    .instruction('Use the provided context to answer questions accurately')
    .instruction(`Context:\n${contextStr}`)
    .build(),
  tools: [],
})

const response = await agent.run([
  { role: 'user', content: 'What are guardrails?' },
])
```

---

### createChunker

Creates a text chunker for splitting documents into manageable chunks.

```typescript
function createChunker(config: ChunkerConfig): Chunker
```

**Parameters:**
- `config` (`ChunkerConfig`): Chunker configuration

**Returns:**
- `Chunker`: Chunker instance

**ChunkerConfig Interface:**

```typescript
interface ChunkerConfig {
  strategy: 'fixed' | 'recursive'
  chunkSize: number
  overlap: number
}
```

**Strategies:**

- `'fixed'`: Simple character-based chunking with overlap
- `'recursive'`: Intelligent chunking that preserves document structure (paragraphs, sentences, words)

**Example:**

```typescript
import { createChunker } from '@seashore/data'

// Fixed-size chunks
const fixedChunker = createChunker({
  strategy: 'fixed',
  chunkSize: 1000,
  overlap: 100,
})

const chunks = fixedChunker.chunk(longDocument)

// Recursive chunking (preserves structure)
const smartChunker = createChunker({
  strategy: 'recursive',
  chunkSize: 1000,
  overlap: 100,
})

const structuredChunks = smartChunker.chunk(longDocument)
```

---

### Chunker

Interface for text chunkers.

```typescript
interface Chunker {
  chunk(text: string): string[]
}
```

#### chunk

```typescript
chunk(text: string): string[]
```

Splits text into chunks according to the chunker's strategy.

**Example:**

```typescript
const document = `
# Introduction

This is a long document that needs to be split into chunks.

## Section 1

Content for section 1...

## Section 2

Content for section 2...
`

const chunker = createChunker({
  strategy: 'recursive',
  chunkSize: 500,
  overlap: 50,
})

const chunks = chunker.chunk(document)
console.log(`Document split into ${chunks.length} chunks`)
chunks.forEach((chunk, i) => {
  console.log(`Chunk ${i + 1}: ${chunk.length} characters`)
})
```

---

## Complete RAG Example

```typescript
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import {
  createStorageService,
  createVectorDBService,
  createRAG,
  createChunker,
} from '@seashore/data'
import { createEmbeddingAdapter } from '@seashore/core'
import { createReActAgent } from '@seashore/agent'
import { createLLMAdapter, systemPrompt } from '@seashore/core'
import fs from 'fs'

// Setup database
const client = postgres(process.env.DATABASE_URL!)
const db = drizzle(client)

// Setup services
const storage = createStorageService(db)
const vectordb = createVectorDBService(db)
const embedder = createEmbeddingAdapter({
  provider: 'openai',
  model: 'text-embedding-3-small',
  apiKey: process.env.OPENAI_API_KEY!,
})

// Create RAG pipeline
const rag = createRAG({
  embedding: embedder,
  vectordb,
  collection: 'docs',
  searchMode: 'hybrid',
  topK: 5,
  chunker: {
    strategy: 'recursive',
    chunkSize: 1000,
    overlap: 100,
  },
})

// Ingest documentation
const docs = [
  fs.readFileSync('./docs/getting-started.md', 'utf-8'),
  fs.readFileSync('./docs/api-reference.md', 'utf-8'),
  fs.readFileSync('./docs/examples.md', 'utf-8'),
]

await rag.ingest(
  docs.map((content, i) => ({
    content,
    metadata: { docIndex: i },
  }))
)

// Create RAG-powered agent
async function createRAGAgent(userQuery: string) {
  // Retrieve relevant context
  const context = await rag.retrieve(userQuery)
  const contextStr = context
    .map((r, i) => `[${i + 1}] ${r.content}`)
    .join('\n\n')

  // Create agent with context
  const agent = createReActAgent({
    model: createLLMAdapter({
      provider: 'openai',
      apiKey: process.env.OPENAI_API_KEY!,
    })('gpt-4o'),
    systemPrompt: systemPrompt()
      .role('You are a helpful documentation assistant')
      .instruction('Answer questions based on the provided context')
      .instruction('Cite sources using [1], [2], etc.')
      .instruction('If the answer is not in the context, say so')
      .instruction(`\n\nContext:\n${contextStr}`)
      .build(),
    tools: [],
  })

  return agent
}

// Create conversation thread
const thread = await storage.createThread({
  title: 'Documentation Q&A',
})

// User asks question
const userQuestion = 'How do I create a ReAct agent?'
await storage.addMessage(thread.id, {
  role: 'user',
  content: userQuestion,
})

// Get answer from RAG agent
const agent = await createRAGAgent(userQuestion)
const response = await agent.run([
  { role: 'user', content: userQuestion },
])

// Save response
await storage.addMessage(thread.id, {
  role: 'assistant',
  content: response.result.content,
  tokenUsage: {
    promptTokens: 1500,
    completionTokens: 300,
    totalTokens: 1800,
  },
})

console.log('Answer:', response.result.content)
```

---

## Database Setup

### Required PostgreSQL Extensions

```sql
-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
```

### Schema Migration

Use Drizzle Kit to generate and run migrations:

```bash
# Generate migration
pnpm drizzle-kit generate

# Run migration
pnpm drizzle-kit migrate
```

Or programmatically:

```typescript
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'

const migrationClient = postgres(process.env.DATABASE_URL!, { max: 1 })
await migrate(drizzle(migrationClient), {
  migrationsFolder: './drizzle',
})
await migrationClient.end()
```

---

## Type Exports

```typescript
import type {
  StorageService,
  PaginationOpts,
  NewMessage,
  Thread,
  Message,
  WorkflowRun,
  VectorDBService,
  SearchQuery,
  SearchResult,
  DocumentInput,
  MetadataFilter,
  RAGConfig,
  RAGPipeline,
  ChunkerConfig,
  Chunker,
} from '@seashore/data'

// Schema exports
import { threads, messages, workflowRuns, embeddings } from '@seashore/data'
```

---

## Best Practices

1. **Use connection pooling**: Configure postgres client with appropriate pool size for your workload.

2. **Index optimization**: The embeddings table has HNSW and GIN indexes pre-configured. Monitor query performance.

3. **Batch operations**: When inserting many documents, batch them in groups of 10-100 for optimal performance.

4. **Chunking strategy**: Use `'recursive'` chunking for natural language documents to preserve semantic boundaries.

5. **Hybrid search**: For production RAG systems, use hybrid search with 70/30 vector/text weights as a starting point.

6. **Metadata filtering**: Store useful metadata (source, date, category) for future filtering capabilities.

7. **Regular cleanup**: Periodically delete old threads and embeddings to manage database size.

8. **Monitor token usage**: Track `tokenUsage` in messages to optimize costs and performance.
