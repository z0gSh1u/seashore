# RAG (检索增强生成)

**RAG** 通过从您自己的知识库检索相关信息来增强 LLM 响应。它结合了**向量搜索**、**全文搜索**和**混合搜索**,为给定查询找到最相关的文档。

## 概览

RAG 解决了**知识基础**的问题:为 LLMs 提供访问超出其训练数据的特定、最新信息的能力。

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
│  (pgvector HNSW)   │ ← 查找相似文档
└────────┬───────────┘
         │
         ▼
┌────────────────────┐
│ Retrieve Top-K     │
│   Documents        │ ← 按相关性排序
└────────┬───────────┘
         │
         ▼
┌────────────────────┐
│  LLM Generation    │
│ (with retrieved    │ ← 增强的上下文
│  context)          │
└────────┬───────────┘
         │
         ▼
┌────────────────────┐
│ Grounded Response  │
└────────────────────┘
```

**主要优势:**
- **准确** - 基于您的数据的响应
- **当前** - 信息是最新的
- **可追溯** - 知道使用了哪些文档
- **可扩展** - 使用 HNSW 索引的高效向量搜索

---

## 核心组件

### 向量数据库

Seashore 使用 **pgvector** 与 PostgreSQL 进行向量存储和搜索。

**特性:**
- HNSW 索引用于快速相似性搜索
- 使用 tsvector/tsquery 的全文搜索
- 使用互惠排名融合 (RRF) 的混合搜索
- 元数据过滤
- Drizzle ORM 集成

### Embeddings

**Embeddings** 将文本转换为捕获语义含义的高维向量。

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

### 分块

**分块**将大文档拆分为较小的、可管理的片段。

**策略:**
- **固定** - 简单的基于字符的分块
- **递归** - 保留段落、句子、单词

```typescript
import { createChunker } from '@seashore/data'

const chunker = createChunker({
  strategy: 'recursive',
  chunkSize: 1000,
  overlap: 100,
})

const chunks = chunker.chunk(longDocument)
console.log(chunks.length)  // 分块数量
```

---

## 设置 RAG

### 1. 数据库设置

安装带有 pgvector 的 PostgreSQL:

```bash
# 使用 Docker
docker run -d \
  --name postgres-vectordb \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=seashore \
  -p 5432:5432 \
  ankane/pgvector

# 安装 pgvector 扩展
psql -U postgres -d seashore -c "CREATE EXTENSION IF NOT EXISTS vector"
```

### 2. 初始化数据库

```typescript
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

const client = postgres(process.env.DATABASE_URL!)
const db = drizzle(client)
```

### 3. 创建 Vector DB 服务

```typescript
import { createVectorDBService } from '@seashore/data'

const vectordb = createVectorDBService(db)
```

### 4. 创建 RAG 管道

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

## RAG 管道 API

### 配置

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

### 摄取文档

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

**使用分块:**
```typescript
// 长文档将被自动分块
await rag.ingest([
  {
    content: longDocument,  // 50,000 characters
    metadata: { source: 'whitepaper.pdf' }
  }
])

// 结果: 保留元数据的多个块
// 每个块: ~1000 个字符,100 个字符重叠
```

### 检索文档

```typescript
const results = await rag.retrieve('How do I build agents?')

results.forEach(result => {
  console.log('Score:', result.score)
  console.log('Content:', result.content)
  console.log('Metadata:', result.metadata)
})
```

---

## 搜索模式

### 向量搜索

使用余弦距离的**语义相似性**:

```typescript
const rag = createRAG({
  embedding: embedder,
  vectordb,
  collection: 'docs',
  searchMode: 'vector',  // 纯向量搜索
  topK: 5,
})

const results = await rag.retrieve('agent frameworks')
// 返回语义上与 "agent frameworks" 相似的文档
// 即使它们不包含这些确切的词
```

**优势:**
- 捕获语义含义
- 处理同义词和释义
- 跨语言工作

**用例:**
- 概念性查询 ("什么是 agent?")
- 跨语言搜索
- 查找相关概念

### 文本搜索

使用 PostgreSQL 全文搜索的**基于关键词**:

```typescript
const rag = createRAG({
  embedding: embedder,
  vectordb,
  collection: 'docs',
  searchMode: 'text',  // 全文搜索
  topK: 5,
})

