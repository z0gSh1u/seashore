# Workflows

**Workflows** 使您能够使用**有向无环图 (DAGs)** 编排复杂的多步骤流程。它们提供并行执行、依赖管理、条件逻辑和人在环路中的能力。

## 概览

Workflows 解决了协调多个相互依赖任务的问题:

- **并行执行** - 同时运行独立的步骤
- **依赖管理** - 确保步骤以正确的顺序运行
- **数据传递** - 在步骤之间共享结果
- **错误处理** - 使用回退重试失败的步骤
- **人工审批** - 在需要人工输入时暂停
- **条件逻辑** - 根据运行时条件跳过步骤

```
传统顺序:                工作流 DAG (并行):
┌─────────┐            ┌─────────┐
│ Step 1  │            │ Step 1  │
└────┬────┘            └─┬─────┬─┘
     │                   │     │
┌────▼────┐         ┌───▼──┐ ┌▼────┐
│ Step 2  │         │Step 2│ │Step3│  ← 并行
└────┬────┘         └───┬──┘ └┬────┘
     │                   │     │
┌────▼────┐             └─┬─┬─┘
│ Step 3  │               │ │
└────┬────┘           ┌───▼─▼──┐
     │                │ Step 4 │  ← 合并
┌────▼────┐           └────────┘
│ Step 4  │
└─────────┘

时间: 4 units         时间: 3 units (快 33%!)
```

---

## 核心概念

### 有向无环图 (DAG)

**DAG** 是一个图,其中:
- **有向** - 边有方向 (从 → 到)
- **无环** - 没有循环依赖
- **图** - 由边(依赖)连接的节点(步骤)

```typescript
// 这是有效的 (DAG)
A → B → D
A → C → D

// 这是无效的 (循环)
A → B → C → A
```

### 步骤

**Steps** 是工作流中的单个工作单元。

```typescript
interface StepConfig<TInput, TOutput> {
  name: string
  execute: (input: TInput, ctx: WorkflowContext) => Promise<TOutput>
  outputSchema?: z.ZodSchema<TOutput>
  retryPolicy?: RetryPolicy
}
```

### 边

**Edges** 定义依赖关系和控制流。

```typescript
interface StepEdgeConfig {
  after?: string | string[]              // 依赖步骤
  when?: (ctx: WorkflowContext) => boolean  // 条件执行
  type?: 'normal' | 'human'              // 人在环路中
  prompt?: (ctx: WorkflowContext) => string // 人工提示
  timeout?: number                       // 超时(ms)
}
```

### 工作流上下文

**Context** 在步骤之间携带状态和共享数据。

```typescript
interface WorkflowContext {
  state: Map<string, unknown>  // 共享状态
  abortSignal: AbortSignal     // 取消信号
}
```

---

## 创建工作流

### 基础工作流

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
    after: 'fetch'  // 在 'fetch' 完成后运行
  })

const result = await workflow.execute()
console.log(result.state.get('process'))
```

### 步骤定义

**createStep** 定义工作流步骤:

```typescript
const step = createStep({
  name: 'transform_data',
  execute: async (input, ctx) => {
    // 从上下文访问前一步结果
    const rawData = ctx.state.get('fetch_data')
    
    // 转换数据
    const transformed = rawData.map(item => ({
      id: item.id,
      value: item.value * 2
    }))
    
    // 返回结果(自动存储在上下文中)
    return transformed
  }
})
```

**使用输出 schema 验证:**

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

**使用重试策略:**

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

## 依赖管理

### 线性依赖

步骤顺序运行:

```typescript
const workflow = createWorkflow({ name: 'linear' })
  .step(createStep({ name: 'step1', execute: async () => 1 }))
  .step(createStep({ name: 'step2', execute: async () => 2 }), { after: 'step1' })
  .step(createStep({ name: 'step3', execute: async () => 3 }), { after: 'step2' })

// 执行顺序: step1 → step2 → step3
```

### 并行执行

没有依赖关系的步骤并行运行:

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

// 执行:
// 1. source
// 2. analyze 和 transform (并行)
// 3. merge (两者都完成后)
```

### 菱形模式

经典的 fork-join 模式:

