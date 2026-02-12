# 性能优化

通过缓存策略、批处理、流式传输、监控和成本优化技术来优化您的 Seashore 智能体以用于生产环境。

## 概述

生产智能体必须快速、经济高效且可扩展。本指南涵盖从基本缓存到高级分布式模式的全面性能优化策略。

**您将学到：**
- 响应缓存策略
- 请求批处理和并行化
- 流式传输优化
- 令牌和成本优化
- 监控和性能分析
- 可扩展性模式

---

## 性能基础

### 测量

```typescript
class PerformanceMonitor {
  private metrics: Map<string, number[]> = new Map()
  
  async measure<T>(name: string, fn: () => Promise<T>): Promise<T> {
    const start = performance.now()
    
    try {
      const result = await fn()
      const duration = performance.now() - start
      
      this.record(name, duration)
      
      return result
    } catch (error) {
      const duration = performance.now() - start
      this.record(`${name}_error`, duration)
      throw error
    }
  }
  
  private record(name: string, value: number): void {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, [])
    }
    this.metrics.get(name)!.push(value)
  }
  
  getStats(name: string) {
    const values = this.metrics.get(name) || []
    if (values.length === 0) return null
    
    const sorted = [...values].sort((a, b) => a - b)
    
    return {
      count: values.length,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      avg: values.reduce((a, b) => a + b, 0) / values.length,
      p50: sorted[Math.floor(values.length * 0.5)],
      p95: sorted[Math.floor(values.length * 0.95)],
      p99: sorted[Math.floor(values.length * 0.99)],
    }
  }
  
  report(): void {
    console.log('\n=== Performance Report ===\n')
    
    for (const [name, values] of this.metrics.entries()) {
      const stats = this.getStats(name)
      console.log(`${name}:`)
      console.log(`  Count: ${stats?.count}`)
      console.log(`  Average: ${stats?.avg.toFixed(2)}ms`)
      console.log(`  P50: ${stats?.p50.toFixed(2)}ms`)
      console.log(`  P95: ${stats?.p95.toFixed(2)}ms`)
      console.log(`  P99: ${stats?.p99.toFixed(2)}ms`)
      console.log()
    }
  }
}

const monitor = new PerformanceMonitor()

// 用法
const response = await monitor.measure('agent.run', async () => {
  return await agent.run(messages)
})
```

---

## 缓存策略

### 响应缓存

```typescript
import { LRUCache } from 'lru-cache'

interface CacheEntry {
  response: AgentResponse
  timestamp: number
  hits: number
}

class ResponseCache {
  private cache: LRUCache<string, CacheEntry>
  
  constructor(options: { maxSize?: number; ttl?: number } = {}) {
    this.cache = new LRUCache({
      max: options.maxSize || 1000,
      ttl: options.ttl || 1000 * 60 * 60, // 默认 1 小时
    })
  }
  
  private getCacheKey(messages: Message[]): string {
    // 创建确定性缓存键
    return JSON.stringify(
      messages.map(m => ({ role: m.role, content: m.content }))
    )
  }
  
  async get(messages: Message[]): Promise<AgentResponse | null> {
    const key = this.getCacheKey(messages)
    const entry = this.cache.get(key)
    
    if (entry) {
      entry.hits++
      console.log(`Cache hit! (${entry.hits} hits)`)
      return entry.response
    }
    
    return null
  }
  
  set(messages: Message[], response: AgentResponse): void {
    const key = this.getCacheKey(messages)
    this.cache.set(key, {
      response,
      timestamp: Date.now(),
      hits: 0,
    })
  }
  
  clear(): void {
    this.cache.clear()
  }
  
  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.cache.max,
      hitRate: this.calculateHitRate(),
    }
  }
  
  private calculateHitRate(): number {
    const entries = Array.from(this.cache.values())
    if (entries.length === 0) return 0
    
    const totalHits = entries.reduce((sum, e) => sum + e.hits, 0)
    return totalHits / (totalHits + entries.length)
  }
}

// 用法
const cache = new ResponseCache({ maxSize: 1000, ttl: 60 * 60 * 1000 })

async function runWithCache(
  agent: ReActAgent,
  messages: Message[]
): Promise<AgentResponse> {
  // 检查缓存
  const cached = await cache.get(messages)
  if (cached) return cached
  
  // 运行智能体
  const response = await agent.run(messages)
  
  // 缓存响应
  cache.set(messages, response)
  
  return response
}
```

