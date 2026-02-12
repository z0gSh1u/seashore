# @seashore/data API 参考

`@seashore/data` 包提供数据持久化、向量搜索和 RAG（检索增强生成）功能，使用 PostgreSQL 和 pgvector。

## 目录

- [存储服务](#存储服务)
  - [createStorageService](#createstorageservice)
  - [StorageService](#storageservice)
  - [数据库模式](#数据库模式)
- [向量数据库](#向量数据库)
  - [createVectorDBService](#createvectordbservice)
  - [VectorDBService](#vectordbservice)
  - [搜索模式](#搜索模式)
- [RAG 管道](#rag-管道)
  - [createRAG](#createrag)
  - [createChunker](#createchunker)
  - [RAGPipeline](#ragpipeline)
  - [Chunker](#chunker)

---

## 存储服务

### createStorageService

创建存储服务，用于使用 Drizzle ORM 管理对话线程、消息和工作流运行。

```typescript
function createStorageService(db: PostgresJsDatabase): StorageService
```

**参数：**
- `db` (`PostgresJsDatabase`): Drizzle 数据库实例

**返回值：**
- `StorageService`: 存储服务实例

**示例：**

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

存储服务的接口，包含管理线程、消息和工作流运行的方法。

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

#### 线程方法

##### createThread

```typescript
createThread(opts?: {
  title?: string
  metadata?: Record<string, unknown>
}): Promise<Thread>
```

创建新的对话线程。

**示例：**

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

通过 ID 获取线程。

##### listThreads

```typescript
listThreads(opts?: PaginationOpts): Promise<Thread[]>
```

列出线程并支持分页，按最近更新时间排序。

**示例：**

```typescript
const recentThreads = await storage.listThreads({ limit: 20, offset: 0 })
const nextPage = await storage.listThreads({ limit: 20, offset: 20 })
```

##### deleteThread

```typescript
deleteThread(id: string): Promise<void>
```

删除线程及其所有消息（级联删除）。

#### 消息方法

##### addMessage

```typescript
addMessage(threadId: string, message: NewMessage): Promise<Message>
```

向线程添加消息并更新线程的 `updatedAt` 时间戳。

**NewMessage 接口：**

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

**示例：**

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

获取线程的消息，按时间顺序排序。

#### 工作流运行方法

##### saveWorkflowRun

```typescript
saveWorkflowRun(
  run: Partial<WorkflowRun> & { id?: string }
): Promise<WorkflowRun>
```

将工作流运行状态保存到数据库。

**示例：**

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

通过 ID 获取工作流运行。

##### updateWorkflowRun

```typescript
updateWorkflowRun(id: string, data: Partial<WorkflowRun>): Promise<void>
```

更新现有的工作流运行。

**示例：**

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

### 数据库模式

存储服务使用三个主要表：

#### threads 表

```typescript
{
  id: uuid (primary key, auto-generated)
  title: text | null
  metadata: jsonb (Record<string, unknown>)
  createdAt: timestamp with timezone (auto-generated)
  updatedAt: timestamp with timezone (auto-generated)
}
```

**模式定义：**

```typescript
import { threads } from '@seashore/data'

// Use in Drizzle queries
const allThreads = await db.select().from(threads)
```

#### messages 表

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

**模式定义：**

```typescript
import { messages } from '@seashore/data'
```

#### workflowRuns 表

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

**模式定义：**

```typescript
import { workflowRuns } from '@seashore/data'
```

#### 运行迁移

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

## 向量数据库

### createVectorDBService

创建向量数据库服务，使用 pgvector 进行语义搜索、全文搜索和混合搜索。

```typescript
function createVectorDBService(db: PostgresJsDatabase): VectorDBService
```

**参数：**
- `db` (`PostgresJsDatabase`): Drizzle 数据库实例

**返回值：**
- `VectorDBService`: 向量数据库服务实例

**示例：**

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

向量数据库操作的接口。

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

在向量数据库中插入或更新带有嵌入向量的文档。

**DocumentInput 接口：**

```typescript
interface DocumentInput {
  content: string
  metadata?: Record<string, unknown>
}
```

**示例：**

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

使用向量相似度、全文搜索或混合搜索在向量数据库中进行搜索。

**SearchQuery 接口：**

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

**SearchResult 接口：**

```typescript
interface SearchResult {
  id: string
  content: string
  metadata: Record<string, unknown> | null
  score: number
}
```

**示例：**

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

从集合中删除文档。

**MetadataFilter 接口：**

```typescript
interface MetadataFilter {
  collection?: string
  metadata?: Record<string, unknown>
}
```

**示例：**

```typescript
// Delete entire collection
await vectordb.delete('old-docs')

// Delete with filter (future enhancement)
// await vectordb.delete('docs', { metadata: { archived: true } })
```

---

### 搜索模式

向量数据库支持三种搜索模式：

#### 向量搜索

使用 pgvector 的 HNSW 索引进行基于余弦相似度的快速近似最近邻搜索。

```typescript
const results = await vectordb.search('docs', {
  mode: 'vector',
  topK: 10,
  vector: queryEmbedding,
})
```

**最适合：**
- 语义相似度
- 查找概念相关的内容
- 当精确的关键词匹配不重要时

#### 文本搜索

使用 PostgreSQL 的内置全文搜索，基于 tsvector 和 tsquery。

```typescript
const results = await vectordb.search('docs', {
  mode: 'text',
  topK: 10,
  text: 'agent framework tools',
})
```

**最适合：**
- 基于关键词的搜索
- 精确术语匹配
- 布尔查询

#### 混合搜索

使用倒数排名融合 (RRF) 结合向量和文本搜索，获得两全其美的结果。

```typescript
const results = await vectordb.search('docs', {
  mode: 'hybrid',
  topK: 10,
  vector: queryEmbedding,
  text: 'agent framework',
  hybridWeights: { vector: 0.7, text: 0.3 },
})
```

**最适合：**
- 平衡语义和关键词相关性
- 生产搜索系统
- 当你需要概念匹配和字面匹配时

**工作原理：**
1. 独立运行向量搜索和文本搜索
2. 对每个搜索的结果进行排名
3. 使用 RRF 组合排名：`score = w_v * 1/(k + rank_v) + w_t * 1/(k + rank_t)`
4. 返回按组合分数排序的顶部结果

---

## RAG 管道

### createRAG

创建 RAG（检索增强生成）管道，结合文档分块、嵌入和混合搜索。

```typescript
function createRAG(config: RAGConfig): RAGPipeline
```

**参数：**
- `config` (`RAGConfig`): RAG 管道配置

**返回值：**
- `RAGPipeline`: RAG 管道实例

**RAGConfig 接口：**

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

**示例：**

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

RAG 管道操作的接口。

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

将文档摄取到 RAG 系统中。如果配置了分块器，文档会在嵌入之前自动分割成较小的块。

**示例：**

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

使用配置的搜索模式检索查询最相关的文档/块。

**示例：**

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

创建文本分块器，用于将文档分割成可管理的块。

```typescript
function createChunker(config: ChunkerConfig): Chunker
```

**参数：**
- `config` (`ChunkerConfig`): 分块器配置

**返回值：**
- `Chunker`: 分块器实例

**ChunkerConfig 接口：**

```typescript
interface ChunkerConfig {
  strategy: 'fixed' | 'recursive'
  chunkSize: number
  overlap: number
}
```

**策略：**

- `'fixed'`: 简单的基于字符的分块，带重叠
- `'recursive'`: 智能分块，保留文档结构（段落、句子、单词）

**示例：**

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

文本分块器的接口。

```typescript
interface Chunker {
  chunk(text: string): string[]
}
```

#### chunk

```typescript
chunk(text: string): string[]
```

根据分块器的策略将文本分割成块。

**示例：**

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

## 完整的 RAG 示例

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

## 数据库设置

### 必需的 PostgreSQL 扩展

```sql
-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
```

### 模式迁移

使用 Drizzle Kit 生成和运行迁移：

```bash
# Generate migration
pnpm drizzle-kit generate

# Run migration
pnpm drizzle-kit migrate
```

或以编程方式：

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

## 类型导出

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

## 最佳实践

1. **使用连接池**：为您的工作负载配置合适的 postgres 客户端池大小。

2. **索引优化**：embeddings 表已预配置 HNSW 和 GIN 索引。监控查询性能。

3. **批量操作**：插入大量文档时，批量分组为 10-100 个以获得最佳性能。

4. **分块策略**：对自然语言文档使用 `'recursive'` 分块以保留语义边界。

5. **混合搜索**：对于生产 RAG 系统，使用混合搜索，起始权重为 70/30 向量/文本。

6. **元数据过滤**：存储有用的元数据（来源、日期、类别）以备将来过滤功能使用。

7. **定期清理**：定期删除旧线程和嵌入以管理数据库大小。

8. **监控令牌使用**：在消息中跟踪 `tokenUsage` 以优化成本和性能。
