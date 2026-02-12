# Workflow Orchestration

Master complex multi-agent workflows with DAG-based orchestration, conditional branches, loops, error recovery, and monitoring.

## Overview

Workflows enable orchestrating multiple agents and steps into complex, reliable pipelines. Seashore uses Directed Acyclic Graph (DAG) architecture for flexible, parallelizable execution.

**What you'll learn:**
- DAG-based workflow design
- Conditional branching and loops
- Parallel execution patterns
- Error handling and recovery
- Human-in-the-loop integration
- Monitoring and observability

---

## Workflow Architecture

### DAG Structure

```
        START
          │
          ▼
    ┌─────────┐
    │  Step A │
    └────┬────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
┌───────┐ ┌───────┐
│Step B │ │Step C │
└───┬───┘ └───┬───┘
    │         │
    └────┬────┘
         │
         ▼
    ┌─────────┐
    │  Step D │
    └────┬────┘
         │
         ▼
        END
```

### Basic Workflow

```typescript
import { createWorkflow, createStep } from '@seashore/agent'

// Define steps
const stepA = createStep({
  name: 'research',
  execute: async (context) => {
    const results = await searchAPI(context.input.topic)
    return { findings: results }
  },
})

const stepB = createStep({
  name: 'analyze',
  execute: async (context) => {
    const analysis = await analyzeData(context.research.findings)
    return { insights: analysis }
  },
})

const stepC = createStep({
  name: 'report',
  execute: async (context) => {
    const report = await generateReport(context.analyze.insights)
    return { report }
  },
})

// Create workflow
const workflow = createWorkflow({
  name: 'research-workflow',
  steps: [stepA, stepB, stepC],
  edges: [
    { from: 'research', to: 'analyze' },
    { from: 'analyze', to: 'report' },
  ],
})

// Execute
const result = await workflow.run({
  topic: 'AI in healthcare',
})

console.log(result.report.report)
```

---

## Step Design

### Step Configuration

```typescript
import { z } from 'zod'

const step = createStep({
  // Unique identifier
  name: 'process_data',
  
  // Input validation
  inputSchema: z.object({
    data: z.array(z.any()),
    options: z.object({
      normalize: z.boolean().default(true),
    }).optional(),
  }),
  
  // Output schema
  outputSchema: z.object({
    processed: z.array(z.any()),
    stats: z.object({
      count: z.number(),
      errors: z.number(),
    }),
  }),
  
  // Retry configuration
  retry: {
    maxRetries: 3,
    backoffMs: 1000,
    exponential: true,
  },
  
  // Timeout
  timeoutMs: 60000, // 1 minute
  
  // Execution function
  execute: async (context) => {
    const { data, options } = context.input
    
    // Process data
    const processed = data.map(item => {
      if (options?.normalize) {
        return normalize(item)
      }
      return item
    })
    
    return {
      processed,
      stats: {
        count: processed.length,
        errors: 0,
      },
    }
  },
})
```

### Agent Steps

Wrap agents as workflow steps:

```typescript
import { createReActAgent } from '@seashore/agent'

const researchAgent = createReActAgent({
  model: () => llm('gpt-4o'),
  systemPrompt: 'You are a research assistant.',
  tools: [searchTool, scrapeTool],
  maxIterations: 10,
})

const researchStep = createStep({
  name: 'research',
  execute: async (context) => {
    const response = await researchAgent.run([
      { role: 'user', content: `Research: ${context.input.topic}` }
    ])
    
    return {
      findings: response.result.content,
      toolCalls: response.result.toolCalls.length,
    }
  },
})
```

### Data Transformation Steps