### 语义缓存

```typescript
import { createEmbeddingAdapter } from '@seashore/core'

class SemanticCache {
  private embeddings = createEmbeddingAdapter({
    provider: 'openai',
    model: 'text-embedding-3-small',
    apiKey: process.env.OPENAI_API_KEY!,
  })
  
  private entries: Array<{
    query: string
    embedding: number[]
    response: AgentResponse
  }> = []
  
  async get(
    query: string,
    similarityThreshold = 0.95
  ): Promise<AgentResponse | null> {
    if (this.entries.length === 0) return null
    
    // 嵌入查询
    const queryEmbedding = await this.embeddings.embed(query)
    
    // 查找最相似的
    let bestMatch: typeof this.entries[0] | null = null
    let bestSimilarity = 0
    
    for (const entry of this.entries) {
      const similarity = cosineSimilarity(queryEmbedding, entry.embedding)
      
      if (similarity > bestSimilarity && similarity >= similarityThreshold) {
        bestSimilarity = similarity
        bestMatch = entry
      }
    }
    
    if (bestMatch) {
      console.log(`Semantic cache hit! (${(bestSimilarity * 100).toFixed(1)}% similar)`)
      return bestMatch.response
    }
    
    return null
  }
  
  async set(query: string, response: AgentResponse): Promise<void> {
    const embedding = await this.embeddings.embed(query)
    
    this.entries.push({
      query,
      embedding,
      response,
    })
    
    // 限制缓存大小
    if (this.entries.length > 100) {
      this.entries.shift()
    }
  }
}
```

### 工具结果缓存

```typescript
function createCachedTool(tool: Tool, ttl = 60000): Tool {
  const cache = new Map<string, { result: any; timestamp: number }>()
  
  return {
    ...tool,
    execute: async (args: any) => {
      const cacheKey = JSON.stringify(args)
      const cached = cache.get(cacheKey)
      
      // 检查缓存是否存在且未过期
      if (cached && Date.now() - cached.timestamp < ttl) {
        console.log(`Tool cache hit: ${tool.name}`)
        return cached.result
      }
      
      // 执行工具
      const result = await tool.execute(args)
      
      // 缓存结果
      cache.set(cacheKey, {
        result,
        timestamp: Date.now(),
      })
      
      return result
    },
  }
}

// 用法
const cachedSearchTool = createCachedTool(searchTool, 5 * 60 * 1000) // 5 分钟缓存
```

---

## 批处理和并行化

### 请求批处理

```typescript
class BatchProcessor<T, R> {
  private queue: Array<{
    item: T
    resolve: (result: R) => void
    reject: (error: Error) => void
  }> = []
  
  private timeout: NodeJS.Timeout | null = null
  
  constructor(
    private processBatch: (items: T[]) => Promise<R[]>,
    private maxBatchSize = 10,
    private maxWaitMs = 100
  ) {}
  
  async add(item: T): Promise<R> {
    return new Promise((resolve, reject) => {
      this.queue.push({ item, resolve, reject })
      
      // 如果批次已满则处理
      if (this.queue.length >= this.maxBatchSize) {
        this.flush()
      } else {
        // 安排刷新
        if (this.timeout) clearTimeout(this.timeout)
        this.timeout = setTimeout(() => this.flush(), this.maxWaitMs)
      }
    })
  }
  
  private async flush(): Promise<void> {
    if (this.queue.length === 0) return
    
    const batch = this.queue.splice(0, this.maxBatchSize)
    const items = batch.map(b => b.item)
    
    try {
      const results = await this.processBatch(items)
      
      batch.forEach((b, i) => {
        b.resolve(results[i])
      })
    } catch (error) {
      batch.forEach(b => {
        b.reject(error as Error)
      })
    }
  }
}

// 用法：批处理嵌入
const embeddingBatcher = new BatchProcessor(
  async (texts: string[]) => {
    return await embeddings.embedMany(texts)
  },
  100, // 批次大小
  50 // 等待 50ms
)

// 单个调用会自动批处理
const embedding1 = embeddingBatcher.add('text 1')
const embedding2 = embeddingBatcher.add('text 2')
const embedding3 = embeddingBatcher.add('text 3')

const results = await Promise.all([embedding1, embedding2, embedding3])
```

