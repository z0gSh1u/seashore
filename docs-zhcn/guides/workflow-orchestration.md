# 工作流编排

掌握基于 DAG 的编排、条件分支、循环、错误恢复和监控的复杂多智能体工作流。

## 概述

工作流使多个智能体和步骤能够编排成复杂、可靠的管道。Seashore 使用有向无环图(DAG)架构实现灵活的、可并行化的执行。

**你将学到:**
- 基于 DAG 的工作流设计
- 条件分支和循环
- 并行执行模式
- 错误处理和恢复
- 人机协同集成
- 监控和可观测性

---

## 工作流架构

### DAG 结构

```
        开始
          │
          ▼
     ┌─────────┐
     │  步骤 A │
     └────┬────┘
          │
     ┌────┴────┐
     │         │
     ▼         ▼
┌───────┐ ┌───────┐
│步骤 B │ │步骤 C │
└───┬───┘ └───┬───┘
    │         │
    └────┬────┘
         │
         ▼
    ┌─────────┐
    │  步骤 D │
    └────┬────┘
         │
         ▼
        结束
```

### 基本工作流

```typescript
import { createWorkflow, createStep } from '@seashore/agent'

// 定义步骤
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

// 创建工作流
const workflow = createWorkflow({
  name: 'research-workflow',
  steps: [stepA, stepB, stepC],
  edges: [
    { from: 'research', to: 'analyze' },
    { from: 'analyze', to: 'report' },
  ],
})

// 执行
const result = await workflow.run({
  topic: 'AI in healthcare',
})

console.log(result.report.report)
```

---

## 步骤设计

### 步骤配置