const results = await rag.retrieve('createReActAgent')
// 返回包含确切术语 "createReActAgent" 的文档
```

**优势:**
- 精确匹配快速
- 适合技术术语
- 无 embedding 开销

**用例:**
- API 函数名
- 确切术语
- 代码搜索

### 混合搜索

使用互惠排名融合 (RRF) 的**两全其美**:

```typescript
const rag = createRAG({
  embedding: embedder,
  vectordb,
  collection: 'docs',
  searchMode: 'hybrid',  // 结合向量 + 文本
  topK: 5,
  hybridWeights: {
    vector: 0.7,  // 70% 语义相似性
    text: 0.3,    // 30% 关键词匹配
  },
})

const results = await rag.retrieve('how to use createReActAgent')
// 结合:
// - 语义理解 ("how to use")
// - 精确匹配 ("createReActAgent")
```

**RRF 工作原理:**
```
向量结果:            文本结果:
1. Doc A (0.95)     1. Doc C (rank 1)
2. Doc B (0.89)     2. Doc A (rank 2)
3. Doc D (0.82)     3. Doc E (rank 3)

RRF Score = w_v * 1/(k + rank_v) + w_t * 1/(k + rank_t)
其中 k = 60 (常数)

组合排名:
1. Doc A (在两者中都很高)
2. Doc C (在文本中很高)
3. Doc B (在向量中很高)
```

**优势:**
- 平衡的结果
- 处理概念和精确术语
- 最适合生产

**用例:**
- 通用问答
- 文档搜索
- 混合查询类型

---

## 分块策略

### 固定分块

简单的基于字符的拆分:

```typescript
const chunker = createChunker({
  strategy: 'fixed',
  chunkSize: 1000,
  overlap: 100,
})

const chunks = chunker.chunk(document)
```

**工作原理:**
```
Document: "ABCDEFGHIJK..."
Chunk 1: "ABCDEFGHIJ" (0-1000)
Chunk 2: "JKLMNOPQRS" (900-1900, 100 char overlap)
Chunk 3: "STUVWXYZ" (1800-2800, 100 char overlap)
```

**优点:**
- 简单且可预测
- 快速处理
- 一致的块大小

**缺点:**
- 可能在单词中间拆分句子
- 失去语义边界

### 递归分块

保留结构的智能拆分:

```typescript
const chunker = createChunker({
  strategy: 'recursive',
  chunkSize: 1000,
  overlap: 100,
})

const chunks = chunker.chunk(document)
```

**拆分层次:**
1. 尝试段落 (`\n\n`)
2. 回退到句子 (`. `)
3. 回退到单词 (` `)
4. 回退到字符 (固定)

**示例:**
```
Document:
"Introduction\n\nSeashore is an agent framework.\n\nIt provides tools for building agents."

Chunks:
1. "Introduction\n\nSeashore is an agent framework."
2. "It provides tools for building agents."
```

**优点:**
- 保留语义边界
- 更好的 embeddings 上下文
- 更有意义的块

**缺点:**
- 可变块大小
- 稍慢

### 选择块大小

**小块 (500-1000 chars):**
- 更精确的检索
- 总块数更多
- 更适合具体问题

**中等块 (1000-2000 chars):**
- 平衡精度/上下文
- 适合大多数用例
- 推荐默认值

**大块 (2000-4000 chars):**
- 每个块更多上下文
- 总块数更少
- 更适合广泛问题

### 块重叠

重叠确保块边界的连续性:

```typescript
// 10% 重叠
chunkSize: 1000,
overlap: 100,  // 块 N 的最后 100 个字符 = 块 N+1 的前 100 个字符
```

**为什么重叠很重要:**
```
没有重叠:
Chunk 1: "...Seashore is an agent"
Chunk 2: "framework built on TanStack..."
问题: "agent framework" 在块之间拆分

