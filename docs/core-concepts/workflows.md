# Workflows

**Workflows** enable you to orchestrate complex, multi-step processes using **Directed Acyclic Graphs (DAGs)**. They provide parallel execution, dependency management, conditional logic, and human-in-the-loop capabilities.

## Overview

Workflows solve the problem of coordinating multiple interdependent tasks:

- **Parallel execution** - Run independent steps simultaneously
- **Dependency management** - Ensure steps run in correct order
- **Data passing** - Share results between steps
- **Error handling** - Retry failed steps with backoff
- **Human approval** - Pause for human input when needed
- **Conditional logic** - Skip steps based on runtime conditions

```
Traditional Sequential:        Workflow DAG (Parallel):
┌─────────┐                   ┌─────────┐
│ Step 1  │                   │ Step 1  │
└────┬────┘                   └─┬─────┬─┘
     │                          │     │
┌────▼────┐                ┌───▼──┐ ┌▼────┐
│ Step 2  │                │Step 2│ │Step3│  ← Parallel
└────┬────┘                └───┬──┘ └┬────┘
     │                          │     │
┌────▼────┐                    └─┬─┬─┘
│ Step 3  │                      │ │
└────┬────┘                  ┌───▼─▼──┐
     │                       │ Step 4 │  ← Join
┌────▼────┐                  └────────┘
│ Step 4  │
└─────────┘

Time: 4 units             Time: 3 units (33% faster!)
```

---

## Core Concepts

### Directed Acyclic Graph (DAG)

A **DAG** is a graph where:
- **Directed** - Edges have a direction (from → to)
- **Acyclic** - No circular dependencies
- **Graph** - Nodes (steps) connected by edges (dependencies)

```typescript
// This is valid (DAG)
A → B → D
A → C → D

// This is INVALID (cycle)
A → B → C → A
```

### Steps

**Steps** are the individual units of work in a workflow.

```typescript
interface StepConfig<TInput, TOutput> {
  name: string
  execute: (input: TInput, ctx: WorkflowContext) => Promise<TOutput>
  outputSchema?: z.ZodSchema<TOutput>
  retryPolicy?: RetryPolicy
}
```

### Edges

**Edges** define dependencies and control flow.

```typescript
interface StepEdgeConfig {
  after?: string | string[]              // Depend on step(s)
  when?: (ctx: WorkflowContext) => boolean  // Conditional execution
  type?: 'normal' | 'human'              // Human-in-the-loop
  prompt?: (ctx: WorkflowContext) => string // Human prompt
  timeout?: number                       // Timeout in ms
}
```

### Workflow Context

**Context** carries state and shared data between steps.

```typescript
interface WorkflowContext {
  state: Map<string, unknown>  // Shared state
  abortSignal: AbortSignal     // Cancellation signal
}
```

---

## Creating Workflows

### Basic Workflow

```typescript
import { createWorkflow, createStep } from '@seashore/agent'

const workflow = createWorkflow({
  name: 'data-pipeline'
})
  .step(createStep({
    name: 'fetch',
    execute: async (input, ctx) => {
      const data = await fetch('/api/data')
      return data.json()
    }
  }))
  .step(createStep({
    name: 'process',
    execute: async (input, ctx) => {
      const fetchResult = ctx.state.get('fetch')
      return processData(fetchResult)
    }
  }), {
    after: 'fetch'  // Run after 'fetch' completes
  })

const result = await workflow.execute()
console.log(result.state.get('process'))
```

### Step Definition

**createStep** defines a workflow step:

```typescript
const step = createStep({
  name: 'transform_data',
  execute: async (input, ctx) => {
    // Access previous step results from context
    const rawData = ctx.state.get('fetch_data')
    
    // Transform data
    const transformed = rawData.map(item => ({
      id: item.id,
      value: item.value * 2
    }))
    
    // Return result (automatically stored in context)
    return transformed
  }
})
```

**With output schema validation:**

```typescript
import { z } from 'zod'

const step = createStep({
  name: 'validate_user',
  execute: async (input, ctx) => {
    const user = await fetchUser(input.userId)
    return {
      id: user.id,
      email: user.email,
      verified: user.verified
    }
  },
  outputSchema: z.object({
    id: z.string(),
    email: z.string().email(),
    verified: z.boolean()
  })
})
```

**With retry policy:**