```typescript
const transformStep = createStep({
  name: 'transform',
  execute: async (context) => {
    // Access previous step results
    const rawData = context.extract.data
    
    // Transform
    const transformed = rawData.map(item => ({
      id: item.id,
      value: parseFloat(item.value),
      timestamp: new Date(item.timestamp),
    }))
    
    // Filter
    const filtered = transformed.filter(item => 
      item.value > 0 && !isNaN(item.value)
    )
    
    // Aggregate
    const stats = {
      total: filtered.reduce((sum, item) => sum + item.value, 0),
      count: filtered.length,
      avg: filtered.reduce((sum, item) => sum + item.value, 0) / filtered.length,
    }
    
    return { data: filtered, stats }
  },
})
```

---

## Conditional Branches

### Simple Conditions

```typescript
const workflow = createWorkflow({
  name: 'conditional-workflow',
  steps: [checkAuth, processPublic, processPrivate],
  edges: [
    {
      from: 'checkAuth',
      to: 'processPublic',
      condition: (context) => !context.checkAuth.authenticated,
    },
    {
      from: 'checkAuth',
      to: 'processPrivate',
      condition: (context) => context.checkAuth.authenticated,
    },
  ],
})
```

### Multi-Way Branching

```typescript
const classifyStep = createStep({
  name: 'classify',
  execute: async (context) => {
    const { text } = context.input
    const category = await classifyText(text)
    return { category }
  },
})

const workflow = createWorkflow({
  name: 'router-workflow',
  steps: [
    classifyStep,
    handleTechnical,
    handleBilling,
    handleGeneral,
  ],
  edges: [
    {
      from: 'classify',
      to: 'handleTechnical',
      condition: (ctx) => ctx.classify.category === 'technical',
    },
    {
      from: 'classify',
      to: 'handleBilling',
      condition: (ctx) => ctx.classify.category === 'billing',
    },
    {
      from: 'classify',
      to: 'handleGeneral',
      condition: (ctx) => ctx.classify.category === 'general',
    },
  ],
})
```

### Dynamic Branching

```typescript
const dynamicWorkflow = createWorkflow({
  name: 'dynamic-branches',
  steps: [analyze, ...processingSteps, merge],
  edges: (context) => {
    const edges = []
    
    // Analyze determines which paths to take
    const { requirements } = context.analyze
    
    if (requirements.includes('search')) {
      edges.push({ from: 'analyze', to: 'search' })
      edges.push({ from: 'search', to: 'merge' })
    }
    
    if (requirements.includes('compute')) {
      edges.push({ from: 'analyze', to: 'compute' })
      edges.push({ from: 'compute', to: 'merge' })
    }
    
    if (requirements.includes('external')) {
      edges.push({ from: 'analyze', to: 'external' })
      edges.push({ from: 'external', to: 'merge' })
    }
    
    return edges
  },
})
```

---

## Parallel Execution

### Fork-Join Pattern

```typescript
const parallelWorkflow = createWorkflow({
  name: 'parallel-processing',
  steps: [
    initStep,
    processA,
    processB,
    processC,
    mergeStep,
  ],
  edges: [
    // Fork: init → A, B, C
    { from: 'init', to: 'processA' },
    { from: 'init', to: 'processB' },
    { from: 'init', to: 'processC' },
    
    // Join: A, B, C → merge
    { from: 'processA', to: 'merge' },
    { from: 'processB', to: 'merge' },
    { from: 'processC', to: 'merge' },
  ],
})

const mergeStep = createStep({
  name: 'merge',
  execute: async (context) => {
    // Access all parallel results
    const resultsA = context.processA
    const resultsB = context.processB
    const resultsC = context.processC
    
    return {
      combined: [resultsA, resultsB, resultsC],
    }
  },
})
```

### Map-Reduce Pattern

