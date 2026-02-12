# 工具开发

学习如何创建健壮的、生产就绪的工具,包括正确的设计原则、验证、错误处理、异步模式和测试策略。

## 概述

工具是智能体的双手——它们使智能体能够与外部系统、数据库、API 和服务交互。设计良好的工具使智能体可靠且有效。

**你将学到:**
- 工具设计原则
- 参数模式设计
- 验证和类型安全
- 错误处理模式
- 异步和性能优化
- 测试策略
- 常见陷阱

---

## 工具结构

### 基本结构

每个工具都有四个基本组件:

```typescript
import { toolDefinition } from '@tanstack/ai'
import { z } from 'zod'

const myTool = toolDefinition({
  // 1. 唯一标识符
  name: 'tool_name',
  
  // 2. 清晰的描述(LLM 会读取这个)
  description: 'What this tool does and when to use it',
  
  // 3. 输入模式(Zod 验证)
  inputSchema: z.object({
    param1: z.string(),
    param2: z.number().optional(),
  }),
  
  // 4. 输出模式
  outputSchema: z.object({
    result: z.string(),
  }),
}).server(async (input) => {
  // 5. 实现
  return { result: 'processed' }
})
```

### Seashore 集成

Seashore 使用 TanStack AI 的工具系统:

```typescript
import { createReActAgent } from '@seashore/agent'

const agent = createReActAgent({
  model: () => llm('gpt-4o'),
  systemPrompt: 'You are helpful',
  tools: [myTool], // 直接传递工具
})
```

---

## 设计原则

### 1. 单一职责

每个工具应该只做好一件事:

```typescript
// ❌ 不好: 万能工具
const userTool = toolDefinition({
  name: 'user_operations',
  description: 'Manage users',
  inputSchema: z.object({
    action: z.enum(['create', 'delete', 'update', 'list', 'search']),
    data: z.any(), // 太模糊!
  }),
  outputSchema: z.any(),
}).server(async ({ action, data }) => {
  // 单体实现
})

// ✅ 好: 专注的工具
const createUserTool = toolDefinition({
  name: 'create_user',
  description: 'Create a new user account',
  inputSchema: z.object({
    email: z.string().email(),
    name: z.string().min(1),
    role: z.enum(['user', 'admin']),
  }),
  outputSchema: z.object({
    userId: z.string().uuid(),
    message: z.string(),
  }),
}).server(async ({ email, name, role }) => {
  const user = await db.user.create({ data: { email, name, role } })
  return { userId: user.id, message: 'User created successfully' }
})

const deleteUserTool = toolDefinition({
  name: 'delete_user',
  description: 'Delete a user account by ID',
  inputSchema: z.object({
    userId: z.string().uuid(),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string(),
  }),
}).server(async ({ userId }) => {
  await db.user.delete({ where: { id: userId } })
  return { success: true, message: 'User deleted successfully' }
})
```

### 2. 清晰的命名

名称应该是自我说明的:

```typescript
// ❌ 不好: 模糊
'search'          // 搜索什么?
'get'             // 获取什么?
'process'         // 处理什么?

// ✅ 好: 具体
'search_products'
'search_orders'
'search_knowledge_base'

'get_user_profile'
'get_order_details'
'get_product_inventory'

'process_payment'
'process_refund'
'process_shipment'
```

### 3. 描述性文档

帮助 LLM 理解何时以及如何使用工具:

```typescript
const searchProductsTool = toolDefinition({
  name: 'search_products',
  
  // ❌ 不好: 最小化描述
  // description: 'Search products',
  
  // ✅ 好: 全面的描述
  description: `Search the product catalog by name, SKU, or category.
  
Returns up to 20 matching products with details including:
- Product name and description
- Price and availability
- SKU and category
- Image URL

Use this when:
- Customer asks about product availability
- Need to find products by name or category
- Looking up products by SKU

Do NOT use for:
- Order history (use search_orders instead)
- Customer information (use get_customer instead)`,
  
  inputSchema: z.object({
    query: z.string()
      .min(2)
      .describe('Search query: product name, SKU, or category'),
    maxResults: z.number()
      .min(1)
      .max(20)
      .default(10)
      .describe('Maximum results to return (default: 10)'),
  }),
  
  outputSchema: z.object({
    products: z.array(z.object({
      id: z.string(),
      name: z.string(),
      price: z.number(),
      inStock: z.boolean(),
    })),
    totalCount: z.number(),
  }),
}).server(async ({ query, maxResults }) => {
  // 实现
  return { products: [], totalCount: 0 }
})
```

