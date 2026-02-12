# Error Handling

Build resilient agents with comprehensive error handling strategies including retry logic, fallbacks, graceful degradation, logging, and debugging techniques.

## Overview

Production agents must handle failures gracefully. This guide covers systematic error handling from basic try-catch to advanced recovery patterns.

**What you'll learn:**
- Error types and classification
- Retry strategies and backoff
- Fallback patterns
- Circuit breakers
- Error logging and monitoring
- Debugging techniques

---

## Error Types

### Classification

```typescript
enum ErrorType {
  // Transient errors (can retry)
  RATE_LIMIT = 'RATE_LIMIT',
  TIMEOUT = 'TIMEOUT',
  NETWORK = 'NETWORK',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  
  // Permanent errors (don't retry)
  INVALID_INPUT = 'INVALID_INPUT',
  UNAUTHORIZED = 'UNAUTHORIZED',
  NOT_FOUND = 'NOT_FOUND',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  
  // Application errors
  TOOL_ERROR = 'TOOL_ERROR',
  LLM_ERROR = 'LLM_ERROR',
  AGENT_ERROR = 'AGENT_ERROR',
  
  // Unknown
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

### Error Detection

```typescript
function classifyError(error: Error): AgentError {
  const message = error.message.toLowerCase()
  
  // Rate limiting
  if (message.includes('rate limit') || message.includes('429')) {
    return new AgentError(
      error.message,
      ErrorType.RATE_LIMIT,
      true,
      { originalError: error }
    )
  }
  
  // Timeout
  if (message.includes('timeout') || message.includes('ETIMEDOUT')) {
    return new AgentError(
      error.message,
      ErrorType.TIMEOUT,
      true,
      { originalError: error }
    )
  }
  
  // Network errors
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
  
  // Service unavailable
  if (message.includes('503') || message.includes('unavailable')) {
    return new AgentError(
      error.message,
      ErrorType.SERVICE_UNAVAILABLE,
      true,
      { originalError: error }
    )
  }
  
  // Validation errors
  if (message.includes('validation') || message.includes('invalid')) {
    return new AgentError(
      error.message,
      ErrorType.VALIDATION_ERROR,
      false,
      { originalError: error }
    )
  }
  
  // Default: unknown, not retryable
  return new AgentError(
    error.message,
    ErrorType.UNKNOWN,
    false,
    { originalError: error }
  )
}
```

---

## Retry Strategies

### Exponential Backoff

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
      
      // Don't retry if not retryable
      if (!agentError.retryable || attempt === config.maxRetries) {
        throw agentError
      }
      
      // Calculate delay
      let delay = config.exponential
        ? config.baseDelay * Math.pow(2, attempt)
        : config.baseDelay
      
      // Cap at max delay
      delay = Math.min(delay, config.maxDelay)
      
      // Add jitter
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

// Usage
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

### Conditional Retry

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
      
      // Check if we should retry
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

// Usage
const response = await withConditionalRetry(
  () => agent.run(messages),
  (error, attempt) => {
    const agentError = classifyError(error)
    
    // Retry rate limits
    if (agentError.type === ErrorType.RATE_LIMIT) {
      return true
    }
    
    // Retry timeouts up to 2 times
    if (agentError.type === ErrorType.TIMEOUT && attempt < 2) {
      return true
    }
    
    // Don't retry anything else
    return false
  },
  (attempt) => 1000 * Math.pow(2, attempt), // Exponential backoff
  5 // Max 5 retries
)
```

---

## Fallback Patterns

### Simple Fallback

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

// Usage: Try GPT-4, fallback to GPT-4-mini
const response = await withFallback(
  () => gpt4Agent.run(messages),
  () => gpt4MiniAgent.run(messages)
)
```

### Cascading Fallbacks

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
  
  // All attempts failed
  throw new Error(
    `All attempts failed:\n${errors.map(e => `- ${e.name}: ${e.error.message}`).join('\n')}`
  )
}

// Usage
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

### Tool Fallbacks

```typescript
const searchToolWithFallback = {
  name: 'search',
  description: 'Search with fallback sources',
  parameters: z.object({ query: z.string() }),
  execute: async ({ query }) => {
    // Try primary search
    try {
      return await primarySearchAPI.search(query)
    } catch (error) {
      console.warn('Primary search failed, trying secondary')
    }
    
    // Try secondary search
    try {
      return await secondarySearchAPI.search(query)
    } catch (error) {
      console.warn('Secondary search failed, using cached results')
    }
    
    // Try cache
    const cached = await cache.get(`search:${query}`)
    if (cached) {
      return cached + '\n\n(Note: Cached results, may be outdated)'
    }
    
    // All failed
    return 'Search temporarily unavailable. Please try again later.'
  },
}
```

---

## Circuit Breaker

### Implementation

```typescript
enum CircuitState {
  CLOSED = 'CLOSED', // Normal operation
  OPEN = 'OPEN', // Failing, reject requests
  HALF_OPEN = 'HALF_OPEN', // Testing if recovered
}

