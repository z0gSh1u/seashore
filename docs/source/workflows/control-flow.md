# Control Flow

Advanced workflows need control flow constructs like loops, branches, and parallel execution. This guide covers how to build complex workflow patterns.

## Conditional Branching

Route execution based on conditions:

```typescript
import { createConditionNode } from '@seashore/workflow'

const sentimentNode = createLLMNode({
  name: 'analyze-sentiment',
  adapter: openaiText('gpt-4o'),
  systemPrompt: 'Analyze sentiment. Return: positive, negative, or neutral.',
  prompt: (input) => input.text,
})

const routeNode = createConditionNode({
  name: 'route-by-sentiment',
  condition: (input, ctx) => {
    const sentiment = ctx.nodeOutputs['analyze-sentiment']?.content?.trim()
    return sentiment ?? 'neutral'
  },
  branches: {
    positive: 'thank-customer',
    negative: 'escalate-support',
    neutral: 'send-feedback',
  },
})

const workflow = createWorkflow({
  name: 'customer-response',
  nodes: [sentimentNode, routeNode, thankCustomer, escalateSupport, sendFeedback],
  edges: [
    { from: 'analyze-sentiment', to: 'route-by-sentiment' },
    // Edges from routeNode to each branch are implicit
  ],
  startNode: 'analyze-sentiment',
})
```

## Loops

Repeat nodes until a condition is met:

```typescript
import { createLoopNode, createForEachNode } from '@seashore/workflow'

// ForEach - Process arrays
const processItems = createForEachNode({
  name: 'process-items',
  itemNode: createLLMNode({
    name: 'process-item',
    adapter: openaiText('gpt-4o'),
    prompt: (item) => `Process: ${item}`,
  }),
  inputArray: (input) => input.items,
})

// Reduce - Aggregate results
const sumNode = createReduceNode({
  name: 'sum-results',
  initial: 0,
  reduce: (acc, value, ctx) => {
    const num = parseInt(ctx.nodeOutputs['process']?.content ?? '0')
    return acc + num
  },
})
```

### While Loops

```typescript
import { createLoopNode } from '@seashore/workflow'

const retryNode = createLoopNode({
  name: 'retry-until-success',
  condition: (input, ctx) => {
    const success = ctx.nodeOutputs['attempt']?.success
    const attempts = ctx.loopState?.iteration ?? 0
    return !success && attempts < 3
  },
  body: createLLMNode({
    name: 'attempt',
    adapter: openaiText('gpt-4o'),
    prompt: (input) => `Try: ${input.task}`,
  }),
})
```

### Breaking Loops

```typescript
import { breakLoop, continueLoop } from '@seashore/workflow'

const checkNode = createTransformNode({
  name: 'check',
  transform: (input, ctx) => {
    if (shouldStop(input)) {
      return breakLoop() // Exit the loop
    }
    if (shouldSkip(input)) {
      return continueLoop() // Next iteration
    }
    return input
  },
})
```

## Parallel Execution

Run multiple operations concurrently:

```typescript
import { createParallelNode } from '@seashore/workflow'

const parallelNode = createParallelNode({
  name: 'parallel-research',
  nodes: [
    createLLMNode({
      name: 'search-news',
      adapter: openaiText('gpt-4o'),
      prompt: () => 'Search for recent news',
    }),
    createLLMNode({
      name: 'search-academic',
      adapter: openaiText('gpt-4o'),
      prompt: () => 'Search academic papers',
    }),
    createLLMNode({
      name: 'search-social',
      adapter: openaiText('gpt-4o'),
      prompt: () => 'Search social media',
    }),
  ],
})

const aggregateNode = createLLMNode({
  name: 'aggregate',
  adapter: openaiText('gpt-4o'),
  prompt: (input, ctx) => {
    const news = ctx.nodeOutputs['search-news']?.content
    const academic = ctx.nodeOutputs['search-academic']?.content
    const social = ctx.nodeOutputs['search-social']?.content

    return `Synthesize these sources:\nNews: ${news}\nAcademic: ${academic}\nSocial: ${social}`
  },
})
```

## Map-Reduce Pattern

Process arrays in parallel and aggregate:

```typescript
import { createMapReduceNode } from '@seashore/workflow'

const analyzeReviews = createMapReduceNode({
  name: 'analyze-reviews',
  inputArray: (input) => input.reviews,

  // Map: Process each item
  map: createLLMNode({
    name: 'analyze-review',
    adapter: openaiText('gpt-4o-mini'),
    prompt: (review) => `Analyze sentiment: ${review.text}`,
  }),

  // Reduce: Aggregate results
  reduce: createTransformNode({
    name: 'aggregate',
    transform: async (_, ctx) => {
      const sentiments = ctx.mapResults ?? []

      const positive = sentiments.filter(s => s.includes('positive')).length
      const negative = sentiments.filter(s => s.includes('negative')).length
      const neutral = sentiments.length - positive - negative

      return {
        total: sentiments.length,
        positive,
        negative,
        neutral,
        average: positive / sentiments.length,
      }
    },
  }),
})
```

## Complex Patterns

### Retry with Backoff

```typescript
const retryWithBackoff = createWorkflow({
  name: 'retry-backoff',
  nodes: [
    createLLMNode({ name: 'attempt', adapter: model, prompt: () => 'Try' }),
    createConditionNode({
      name: 'check-success',
      condition: (_, ctx) => !ctx.nodeOutputs['attempt']?.success,
      branches: {
        true: 'delay',
        false: 'complete',
      },
    }),
    createDelayNode({
      name: 'delay',
      durationMs: (input, ctx) => {
        const attempt = ctx.loopState?.iteration ?? 0
        return Math.pow(2, attempt) * 1000 // Exponential backoff
      },
    }),
  ],
  edges: [
    { from: 'attempt', to: 'check-success' },
    { from: 'check-success', to: 'delay' },
    { from: 'delay', to: 'attempt' },
  ],
})
```

### Pipeline with Error Recovery

```typescript
const workflow = createWorkflow({
  name: 'resilient-pipeline',
  nodes: [
    step1,
    step2,
    step3,
    createConditionNode({
      name: 'check-errors',
      condition: (_, ctx) => {
        return Object.values(ctx.nodeOutputs).some(o => o?.error)
      },
      branches: {
        true: 'error-handler',
        false: 'complete',
      },
    }),
    createTransformNode({
      name: 'error-handler',
      transform: async (_, ctx) => {
        // Log errors, notify, etc.
        const errors = Object.entries(ctx.nodeOutputs)
          .filter(([_, o]) => o?.error)
          .map(([name, _]) => name)
        console.error('Errors in:', errors)
        return { recovered: true }
      },
    }),
  ],
})
```

## Best Practices

1. **Avoid Deep Nesting** — Keep workflows flat when possible
2. **Clear Branching** — Make conditions explicit and readable
3. **Loop Limits** — Always have loop exit conditions
4. **Parallel Safety** — Ensure parallel nodes don't have dependencies
5. **Error Handling** — Handle errors in each branch/path

## Next Steps

- [Error Handling](./errors.md) — Retry strategies and fallbacks
- [RAG](../rag/index.md) — Build retrieval workflows