```typescript
/*
      ┌───────┐
      │source │
      └───┬───┘
      ┌───┴───┐
  ┌───▼───┐ ┌─▼────┐
  │branch1│ │branch2│  ← 并行
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

### 多个依赖

步骤在所有依赖完成后运行:

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

// 执行:
// 1. fetch_users, fetch_posts, fetch_comments (全部并行)
// 2. build_report (所有 3 个完成后)
```

---

## 数据传递

### 上下文状态

步骤通过共享上下文进行通信:

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
      // 从上下文读取
      const produced = ctx.state.get('producer')
      console.log(produced.value)  // 42
      
      return { doubled: produced.value * 2 }
    }
  }), { after: 'producer' })

const result = await workflow.execute()

// 访问最终状态
console.log(result.state.get('consumer'))  // { doubled: 84 }
```

### 初始状态

提供起始数据:

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

### 类型安全的状态访问

```typescript
// 定义状态 schema
interface WorkflowState {
  fetchData: { items: string[] }
  processData: { count: number }
}

// 类型安全访问辅助函数
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
    console.log(data.items.length)  // 类型安全!
  }
})
```

---

## 条件执行

### 条件步骤

根据运行时条件跳过步骤:

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

### 异步条件

条件可以是异步的:

```typescript
.step(createStep({ name: 'expensive_step', execute: doWork }), {
  when: async (ctx) => {
    const credits = await checkUserCredits()
    return credits > 100
  }
})
```

---

## 错误处理

### 重试策略

自动重试失败的步骤:

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

// 重试计划:
// 尝试 1: 立即
// 尝试 2: 1000ms 后
// 尝试 3: 2000ms 后
// 尝试 4: 4000ms 后
```

### 工作流错误处理

```typescript
const result = await workflow.execute()

if (result.status === 'failed') {
  console.error('Workflow failed:', result.error)
  console.log('Completed steps:', Array.from(result.state.keys()))
} else {
  console.log('Success!')
}
```

### 步骤级错误处理

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

## 人在环路中

### 人工审批步骤

暂停工作流等待人工审批:

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
      // 此步骤将暂停并等待人工输入
      return 'pending'
    }
  }), {
    after: 'prepare_data',
    type: 'human',
    prompt: (ctx) => {
      const data = ctx.state.get('prepare_data')
      return `Approve payment of $${data.amount} to ${data.recipient}?`
    },
    timeout: 3600000  // 1 小时
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

// 启动工作流(将在审批步骤暂停)
const result = await workflow.execute()

if (result.status === 'pending') {
  console.log('Waiting for approval:', result.pendingStep)
}
```

### 审批后恢复

```typescript
// 人工输入后恢复工作流
const resumeResult = await workflow.resume({
  approved: true,
  comment: 'Approved by manager'
})
```

---

## 工作流执行

### Execute 方法

```typescript
interface ExecuteOptions {
  initialState?: Map<string, unknown>
  abortSignal?: AbortSignal
}

const result = await workflow.execute(options)
```

### 工作流结果

```typescript
interface WorkflowResult {
  status: 'idle' | 'running' | 'pending' | 'completed' | 'failed'
  state: Map<string, unknown>
  error?: Error
}
```

**状态含义:**
- `idle` - 未启动
- `running` - 当前正在执行
- `pending` - 等待人工输入
- `completed` - 成功完成
- `failed` - 遇到错误

### 取消

```typescript
const controller = new AbortController()

const promise = workflow.execute({
  abortSignal: controller.signal
})

// 10 秒后取消
setTimeout(() => controller.abort(), 10000)

const result = await promise
console.log(result.status)  // 'failed'
console.log(result.error.message)  // 'Aborted'
```

---

## 相关概念

- **[Agents](./agents.md)** - 在工作流步骤中使用 agents
- **[Architecture](./architecture.md)** - 理解 DAG 实现
- **[Deployment](../deployment/)** - 生产工作流模式

---

## 下一步

- **[构建你的第一个工作流](../getting-started/first-workflow.md)**
- **[工作流示例](../../examples/workflow/)**
- **[高级编排](../guides/advanced-workflows.md)**
