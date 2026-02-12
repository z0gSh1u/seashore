# Tools

**Tools** 赋予 agents 与外部世界交互的能力。它们是 agents 可以调用的函数,用于收集信息、执行操作或访问服务。

## 概览

Tools 是 **AI 推理**和**真实世界操作**之间的桥梁:

```
┌─────────────┐
│  LLM Agent  │ ──┐
└─────────────┘   │
                  │ "I need to search for X"
                  │
                  ▼
         ┌────────────────┐
         │   Tool Layer   │
         │ (Type-checked, │
         │  validated)    │
         └────────┬───────┘
                  │
     ┌────────────┼────────────┐
     │            │            │
     ▼            ▼            ▼
┌─────────┐  ┌────────┐  ┌─────────┐
│Search API│ │Database│  │File I/O │
└─────────┘  └────────┘  └─────────┘
```

**关键能力:**
- **类型安全** - Zod schemas 验证输入/输出
- **可组合** - 将工具组合成工具包
- **异步** - 原生 async/await 支持
- **错误处理** - 带错误消息的优雅失败
- **可观察** - 跟踪工具调用和结果

---

## 工具接口

### 基本结构

```typescript
interface Tool {
  name: string                          // 唯一标识符
  description: string                   // 工具的功能
  parameters: z.ZodType<any>           // 输入 schema
  execute: (args: any) => Promise<any>  // 实现
}
```

### TanStack AI 集成

Seashore 工具使用 TanStack AI 的 `toolDefinition`:

```typescript
import { toolDefinition } from '@tanstack/ai'
import { z } from 'zod'

const searchTool = toolDefinition({
  name: 'web_search',
  description: 'Search the web for information',
  inputSchema: z.object({
    query: z.string().describe('Search query'),
    numResults: z.number().optional().default(10),
  }),
  outputSchema: z.object({
    results: z.array(z.object({
      title: z.string(),
      url: z.string(),
      snippet: z.string(),
    })),
  }),
}).server(async (input) => {
  // 实现
  const results = await searchAPI(input.query)
  return { results }
})
```

---

## 创建工具

### 简单工具

```typescript
import { toolDefinition } from '@tanstack/ai'
import { z } from 'zod'

const calculatorTool = toolDefinition({
  name: 'calculator',
  description: 'Perform basic arithmetic operations',
  inputSchema: z.object({
    operation: z.enum(['add', 'subtract', 'multiply', 'divide']),
    a: z.number(),
    b: z.number(),
  }),
  outputSchema: z.number(),
}).server(async ({ operation, a, b }) => {
  switch (operation) {
    case 'add': return a + b
    case 'subtract': return a - b
    case 'multiply': return a * b
    case 'divide':
      if (b === 0) throw new Error('Division by zero')
      return a / b
  }
})
```

### 使用外部 API 的工具

```typescript
const weatherTool = toolDefinition({
  name: 'get_weather',
  description: 'Get current weather for a location',
  inputSchema: z.object({
    location: z.string().describe('City name or zip code'),
    units: z.enum(['celsius', 'fahrenheit']).default('celsius'),
  }),
  outputSchema: z.object({
    temperature: z.number(),
    condition: z.string(),
    humidity: z.number(),
  }),
}).server(async ({ location, units }) => {
  const response = await fetch(
    `https://api.weather.com/v1/current?location=${location}&units=${units}`,
    {
      headers: {
        'Authorization': `Bearer ${process.env.WEATHER_API_KEY}`
      }
    }
  )

  if (!response.ok) {
    throw new Error(`Weather API error: ${response.statusText}`)
  }

  const data = await response.json()
  
  return {
    temperature: data.temp,
    condition: data.conditions,
    humidity: data.humidity,
  }
})
```

### 使用数据库访问的工具

```typescript
const getUserTool = toolDefinition({
  name: 'get_user',
  description: 'Fetch user information from database',
  inputSchema: z.object({
    userId: z.string().uuid(),
  }),
  outputSchema: z.object({
    id: z.string(),
    name: z.string(),
    email: z.string().email(),
    createdAt: z.string(),
  }),
}).server(async ({ userId }) => {
  const user = await db.user.findUnique({
    where: { id: userId }
  })

  if (!user) {
    throw new Error(`User ${userId} not found`)
  }

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    createdAt: user.createdAt.toISOString(),
  }
})
```

---

## 参数 Schemas

### 基本类型

```typescript
z.object({
  string: z.string(),
  number: z.number(),
  boolean: z.boolean(),
  array: z.array(z.string()),
  object: z.object({ key: z.string() }),
})
```

### 可选参数

```typescript
z.object({
  required: z.string(),
  optional: z.string().optional(),
  withDefault: z.number().default(10),
})

