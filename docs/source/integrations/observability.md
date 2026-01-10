# Observability

Monitor, trace, and debug your agents with comprehensive observability tools.

## Logging

Structured logging for debugging:

```typescript
import { createLogger } from '@seashore/observability'

const logger = createLogger({
  name: 'my-app',
  level: 'debug', // 'debug' | 'info' | 'warn' | 'error'
  format: 'pretty', // 'pretty' | 'json'
})

// Log at different levels
logger.debug('Debug info', { data: { key: 'value' } })
logger.info('User action', { userId: '123', action: 'chat' })
logger.warn('High latency', { durationMs: 5000 })
logger.error('API error', { error: 'Rate limit exceeded' })

// With context
logger.withContext({ userId: '123' }).info('Message sent')
```

## Tracing

Distributed tracing for agent execution:

```typescript
import { createTracer } from '@seashore/observability'

const tracer = createTracer({
  serviceName: 'seashore-app',
  samplingRate: 1.0, // 100% sampling
  exporters: [
    { type: 'console' },
    // { type: 'otlp', endpoint: 'https://otel-collector:4317' }
  ],
})

// Create a span
const span = tracer.startSpan('agent.run', {
  type: 'agent',
  attributes: {
    'agent.name': 'assistant',
    'input': 'Hello',
  },
})

try {
  const result = await agent.run('Hello')
  span.setStatus({ code: 'ok' })
  span.setAttributes({
    'output.tokens': result.usage?.completionTokens,
    'tool.calls': result.toolCalls.length,
  })
} catch (error) {
  span.setStatus({ code: 'error', message: String(error) })
} finally {
  span.end()
}

// Shutdown
await tracer.shutdown()
```

## Token Counting

Track token usage:

```typescript
import { createTokenCounter } from '@seashore/observability'

const counter = createTokenCounter({
  defaultEncoding: 'cl100k_base', // GPT-4 encoding
})

// Count tokens
const inputTokens = counter.count('This is some text')
console.log(inputTokens) // ~5 tokens

// Count messages
const messageTokens = counter.countMessages([
  { role: 'system', content: 'You are helpful.' },
  { role: 'user', content: 'Hello!' },
])
console.log(messageTokens) // ~15 tokens
```

## Middleware

Add observability to agents:

```typescript
import { withTracing, withLogging } from '@seashore/observability'

const agent = createAgent({
  name: 'assistant',
  model: openaiText('gpt-4o'),
  systemPrompt: 'You are helpful.',
})

// Wrap with tracing
const tracedAgent = withTracing(agent, {
  tracer,
  logLevel: 'info',
})

// Wrap with logging
const loggedAgent = withLogging(agent, {
  logger,
  logInputs: true,
  logOutputs: true,
  logToolCalls: true,
})
```

## Exporters

### Console Exporter

```typescript
import { createConsoleExporter } from '@seashore/observability'

const consoleExporter = createConsoleExporter({
  colors: true,
  timestamp: true,
})

// Shutdown
await consoleExporter.shutdown()
```

### OTLP Exporter

```typescript
import { createOTLPExporter } from '@seashore/observability'

const otlpExporter = createOTLPExporter({
  endpoint: 'https://otel-collector:4317',
  headers: {
    'X-API-Key': process.env.OTEL_API_KEY,
  },
})

const tracer = createTracer({
  serviceName: 'seashore-app',
  exporters: [otlpExporter],
})
```

## Custom Metrics

Track custom metrics:

```typescript
import { createMetrics } from '@seashore/observability'

const metrics = createMetrics({
  prefix: 'seashore_',
})

// Counter
const requestCounter = metrics.createCounter('requests_total', {
  description: 'Total requests',
})

requestCounter.inc(1, { agent: 'assistant', status: 'success' })

// Histogram
const latencyHistogram = metrics.createHistogram('request_duration_ms', {
  description: 'Request duration',
  buckets: [100, 500, 1000, 5000],
})

latencyHistogram.observe(234, { agent: 'assistant' })

// Gauge
const activeGauge = metrics.createGauge('active_connections', {
  description: 'Active connections',
})

activeGauge.set(5, { agent: 'assistant' })

// Export metrics
const metricsData = await metrics.collect()
console.log(metricsData)
```

## Error Tracking

Track and analyze errors:

```typescript
import { createErrorTracker } from '@seashore/observability'

const errorTracker = createErrorTracker({
  serviceName: 'seashore-app',
})

// Track errors
try {
  await agent.run(input)
} catch (error) {
  errorTracker.capture(error, {
    agent: 'assistant',
    userId: '123',
    input,
  })
}

// Get error stats
const stats = errorTracker.getStats()
console.log(stats)
// {
//   totalErrors: 10,
//   byType: { 'RateLimitError': 5, 'ValidationError': 3, ... },
//   byAgent: { 'assistant': 8, 'support': 2 }
// }
```

## Performance Monitoring

Monitor agent performance:

```typescript
import { observePerformance } from '@seashore/observability'

const perf = observePerformance()

// Start observation
perf.start('agent-run')

const result = await agent.run(input)

// End observation
const metrics = perf.end('agent-run')

console.log(metrics)
// {
//   durationMs: 1234,
//   memoryMb: 50,
//   cpuPercent: 15
// }
```

## Best Practices

1. **Structured Logging** — Use consistent log formats
2. **Sampling** — Adjust sampling based on traffic
3. **Correlation IDs** — Track requests across services
4. **Error Context** — Include relevant context in error logs
5. **Metrics** — Track key performance indicators
6. **Privacy** — Don't log sensitive information

## Next Steps

- [Security](../security/index.md) — Add security monitoring
- [Evaluation](../security/evaluation.md) — Evaluate agent performance