### 4. 可预测的行为

工具应该行为一致:

```typescript
// ✅ 好: 可预测、幂等
const getUserTool = toolDefinition({
  name: 'get_user',
  description: 'Fetch user information by ID (read-only)',
  inputSchema: z.object({
    userId: z.string().uuid(),
  }),
  outputSchema: z.object({
    id: z.string(),
    name: z.string(),
    email: z.string(),
  }),
}).server(async ({ userId }) => {
  const user = await db.user.findUnique({ where: { id: userId } })
  if (!user) throw new Error(`User ${userId} not found`)
  return user
})

// ⚠️ 警告: 副作用应该在名称中明确
const sendEmailTool = toolDefinition({
  name: 'send_confirmation_email', // 明确: 这会执行某个操作
  description: 'Send order confirmation email to customer',
  inputSchema: z.object({
    orderId: z.string(),
    email: z.string().email(),
  }),
  outputSchema: z.object({
    sent: z.boolean(),
    messageId: z.string(),
  }),
}).server(async ({ orderId, email }) => {
  const result = await emailService.send({
    to: email,
    subject: 'Order Confirmation',
    body: generateConfirmationEmail(orderId),
  })
  return { sent: true, messageId: result.id }
})
```

---

## 参数设计

### 模式最佳实践

```typescript
const exemplaryTool = toolDefinition({
  name: 'search_knowledge_base',
  description: 'Search company knowledge base',
  inputSchema: z.object({
    // 带验证的必需字符串
    query: z.string()
      .min(3, 'Query must be at least 3 characters')
      .max(200, 'Query too long')
      .describe('Search query'),
    
    // 带默认值的可选参数
    maxResults: z.number()
      .int()
      .min(1)
      .max(50)
      .default(10)
      .describe('Maximum results (1-50, default: 10)'),
    
    // 有限选择的枚举
    category: z.enum(['policies', 'procedures', 'faqs', 'guides'])
      .optional()
      .describe('Filter by content category'),
    
    // 带默认值的布尔值
    includeArchived: z.boolean()
      .default(false)
      .describe('Include archived articles'),
    
    // 嵌套对象
    filters: z.object({
      dateRange: z.object({
        start: z.string().datetime(),
        end: z.string().datetime(),
      }).optional(),
      tags: z.array(z.string()).optional(),
    }).optional()
      .describe('Advanced filters'),
    
    // 自定义验证
    sortBy: z.enum(['relevance', 'date', 'popularity'])
      .default('relevance')
      .describe('Sort order'),
  }).refine(
    (data) => {
      // 跨字段验证
      if (data.filters?.dateRange) {
        return new Date(data.filters.dateRange.start) <= new Date(data.filters.dateRange.end)
      }
      return true
    },
    { message: 'Start date must be before end date' }
  ),
  
  outputSchema: z.object({
    articles: z.array(z.object({
      id: z.string(),
      title: z.string(),
      snippet: z.string(),
      url: z.string().url(),
      relevance: z.number().min(0).max(1),
      lastUpdated: z.string().datetime(),
    })),
    totalResults: z.number(),
    hasMore: z.boolean(),
  }),
}).server(async (input) => {
  // 类型安全的实现
  return {
    articles: [],
    totalResults: 0,
    hasMore: false,
  }
})
```

### 常见模式

**文件路径:**
```typescript
filePath: z.string()
  .regex(/^[a-zA-Z0-9\/._-]+$/, 'Invalid file path')
  .refine((path) => !path.includes('..'), 'Path traversal not allowed')
```

**URLs:**
```typescript
url: z.string()
  .url('Invalid URL')
  .refine((url) => {
    const parsed = new URL(url)
    return ['http:', 'https:'].includes(parsed.protocol)
  }, 'Only HTTP/HTTPS URLs allowed')
```

**日期:**
```typescript
date: z.string()
  .datetime()
  .describe('ISO 8601 datetime string')

// 或带解析
date: z.string()
  .refine((val) => !isNaN(Date.parse(val)), 'Invalid date')
  .transform((val) => new Date(val))
```

**数组:**
```typescript
items: z.array(z.string())
  .min(1, 'At least one item required')
  .max(100, 'Too many items')
  .describe('List of items to process')
```

---

## 错误处理

### 模式 1: 抛出错误

最适合不可恢复的错误:

```typescript
const strictTool = toolDefinition({
  name: 'get_user',
  description: 'Get user by ID',
  inputSchema: z.object({ userId: z.string().uuid() }),
  outputSchema: z.object({
    id: z.string(),
    name: z.string(),
  }),
}).server(async ({ userId }) => {
  const user = await db.user.findUnique({ where: { id: userId } })
  
  if (!user) {
    throw new Error(`User ${userId} not found. Verify the ID and try again.`)
  }
  
  return user
})
```

### 模式 2: 返回错误状态

最适合可恢复或预期的错误:

```typescript
const flexibleTool = toolDefinition({
  name: 'search_user',
  description: 'Search for users',
  inputSchema: z.object({ query: z.string() }),
  outputSchema: z.object({
    success: z.boolean(),
    users: z.array(z.object({
      id: z.string(),
      name: z.string(),
    })).optional(),
    error: z.string().optional(),
    suggestions: z.array(z.string()).optional(),
  }),
}).server(async ({ query }) => {
  try {
    const users = await db.user.findMany({
      where: { name: { contains: query } }
    })
    
    if (users.length === 0) {
      return {
        success: true,
        users: [],
        error: 'No users found',
        suggestions: [
          'Try a different search term',
          'Check spelling',
          'Use partial name',
        ],
      }
    }
    
    return {
      success: true,
      users,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Search failed',
    }
  }
})
```

### 模式 3: 重试逻辑

```typescript
async function withRetry<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number
    baseDelay?: number
    maxDelay?: number
    onRetry?: (error: Error, attempt: number) => void
  } = {}
): Promise<T> {
  const {
    maxRetries = 3,
    baseDelay = 1000,
    maxDelay = 10000,
    onRetry,
  } = options
  
  let lastError: Error
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      
      if (attempt < maxRetries) {
        const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay)
        onRetry?.(lastError, attempt + 1)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
  }
  
  throw lastError!
}

const resilientTool = toolDefinition({
  name: 'fetch_external_data',
  description: 'Fetch data from external API with automatic retries',
  inputSchema: z.object({ endpoint: z.string() }),
  outputSchema: z.object({ data: z.any() }),
}).server(async ({ endpoint }) => {
  const data = await withRetry(
    () => fetch(`https://api.example.com/${endpoint}`).then(r => r.json()),
    {
      maxRetries: 3,
      baseDelay: 1000,
      onRetry: (error, attempt) => {
        console.warn(`Retry attempt ${attempt} after error:`, error.message)
      },
    }
  )
  
  return { data }
})
```

### 模式 4: 超时保护

```typescript
async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  errorMessage = 'Operation timed out'
): Promise<T> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(errorMessage)), timeoutMs)
  )
  
  return Promise.race([promise, timeout])
}

const timeoutTool = toolDefinition({
  name: 'slow_operation',
  description: 'Operation with timeout protection',
  inputSchema: z.object({ taskId: z.string() }),
  outputSchema: z.object({ result: z.string() }),
}).server(async ({ taskId }) => {
  try {
    const result = await withTimeout(
      performSlowOperation(taskId),
      30000, // 30 秒超时
      'Operation exceeded 30 second limit'
    )
    
    return { result }
  } catch (error) {
    if (error instanceof Error && error.message.includes('timeout')) {
      return {
        result: 'Operation timed out. Task queued for background processing.',
      }
    }
    throw error
  }
})
```

---

## 异步模式

### 并行执行

```typescript
const batchTool = toolDefinition({
  name: 'fetch_multiple_products',
  description: 'Fetch details for multiple products',
  inputSchema: z.object({
    productIds: z.array(z.string()).min(1).max(20),
  }),
  outputSchema: z.object({
    products: z.array(z.object({
      id: z.string(),
      name: z.string(),
      price: z.number(),
    })),
  }),
}).server(async ({ productIds }) => {
  // ❌ 不好: 顺序执行(慢)
  // const products = []
  // for (const id of productIds) {
  //   products.push(await fetchProduct(id))
  // }
  
  // ✅ 好: 并行执行(快)
  const products = await Promise.all(
    productIds.map(id => fetchProduct(id))
  )
  
  return { products }
})
```

### 速率限制

```typescript
import pLimit from 'p-limit'

const limiter = pLimit(5) // 最多 5 个并发操作