// 有效输入:
// { required: "hello" }
// { required: "hello", optional: "world" }
// { required: "hello", withDefault: 20 }
```

### 枚举

```typescript
z.object({
  type: z.enum(['search', 'news', 'images']),
  color: z.union([
    z.literal('red'),
    z.literal('blue'),
    z.literal('green')
  ]),
})
```

### 嵌套对象

```typescript
z.object({
  user: z.object({
    name: z.string(),
    age: z.number(),
    address: z.object({
      street: z.string(),
      city: z.string(),
      zip: z.string(),
    }),
  }),
})
```

### 数组

```typescript
z.object({
  simpleArray: z.array(z.string()),
  objectArray: z.array(z.object({
    id: z.string(),
    value: z.number(),
  })),
  minMaxArray: z.array(z.string()).min(1).max(10),
})
```

### 精化

```typescript
z.object({
  email: z.string().email(),
  url: z.string().url(),
  uuid: z.string().uuid(),
  positiveNumber: z.number().positive(),
  minMax: z.number().min(0).max(100),
  customValidation: z.string().refine(
    (val) => val.startsWith('prefix_'),
    { message: 'Must start with prefix_' }
  ),
})
```

### 描述

帮助 LLMs 理解参数:

```typescript
z.object({
  query: z.string().describe('The search query to execute'),
  maxResults: z.number()
    .min(1)
    .max(100)
    .default(10)
    .describe('Maximum number of results to return (1-100)'),
  sortBy: z.enum(['relevance', 'date', 'popularity'])
    .default('relevance')
    .describe('How to sort the results'),
})
```

---

## 最佳实践

### 1. 清晰的工具名称

```typescript
// ❌ 不好: 模糊的名称
name: 'search'

// ✅ 好: 具体的名称
name: 'web_search'
name: 'search_company_documents'
name: 'search_user_database'
```

### 2. 描述性的描述

```typescript
// ❌ 不好: 最小化描述
description: 'Search'

// ✅ 好: 清晰的上下文描述
description: 'Search the company knowledge base for articles, policies, and FAQs. Returns the top 10 most relevant documents.'
```

### 3. 记录参数

```typescript
// ✅ 好: 良好记录的参数
inputSchema: z.object({
  query: z.string()
    .min(3)
    .describe('Search query (minimum 3 characters)'),
  maxResults: z.number()
    .min(1)
    .max(50)
    .default(10)
    .describe('Maximum number of results to return (1-50, default: 10)'),
  category: z.enum(['all', 'docs', 'code', 'issues'])
    .default('all')
    .describe('Filter results by category'),
})
```

---

## 相关概念

- **[Agents](./agents.md)** - 在 ReAct agents 中使用工具
- **[Workflows](./workflows.md)** - 工作流步骤中的工具
- **[MCP Integration](../guides/mcp.md)** - Model Context Protocol 工具

---

## 下一步

- **[创建你的第一个工具](../getting-started/first-tool.md)**
- **[工具示例](../../examples/tools/)**
- **[MCP 工具集成](../guides/mcp.md)**
