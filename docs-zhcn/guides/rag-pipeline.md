# RAG 管道

构建生产就绪的检索增强生成(RAG)系统,包括正确的文档准备、分块策略、嵌入选择、搜索调优和性能优化。

## 概述

RAG 通过从知识库检索相关信息来增强 LLM 响应。本指南涵盖从文档摄取到生产部署的完整 RAG 管道构建。

**你将学到:**
- 文档准备和处理
- 分块策略和优化
- 嵌入模型选择
- 向量搜索和检索调优
- 查询优化
- 性能和可扩展性
- 评估和监控

---

## RAG 架构

### 管道概述

```
文档 → 预处理 → 分块 → 嵌入 → 向量存储
                                      ↓
用户查询 → 查询处理 → 嵌入 → 向量搜索 → 重排序 → 上下文
                                               ↓
                                          LLM 生成
```

### Seashore RAG 组件

```typescript
import { createRAGPipeline, createVectorDB } from '@seashore/data'
import { createEmbeddingAdapter } from '@seashore/core'

// 1. 设置嵌入
const embeddings = createEmbeddingAdapter({
  provider: 'openai',
  model: 'text-embedding-3-small',
  apiKey: process.env.OPENAI_API_KEY!,
})

// 2. 设置向量数据库
const vectorDB = createVectorDB({
  connectionString: process.env.DATABASE_URL!,
  tableName: 'documents',
  dimensions: 1536, // 匹配嵌入维度
})

// 3. 创建 RAG 管道
const rag = createRAGPipeline({
  vectorDB,
  embeddings,
  chunkSize: 1000,
  chunkOverlap: 200,
  topK: 5,
})
```

---

## 文档准备

### 文档类型

支持多种格式:

```typescript
import { DocumentLoader } from '@seashore/data'

const loader = new DocumentLoader()

// 文本文件
const txtDocs = await loader.loadText('./docs/manual.txt')

// Markdown
const mdDocs = await loader.loadMarkdown('./docs/*.md')

// PDF
const pdfDocs = await loader.loadPDF('./docs/report.pdf')

// 网页
const webDocs = await loader.loadWeb('https://example.com/docs')

// 合并所有
const allDocs = [...txtDocs, ...mdDocs, ...pdfDocs, ...webDocs]
```

### 预处理

清理和规范化文档:

```typescript
import { DocumentProcessor } from '@seashore/data'

const processor = new DocumentProcessor({
  // 移除噪音
  removeHeaders: true,
  removeFooters: true,
  removePageNumbers: true,
  
  // 规范化
  normalizeWhitespace: true,
  lowercaseHeaders: false,
  
  // 提取
  extractMetadata: true,
  extractCodeBlocks: true,
})

const processedDocs = await processor.process(allDocs)
```

### 自定义预处理

```typescript
interface Document {
  content: string
  metadata: Record<string, any>
}

function preprocessDocument(doc: Document): Document {
  let content = doc.content
  
  // 1. 移除多余空白
  content = content.replace(/\s+/g, ' ')
  
  // 2. 移除页码
  content = content.replace(/Page \d+/g, '')
  
  // 3. 规范化引号
  content = content.replace(/[""]/g, '"')
  content = content.replace(/['']/g, "'")
  
  // 4. 修复常见的 OCR 错误(如果来自 PDF)
  if (doc.metadata.source === 'pdf') {
    content = content.replace(/\bl\b/g, 'I') // l → I
    content = content.replace(/\bO\b/g, '0') // O → 0
  }
  
  // 5. 提取和增强元数据
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

## 分块策略

### 固定大小分块

简单且可预测:

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

// 使用
const chunks = chunkBySize(document.content, 1000, 200)
```

### 语义分块

按意义分割:

```typescript
import { SemanticChunker } from '@seashore/data'

const chunker = new SemanticChunker({
  embeddings,
  similarityThreshold: 0.7, // 相似度下降时分割
  minChunkSize: 100,
  maxChunkSize: 1000,
})

const semanticChunks = await chunker.chunk(document.content)
```