```typescript
const mapReduceWorkflow = createWorkflow({
  name: 'map-reduce',
  steps: [split, ...mapSteps, reduce],
  
  edges: (context) => {
    const edges = []
    
    // Split creates N chunks
    const chunks = context.split.chunks
    
    // Map: split → map1, map2, ..., mapN
    chunks.forEach((_, i) => {
      edges.push({ from: 'split', to: `map${i}` })
      edges.push({ from: `map${i}`, to: 'reduce' })
    })
    
    return edges
  },
})

const splitStep = createStep({
  name: 'split',
  execute: async (context) => {
    const { data } = context.input
    const chunkSize = 100
    const chunks = []
    
    for (let i = 0; i < data.length; i += chunkSize) {
      chunks.push(data.slice(i, i + chunkSize))
    }
    
    return { chunks }
  },
})

const reduceStep = createStep({
  name: 'reduce',
  execute: async (context) => {
    // Collect all map results
    const mapResults = Object.keys(context)
      .filter(key => key.startsWith('map'))
      .map(key => context[key])
    
    // Reduce
    const combined = mapResults.reduce((acc, result) => {
      return acc.concat(result.processed)
    }, [])
    
    return { final: combined }
  },
})
```

---

## Loops and Iteration

### While Loop

```typescript
const loopWorkflow = createWorkflow({
  name: 'retry-loop',
  steps: [attempt, check, process],
  edges: [
    { from: 'attempt', to: 'check' },
    {
      from: 'check',
      to: 'attempt',
      condition: (ctx) => !ctx.check.success && ctx.check.retries < 3,
    },
    {
      from: 'check',
      to: 'process',
      condition: (ctx) => ctx.check.success,
    },
  ],
  maxIterations: 10, // Prevent infinite loops
})
```

### For Each Loop

```typescript
const foreachWorkflow = createWorkflow({
  name: 'process-items',
  steps: [initialize, processItem, accumulate],
  
  edges: (context) => {
    const edges = [
      { from: 'initialize', to: 'processItem' },
    ]
    
    // Loop until all items processed
    if (context.accumulate?.remaining > 0) {
      edges.push({ from: 'accumulate', to: 'processItem' })
    }
    
    return edges
  },
})

const initializeStep = createStep({
  name: 'initialize',
  execute: async (context) => {
    return {
      items: context.input.items,
      processed: [],
      currentIndex: 0,
    }
  },
})

const processItemStep = createStep({
  name: 'processItem',
  execute: async (context) => {
    const { items, currentIndex } = context.accumulate || context.initialize
    const item = items[currentIndex]
    
    const result = await processItem(item)
    
    return { result, item }
  },
})

const accumulateStep = createStep({
  name: 'accumulate',
  execute: async (context) => {
    const prev = context.accumulate || context.initialize
    const { result, item } = context.processItem
    
    return {
      items: prev.items,
      processed: [...prev.processed, { item, result }],
      currentIndex: prev.currentIndex + 1,
      remaining: prev.items.length - prev.currentIndex - 1,
    }
  },
})
```

---

## Error Handling

### Step-Level Retry

```typescript
const resilientStep = createStep({
  name: 'resilient',
  
  retry: {
    maxRetries: 3,
    backoffMs: 1000,
    exponential: true, // 1s, 2s, 4s
    retryOn: (error) => {
      // Only retry on specific errors
      return error.code === 'ETIMEDOUT' || error.code === 'ECONNRESET'
    },
  },
  
  execute: async (context) => {
    // This will auto-retry on failure
    return await unreliableAPI.call()
  },
})
```

### Fallback Steps

```typescript
const workflowWithFallback = createWorkflow({
  name: 'resilient-workflow',
  steps: [
    primaryStep,
    fallbackStep,
    finalStep,
  ],
  edges: [
    { from: 'primary', to: 'final' },
    {
      from: 'primary',
      to: 'fallback',
      onError: true, // Execute on error
    },
    { from: 'fallback', to: 'final' },
  ],
})

const primaryStep = createStep({
  name: 'primary',
  execute: async (context) => {
    try {
      return await expensiveOperation()
    } catch (error) {
      // Mark for fallback
      throw error
    }
  },
})

const fallbackStep = createStep({
  name: 'fallback',
  execute: async (context) => {
    // Use cached/approximate data
    console.warn('Using fallback due to error:', context.primary.error)
    return await getCachedResults()
  },
})
```

