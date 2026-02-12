# 错误处理

使用重试逻辑、回退、优雅降级、日志记录和调试技术构建具有全面错误处理策略的弹性智能体。

## 概述

生产智能体必须优雅地处理故障。本指南涵盖从基本 try-catch 到高级恢复模式的系统化错误处理。

**您将学到：**
- 错误类型和分类
- 重试策略和退避
- 回退模式
- 断路器
- 错误日志记录和监控
- 调试技术

---

## 错误类型

### 分类

```typescript
enum ErrorType {
  // 瞬态错误（可以重试）
  RATE_LIMIT = 'RATE_LIMIT',
  TIMEOUT = 'TIMEOUT',
  NETWORK = 'NETWORK',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  
  // 永久错误（不要重试）
  INVALID_INPUT = 'INVALID_INPUT',
  UNAUTHORIZED = 'UNAUTHORIZED',
  NOT_FOUND = 'NOT_FOUND',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  
  // 应用程序错误
  TOOL_ERROR = 'TOOL_ERROR',
  LLM_ERROR = 'LLM_ERROR',
  AGENT_ERROR = 'AGENT_ERROR',
  
  // 未知
  UNKNOWN = 'UNKNOWN',
}

class AgentError extends Error {
  constructor(
    message: string,
    public type: ErrorType,
    public retryable: boolean,
    public context?: Record<string, any>
  ) {
    super(message)
    this.name = 'AgentError'
  }
}
```

### 错误检测

```typescript
function classifyError(error: Error): AgentError {
  const message = error.message.toLowerCase()
  
  // 速率限制
  if (message.includes('rate limit') || message.includes('429')) {
    return new AgentError(
      error.message,
      ErrorType.RATE_LIMIT,
      true,
      { originalError: error }
    )
  }
  
  // 超时
  if (message.includes('timeout') || message.includes('ETIMEDOUT')) {
    return new AgentError(
      error.message,
      ErrorType.TIMEOUT,
      true,
      { originalError: error }
    )
  }
  
  // 网络错误
  if (
    message.includes('ECONNREFUSED') ||
    message.includes('ENOTFOUND') ||
    message.includes('ECONNRESET')
  ) {
    return new AgentError(
      error.message,
      ErrorType.NETWORK,
      true,
      { originalError: error }
    )
  }
  
  // 服务不可用
  if (message.includes('503') || message.includes('unavailable')) {
    return new AgentError(
      error.message,
      ErrorType.SERVICE_UNAVAILABLE,
      true,
      { originalError: error }
    )
  }
  
  // 验证错误
  if (message.includes('validation') || message.includes('invalid')) {
    return new AgentError(
      error.message,
      ErrorType.VALIDATION_ERROR,
      false,
      { originalError: error }
    )
  }
  
  // 默认：未知，不可重试
  return new AgentError(
    error.message,
    ErrorType.UNKNOWN,
    false,
    { originalError: error }
  )
}
```

---

## 重试策略

### 指数退避

```typescript
interface RetryConfig {
  maxRetries: number
  baseDelay: number
  maxDelay: number
  exponential: boolean
  jitter: boolean
}

async function withRetry<T>(
  fn: () => Promise<T>,
  config: RetryConfig = {
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 30000,
    exponential: true,
    jitter: true,
  }
): Promise<T> {
  let lastError: Error
  
  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error as Error
      
      const agentError = classifyError(lastError)
      
      // 如果不可重试则不重试
      if (!agentError.retryable || attempt === config.maxRetries) {
        throw agentError
      }
      
      // 计算延迟
      let delay = config.exponential
        ? config.baseDelay * Math.pow(2, attempt)
        : config.baseDelay
      
      // 限制在最大延迟
      delay = Math.min(delay, config.maxDelay)
      
      // 添加抖动
      if (config.jitter) {
        delay = delay * (0.5 + Math.random() * 0.5)
      }
      
      console.warn(
        `Attempt ${attempt + 1} failed: ${agentError.message}. ` +
        `Retrying in ${delay}ms...`
      )
      
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
  
  throw lastError!
}

// 用法
const response = await withRetry(
  () => agent.run(messages),
  {
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 30000,
    exponential: true,
    jitter: true,
  }
)
```