### 并行工具执行

```typescript
const agent = createReActAgent({
  model: () => llm('gpt-4o'),
  systemPrompt: `You are efficient. When you need multiple independent pieces of information, request them all at once.

Example:
User: "Compare weather in Tokyo, London, and Paris"
You: Call get_weather for all three cities in parallel`,
  tools: [weatherTool],
  maxIterations: 10,
})

// 工具实现支持并行化
const weatherTool = {
  name: 'get_weather',
  description: 'Get weather (supports batch requests)',
  parameters: z.object({
    locations: z.array(z.string()),
  }),
  execute: async ({ locations }) => {
    // 并行获取所有
    const results = await Promise.all(
      locations.map(loc => fetchWeather(loc))
    )
    
    return results
  },
}
```

---

## 流式传输优化

### 流式响应

```typescript
const agent = createReActAgent({
  model: () => llm('gpt-4o'),
  systemPrompt: 'You are helpful',
  tools: [],
})

// 向用户流式传输响应
const response = await agent.stream(messages)

// 在令牌到达时处理
for await (const chunk of response.stream) {
  process.stdout.write(chunk.content)
  
  // 实时更新 UI
  await updateUI(chunk.content)
}
```

### 缓冲流式传输

```typescript
class BufferedStream {
  private buffer = ''
  private flushInterval = 50 // ms
  private lastFlush = Date.now()
  
  async *process(
    stream: AsyncIterable<{ content: string }>
  ): AsyncIterable<string> {
    for await (const chunk of stream) {
      this.buffer += chunk.content
      
      // 定期刷新
      if (Date.now() - this.lastFlush >= this.flushInterval) {
        yield this.buffer
        this.buffer = ''
        this.lastFlush = Date.now()
      }
    }
    
    // 刷新剩余内容
    if (this.buffer) {
      yield this.buffer
    }
  }
}

// 用法
const buffered = new BufferedStream()
const response = await agent.stream(messages)

for await (const chunk of buffered.process(response.stream)) {
  // 每 50ms 接收块而不是每个令牌
  updateUI(chunk)
}
```

---

## 令牌优化

### 提示压缩

```typescript
function compressContext(context: string[], maxTokens: number): string[] {
  // 估计令牌（粗略：1 令牌 ≈ 4 个字符）
  const estimateTokens = (text: string) => Math.ceil(text.length / 4)
  
  const compressed: string[] = []
  let totalTokens = 0
  
  // 首先添加最近的上下文（LIFO）
  for (let i = context.length - 1; i >= 0; i--) {
    const tokens = estimateTokens(context[i])
    
    if (totalTokens + tokens <= maxTokens) {
      compressed.unshift(context[i])
      totalTokens += tokens
    } else {
      break
    }
  }
  
  return compressed
}

// 用法
const maxContextTokens = 4000
const compressedContext = compressContext(conversationHistory, maxContextTokens)
```

### 消息摘要

```typescript
async function summarizeHistory(
  messages: Message[],
  maxMessages = 10
): Promise<Message[]> {
  if (messages.length <= maxMessages) {
    return messages
  }
  
  // 保留最近的消息
  const recentMessages = messages.slice(-maxMessages)
  
  // 摘要较旧的消息
  const olderMessages = messages.slice(0, -maxMessages)
  const summary = await llm('gpt-4o-mini').chat([
    {
      role: 'system',
      content: 'Summarize this conversation history concisely.',
    },
    {
      role: 'user',
      content: JSON.stringify(olderMessages),
    },
  ])
  
  return [
    { role: 'system', content: `Previous conversation summary: ${summary.content}` },
    ...recentMessages,
  ]
}
```