```typescript
const step = createStep({
  name: 'call_external_api',
  execute: async (input, ctx) => {
    return await fetch('https://api.example.com/data')
  },
  retryPolicy: {
    maxRetries: 3,
    delayMs: 1000,
    backoffMultiplier: 2  // 1s, 2s, 4s
  }
})
```

---

## Dependency Management

### Linear Dependencies

Steps run sequentially:

```typescript
const workflow = createWorkflow({ name: 'linear' })
  .step(createStep({ name: 'step1', execute: async () => 1 }))
  .step(createStep({ name: 'step2', execute: async () => 2 }), { after: 'step1' })
  .step(createStep({ name: 'step3', execute: async () => 3 }), { after: 'step2' })

// Execution order: step1 → step2 → step3
```

### Parallel Execution

Steps without dependencies run in parallel:

```typescript
const workflow = createWorkflow({ name: 'parallel' })
  .step(createStep({ name: 'source', execute: async () => data }))
  .step(createStep({
    name: 'analyze',
    execute: async (input, ctx) => {
      const source = ctx.state.get('source')
      return analyzeData(source)
    }
  }), { after: 'source' })
  .step(createStep({
    name: 'transform',
    execute: async (input, ctx) => {
      const source = ctx.state.get('source')
      return transformData(source)
    }
  }), { after: 'source' })
  .step(createStep({
    name: 'merge',
    execute: async (input, ctx) => {
      const analysis = ctx.state.get('analyze')
      const transformed = ctx.state.get('transform')
      return { analysis, transformed }
    }
  }), { after: ['analyze', 'transform'] })

// Execution:
// 1. source
// 2. analyze AND transform (parallel)
// 3. merge (after both complete)
```

### Diamond Pattern

Classic fork-join pattern:

```typescript
/*
      ┌───────┐
      │source │
      └───┬───┘
      ┌───┴───┐
  ┌───▼───┐ ┌─▼────┐
  │branch1│ │branch2│  ← Parallel
  └───┬───┘ └─┬────┘
      └───┬───┘
      ┌───▼───┐
      │ join  │
      └───────┘
*/

const workflow = createWorkflow({ name: 'diamond' })
  .step(createStep({ name: 'source', execute: async () => data }))
  .step(createStep({ name: 'branch1', execute: async (i, ctx) => {
    return processBranch1(ctx.state.get('source'))
  }}), { after: 'source' })
  .step(createStep({ name: 'branch2', execute: async (i, ctx) => {
    return processBranch2(ctx.state.get('source'))
  }}), { after: 'source' })
  .step(createStep({ name: 'join', execute: async (i, ctx) => {
    const b1 = ctx.state.get('branch1')
    const b2 = ctx.state.get('branch2')
    return mergeResults(b1, b2)
  }}), { after: ['branch1', 'branch2'] })
```

### Multiple Dependencies

Step runs after ALL dependencies complete:

```typescript
const workflow = createWorkflow({ name: 'multi-dep' })
  .step(createStep({ name: 'fetch_users', execute: fetchUsers }))
  .step(createStep({ name: 'fetch_posts', execute: fetchPosts }))
  .step(createStep({ name: 'fetch_comments', execute: fetchComments }))
  .step(createStep({
    name: 'build_report',
    execute: async (input, ctx) => {
      return {
        users: ctx.state.get('fetch_users'),
        posts: ctx.state.get('fetch_posts'),
        comments: ctx.state.get('fetch_comments')
      }
    }
  }), {
    after: ['fetch_users', 'fetch_posts', 'fetch_comments']
  })

// Execution:
// 1. fetch_users, fetch_posts, fetch_comments (all parallel)
// 2. build_report (after all 3 complete)
```

---

## Data Passing

### Context State

Steps communicate through shared context:

```typescript
const workflow = createWorkflow({ name: 'data-flow' })
  .step(createStep({
    name: 'producer',
    execute: async () => {
      return { value: 42 }
    }
  }))
  .step(createStep({
    name: 'consumer',
    execute: async (input, ctx) => {
      // Read from context
      const produced = ctx.state.get('producer')
      console.log(produced.value)  // 42
      
      return { doubled: produced.value * 2 }
    }
  }), { after: 'producer' })

const result = await workflow.execute()

// Access final state
console.log(result.state.get('consumer'))  // { doubled: 84 }
```