### 条件重试

```typescript
async function withConditionalRetry<T>(
  fn: () => Promise<T>,
  shouldRetry: (error: Error, attempt: number) => boolean,
  getDelay: (attempt: number) => number,
  maxRetries = 3
): Promise<T> {
  let lastError: Error
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error as Error
      
      // 检查是否应该重试
      if (attempt < maxRetries && shouldRetry(lastError, attempt)) {
        const delay = getDelay(attempt)
        await new Promise(resolve => setTimeout(resolve, delay))
      } else {
        throw lastError
      }
    }
  }
  
  throw lastError!
}

// 用法
const response = await withConditionalRetry(
  () => agent.run(messages),
  (error, attempt) => {
    const agentError = classifyError(error)
    
    // 重试速率限制
    if (agentError.type === ErrorType.RATE_LIMIT) {
      return true
    }
    
    // 重试超时最多 2 次
    if (agentError.type === ErrorType.TIMEOUT && attempt < 2) {
      return true
    }
    
    // 不重试其他任何内容
    return false
  },
  (attempt) => 1000 * Math.pow(2, attempt), // 指数退避
  5 // 最多 5 次重试
)
```

---

## 回退模式

### 简单回退

```typescript
async function withFallback<T>(
  primary: () => Promise<T>,
  fallback: () => Promise<T>,
  logFallback = true
): Promise<T> {
  try {
    return await primary()
  } catch (error) {
    if (logFallback) {
      console.warn('Primary failed, using fallback:', error)
    }
    return await fallback()
  }
}

// 用法：尝试 GPT-4，回退到 GPT-4-mini
const response = await withFallback(
  () => gpt4Agent.run(messages),
  () => gpt4MiniAgent.run(messages)
)
```

### 级联回退

```typescript
async function withCascadingFallbacks<T>(
  attempts: Array<{
    name: string
    fn: () => Promise<T>
  }>
): Promise<T> {
  const errors: Array<{ name: string; error: Error }> = []
  
  for (const attempt of attempts) {
    try {
      console.log(`Trying: ${attempt.name}`)
      return await attempt.fn()
    } catch (error) {
      console.warn(`${attempt.name} failed:`, error)
      errors.push({
        name: attempt.name,
        error: error as Error,
      })
    }
  }
  
  // 所有尝试都失败了
  throw new Error(
    `All attempts failed:\n${errors.map(e => `- ${e.name}: ${e.error.message}`).join('\n')}`
  )
}

// 用法
const response = await withCascadingFallbacks([
  {
    name: 'Primary (GPT-4)',
    fn: () => gpt4Agent.run(messages),
  },
  {
    name: 'Secondary (GPT-4-mini)',
    fn: () => gpt4MiniAgent.run(messages),
  },
  {
    name: 'Tertiary (cached response)',
    fn: () => getCachedResponse(messages),
  },
  {
    name: 'Final (default response)',
    fn: async () => ({
      result: {
        content: 'Service temporarily unavailable. Please try again later.',
        toolCalls: [],
      },
      messages: [],
    }),
  },
])
```

### 工具回退

```typescript
const searchToolWithFallback = {
  name: 'search',
  description: 'Search with fallback sources',
  parameters: z.object({ query: z.string() }),
  execute: async ({ query }) => {
    // 尝试主搜索
    try {
      return await primarySearchAPI.search(query)
    } catch (error) {
      console.warn('Primary search failed, trying secondary')
    }
    
    // 尝试次搜索
    try {
      return await secondarySearchAPI.search(query)
    } catch (error) {
      console.warn('Secondary search failed, using cached results')
    }
    
    // 尝试缓存
    const cached = await cache.get(`search:${query}`)
    if (cached) {
      return cached + '\n\n(Note: Cached results, may be outdated)'
    }
    
    // 全部失败
    return 'Search temporarily unavailable. Please try again later.'
  },
}
```