### Error Recovery

```typescript
const errorHandler = createStep({
  name: 'errorHandler',
  execute: async (context) => {
    const error = context.previousStep.error
    
    if (error.code === 'RATE_LIMIT') {
      // Wait and retry
      await delay(60000)
      return { action: 'retry' }
    }
    
    if (error.code === 'NOT_FOUND') {
      // Skip gracefully
      return { action: 'skip', reason: 'Resource not found' }
    }
    
    // Fatal error
    throw new Error(`Unrecoverable error: ${error.message}`)
  },
})
```

---

## Human-in-the-Loop

### Approval Step

```typescript
const approvalStep = createStep({
  name: 'approval',
  requiresHumanInput: true,
  
  execute: async (context) => {
    const { proposal } = context.generate
    
    // Pause workflow and request human input
    const approval = await context.requestHumanInput({
      type: 'approval',
      message: 'Please review and approve the proposal',
      data: proposal,
      options: ['approve', 'reject', 'revise'],
    })
    
    return { approved: approval.decision === 'approve' }
  },
})

// Run workflow with human input handler
const result = await workflow.run(
  { input: 'data' },
  {
    onHumanInputRequired: async (request) => {
      // Present to human via UI
      console.log('Human input required:', request.message)
      console.log('Data:', request.data)
      
      // Wait for human response
      const decision = await promptHuman(request.options)
      
      return { decision }
    },
  }
)
```

### Review Step

```typescript
const reviewStep = createStep({
  name: 'review',
  requiresHumanInput: true,
  
  execute: async (context) => {
    const { draft } = context.write
    
    const feedback = await context.requestHumanInput({
      type: 'review',
      message: 'Please review the draft',
      data: draft,
      schema: z.object({
        approved: z.boolean(),
        comments: z.string().optional(),
        changes: z.array(z.object({
          section: z.string(),
          suggestion: z.string(),
        })).optional(),
      }),
    })
    
    return feedback
  },
})
```

---

## Monitoring and Observability

### Workflow Events

```typescript
const workflow = createWorkflow({
  name: 'monitored-workflow',
  steps: [stepA, stepB, stepC],
  edges: [
    { from: 'stepA', to: 'stepB' },
    { from: 'stepB', to: 'stepC' },
  ],
  
  // Lifecycle hooks
  onStepStart: (step, context) => {
    console.log(`Starting step: ${step.name}`)
    metrics.increment('workflow.step.start', { step: step.name })
  },
  
  onStepComplete: (step, result, duration) => {
    console.log(`Completed step: ${step.name} in ${duration}ms`)
    metrics.timing('workflow.step.duration', duration, { step: step.name })
  },
  
  onStepError: (step, error) => {
    console.error(`Error in step: ${step.name}`, error)
    metrics.increment('workflow.step.error', { step: step.name })
  },
  
  onComplete: (result, duration) => {
    console.log(`Workflow completed in ${duration}ms`)
    metrics.timing('workflow.duration', duration)
  },
})
```

### Execution Tracing