### 基于句子的分块

```typescript
function chunkBySentences(
  text: string,
  sentencesPerChunk: number,
  overlapSentences: number
): string[] {
  // 分割为句子
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

### 递归分块

分层分割:

```typescript
function recursiveChunk(
  text: string,
  maxSize: number,
  separators: string[] = ['\n\n', '\n', '. ', ' ']
): string[] {
  if (text.length <= maxSize) {
    return [text]
  }
  
  // 按顺序尝试每个分隔符
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
          
          // 如果部分仍然太大,递归
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
  
  // 未找到分隔符,强制分割
  return chunkBySize(text, maxSize, 0)
}
```

### Markdown 感知分块

```typescript
function chunkMarkdown(content: string, maxSize: number): string[] {
  const chunks: string[] = []
  
  // 按标题分割
  const sections = content.split(/^(#{1,6}\s+.+)$/m)
  
  let currentChunk = ''
  let currentHeader = ''
  
  for (let i = 0; i < sections.length; i++) {
    const section = sections[i]
    
    // 这是标题吗?
    if (/^#{1,6}\s+/.test(section)) {
      currentHeader = section
      continue
    }
    
    // 在块中包含标题
    const withHeader = currentHeader + '\n' + section
    
    if (withHeader.length <= maxSize) {
      currentChunk = withHeader
      chunks.push(currentChunk)
    } else {
      // 分割大节
      const subchunks = recursiveChunk(section, maxSize - currentHeader.length)
      chunks.push(...subchunks.map(chunk => currentHeader + '\n' + chunk))
    }
  }
  
  return chunks
}
```

### 选择策略

| 策略 | 最适合 | 优点 | 缺点 |
|----------|----------|------|------|
| 固定大小 | 一般文本 | 简单、可预测 | 可能在句子中间分割 |
| 语义 | 长文档 | 保留意义 | 较慢、大小可变 |
| 句子 | 文章、文档 | 自然边界 | 长度可变 |
| 递归 | 混合内容 | 灵活 | 复杂 |
| Markdown | 技术文档 | 结构感知 | 仅限 Markdown |

---

## 嵌入选择

### 模型比较

```typescript
// OpenAI Ada 002 (旧版)
const ada002 = createEmbeddingAdapter({
  provider: 'openai',
  model: 'text-embedding-ada-002',
  dimensions: 1536,
  costPer1M: 0.10,
})

// OpenAI Small (推荐)
const small = createEmbeddingAdapter({
  provider: 'openai',
  model: 'text-embedding-3-small',
  dimensions: 1536, // 可以减少到 512
  costPer1M: 0.02, // 便宜 5 倍
})

// OpenAI Large (最佳质量)
const large = createEmbeddingAdapter({
  provider: 'openai',
  model: 'text-embedding-3-large',
  dimensions: 3072, // 可以减少到 256-1024
  costPer1M: 0.13,
})
```

### 维度缩减

以质量换取速度/成本:

```typescript
const embeddings = createEmbeddingAdapter({
  provider: 'openai',
  model: 'text-embedding-3-large',
  dimensions: 1024, // 从 3072 减少
  apiKey: process.env.OPENAI_API_KEY!,
})

// 结果:
// - 更小的存储(减少 3 倍)
// - 更快的搜索(快 3 倍)
// - 更低的成本
// - 略低的质量(通常 <5% 影响)
```

### 批处理以提高性能

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

## 向量搜索

### 基本搜索

```typescript
const results = await rag.search({
  query: 'How do I reset my password?',
  topK: 5, // 返回前 5 个结果
})

// 结果包含:
// - content: 块文本
// - score: 相似度分数(0-1)
// - metadata: 文档元数据
```

### 高级搜索

```typescript
const results = await rag.search({
  query: 'password reset',
  topK: 10,
  
  // 元数据过滤器
  filter: {
    category: 'authentication',
    language: 'en',
    updatedAfter: '2024-01-01',
  },
  
  // 最小相似度阈值
  minScore: 0.7,
  
  // 多样性(避免相似结果)
  diversityPenalty: 0.3,
})
```

### 混合搜索

结合向量和关键词搜索:

```typescript
import { HybridSearch } from '@seashore/data'

const hybrid = new HybridSearch({
  vectorDB,
  embeddings,
  
  // 加权
  vectorWeight: 0.7, // 70% 向量相似度
  keywordWeight: 0.3, // 30% 关键词匹配
})

const results = await hybrid.search({
  query: 'database optimization techniques',
  topK: 10,
})
```

### 重排序

使用重排序改进结果:

```typescript
import { Reranker } from '@seashore/data'

const reranker = new Reranker({
  model: 'cross-encoder/ms-marco-MiniLM-L-12-v2',
})

// 初始搜索
const candidates = await rag.search({
  query: 'machine learning best practices',
  topK: 50, // 获取更多候选
})

// 重排序顶部候选
const reranked = await reranker.rerank({
  query: 'machine learning best practices',
  documents: candidates,
  topK: 5, // 重排序后返回前 5 个
})
```

---

## 查询优化

### 查询扩展

通过相关术语提高召回率:

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

// 使用
const queries = await expandQuery('How to deploy Seashore?', llm)
// ['How to deploy Seashore?', 'Seashore deployment guide', 'Deploy Seashore to production', ...]

// 使用所有查询搜索
const allResults = await Promise.all(
  queries.map(q => rag.search({ query: q, topK: 10 }))
)

// 去重和合并
const merged = deduplicateResults(allResults.flat())
```

### 查询分解

将复杂查询分解为子查询:

```typescript
async function decomposeQuery(
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

// 使用
const complex = 'How do I set up authentication with OAuth and deploy to AWS?'
const subQueries = await decomposeQuery(complex, llm)
// ['How to set up OAuth authentication?', 'How to deploy to AWS?']

// 回答每个子查询
const subAnswers = await Promise.all(
  subQueries.map(async (q) => {
    const results = await rag.search({ query: q, topK: 3 })
    return { query: q, context: results }
  })
)
```

### 假设文档嵌入(HyDE)

生成假设答案,然后嵌入它:

```typescript
async function hydeSearch(
  query: string,
  rag: RAGPipeline,
  llm: LLMAdapter
): Promise<SearchResult[]> {
  // 生成假设答案
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
  
  // 使用假设答案搜索
  return await rag.search({
    query: hypothetical.content,
    topK: 5,
  })
}
```

---

## 摄取管道

### 完整摄取流程

```typescript
import { createRAGPipeline } from '@seashore/data'

async function ingestDocuments(
  files: string[],
  rag: RAGPipeline
): Promise<void> {
  console.log(`Ingesting ${files.length} documents...`)
  
  // 1. 加载文档
  const loader = new DocumentLoader()
  const documents = await Promise.all(
    files.map(file => loader.load(file))
  )
  console.log(`Loaded ${documents.length} documents`)
  
  // 2. 预处理
  const processor = new DocumentProcessor()
  const processed = await processor.process(documents.flat())
  console.log(`Processed ${processed.length} documents`)
  
  // 3. 分块
  const chunks = processed.flatMap(doc => 
    rag.chunk(doc.content, {
      chunkSize: 1000,
      overlap: 200,
      metadata: doc.metadata,
    })
  )
  console.log(`Created ${chunks.length} chunks`)
  
  // 4. 嵌入(带批处理)
  const batchSize = 100
  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize)
    await rag.ingest(batch)
    console.log(`Ingested ${i + batch.length}/${chunks.length}`)
  }
  
  console.log('Ingestion complete!')
}
```

### 增量更新

```typescript
async function updateDocument(
  docId: string,
  newContent: string,
  rag: RAGPipeline
): Promise<void> {
  // 1. 删除旧块
  await rag.deleteByMetadata({ documentId: docId })
  
  // 2. 分块新内容
  const chunks = rag.chunk(newContent, {
    metadata: { documentId: docId, updatedAt: new Date().toISOString() },
  })
  
  // 3. 摄取新块
  await rag.ingest(chunks)
}
```

---

## 生产模式

### 缓存

```typescript
import { LRUCache } from 'lru-cache'

const searchCache = new LRUCache<string, SearchResult[]>({
  max: 1000, // 缓存 1000 个查询
  ttl: 1000 * 60 * 30, // 30 分钟 TTL
})

async function cachedSearch(
  query: string,
  rag: RAGPipeline
): Promise<SearchResult[]> {
  const cacheKey = query.toLowerCase().trim()
  
  // 检查缓存
  const cached = searchCache.get(cacheKey)
  if (cached) {
    console.log('Cache hit:', query)
    return cached
  }
  
  // 搜索
  const results = await rag.search({ query, topK: 5 })
  
  // 缓存结果
  searchCache.set(cacheKey, results)
  
  return results
}
```

### 异步摄取

```typescript
import { Queue } from 'bullmq'

const ingestionQueue = new Queue('document-ingestion', {
  connection: { host: 'localhost', port: 6379 },
})

// 将文档添加到队列
async function queueDocuments(files: string[]): Promise<void> {
  for (const file of files) {
    await ingestionQueue.add('ingest', { file })
  }
}

// 处理队列
const worker = new Worker('document-ingestion', async (job) => {
  const { file } = job.data
  await ingestSingleDocument(file, rag)
}, {
  connection: { host: 'localhost', port: 6379 },
  concurrency: 5, // 同时处理 5 个文档
})
```

### 监控

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

## 评估

### 检索指标

```typescript
interface EvaluationResult {
  precision: number
  recall: number
  f1: number
  mrr: number // 平均倒数排名
  ndcg: number // 归一化折损累计增益
}

function evaluateRetrieval(
  results: SearchResult[],
  relevantDocs: Set<string>
): EvaluationResult {
  const retrieved = new Set(results.map(r => r.id))
  
  // 精确度: 检索到的相关文档的百分比
  const relevant = results.filter(r => relevantDocs.has(r.id))
  const precision = relevant.length / results.length
  
  // 召回率: 相关文档中被检索到的百分比
  const recall = relevant.length / relevantDocs.size
  
  // F1 分数
  const f1 = 2 * (precision * recall) / (precision + recall)
  
  // MRR: 1 / 第一个相关结果的排名
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

### 端到端评估

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
  
  // 聚合指标
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

## 最佳实践检查清单

### 文档准备
- [ ] 清理和规范化文本
- [ ] 提取有意义的元数据
- [ ] 处理多种格式
- [ ] 移除噪音(页眉、页脚等)

### 分块
- [ ] 根据内容类型选择适当的策略
- [ ] 使用重叠以保留上下文
- [ ] 保持块的专注和连贯
- [ ] 为每个块包含元数据

### 嵌入
- [ ] 根据质量/成本权衡选择模型
- [ ] 对查询和文档使用一致的模型
- [ ] 批量嵌入以提高性能
- [ ] 考虑维度缩减

### 搜索
- [ ] 根据上下文窗口调整 topK
- [ ] 尽可能使用元数据过滤器
- [ ] 考虑混合搜索以提高召回率
- [ ] 实施重排序以提高质量

### 性能
- [ ] 缓存频繁查询
- [ ] 对大型数据集使用异步摄取
- [ ] 监控延迟和错误
- [ ] 水平扩展(多个向量 DB 副本)

---

## 下一步

- **[评估指南](./evaluation.md)** - 测试 RAG 质量
- **[性能指南](./performance.md)** - 为生产优化
- **[构建智能体](./building-agents.md)** - 在智能体中使用 RAG

---

## 其他资源

- **[核心概念: RAG](/docs/core-concepts/rag.md)** - 详细文档
- **[API 参考](/docs/api/data.md)** - 完整 API
- **[示例](/examples/)** - 代码示例