---

## 断路器

### 实现

```typescript
enum CircuitState {
  CLOSED = 'CLOSED', // 正常操作
  OPEN = 'OPEN', // 失败，拒绝请求
  HALF_OPEN = 'HALF_OPEN', // 测试是否恢复
}

class CircuitBreaker {
  private state = CircuitState.CLOSED
  private failures = 0
  private nextAttempt = Date.now()
  
  constructor(
    private threshold = 5, // 5 次失败后打开
    private timeout = 60000, // 60 秒后重试
    private successThreshold = 2 // 2 次成功后关闭
  ) {}
  
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // 检查电路是否打开
    if (this.state === CircuitState.OPEN) {
      if (Date.now() < this.nextAttempt) {
        throw new Error('Circuit breaker is OPEN')
      }
      
      // 尝试半开
      this.state = CircuitState.HALF_OPEN
      console.log('Circuit breaker: OPEN → HALF_OPEN')
    }
    
    try {
      const result = await fn()
      
      // 成功！
      this.onSuccess()
      
      return result
    } catch (error) {
      this.onFailure()
      throw error
    }
  }
  
  private onSuccess(): void {
    this.failures = 0
    
    if (this.state === CircuitState.HALF_OPEN) {
      this.state = CircuitState.CLOSED
      console.log('Circuit breaker: HALF_OPEN → CLOSED')
    }
  }
  
  private onFailure(): void {
    this.failures++
    
    if (this.failures >= this.threshold) {
      this.state = CircuitState.OPEN
      this.nextAttempt = Date.now() + this.timeout
      console.error(`Circuit breaker: ${this.state} → OPEN`)
    }
  }
  
  getState() {
    return {
      state: this.state,
      failures: this.failures,
      nextAttempt: new Date(this.nextAttempt),
    }
  }
}

// 用法
const breaker = new CircuitBreaker(5, 60000)

async function callWithCircuitBreaker(agent: ReActAgent, messages: Message[]) {
  return await breaker.execute(() => agent.run(messages))
}
```

---

## 优雅降级

### 功能降级

```typescript
async function runWithDegradation(
  agent: ReActAgent,
  messages: Message[]
): Promise<AgentResponse> {
  try {
    // 尝试完整功能集
    return await agent.run(messages)
  } catch (error) {
    console.warn('Full agent failed, trying degraded mode')
    
    // 移除工具（更快、更可靠）
    const degradedAgent = createReActAgent({
      model: () => llm('gpt-4o-mini'),
      systemPrompt: agent.systemPrompt + '\n\nNote: Running in limited mode.',
      tools: [], // 无工具
      maxIterations: 3,
    })
    
    return await degradedAgent.run(messages)
  }
}
```

### 部分结果

```typescript
async function runWithPartialResults(
  agent: ReActAgent,
  messages: Message[]
): Promise<AgentResponse> {
  const timeoutMs = 30000 // 30 秒超时
  
  try {
    return await Promise.race([
      agent.run(messages),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Timeout')), timeoutMs)
      ),
    ])
  } catch (error) {
    // 如果可用则返回部分结果
    if (agent.hasPartialResult()) {
      console.warn('Returning partial result due to timeout')
      return {
        result: {
          content: agent.getPartialResult() +
            '\n\n⚠️ Response incomplete due to timeout.',
          toolCalls: [],
        },
        messages: [],
      }
    }
    
    throw error
  }
}
```

---

## 日志记录和监控

### 结构化日志记录