```typescript
import { z } from 'zod'

const step = createStep({
  // 唯一标识符
  name: 'process_data',
  
  // 输入验证
  inputSchema: z.object({
    data: z.array(z.any()),
    options: z.object({
      normalize: z.boolean().default(true),
    }).optional(),
  }),
  
  // 输出模式
  outputSchema: z.object({
    processed: z.array(z.any()),
    stats: z.object({
      count: z.number(),
      errors: z.number(),
    }),
  }),
  
  // 重试配置
  retry: {
    maxRetries: 3,
    backoffMs: 1000,
    exponential: true,
  },
  
  // 超时
  timeoutMs: 60000, // 1 分钟
  
  // 执行函数
  execute: async (context) => {
    const { data, options } = context.input
    
    // 处理数据
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

### 智能体步骤

将智能体包装为工作流步骤:

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

### 数据转换步骤

```typescript
const transformStep = createStep({
  name: 'transform',
  execute: async (context) => {
    // 访问前一步骤的结果
    const rawData = context.extract.data
    
    // 转换
    const transformed = rawData.map(item => ({
      id: item.id,
      value: parseFloat(item.value),
      timestamp: new Date(item.timestamp),
    }))
    
    // 过滤
    const filtered = transformed.filter(item => 
      item.value > 0 && !isNaN(item.value)
    )
    
    // 聚合
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

## 条件分支

### 简单条件

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

### 多路分支

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

### 动态分支

```typescript
const dynamicWorkflow = createWorkflow({
  name: 'dynamic-branches',
  steps: [analyze, ...processingSteps, merge],
  edges: (context) => {
    const edges = []
    
    // 分析确定采取哪些路径
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

## 并行执行

### 分支-汇聚模式

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
    // 分支: init → A, B, C
    { from: 'init', to: 'processA' },
    { from: 'init', to: 'processB' },
    { from: 'init', to: 'processC' },
    
    // 汇聚: A, B, C → merge
    { from: 'processA', to: 'merge' },
    { from: 'processB', to: 'merge' },
    { from: 'processC', to: 'merge' },
  ],
})

const mergeStep = createStep({
  name: 'merge',
  execute: async (context) => {
    // 访问所有并行结果
    const resultsA = context.processA
    const resultsB = context.processB
    const resultsC = context.processC
    
    return {
      combined: [resultsA, resultsB, resultsC],
    }
  },
})
```

### Map-Reduce 模式

```typescript
const mapReduceWorkflow = createWorkflow({
  name: 'map-reduce',
  steps: [split, ...mapSteps, reduce],
  
  edges: (context) => {
    const edges = []
    
    // Split 创建 N 个块
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
    // 收集所有 map 结果
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

## 循环和迭代

### While 循环

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
  maxIterations: 10, // 防止无限循环
})
```

### For Each 循环

```typescript
const foreachWorkflow = createWorkflow({
  name: 'process-items',
  steps: [initialize, processItem, accumulate],
  
  edges: (context) => {
    const edges = [
      { from: 'initialize', to: 'processItem' },
    ]
    
    // 循环直到所有项目处理完毕
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

## 错误处理

### 步骤级重试

```typescript
const resilientStep = createStep({
  name: 'resilient',
  
  retry: {
    maxRetries: 3,
    backoffMs: 1000,
    exponential: true, // 1s, 2s, 4s
    retryOn: (error) => {
      // 仅对特定错误重试
      return error.code === 'ETIMEDOUT' || error.code === 'ECONNRESET'
    },
  },
  
  execute: async (context) => {
    // 失败时会自动重试
    return await unreliableAPI.call()
  },
})
```

### 回退步骤

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
      onError: true, // 错误时执行
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
      // 标记为回退
      throw error
    }
  },
})

const fallbackStep = createStep({
  name: 'fallback',
  execute: async (context) => {
    // 使用缓存/近似数据
    console.warn('Using fallback due to error:', context.primary.error)
    return await getCachedResults()
  },
})
```

### 错误恢复

```typescript
const errorHandler = createStep({
  name: 'errorHandler',
  execute: async (context) => {
    const error = context.previousStep.error
    
    if (error.code === 'RATE_LIMIT') {
      // 等待并重试
      await delay(60000)
      return { action: 'retry' }
    }
    
    if (error.code === 'NOT_FOUND') {
      // 优雅地跳过
      return { action: 'skip', reason: 'Resource not found' }
    }
    
    // 致命错误
    throw new Error(`Unrecoverable error: ${error.message}`)
  },
})
```

---

## 人机协同

### 审批步骤

```typescript
const approvalStep = createStep({
  name: 'approval',
  requiresHumanInput: true,
  
  execute: async (context) => {
    const { proposal } = context.generate
    
    // 暂停工作流并请求人工输入
    const approval = await context.requestHumanInput({
      type: 'approval',
      message: 'Please review and approve the proposal',
      data: proposal,
      options: ['approve', 'reject', 'revise'],
    })
    
    return { approved: approval.decision === 'approve' }
  },
})

// 使用人工输入处理程序运行工作流
const result = await workflow.run(
  { input: 'data' },
  {
    onHumanInputRequired: async (request) => {
      // 通过 UI 呈现给人工
      console.log('Human input required:', request.message)
      console.log('Data:', request.data)
      
      // 等待人工响应
      const decision = await promptHuman(request.options)
      
      return { decision }
    },
  }
)
```

### 审查步骤

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

## 监控和可观测性

### 工作流事件

```typescript
const workflow = createWorkflow({
  name: 'monitored-workflow',
  steps: [stepA, stepB, stepC],
  edges: [
    { from: 'stepA', to: 'stepB' },
    { from: 'stepB', to: 'stepC' },
  ],
  
  // 生命周期钩子
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

### 执行追踪

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

## 高级模式

### Saga 模式

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
    
    // 错误时的补偿
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

### 管道模式

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

// 每个步骤处理并向前传递数据
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

## 最佳实践检查清单

### 设计
- [ ] 步骤具有单一、明确的职责
- [ ] 工作流是 DAG(除明确循环外无环)
- [ ] 并行步骤无依赖关系
- [ ] 适当级别的错误处理

### 性能
- [ ] 尽可能最大化并行化
- [ ] 步骤有适当的超时
- [ ] 昂贵操作被缓存
- [ ] 进度被跟踪和记录

### 可靠性
- [ ] 瞬时故障的重试策略
- [ ] 关键故障的回退路径
- [ ] 尽可能幂等的步骤
- [ ] 长时间运行工作流的状态持久化

### 可观测性
- [ ] 捕获执行追踪
- [ ] 为关键事件发出指标
- [ ] 带上下文记录错误
- [ ] 用户可见的进度

---

## 下一步

- **[构建智能体](./building-agents.md)** - 在工作流中使用智能体
- **[错误处理](./error-handling.md)** - 高级错误模式
- **[性能](./performance.md)** - 优化工作流执行

---

## 其他资源

- **[核心概念: 工作流](/docs/core-concepts/workflows.md)** - 详细文档
- **[API 参考](/docs/api/agent.md#workflows)** - 完整 API
- **[示例](/examples/workflow/)** - 代码示例