### Initial State

Provide starting data:

```typescript
const workflow = createWorkflow({ name: 'with-input' })
  .step(createStep({
    name: 'process',
    execute: async (input, ctx) => {
      const userId = ctx.state.get('userId')
      return await fetchUser(userId)
    }
  }))

const result = await workflow.execute({
  initialState: new Map([
    ['userId', '123']
  ])
})
```

### Type-Safe State Access

```typescript
// Define state schema
interface WorkflowState {
  fetchData: { items: string[] }
  processData: { count: number }
}

// Type-safe access helper
function getState<K extends keyof WorkflowState>(
  ctx: WorkflowContext,
  key: K
): WorkflowState[K] {
  return ctx.state.get(key) as WorkflowState[K]
}

const step = createStep({
  name: 'analyze',
  execute: async (input, ctx) => {
    const data = getState(ctx, 'fetchData')
    console.log(data.items.length)  // Type-safe!
  }
})
```

---

## Conditional Execution

### Conditional Steps

Skip steps based on runtime conditions:

```typescript
const workflow = createWorkflow({ name: 'conditional' })
  .step(createStep({
    name: 'check_user',
    execute: async () => {
      return { isPremium: true }
    }
  }))
  .step(createStep({
    name: 'premium_features',
    execute: async () => {
      return ['feature1', 'feature2']
    }
  }), {
    after: 'check_user',
    when: (ctx) => {
      const user = ctx.state.get('check_user')
      return user.isPremium === true
    }
  })
  .step(createStep({
    name: 'basic_features',
    execute: async () => {
      return ['feature1']
    }
  }), {
    after: 'check_user',
    when: (ctx) => {
      const user = ctx.state.get('check_user')
      return user.isPremium === false
    }
  })
```

### Async Conditions

Conditions can be async:

```typescript
.step(createStep({ name: 'expensive_step', execute: doWork }), {
  when: async (ctx) => {
    const credits = await checkUserCredits()
    return credits > 100
  }
})
```

---

## Error Handling

### Retry Policies

Automatically retry failed steps:

```typescript
interface RetryPolicy {
  maxRetries: number
  delayMs?: number
  backoffMultiplier?: number
}

const step = createStep({
  name: 'flaky_api',
  execute: async () => {
    return await fetch('https://api.example.com')
  },
  retryPolicy: {
    maxRetries: 3,
    delayMs: 1000,
    backoffMultiplier: 2
  }
})

// Retry schedule:
// Attempt 1: immediate
// Attempt 2: after 1000ms
// Attempt 3: after 2000ms
// Attempt 4: after 4000ms
```

### Workflow Error Handling

```typescript
const result = await workflow.execute()

if (result.status === 'failed') {
  console.error('Workflow failed:', result.error)
  console.log('Completed steps:', Array.from(result.state.keys()))
} else {
  console.log('Success!')
}
```

### Step-Level Error Handling

```typescript
const step = createStep({
  name: 'safe_step',
  execute: async (input, ctx) => {
    try {
      return await riskyOperation()
    } catch (error) {
      console.error('Step failed:', error)
      return { error: error.message }
    }
  }
})
```

---

## Human-in-the-Loop

### Human Approval Steps

Pause workflow for human approval:

```typescript
const workflow = createWorkflow({ name: 'approval-workflow' })
  .step(createStep({
    name: 'prepare_data',
    execute: async () => {
      return { amount: 10000, recipient: 'vendor@example.com' }
    }
  }))
  .step(createStep({
    name: 'approval',
    execute: async (input, ctx) => {
      // This step will pause and wait for human input
      return 'pending'
    }
  }), {
    after: 'prepare_data',
    type: 'human',
    prompt: (ctx) => {
      const data = ctx.state.get('prepare_data')
      return `Approve payment of $${data.amount} to ${data.recipient}?`
    },
    timeout: 3600000  // 1 hour
  })
  .step(createStep({
    name: 'execute_payment',
    execute: async (input, ctx) => {
      const data = ctx.state.get('prepare_data')
      return await processPayment(data)
    }
  }), {
    after: 'approval'
  })

// Start workflow (will pause at approval step)
const result = await workflow.execute()

if (result.status === 'pending') {
  console.log('Waiting for approval:', result.pendingStep)
}
```

### Resuming After Approval