```typescript
interface LogEntry {
  timestamp: Date
  level: 'debug' | 'info' | 'warn' | 'error'
  message: string
  context?: Record<string, any>
  error?: Error
}

class Logger {
  private logs: LogEntry[] = []
  
  debug(message: string, context?: Record<string, any>): void {
    this.log('debug', message, context)
  }
  
  info(message: string, context?: Record<string, any>): void {
    this.log('info', message, context)
  }
  
  warn(message: string, context?: Record<string, any>): void {
    this.log('warn', message, context)
  }
  
  error(message: string, error?: Error, context?: Record<string, any>): void {
    this.log('error', message, { ...context, error })
  }
  
  private log(
    level: LogEntry['level'],
    message: string,
    context?: Record<string, any>
  ): void {
    const entry: LogEntry = {
      timestamp: new Date(),
      level,
      message,
      context,
    }
    
    this.logs.push(entry)
    
    // 控制台输出
    const prefix = `[${entry.timestamp.toISOString()}] [${level.toUpperCase()}]`
    console.log(`${prefix} ${message}`, context || '')
  }
  
  getLogs(level?: LogEntry['level']): LogEntry[] {
    if (level) {
      return this.logs.filter(log => log.level === level)
    }
    return this.logs
  }
  
  async save(path: string): Promise<void> {
    await fs.writeFile(path, JSON.stringify(this.logs, null, 2))
  }
}

const logger = new Logger()

// 用法
async function runWithLogging(agent: ReActAgent, messages: Message[]) {
  logger.info('Starting agent execution', {
    messageCount: messages.length,
  })
  
  try {
    const response = await agent.run(messages)
    
    logger.info('Agent execution completed', {
      duration: response.metadata?.duration,
      toolCalls: response.result.toolCalls.length,
    })
    
    return response
  } catch (error) {
    logger.error('Agent execution failed', error as Error, {
      messageCount: messages.length,
    })
    
    throw error
  }
}
```

### 错误跟踪

```typescript
interface ErrorReport {
  id: string
  timestamp: Date
  error: Error
  context: Record<string, any>
  stackTrace: string
  userImpact: 'none' | 'low' | 'medium' | 'high'
}

class ErrorTracker {
  private errors: ErrorReport[] = []
  
  track(
    error: Error,
    context: Record<string, any>,
    userImpact: ErrorReport['userImpact'] = 'medium'
  ): void {
    const report: ErrorReport = {
      id: generateId(),
      timestamp: new Date(),
      error,
      context,
      stackTrace: error.stack || '',
      userImpact,
    }
    
    this.errors.push(report)
    
    // 发送到监控服务
    this.sendToMonitoring(report)
    
    // 如果影响高则发出警报
    if (userImpact === 'high') {
      this.alert(report)
    }
  }
  
  private async sendToMonitoring(report: ErrorReport): Promise<void> {
    // 发送到 Sentry、DataDog 等
    console.error('Error tracked:', report.id)
  }
  
  private async alert(report: ErrorReport): Promise<void> {
    // 发送警报（Slack、PagerDuty 等）
    console.error('🚨 High-impact error:', report.error.message)
  }
  
  getErrors(since?: Date): ErrorReport[] {
    if (since) {
      return this.errors.filter(e => e.timestamp >= since)
    }
    return this.errors
  }
  
  getStats() {
    const byImpact = this.errors.reduce((acc, e) => {
      acc[e.userImpact] = (acc[e.userImpact] || 0) + 1
      return acc
    }, {} as Record<string, number>)
    
    return {
      total: this.errors.length,
      byImpact,
      recent: this.errors.slice(-10),
    }
  }
}

const errorTracker = new ErrorTracker()

// 用法
try {
  await agent.run(messages)
} catch (error) {
  errorTracker.track(
    error as Error,
    {
      userId: user.id,
      messageCount: messages.length,
    },
    'high' // 用户无法获得响应
  )
  
  throw error
}
```

---

## 调试

### 调试模式