### 模型选择

```typescript
function selectOptimalModel(task: string): string {
  const taskComplexity = analyzeComplexity(task)
  
  if (taskComplexity === 'simple') {
    return 'gpt-4o-mini' // 更快、更便宜
  } else if (taskComplexity === 'medium') {
    return 'gpt-4o'
  } else {
    return 'gpt-4o' // 最适合复杂任务
  }
}

const model = selectOptimalModel(userQuery)
const agent = createReActAgent({
  model: () => llm(model),
  systemPrompt: 'You are helpful',
  tools: [],
})
```

---

## 成本优化

### 成本跟踪

```typescript
interface CostMetrics {
  inputTokens: number
  outputTokens: number
  totalTokens: number
  estimatedCost: number
}

class CostTracker {
  private costs: CostMetrics[] = []
  
  // 定价（美元每 100 万令牌）
  private pricing = {
    'gpt-4o': { input: 2.50, output: 10.00 },
    'gpt-4o-mini': { input: 0.15, output: 0.60 },
  }
  
  track(model: string, inputTokens: number, outputTokens: number): CostMetrics {
    const pricing = this.pricing[model] || this.pricing['gpt-4o']
    
    const cost =
      (inputTokens / 1_000_000) * pricing.input +
      (outputTokens / 1_000_000) * pricing.output
    
    const metrics = {
      inputTokens,
      outputTokens,
      totalTokens: inputTokens + outputTokens,
      estimatedCost: cost,
    }
    
    this.costs.push(metrics)
    
    return metrics
  }
  
  getTotal(): CostMetrics {
    return this.costs.reduce(
      (total, cost) => ({
        inputTokens: total.inputTokens + cost.inputTokens,
        outputTokens: total.outputTokens + cost.outputTokens,
        totalTokens: total.totalTokens + cost.totalTokens,
        estimatedCost: total.estimatedCost + cost.estimatedCost,
      }),
      { inputTokens: 0, outputTokens: 0, totalTokens: 0, estimatedCost: 0 }
    )
  }
  
  report(): void {
    const total = this.getTotal()
    console.log('\n=== Cost Report ===')
    console.log(`Total Requests: ${this.costs.length}`)
    console.log(`Input Tokens: ${total.inputTokens.toLocaleString()}`)
    console.log(`Output Tokens: ${total.outputTokens.toLocaleString()}`)
    console.log(`Total Tokens: ${total.totalTokens.toLocaleString()}`)
    console.log(`Estimated Cost: $${total.estimatedCost.toFixed(4)}`)
  }
}

const costTracker = new CostTracker()

// 每次请求后跟踪
const response = await agent.run(messages)
costTracker.track('gpt-4o', response.usage.inputTokens, response.usage.outputTokens)
```

### 成本优化策略

```typescript
// 1. 对简单任务使用更便宜的模型
const simpleAgent = createReActAgent({
  model: () => llm('gpt-4o-mini'), // 比 GPT-4 便宜 16 倍
  systemPrompt: 'Answer simple questions',
  tools: [],
})

// 2. 缓存响应
const cachedAgent = withCache(agent)

// 3. 限制上下文窗口
const efficientAgent = createReActAgent({
  model: () => llm('gpt-4o'),
  systemPrompt: 'Be concise',
  tools: [],
  maxIterations: 5, // 限制迭代
})

// 4. 使用输出模式减少令牌浪费
const structuredAgent = createReActAgent({
  model: () => llm('gpt-4o'),
  systemPrompt: 'Respond in JSON',
  tools: [],
  outputSchema: z.object({
    answer: z.string(),
  }),
})
```

---

## 监控

### 实时指标

