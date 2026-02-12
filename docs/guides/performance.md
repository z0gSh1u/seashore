# Performance Optimization

Optimize your Seashore agents for production with caching strategies, batching, streaming, monitoring, and cost optimization techniques.

## Overview

Production agents must be fast, cost-effective, and scalable. This guide covers comprehensive performance optimization strategies from basic caching to advanced distributed patterns.

**What you'll learn:**
- Response caching strategies
- Request batching and parallelization
- Streaming optimization
- Token and cost optimization
- Monitoring and profiling
- Scalability patterns

---

## Performance Fundamentals

### Measurement

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

// Usage
const response = await monitor.measure('agent.run', async () => {
  return await agent.run(messages)
})
```

---

## Caching Strategies

### Response Caching

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
      ttl: options.ttl || 1000 * 60 * 60, // 1 hour default
    })
  }
  
  private getCacheKey(messages: Message[]): string {
    // Create deterministic cache key
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

// Usage
const cache = new ResponseCache({ maxSize: 1000, ttl: 60 * 60 * 1000 })

async function runWithCache(
  agent: ReActAgent,
  messages: Message[]
): Promise<AgentResponse> {
  // Check cache
  const cached = await cache.get(messages)
  if (cached) return cached
  
  // Run agent
  const response = await agent.run(messages)
  
  // Cache response
  cache.set(messages, response)
  
  return response
}
```

### Semantic Caching

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
    
    // Embed query
    const queryEmbedding = await this.embeddings.embed(query)
    
    // Find most similar
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
    
    // Limit cache size
    if (this.entries.length > 100) {
      this.entries.shift()
    }
  }
}
```

### Tool Result Caching

```typescript
function createCachedTool(tool: Tool, ttl = 60000): Tool {
  const cache = new Map<string, { result: any; timestamp: number }>()
  
  return {
    ...tool,
    execute: async (args: any) => {
      const cacheKey = JSON.stringify(args)
      const cached = cache.get(cacheKey)
      
      // Check if cached and not expired
      if (cached && Date.now() - cached.timestamp < ttl) {
        console.log(`Tool cache hit: ${tool.name}`)
        return cached.result
      }
      
      // Execute tool
      const result = await tool.execute(args)
      
      // Cache result
      cache.set(cacheKey, {
        result,
        timestamp: Date.now(),
      })
      
      return result
    },
  }
}

// Usage
const cachedSearchTool = createCachedTool(searchTool, 5 * 60 * 1000) // 5 min cache
```

---

## Batching and Parallelization

### Request Batching

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
      
      // Process if batch is full
      if (this.queue.length >= this.maxBatchSize) {
        this.flush()
      } else {
        // Schedule flush
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

// Usage: Batch embeddings
const embeddingBatcher = new BatchProcessor(
  async (texts: string[]) => {
    return await embeddings.embedMany(texts)
  },
  100, // Batch size
  50 // Wait 50ms
)

// Individual calls are automatically batched
const embedding1 = embeddingBatcher.add('text 1')
const embedding2 = embeddingBatcher.add('text 2')
const embedding3 = embeddingBatcher.add('text 3')

const results = await Promise.all([embedding1, embedding2, embedding3])
```

### Parallel Tool Execution

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

// Tool implementation supports parallelization
const weatherTool = {
  name: 'get_weather',
  description: 'Get weather (supports batch requests)',
  parameters: z.object({
    locations: z.array(z.string()),
  }),
  execute: async ({ locations }) => {
    // Fetch all in parallel
    const results = await Promise.all(
      locations.map(loc => fetchWeather(loc))
    )
    
    return results
  },
}
```

---

## Streaming Optimization

### Streaming Responses

```typescript
const agent = createReActAgent({
  model: () => llm('gpt-4o'),
  systemPrompt: 'You are helpful',
  tools: [],
})

// Stream response to user
const response = await agent.stream(messages)

// Process tokens as they arrive
for await (const chunk of response.stream) {
  process.stdout.write(chunk.content)
  
  // Update UI in real-time
  await updateUI(chunk.content)
}
```

### Buffered Streaming

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
      
      // Flush periodically
      if (Date.now() - this.lastFlush >= this.flushInterval) {
        yield this.buffer
        this.buffer = ''
        this.lastFlush = Date.now()
      }
    }
    
    // Flush remaining
    if (this.buffer) {
      yield this.buffer
    }
  }
}

// Usage
const buffered = new BufferedStream()
const response = await agent.stream(messages)

for await (const chunk of buffered.process(response.stream)) {
  // Receive chunks every 50ms instead of every token
  updateUI(chunk)
}
```

---

## Token Optimization

### Prompt Compression