const rateLimitedTool = toolDefinition({
  name: 'search_multiple_sources',
  description: 'Search multiple sources with rate limiting',
  inputSchema: z.object({
    queries: z.array(z.string()).min(1).max(50),
  }),
  outputSchema: z.object({
    results: z.array(z.any()),
  }),
}).server(async ({ queries }) => {
  // 最多 5 个并发请求执行
  const results = await Promise.all(
    queries.map(query =>
      limiter(() => searchAPI(query))
    )
  )
  
  return { results }
})
```

### 流式结果

```typescript
const streamingTool = toolDefinition({
  name: 'process_large_dataset',
  description: 'Process large dataset in chunks',
  inputSchema: z.object({
    datasetId: z.string(),
  }),
  outputSchema: z.object({
    summary: z.string(),
    processedCount: z.number(),
  }),
}).server(async ({ datasetId }) => {
  let processedCount = 0
  const summaries: string[] = []
  
  // 流式处理块
  for await (const chunk of streamDataset(datasetId)) {
    const result = await processChunk(chunk)
    summaries.push(result.summary)
    processedCount += chunk.length
  }
  
  return {
    summary: summaries.join('\n'),
    processedCount,
  }
})
```

---

## 性能优化

### 缓存

```typescript
import { LRUCache } from 'lru-cache'

const cache = new LRUCache<string, any>({
  max: 500, // 最多 500 个项目
  ttl: 1000 * 60 * 5, // 5 分钟 TTL
})

const cachedTool = toolDefinition({
  name: 'fetch_cached_data',
  description: 'Fetch data with caching',
  inputSchema: z.object({ key: z.string() }),
  outputSchema: z.object({ data: z.any() }),
}).server(async ({ key }) => {
  // 检查缓存
  const cached = cache.get(key)
  if (cached) {
    console.log('Cache hit:', key)
    return { data: cached }
  }
  
  // 获取并缓存
  console.log('Cache miss:', key)
  const data = await fetchExpensiveData(key)
  cache.set(key, data)
  
  return { data }
})
```

### 连接池

```typescript
import { Pool } from 'pg'

const pool = new Pool({
  max: 20, // 最多 20 个连接
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
})

const dbTool = toolDefinition({
  name: 'query_database',
  description: 'Query database with connection pooling',
  inputSchema: z.object({
    query: z.string(),
    params: z.array(z.any()).optional(),
  }),
  outputSchema: z.object({ rows: z.array(z.any()) }),
}).server(async ({ query, params }) => {
  const client = await pool.connect()
  
  try {
    const result = await client.query(query, params)
    return { rows: result.rows }
  } finally {
    client.release() // 返回到池
  }
})
```

### 延迟初始化

```typescript
let expensiveResourcePromise: Promise<ExpensiveResource> | null = null

async function getExpensiveResource(): Promise<ExpensiveResource> {
  if (!expensiveResourcePromise) {
    console.log('Initializing expensive resource...')
    expensiveResourcePromise = initializeExpensiveResource()
  }
  return expensiveResourcePromise
}

const lazyTool = toolDefinition({
  name: 'use_expensive_resource',
  description: 'Use resource initialized on first use',
  inputSchema: z.object({ input: z.string() }),
  outputSchema: z.object({ output: z.string() }),
}).server(async ({ input }) => {
  const resource = await getExpensiveResource()
  const output = await resource.process(input)
  return { output }
})
```

---

## 测试

### 单元测试

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

describe('searchProductsTool', () => {
  beforeEach(() => {
    // 设置
  })
  
  afterEach(() => {
    // 清理
    vi.restoreAllMocks()
  })
  
  it('should return products matching query', async () => {
    const result = await searchProductsTool.execute({
      query: 'laptop',
      maxResults: 5,
    })
    
    expect(result.products).toHaveLength(5)
    expect(result.products[0]).toHaveProperty('name')
    expect(result.products[0]).toHaveProperty('price')
  })
  
  it('should handle empty results', async () => {
    const result = await searchProductsTool.execute({
      query: 'nonexistent-product-xyz',
      maxResults: 10,
    })
    
    expect(result.products).toHaveLength(0)
    expect(result.totalCount).toBe(0)
  })
  
  it('should validate input schema', async () => {
    await expect(
      searchProductsTool.execute({
        query: 'a', // 太短(最少 2 个字符)
        maxResults: 10,
      })
    ).rejects.toThrow('at least 2 characters')
  })
  
  it('should handle API errors gracefully', async () => {
    // 模拟 API 失败
    vi.spyOn(global, 'fetch').mockRejectedValue(new Error('API error'))
    
    await expect(
      searchProductsTool.execute({
        query: 'laptop',
        maxResults: 10,
      })
    ).rejects.toThrow('API error')
  })
})
```

