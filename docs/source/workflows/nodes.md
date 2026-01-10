# Node Types

Workflows support several node types for different purposes. This guide covers all available nodes and when to use each.

## LLM Nodes

Call language models with prompts or message history:

```typescript
import { createLLMNode } from '@seashore/workflow'

// Simple prompt-based
const promptNode = createLLMNode({
  name: 'generate',
  adapter: openaiText('gpt-4o'),
  systemPrompt: 'You are a helpful assistant.',
  prompt: (input) => `Respond to: ${input.question}`,
})

// Message-based
const messageNode = createLLMNode({
  name: 'chat',
  adapter: openaiText('gpt-4o'),
  messages: (input, ctx) => {
    const history = ctx.nodeOutputs['history']?.messages ?? []
    return [
      { role: 'system', content: 'You are helpful.' },
      ...history,
      { role: 'user', content: input.message },
    ]
  },
})
```

**Use for:** Text generation, summarization, analysis, chat

## Tool Nodes

Execute tools and pass results to the workflow:

```typescript
import { createToolNode } from '@seashore/workflow'

const searchNode = createToolNode({
  name: 'search',
  tool: serperTool({ apiKey: process.env.SERPER_API_KEY }),
  inputMapping: (input) => ({ query: input.searchQuery }),
})

// Access tool output in subsequent nodes
const summarizeNode = createLLMNode({
  name: 'summarize',
  adapter: openaiText('gpt-4o'),
  prompt: (input, ctx) => {
    const searchResults = ctx.nodeOutputs['search']?.data
    return `Summarize these results: ${JSON.stringify(searchResults)}`
  },
})
```

**Use for:** API calls, database queries, external operations

## Condition Nodes

Branch execution based on conditions:

```typescript
import { createConditionNode } from '@seashore/workflow'

const categoryNode = createConditionNode({
  name: 'categorize',
  condition: (input, ctx) => {
    const sentiment = ctx.nodeOutputs['analyze']?.sentiment
    if (sentiment === 'positive') return 'positive'
    if (sentiment === 'negative') return 'negative'
    return 'neutral'
  },
  branches: {
    positive: 'handle-positive',
    negative: 'handle-negative',
    neutral: 'handle-neutral',
  },
})
```

**Use for:** Routing, A/B testing, conditional logic

## Switch Nodes

Route based on exact value matches:

```typescript
import { createSwitchNode } from '@seashore/workflow'

const routeNode = createSwitchNode({
  name: 'route',
  value: (input, ctx) => ctx.nodeOutputs['detect']?.type,
  cases: {
    'email': 'email-handler',
    'sms': 'sms-handler',
    'push': 'push-handler',
  },
  default: 'default-handler',
})
```

**Use for:** Exact value matching, type-based routing

## Parallel Nodes

Execute multiple nodes concurrently:

```typescript
import { createParallelNode } from '@seashore/workflow'

const parallelNode = createParallelNode({
  name: 'parallel-tasks',
  nodes: [
    createLLMNode({
      name: 'task1',
      adapter: openaiText('gpt-4o'),
      prompt: () => 'Do task 1',
    }),
    createLLMNode({
      name: 'task2',
      adapter: openaiText('gpt-4o'),
      prompt: () => 'Do task 2',
    }),
  ],
})

// Access all results
const aggregateNode = createTransformNode({
  name: 'aggregate',
  transform: (input, ctx) => {
    const task1Result = ctx.nodeOutputs['task1']?.content
    const task2Result = ctx.nodeOutputs['task2']?.content
    return { combined: `${task1Result}\n${task2Result}` }
  },
})
```

**Use for:** Concurrent processing, aggregations

## Map-Reduce Nodes

Process arrays in parallel and aggregate:

```typescript
import { createMapReduceNode } from '@seashore/workflow'

const processItems = createMapReduceNode({
  name: 'process-items',
  map: createLLMNode({
    name: 'summarize',
    adapter: openaiText('gpt-4o'),
    prompt: (item) => `Summarize: ${item.text}`,
  }),
  reduce: createTransformNode({
    name: 'combine',
    transform: async (_, ctx) => {
      const summaries = ctx.mapResults ?? []
      return {
        combined: summaries.join('\n'),
        count: summaries.length,
      }
    },
  }),
  inputArray: (input) => input.items,
})
```

**Use for:** Batch processing, array operations

## Transform Nodes

Custom transformation logic:

```typescript
import { createTransformNode } from '@seashore/workflow'

const transformNode = createTransformNode({
  name: 'format',
  transform: async (input, ctx) => {
    const raw = ctx.nodeOutputs['generate']?.content ?? ''
    return {
      formatted: raw.toUpperCase(),
      timestamp: new Date().toISOString(),
    }
  },
})
```

## Passthrough Nodes

Pass data through unchanged:

```typescript
import { createPassthroughNode } from '@seashore/workflow'

const logNode = createPassthroughNode({
  name: 'log',
  middleware: async (input, ctx) => {
    console.log('Processing:', input)
    return input // Pass through
  },
})
```

## Validation Nodes

Validate data before proceeding:

```typescript
import { createValidationNode } from '@seashore/workflow'

const validateNode = createValidationNode({
  name: 'validate',
  validate: async (input, ctx) => {
    const data = ctx.nodeOutputs['previous']?.data
    if (!data?.email) {
      throw new Error('Email is required')
    }
    return true
  },
})
```

## Delay Nodes

Add delays between operations:

```typescript
import { createDelayNode } from '@seashore/workflow'

const waitNode = createDelayNode({
  name: 'wait',
  durationMs: 5000, // Wait 5 seconds
})
```

## Log Nodes

Log workflow state:

```typescript
import { createLogNode } from '@seashore/workflow'

const logNode = createLogNode({
  name: 'log-progress',
  message: (input, ctx) => {
    return `Processing ${input.id}, previous output: ${JSON.stringify(ctx.nodeOutputs['previous'])}`
  },
  level: 'info',
})
```

## Node Comparison

| Node Type | Purpose | Async | Parallel |
|-----------|---------|-------|----------|
| LLM | Text generation | Yes | No |
| Tool | Execute functions | Yes | No |
| Condition | Branching | No | No |
| Switch | Value routing | No | No |
| Parallel | Concurrent execution | Yes | Yes |
| Map-Reduce | Batch processing | Yes | Yes |
| Transform | Custom logic | Yes | No |
| Validation | Data validation | Yes | No |
| Delay | Timing control | Yes | No |
| Log | Debugging | No | No |

## Best Practices

1. **Single Responsibility** — Each node should do one thing
2. **Clear Names** — Use descriptive names for debugging
3. **Error Handling** — Handle errors in nodes or use error handling strategies
4. **Type Safety** — Use schemas for input/output validation
5. **Context Access** — Minimize dependency on context when possible

## Next Steps

- [Control Flow](./control-flow.md) — Loops and branches
- [Error Handling](./errors.md) — Retry and fallback