有重叠 (100 chars):
Chunk 1: "...Seashore is an agent framework..."
Chunk 2: "...agent framework built on TanStack..."
好处: "agent framework" 出现在两个块中
```

---

## 在 Agents 中使用 RAG

### 基础 RAG Agent

```typescript
import { createReActAgent } from '@seashore/agent'
import { createRAG } from '@seashore/data'

// 创建 RAG 管道
const rag = createRAG({
  embedding: embedder,
  vectordb,
  collection: 'docs',
  searchMode: 'hybrid',
  topK: 3,
})

// 创建检索工具
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

// 使用 RAG 工具创建 agent
const agent = createReActAgent({
  model: () => llm('gpt-4o'),
  systemPrompt: `You are a helpful assistant with access to a knowledge base.
Always search the knowledge base before answering questions.
Base your answers on the retrieved information.`,
  tools: [retrieveTool],
})

// 使用 agent
const response = await agent.run([
  { role: 'user', content: 'How do I create a ReAct agent?' }
])
```

### Auto-RAG 模式

自动使用相关上下文增强查询:

```typescript
async function chatWithRAG(userQuery: string) {
  // 1. 检索相关文档
  const docs = await rag.retrieve(userQuery)
  
  // 2. 从顶部结果构建上下文
  const context = docs
    .slice(0, 3)
    .map(d => d.content)
    .join('\n\n---\n\n')
  
  // 3. 使用上下文增强用户查询
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
  
  // 4. 获取 LLM 响应
  const response = await agent.run(augmentedMessages)
  
  return {
    answer: response.result.content,
    sources: docs.map(d => d.metadata),
  }
}

// 用法
const result = await chatWithRAG('What is Seashore?')
console.log(result.answer)
console.log('Sources:', result.sources)
```

### Agentic RAG

让 agent 决定何时检索:

```typescript
const agent = createReActAgent({
  model: () => llm('gpt-4o'),
  systemPrompt: `You are a documentation assistant.
When you don't know something, use the search_knowledge_base tool.
Always cite your sources.`,
  tools: [retrieveTool],
})

// Agent 将在需要时自动调用 retrieveTool
const response = await agent.run([
  { role: 'user', content: 'How do workflows work?' }
])

// Agent 执行:
// 1. 识别需要信息
// 2. 调用 search_knowledge_base({ query: "workflows" })
// 3. 接收检索的文档
// 4. 基于结果制定答案
```

---

## 最佳实践

### 1. 选择适当的搜索模式

```typescript
// 技术文档 → 混合
const techDocsRAG = createRAG({
  searchMode: 'hybrid',
  hybridWeights: { vector: 0.6, text: 0.4 },
})

// 通用知识 → 向量
const generalRAG = createRAG({
  searchMode: 'vector',
})

// API 参考 → 文本
const apiRefRAG = createRAG({
  searchMode: 'text',
})
```

### 2. 为内容类型优化块大小

```typescript
// 短问答 → 小块
const qnaChunker = createChunker({
  strategy: 'recursive',
  chunkSize: 500,
  overlap: 50,
})

// 技术文章 → 中等块
const articleChunker = createChunker({
  strategy: 'recursive',
  chunkSize: 1500,
  overlap: 150,
})

// 书籍/白皮书 → 大块
const bookChunker = createChunker({
  strategy: 'recursive',
  chunkSize: 3000,
  overlap: 300,
})
```

### 3. 包含元数据

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

---

## 相关概念

- **[Agents](./agents.md)** - 在 ReAct agents 中使用 RAG
- **[Context](./context.md)** - RAG 的提示词工程
- **[Architecture](./architecture.md)** - 理解数据层

---

## 下一步

- **[构建 RAG 系统](../getting-started/first-rag.md)**
- **[RAG 示例](../../examples/rag/)**
- **[高级 RAG 模式](../guides/advanced-rag.md)**