### 集成测试

```typescript
describe('tool integration', () => {
  it('should work with agent', async () => {
    const agent = createReActAgent({
      model: () => llm('gpt-4o-mini'),
      systemPrompt: 'Use tools to answer questions',
      tools: [searchProductsTool],
      maxIterations: 5,
    })
    
    const response = await agent.run([
      { role: 'user', content: 'Find laptops under $1000' }
    ])
    
    expect(response.result.toolCalls.length).toBeGreaterThan(0)
    expect(response.result.toolCalls[0].name).toBe('search_products')
    expect(response.result.content).toContain('laptop')
  })
})
```

### 模拟外部服务

```typescript
import { rest } from 'msw'
import { setupServer } from 'msw/node'

const server = setupServer(
  rest.get('https://api.example.com/products', (req, res, ctx) => {
    const query = req.url.searchParams.get('q')
    
    if (query === 'laptop') {
      return res(ctx.json({
        products: [
          { id: '1', name: 'Gaming Laptop', price: 1200 },
          { id: '2', name: 'Business Laptop', price: 800 },
        ],
      }))
    }
    
    return res(ctx.json({ products: [] }))
  })
)

beforeAll(() => server.listen())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe('with mocked API', () => {
  it('should fetch products from API', async () => {
    const result = await searchProductsTool.execute({
      query: 'laptop',
      maxResults: 10,
    })
    
    expect(result.products).toHaveLength(2)
  })
})
```

---

## 最佳实践检查清单

### 设计
- [ ] 工具具有单一、明确的职责
- [ ] 名称具体且描述性强
- [ ] 描述解释了什么、何时以及为什么
- [ ] 参数有良好的文档

### 模式
- [ ] 必需与可选参数清晰明确
- [ ] 默认值合理
- [ ] 验证全面
- [ ] 类型尽可能具体

### 错误处理
- [ ] 错误提供可操作的指导
- [ ] 瞬时故障的重试
- [ ] 超时防止挂起
- [ ] 可能时优雅降级

### 性能
- [ ] 异步操作并行运行
- [ ] 速率限制防止过载
- [ ] 昂贵操作的缓存
- [ ] 连接的资源池

### 测试
- [ ] 快乐路径的单元测试
- [ ] 错误情况的测试
- [ ] 边缘情况覆盖
- [ ] 与智能体的集成测试

---

## 常见陷阱

### 1. 过于通用的工具

```typescript
// ❌ 不好
const tool = toolDefinition({
  name: 'api_call',
  description: 'Call an API',
  inputSchema: z.object({
    endpoint: z.string(),
    method: z.string(),
    body: z.any(),
  }),
  outputSchema: z.any(),
})

// ✅ 好
const getUserTool = toolDefinition({
  name: 'get_user_profile',
  description: 'Fetch user profile by ID',
  inputSchema: z.object({
    userId: z.string().uuid(),
  }),
  outputSchema: z.object({
    id: z.string(),
    name: z.string(),
    email: z.string(),
  }),
})
```

### 2. 糟糕的错误消息

```typescript
// ❌ 不好
throw new Error('Error')

// ✅ 好
throw new Error(
  `User ${userId} not found. ` +
  `Verify the user ID and try again, or use search_users to find the correct ID.`
)
```

### 3. 阻塞操作

```typescript
// ❌ 不好: 顺序执行
for (const id of ids) {
  await process(id)
}

// ✅ 好: 并行执行
await Promise.all(ids.map(id => process(id)))
```

### 4. 没有验证

```typescript
// ❌ 不好
inputSchema: z.object({
  email: z.string(), // 接受任何字符串!
})

// ✅ 好
inputSchema: z.object({
  email: z.string()
    .email('Invalid email format')
    .toLowerCase()
    .trim(),
})
```

---

## 下一步

- **[构建智能体](./building-agents.md)** - 在智能体中使用工具
- **[MCP 集成](./mcp.md)** - 使用模型上下文协议工具
- **[测试指南](./testing.md)** - 高级测试策略
- **[性能指南](./performance.md)** - 优化技术

---

## 其他资源

- **[核心概念: 工具](/docs/core-concepts/tools.md)** - 详细文档
- **[API 参考](/docs/api/core.md#tools)** - 完整 API
- **[示例](/examples/)** - 代码示例