```typescript
class MetricsCollector {
  private metrics = {
    requests: 0,
    errors: 0,
    totalLatency: 0,
    totalCost: 0,
  }
  
  recordRequest(latency: number, cost: number, error = false): void {
    this.metrics.requests++
    this.metrics.totalLatency += latency
    this.metrics.totalCost += cost
    
    if (error) {
      this.metrics.errors++
    }
  }
  
  getMetrics() {
    return {
      ...this.metrics,
      avgLatency: this.metrics.totalLatency / this.metrics.requests,
      errorRate: this.metrics.errors / this.metrics.requests,
      avgCost: this.metrics.totalCost / this.metrics.requests,
    }
  }
  
  reset(): void {
    this.metrics = {
      requests: 0,
      errors: 0,
      totalLatency: 0,
      totalCost: 0,
    }
  }
}

const metrics = new MetricsCollector()

// 包装智能体调用
async function monitoredRun(agent: ReActAgent, messages: Message[]) {
  const start = Date.now()
  
  try {
    const response = await agent.run(messages)
    const latency = Date.now() - start
    const cost = estimateCost(response.usage)
    
    metrics.recordRequest(latency, cost)
    
    return response
  } catch (error) {
    const latency = Date.now() - start
    metrics.recordRequest(latency, 0, true)
    throw error
  }
}
```

### 仪表板

```typescript
import express from 'express'

const app = express()

app.get('/metrics', (req, res) => {
  const metrics = metricsCollector.getMetrics()
  
  res.json({
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    agent: metrics,
    cache: cache.getStats(),
  })
})

app.listen(3000)
```

---

## 可扩展性

### 水平扩展

```typescript
// 负载均衡器
class AgentPool {
  private agents: ReActAgent[]
  private currentIndex = 0
  
  constructor(count: number, createAgent: () => ReActAgent) {
    this.agents = Array.from({ length: count }, createAgent)
  }
  
  async run(messages: Message[]): Promise<AgentResponse> {
    // 轮询
    const agent = this.agents[this.currentIndex]
    this.currentIndex = (this.currentIndex + 1) % this.agents.length
    
    return await agent.run(messages)
  }
}

// 创建 5 个智能体池
const pool = new AgentPool(5, () =>
  createReActAgent({
    model: () => llm('gpt-4o'),
    systemPrompt: 'You are helpful',
    tools: [],
  })
)

// 处理并发请求
const responses = await Promise.all([
  pool.run(messages1),
  pool.run(messages2),
  pool.run(messages3),
])
```

### 基于队列的处理

```typescript
import { Queue, Worker } from 'bullmq'

const agentQueue = new Queue('agent-requests', {
  connection: { host: 'localhost', port: 6379 },
})

// 生产者：将请求添加到队列
async function queueRequest(messages: Message[]): Promise<string> {
  const job = await agentQueue.add('process', { messages })
  return job.id!
}

// 消费者：处理队列
const worker = new Worker(
  'agent-requests',
  async (job) => {
    const { messages } = job.data
    const response = await agent.run(messages)
    return response
  },
  {
    connection: { host: 'localhost', port: 6379 },
    concurrency: 10, // 一次处理 10 个
  }
)

// 获取结果
const jobId = await queueRequest(messages)
const job = await agentQueue.getJob(jobId)
const result = await job.waitUntilFinished()
```

---

## 最佳实践

### 性能
- [ ] 优化前先测量
- [ ] 积极缓存
- [ ] 尽可能批处理操作
- [ ] 对长响应使用流式传输
- [ ] 选择合适的模型

### 成本
- [ ] 在生产中跟踪成本
- [ ] 对简单任务使用更便宜的模型
- [ ] 实施缓存
- [ ] 压缩上下文
- [ ] 设置预算和警报

### 监控
- [ ] 跟踪关键指标（延迟、成本、错误）
- [ ] 设置仪表板
- [ ] 对异常发出警报
- [ ] 记录以供调试
- [ ] 定期性能审查

---

## 下一步

- **[评估](./evaluation.md)** - 衡量改进
- **[错误处理](./error-handling.md)** - 构建可靠系统
- **[测试](./testing.md)** - 测试性能

---

## 其他资源

- **[API 参考](/docs/api/)** - 完整 API 文档
- **[示例](/examples/)** - 性能示例
- **[最佳实践](/docs/best-practices)** - 更多指南