```typescript
function compressContext(context: string[], maxTokens: number): string[] {
  // Estimate tokens (rough: 1 token ≈ 4 characters)
  const estimateTokens = (text: string) => Math.ceil(text.length / 4)
  
  const compressed: string[] = []
  let totalTokens = 0
  
  // Add most recent context first (LIFO)
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

// Usage
const maxContextTokens = 4000
const compressedContext = compressContext(conversationHistory, maxContextTokens)
```

### Message Summarization

```typescript
async function summarizeHistory(
  messages: Message[],
  maxMessages = 10
): Promise<Message[]> {
  if (messages.length <= maxMessages) {
    return messages
  }
  
  // Keep recent messages
  const recentMessages = messages.slice(-maxMessages)
  
  // Summarize older messages
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

### Model Selection

```typescript
function selectOptimalModel(task: string): string {
  const taskComplexity = analyzeComplexity(task)
  
  if (taskComplexity === 'simple') {
    return 'gpt-4o-mini' // Faster, cheaper
  } else if (taskComplexity === 'medium') {
    return 'gpt-4o'
  } else {
    return 'gpt-4o' // Best for complex tasks
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

## Cost Optimization

### Cost Tracking

```typescript
interface CostMetrics {
  inputTokens: number
  outputTokens: number
  totalTokens: number
  estimatedCost: number
}

class CostTracker {
  private costs: CostMetrics[] = []
  
  // Pricing (USD per 1M tokens)
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

// Track after each request
const response = await agent.run(messages)
costTracker.track('gpt-4o', response.usage.inputTokens, response.usage.outputTokens)
```

### Cost Optimization Strategies

```typescript
// 1. Use cheaper models for simple tasks
const simpleAgent = createReActAgent({
  model: () => llm('gpt-4o-mini'), // 16x cheaper than GPT-4
  systemPrompt: 'Answer simple questions',
  tools: [],
})

// 2. Cache responses
const cachedAgent = withCache(agent)

// 3. Limit context window
const efficientAgent = createReActAgent({
  model: () => llm('gpt-4o'),
  systemPrompt: 'Be concise',
  tools: [],
  maxIterations: 5, // Limit iterations
})

// 4. Use output schemas to reduce token waste
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

## Monitoring

### Real-Time Metrics

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

// Wrap agent calls
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

### Dashboard

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

## Scalability

### Horizontal Scaling

```typescript
// Load balancer
class AgentPool {
  private agents: ReActAgent[]
  private currentIndex = 0
  
  constructor(count: number, createAgent: () => ReActAgent) {
    this.agents = Array.from({ length: count }, createAgent)
  }
  
  async run(messages: Message[]): Promise<AgentResponse> {
    // Round-robin
    const agent = this.agents[this.currentIndex]
    this.currentIndex = (this.currentIndex + 1) % this.agents.length
    
    return await agent.run(messages)
  }
}

// Create pool of 5 agents
const pool = new AgentPool(5, () =>
  createReActAgent({
    model: () => llm('gpt-4o'),
    systemPrompt: 'You are helpful',
    tools: [],
  })
)

// Handle concurrent requests
const responses = await Promise.all([
  pool.run(messages1),
  pool.run(messages2),
  pool.run(messages3),
])
```

### Queue-Based Processing

```typescript
import { Queue, Worker } from 'bullmq'

const agentQueue = new Queue('agent-requests', {
  connection: { host: 'localhost', port: 6379 },
})

// Producer: Add requests to queue
async function queueRequest(messages: Message[]): Promise<string> {
  const job = await agentQueue.add('process', { messages })
  return job.id!
}

// Consumer: Process queue
const worker = new Worker(
  'agent-requests',
  async (job) => {
    const { messages } = job.data
    const response = await agent.run(messages)
    return response
  },
  {
    connection: { host: 'localhost', port: 6379 },
    concurrency: 10, // Process 10 at a time
  }
)

// Get result
const jobId = await queueRequest(messages)
const job = await agentQueue.getJob(jobId)
const result = await job.waitUntilFinished()
```

---

## Best Practices

### Performance
- [ ] Measure before optimizing
- [ ] Cache aggressively
- [ ] Batch operations when possible
- [ ] Use streaming for long responses
- [ ] Choose appropriate models

### Cost
- [ ] Track costs in production
- [ ] Use cheaper models for simple tasks
- [ ] Implement caching
- [ ] Compress context
- [ ] Set budgets and alerts

### Monitoring
- [ ] Track key metrics (latency, cost, errors)
- [ ] Set up dashboards
- [ ] Alert on anomalies
- [ ] Log for debugging
- [ ] Regular performance reviews

---

## Next Steps

- **[Evaluation](./evaluation.md)** - Measure improvements
- **[Error Handling](./error-handling.md)** - Build reliable systems
- **[Testing](./testing.md)** - Test performance

---

## Additional Resources

- **[API Reference](/docs/api/)** - Complete API documentation
- **[Examples](/examples/)** - Performance examples
- **[Best Practices](/docs/best-practices)** - More guidelines