```typescript
class DebugAgent {
  private debug = true
  private trace: Array<{
    timestamp: Date
    event: string
    data: any
  }> = []
  
  constructor(private agent: ReActAgent) {}
  
  async run(messages: Message[]): Promise<AgentResponse> {
    this.trace = []
    
    this.log('start', { messageCount: messages.length })
    
    try {
      // 拦截工具调用
      const response = await this.agent.run(messages, {
        onToolCall: (tool, args) => {
          this.log('tool_call', { tool: tool.name, args })
        },
        onToolResult: (tool, result) => {
          this.log('tool_result', { tool: tool.name, result })
        },
      })
      
      this.log('complete', {
        toolCalls: response.result.toolCalls.length,
        responseLength: response.result.content.length,
      })
      
      return response
    } catch (error) {
      this.log('error', { error })
      throw error
    } finally {
      if (this.debug) {
        console.log('\n=== Debug Trace ===')
        this.trace.forEach(t => {
          console.log(`[${t.timestamp.toISOString()}] ${t.event}:`, t.data)
        })
      }
    }
  }
  
  private log(event: string, data: any): void {
    this.trace.push({
      timestamp: new Date(),
      event,
      data,
    })
  }
  
  getTrace() {
    return this.trace
  }
}

// 用法
const debugAgent = new DebugAgent(agent)
const response = await debugAgent.run(messages)
console.log('Trace:', debugAgent.getTrace())
```

### 错误重现

```typescript
interface ErrorContext {
  messages: Message[]
  agentConfig: any
  toolCalls: ToolCall[]
  error: Error
  timestamp: Date
}

class ErrorReproducer {
  async saveContext(
    messages: Message[],
    agent: ReActAgent,
    error: Error
  ): Promise<string> {
    const context: ErrorContext = {
      messages,
      agentConfig: {
        systemPrompt: agent.systemPrompt,
        tools: agent.tools.map(t => t.name),
        maxIterations: agent.maxIterations,
      },
      toolCalls: [], // 将从智能体捕获
      error: {
        message: error.message,
        stack: error.stack,
      } as Error,
      timestamp: new Date(),
    }
    
    const filename = `error-${Date.now()}.json`
    await fs.writeFile(
      `./errors/${filename}`,
      JSON.stringify(context, null, 2)
    )
    
    return filename
  }
  
  async reproduce(filename: string): Promise<void> {
    const context: ErrorContext = JSON.parse(
      await fs.readFile(`./errors/${filename}`, 'utf-8')
    )
    
    console.log('Reproducing error from:', context.timestamp)
    console.log('Original error:', context.error.message)
    
    // 重新创建智能体
    const agent = createReActAgent(context.agentConfig)
    
    // 使用相同输入重新运行
    try {
      await agent.run(context.messages)
      console.log('✅ Error not reproduced')
    } catch (error) {
      console.log('❌ Error reproduced:', error)
    }
  }
}
```

---

## 最佳实践

### 错误处理
- [ ] 分类错误（瞬态 vs 永久）
- [ ] 使用退避重试瞬态错误
- [ ] 为关键路径提供回退
- [ ] 对不稳定服务使用断路器
- [ ] 实施优雅降级

### 日志记录
- [ ] 使用结构化日志记录
- [ ] 在日志中包含上下文
- [ ] 在适当级别记录
- [ ] 不要记录敏感数据
- [ ] 聚合日志以供分析

### 监控
- [ ] 跟踪错误率
- [ ] 为异常设置警报
- [ ] 监控用户影响
- [ ] 分析错误模式
- [ ] 定期错误审查

### 调试
- [ ] 保存错误上下文
- [ ] 需要时启用调试模式
- [ ] 使错误可重现
- [ ] 添加详细的错误消息
- [ ] 使用错误跟踪工具

---

## 下一步

- **[测试](./testing.md)** - 测试错误场景
- **[性能](./performance.md)** - 优化错误处理
- **[评估](./evaluation.md)** - 衡量可靠性

---

## 其他资源

- **[API 参考](/docs/api/)** - 错误处理 API
- **[示例](/examples/)** - 错误处理示例
- **[最佳实践](/docs/best-practices)** - 更多指南