class CircuitBreaker {
  private state = CircuitState.CLOSED
  private failures = 0
  private nextAttempt = Date.now()
  
  constructor(
    private threshold = 5, // Open after 5 failures
    private timeout = 60000, // Try again after 60s
    private successThreshold = 2 // Close after 2 successes
  ) {}
  
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // Check if circuit is open
    if (this.state === CircuitState.OPEN) {
      if (Date.now() < this.nextAttempt) {
        throw new Error('Circuit breaker is OPEN')
      }
      
      // Try half-open
      this.state = CircuitState.HALF_OPEN
      console.log('Circuit breaker: OPEN → HALF_OPEN')
    }
    
    try {
      const result = await fn()
      
      // Success!
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

// Usage
const breaker = new CircuitBreaker(5, 60000)

async function callWithCircuitBreaker(agent: ReActAgent, messages: Message[]) {
  return await breaker.execute(() => agent.run(messages))
}
```

---

## Graceful Degradation

### Feature Degradation

```typescript
async function runWithDegradation(
  agent: ReActAgent,
  messages: Message[]
): Promise<AgentResponse> {
  try {
    // Try full feature set
    return await agent.run(messages)
  } catch (error) {
    console.warn('Full agent failed, trying degraded mode')
    
    // Remove tools (faster, more reliable)
    const degradedAgent = createReActAgent({
      model: () => llm('gpt-4o-mini'),
      systemPrompt: agent.systemPrompt + '\n\nNote: Running in limited mode.',
      tools: [], // No tools
      maxIterations: 3,
    })
    
    return await degradedAgent.run(messages)
  }
}
```

### Partial Results

```typescript
async function runWithPartialResults(
  agent: ReActAgent,
  messages: Message[]
): Promise<AgentResponse> {
  const timeoutMs = 30000 // 30 second timeout
  
  try {
    return await Promise.race([
      agent.run(messages),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Timeout')), timeoutMs)
      ),
    ])
  } catch (error) {
    // Return partial result if available
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

## Logging and Monitoring

### Structured Logging

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
    
    // Console output
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

// Usage
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

### Error Tracking

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
    
    // Send to monitoring service
    this.sendToMonitoring(report)
    
    // Alert if high impact
    if (userImpact === 'high') {
      this.alert(report)
    }
  }
  
  private async sendToMonitoring(report: ErrorReport): Promise<void> {
    // Send to Sentry, DataDog, etc.
    console.error('Error tracked:', report.id)
  }
  
  private async alert(report: ErrorReport): Promise<void> {
    // Send alert (Slack, PagerDuty, etc.)
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

// Usage
try {
  await agent.run(messages)
} catch (error) {
  errorTracker.track(
    error as Error,
    {
      userId: user.id,
      messageCount: messages.length,
    },
    'high' // User can't get response
  )
  
  throw error
}
```

---

## Debugging

### Debug Mode

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
      // Intercept tool calls
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

// Usage
const debugAgent = new DebugAgent(agent)
const response = await debugAgent.run(messages)
console.log('Trace:', debugAgent.getTrace())
```

### Error Reproduction

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
      toolCalls: [], // Would capture from agent
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
    
    // Recreate agent
    const agent = createReActAgent(context.agentConfig)
    
    // Re-run with same inputs
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

## Best Practices

### Error Handling
- [ ] Classify errors (transient vs permanent)
- [ ] Retry transient errors with backoff
- [ ] Provide fallbacks for critical paths
- [ ] Use circuit breakers for unstable services
- [ ] Implement graceful degradation

### Logging
- [ ] Use structured logging
- [ ] Include context in logs
- [ ] Log at appropriate levels
- [ ] Don't log sensitive data
- [ ] Aggregate logs for analysis

### Monitoring
- [ ] Track error rates
- [ ] Set up alerts for anomalies
- [ ] Monitor user impact
- [ ] Analyze error patterns
- [ ] Regular error reviews

### Debugging
- [ ] Save error context
- [ ] Enable debug mode when needed
- [ ] Make errors reproducible
- [ ] Add detailed error messages
- [ ] Use error tracking tools

---

## Next Steps

- **[Testing](./testing.md)** - Test error scenarios
- **[Performance](./performance.md)** - Optimize error handling
- **[Evaluation](./evaluation.md)** - Measure reliability

---

## Additional Resources

- **[API Reference](/docs/api/)** - Error handling API
- **[Examples](/examples/)** - Error handling examples
- **[Best Practices](/docs/best-practices)** - More guidelines