```typescript
// Resume workflow after human input
const resumeResult = await workflow.resume({
  approved: true,
  comment: 'Approved by manager'
})
```

---

## Workflow Execution

### Execute Method

```typescript
interface ExecuteOptions {
  initialState?: Map<string, unknown>
  abortSignal?: AbortSignal
}

const result = await workflow.execute(options)
```

### Workflow Result

```typescript
interface WorkflowResult {
  status: 'idle' | 'running' | 'pending' | 'completed' | 'failed'
  state: Map<string, unknown>
  error?: Error
}
```

**Status meanings:**
- `idle` - Not started
- `running` - Currently executing
- `pending` - Waiting for human input
- `completed` - Successfully finished
- `failed` - Encountered error

### Cancellation

```typescript
const controller = new AbortController()

const promise = workflow.execute({
  abortSignal: controller.signal
})

// Cancel after 10 seconds
setTimeout(() => controller.abort(), 10000)

const result = await promise
console.log(result.status)  // 'failed'
console.log(result.error.message)  // 'Aborted'
```

---

## DAG Class

The underlying graph data structure:

```typescript
import { DAG } from '@seashore/agent'

const dag = new DAG()

// Add nodes
dag.addNode('A')
dag.addNode('B')
dag.addNode('C')

// Add edges (A → B, A → C)
dag.addEdge('A', 'B')
dag.addEdge('A', 'C')

// Query graph
const roots = dag.getRoots()  // ['A']
const deps = dag.getDependencies('B')  // ['A']

// Topological sort
const sorted = dag.topologicalSort()  // ['A', 'B', 'C'] or ['A', 'C', 'B']

// Get ready steps
const completed = new Set(['A'])
const ready = dag.getReady(completed)  // ['B', 'C']
```

### Cycle Detection

DAG automatically detects cycles:

```typescript
const dag = new DAG()
dag.addNode('A')
dag.addNode('B')
dag.addNode('C')

dag.addEdge('A', 'B')
dag.addEdge('B', 'C')
dag.addEdge('C', 'A')  // Cycle!

try {
  dag.topologicalSort()
} catch (error) {
  console.error(error.message)  // "Circular dependency detected involving: A"
}
```

---

## Advanced Patterns

### Fan-Out / Fan-In

Process multiple items in parallel:

```typescript
const workflow = createWorkflow({ name: 'fan-out-in' })
  .step(createStep({
    name: 'get_user_ids',
    execute: async () => {
      return ['user1', 'user2', 'user3']
    }
  }))

// Create dynamic steps for each user
const userIds = ['user1', 'user2', 'user3']
userIds.forEach(userId => {
  workflow.step(createStep({
    name: `process_${userId}`,
    execute: async () => {
      return await processUser(userId)
    }
  }), { after: 'get_user_ids' })
})

workflow.step(createStep({
  name: 'aggregate',
  execute: async (input, ctx) => {
    const results = userIds.map(id => 
      ctx.state.get(`process_${id}`)
    )
    return results
  }
}), { after: userIds.map(id => `process_${id}`) })
```

### Nested Workflows

Workflows can call other workflows:

```typescript
const subWorkflow = createWorkflow({ name: 'sub' })
  .step(createStep({ name: 'sub1', execute: async () => 1 }))
  .step(createStep({ name: 'sub2', execute: async () => 2 }))

const mainWorkflow = createWorkflow({ name: 'main' })
  .step(createStep({
    name: 'call_sub',
    execute: async () => {
      return await subWorkflow.execute()
    }
  }))
```

### Checkpoint / Resume

Save workflow state for resumption:

```typescript
const workflow = createWorkflow({ name: 'long-running' })
  .step(createStep({ name: 'step1', execute: async () => 'result1' }))
  .step(createStep({ name: 'step2', execute: async () => 'result2' }), { after: 'step1' })

// Execute and save state
const result = await workflow.execute()
const checkpointState = result.state

// Later: resume from checkpoint
const resumedResult = await workflow.execute({
  initialState: checkpointState
})
```

### Agent Integration

Combine workflows with ReAct agents:

```typescript
import { createReActAgent } from '@seashore/agent'

const agent = createReActAgent({
  model: () => llm('gpt-4o'),
  systemPrompt: 'You are helpful.',
  tools: [researchTool]
})

const workflow = createWorkflow({ name: 'research-report' })
  .step(createStep({
    name: 'research',
    execute: async (input, ctx) => {
      const topic = ctx.state.get('topic')
      const response = await agent.run([
        { role: 'user', content: `Research ${topic}` }
      ])
      return response.result.content
    }
  }))
  .step(createStep({
    name: 'summarize',
    execute: async (input, ctx) => {
      const research = ctx.state.get('research')
      const response = await agent.run([
        { role: 'user', content: `Summarize: ${research}` }
      ])
      return response.result.content
    }
  }), { after: 'research' })

const result = await workflow.execute({
  initialState: new Map([['topic', 'AI Safety']])
})
```

---

## Best Practices

### 1. Descriptive Step Names

```typescript
// ❌ BAD
createStep({ name: 'step1', execute: doSomething })

// ✅ GOOD
createStep({ name: 'fetch_user_data', execute: fetchUser })
```

### 2. Idempotent Steps

Steps should be safe to retry:

```typescript
// ✅ GOOD: Idempotent
const step = createStep({
  name: 'update_record',
  execute: async (input, ctx) => {
    const record = await db.findById(id)
    if (record.processed) return record  // Already done
    
    record.processed = true
    await db.update(record)
    return record
  }
})
```

### 3. Small, Focused Steps

```typescript
// ❌ BAD: One giant step
createStep({
  name: 'do_everything',
  execute: async () => {
    const data = await fetch()
    const validated = validate(data)
    const transformed = transform(validated)
    const saved = await save(transformed)
    return saved
  }
})

// ✅ GOOD: Multiple focused steps
.step(createStep({ name: 'fetch', execute: fetch }))
.step(createStep({ name: 'validate', execute: validate }), { after: 'fetch' })
.step(createStep({ name: 'transform', execute: transform }), { after: 'validate' })
.step(createStep({ name: 'save', execute: save }), { after: 'transform' })
```

### 4. Handle Errors Gracefully

```typescript
const step = createStep({
  name: 'fetch_external',
  execute: async () => {
    try {
      return await fetch('https://api.example.com')
    } catch (error) {
      // Return error info, don't throw
      return {
        success: false,
        error: error.message,
        fallbackData: []
      }
    }
  }
})
```

### 5. Use Schema Validation

```typescript
const step = createStep({
  name: 'process_user',
  execute: async (input, ctx) => {
    return {
      id: '123',
      email: 'user@example.com',
      verified: true
    }
  },
  outputSchema: z.object({
    id: z.string(),
    email: z.string().email(),
    verified: z.boolean()
  })
})
```

---

## Common Pitfalls

### 1. Circular Dependencies

```typescript
// ❌ BAD: Creates cycle
.step(createStep({ name: 'A', execute: () => 'a' }), { after: 'C' })
.step(createStep({ name: 'B', execute: () => 'b' }), { after: 'A' })
.step(createStep({ name: 'C', execute: () => 'c' }), { after: 'B' })

// Error: Circular dependency detected involving: A
```

### 2. Missing Dependencies

```typescript
// ❌ BAD: Forgets dependency
.step(createStep({
  name: 'process',
  execute: async (input, ctx) => {
    const data = ctx.state.get('fetch')  // May be undefined!
    return data.value
  }
}))

// ✅ GOOD: Declares dependency
.step(createStep({ name: 'process', execute: ... }), { after: 'fetch' })
```

### 3. Mutating Context Incorrectly

```typescript
// ❌ BAD: Direct mutation
const step = createStep({
  name: 'bad',
  execute: async (input, ctx) => {
    ctx.state.set('fetch', { modified: true })  // Mutates another step's result!
  }
})

// ✅ GOOD: Return new state
const step = createStep({
  name: 'good',
  execute: async (input, ctx) => {
    const fetch = ctx.state.get('fetch')
    return { ...fetch, processed: true }
  }
})
```

---

## Related Concepts

- **[Agents](./agents.md)** - Use agents within workflow steps
- **[Architecture](./architecture.md)** - Understanding the DAG implementation
- **[Deployment](../deployment/)** - Production workflow patterns

---

## Next Steps

- **[Build Your First Workflow](../getting-started/first-workflow.md)**
- **[Workflow Examples](../../examples/workflow/)**
- **[Advanced Orchestration](../guides/advanced-workflows.md)**