```typescript
interface ExecutionTrace {
  workflowId: string
  startTime: Date
  steps: Array<{
    name: string
    startTime: Date
    endTime: Date
    duration: number
    status: 'success' | 'error' | 'skipped'
    input?: any
    output?: any
    error?: any
  }>
  endTime?: Date
  totalDuration?: number
  status: 'running' | 'completed' | 'failed'
}

class TracedWorkflow {
  private trace: ExecutionTrace
  
  async run(input: any): Promise<any> {
    this.trace = {
      workflowId: generateId(),
      startTime: new Date(),
      steps: [],
      status: 'running',
    }
    
    try {
      const result = await this.workflow.run(input, {
        onStepStart: (step) => {
          this.trace.steps.push({
            name: step.name,
            startTime: new Date(),
            status: 'running',
          })
        },
        onStepComplete: (step, result) => {
          const stepTrace = this.trace.steps.find(s => s.name === step.name)!
          stepTrace.endTime = new Date()
          stepTrace.duration = stepTrace.endTime.getTime() - stepTrace.startTime.getTime()
          stepTrace.status = 'success'
          stepTrace.output = result
        },
      })
      
      this.trace.endTime = new Date()
      this.trace.totalDuration = this.trace.endTime.getTime() - this.trace.startTime.getTime()
      this.trace.status = 'completed'
      
      await this.saveTrace()
      
      return result
    } catch (error) {
      this.trace.status = 'failed'
      this.trace.endTime = new Date()
      await this.saveTrace()
      throw error
    }
  }
  
  private async saveTrace() {
    await db.traces.create({ data: this.trace })
  }
}
```

---

## Advanced Patterns

### Saga Pattern

```typescript
const sagaWorkflow = createWorkflow({
  name: 'saga',
  steps: [
    bookFlight,
    compensateBookFlight,
    bookHotel,
    compensateBookHotel,
    bookCar,
    compensateBookCar,
    confirm,
  ],
  
  edges: [
    { from: 'bookFlight', to: 'bookHotel' },
    { from: 'bookHotel', to: 'bookCar' },
    { from: 'bookCar', to: 'confirm' },
    
    // Compensations on error
    {
      from: 'bookHotel',
      to: 'compensateBookFlight',
      onError: true,
    },
    {
      from: 'bookCar',
      to: 'compensateBookHotel',
      onError: true,
    },
    {
      from: 'compensateBookHotel',
      to: 'compensateBookFlight',
    },
  ],
})

const compensateBookFlight = createStep({
  name: 'compensateBookFlight',
  execute: async (context) => {
    const { bookingId } = context.bookFlight
    await cancelFlightBooking(bookingId)
    return { cancelled: true }
  },
})
```

### Pipeline Pattern

```typescript
const pipeline = createWorkflow({
  name: 'data-pipeline',
  steps: [
    extract,
    validate,
    transform,
    enrich,
    load,
  ],
  edges: [
    { from: 'extract', to: 'validate' },
    { from: 'validate', to: 'transform' },
    { from: 'transform', to: 'enrich' },
    { from: 'enrich', to: 'load' },
  ],
})

// Each step processes and passes data forward
const transformStep = createStep({
  name: 'transform',
  execute: async (context) => {
    const validatedData = context.validate.data
    
    return {
      data: validatedData.map(row => ({
        ...row,
        normalized: normalizeValue(row.value),
        categorized: categorize(row),
      })),
    }
  },
})
```

---

## Best Practices Checklist

### Design
- [ ] Steps have single, clear responsibility
- [ ] Workflows are DAGs (no cycles except explicit loops)
- [ ] Parallel steps have no dependencies
- [ ] Error handling at appropriate levels

### Performance
- [ ] Maximize parallelization where possible
- [ ] Steps have appropriate timeouts
- [ ] Expensive operations are cached
- [ ] Progress is tracked and logged

### Reliability
- [ ] Retry policies for transient failures
- [ ] Fallback paths for critical failures
- [ ] Idempotent steps where possible
- [ ] State is persisted for long-running workflows

### Observability
- [ ] Execution traces captured
- [ ] Metrics emitted for key events
- [ ] Errors logged with context
- [ ] Progress visible to users

---

## Next Steps

- **[Building Agents](./building-agents.md)** - Use agents in workflows
- **[Error Handling](./error-handling.md)** - Advanced error patterns
- **[Performance](./performance.md)** - Optimize workflow execution

---

## Additional Resources

- **[Core Concepts: Workflows](/docs/core-concepts/workflows.md)** - Detailed documentation
- **[API Reference](/docs/api/agent.md#workflows)** - Complete API
- **[Examples](/examples/workflow/)** - Code examples
