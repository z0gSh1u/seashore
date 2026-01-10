# Error Handling

Robust workflows handle errors gracefully. This guide covers retry strategies, fallback mechanisms, and error recovery patterns.

## Node-Level Errors

Errors in nodes are captured and available in the result:

```typescript
const riskyNode = createLLMNode({
  name: 'risky-operation',
  adapter: openaiText('gpt-4o'),
  prompt: () => 'Do something risky',
})

const result = await workflow.execute({ input: 'test' })

if (result.nodeOutputs['risky-operation']?.error) {
  console.error('Error:', result.nodeOutputs['risky-operation'].error)
}
```

## Retry Strategy

Automatically retry failed operations:

```typescript
import { withRetry } from '@seashore/workflow'

const flakyNode = withRetry(
  createLLMNode({
    name: 'flaky-api',
    adapter: openaiText('gpt-4o'),
    prompt: (input) => input.query,
  }),
  {
    maxRetries: 3,
    initialDelayMs: 1000,
    backoffMultiplier: 2,
    retryableErrors: ['rate_limit', 'timeout'],
  }
)
```

### Custom Retry Conditions

```typescript
const smartRetry = withRetry(node, {
  shouldRetry: (error, attempt) => {
    if (error.message.includes('rate_limit')) return true
    if (attempt < 2 && error.message.includes('timeout')) return true
    return false
  },
})
```

## Fallback Strategy

Provide fallback when operations fail:

```typescript
import { withFallback } from '@seashore/workflow'

const primaryNode = createLLMNode({
  name: 'primary',
  adapter: openaiText('gpt-4o'),
  prompt: () => 'Generate content',
})

const fallbackNode = createLLMNode({
  name: 'fallback',
  adapter: openaiText('gpt-4o-mini'),
  prompt: () => 'Generate simpler content',
})

const resilientNode = withFallback(primaryNode, fallbackNode)
```

### Multiple Fallbacks

```typescript
const nodeWithFallbacks = withFallback(
  primaryNode,
  withFallback(secondaryNode, tertiaryNode)
)
```

## Error Transformation

Transform errors into usable data:

```typescript
import { withErrorTransform } from '@seashore/workflow'

const transformedNode = withErrorTransform(
  createLLMNode({
    name: 'might-fail',
    adapter: openaiText('gpt-4o'),
    prompt: (input) => input.query,
  }),
  {
    transform: (error) => ({
      success: false,
      error: error.message,
      fallbackResponse: 'Sorry, something went wrong.',
    }),
  }
)
```

## Circuit Breaker

Stop calling failing services:

```typescript
import { createCircuitBreaker } from '@seashore/workflow'

const breaker = createCircuitBreaker({
  failureThreshold: 5,
  timeoutMs: 60000, // 1 minute
})

const protectedNode = breaker.wrap(
  createToolNode({
    name: 'api-call',
    tool: externalApiTool,
  })
)

// Check circuit state
if (breaker.isOpen()) {
  // Use alternative
}
```

## Timeout

Prevent nodes from running forever:

```typescript
import { withTimeout } from '@seashore/workflow'

const timeoutNode = withTimeout(
  createLLMNode({
    name: 'slow-operation',
    adapter: openaiText('gpt-4o'),
    prompt: () => 'Take your time...',
  }),
  {
    timeoutMs: 10000, // 10 seconds
    onTimeout: () => ({ error: 'Operation timed out', fallback: 'Default response' }),
  }
)
```

## Workflow-Level Error Handling

Handle errors at the workflow level:

```typescript
const workflow = createWorkflow({
  name: 'resilient-workflow',
  nodes: [step1, step2, step3],
  edges: [
    { from: 'step1', to: 'step2' },
    { from: 'step2', to: 'step3' },
  ],
  startNode: 'step1',
  onError: async (error, context) => {
    console.error('Workflow error:', error)
    console.error('Execution ID:', context.executionId)

    // Log to monitoring
    await logError(error, context)

    // Return fallback output
    return { error: true, message: 'Workflow failed' }
  },
})
```

## Error Recovery Patterns

### Skip on Error

```typescript
const skipOnError = createTransformNode({
  name: 'skip-on-error',
  transform: async (input, ctx) => {
    const previous = ctx.nodeOutputs['previous']
    if (previous?.error) {
      console.log('Skipping due to error:', previous.error)
      return { skipped: true }
    }
    return input
  },
})
```

### Default Value on Error

```typescript
const defaultOnError = createTransformNode({
  name: 'default-on-error',
  transform: async (input, ctx) => {
    const data = ctx.nodeOutputs['fetch']?.data
    return data ?? { defaultValue: 'N/A' }
  },
})
```

### Aggregate Errors

```typescript
const aggregateNode = createTransformNode({
  name: 'aggregate',
  transform: async (_, ctx) => {
    const results = Object.values(ctx.nodeOutputs)
    const errors = results
      .filter(r => r?.error)
      .map(r => ({ node: r.node, error: r.error }))

    return {
      success: errors.length === 0,
      errors,
      results: results.filter(r => !r?.error),
    }
  },
})
```

## Best Practices

1. **Retry with Backoff** — Don't overwhelm failing services
2. **Graceful Degradation** — Provide fallbacks when possible
3. **Error Logging** — Log errors for debugging and monitoring
4. **Circuit Breakers** — Stop calling services that are down
5. **Timeouts** — Always set timeouts on external calls
6. **Clear Messages** — Return helpful error messages to users

## Next Steps

- [RAG](../rag/index.md) — Build retrieval-augmented workflows
- [Evaluation](../security/evaluation.md) — Measure workflow performance
