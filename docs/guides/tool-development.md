# Tool Development

Learn how to create robust, production-ready tools with proper design principles, validation, error handling, async patterns, and testing strategies.

## Overview

Tools are the hands of your agents—they enable interaction with external systems, databases, APIs, and services. Well-designed tools make agents reliable and effective.

**What you'll learn:**
- Tool design principles
- Parameter schema design
- Validation and type safety
- Error handling patterns
- Async and performance optimization
- Testing strategies
- Common pitfalls

---

## Tool Anatomy

### Basic Structure

Every tool has four essential components:

```typescript
import { toolDefinition } from '@tanstack/ai'
import { z } from 'zod'

const myTool = toolDefinition({
  // 1. Unique identifier
  name: 'tool_name',
  
  // 2. Clear description (LLM reads this)
  description: 'What this tool does and when to use it',
  
  // 3. Input schema (Zod validation)
  inputSchema: z.object({
    param1: z.string(),
    param2: z.number().optional(),
  }),
  
  // 4. Output schema
  outputSchema: z.object({
    result: z.string(),
  }),
}).server(async (input) => {
  // 5. Implementation
  return { result: 'processed' }
})
```

### Seashore Integration

Seashore uses TanStack AI's tool system:

```typescript
import { createReActAgent } from '@seashore/agent'

const agent = createReActAgent({
  model: () => llm('gpt-4o'),
  systemPrompt: 'You are helpful',
  tools: [myTool], // Pass tools directly
})
```

---

## Design Principles

### 1. Single Responsibility

Each tool should do ONE thing well:

```typescript
// ❌ BAD: Kitchen sink tool
const userTool = toolDefinition({
  name: 'user_operations',
  description: 'Manage users',
  inputSchema: z.object({
    action: z.enum(['create', 'delete', 'update', 'list', 'search']),
    data: z.any(), // Too vague!
  }),
  outputSchema: z.any(),
}).server(async ({ action, data }) => {
  // Monolithic implementation
})

// ✅ GOOD: Focused tools
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

### 2. Clear Naming

Names should be self-documenting:

```typescript
// ❌ BAD: Ambiguous
'search'          // Search what?
'get'             // Get what?
'process'         // Process what?

// ✅ GOOD: Specific
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

### 3. Descriptive Documentation

Help the LLM understand when and how to use the tool:

```typescript
const searchProductsTool = toolDefinition({
  name: 'search_products',
  
  // ❌ BAD: Minimal description
  // description: 'Search products',
  
  // ✅ GOOD: Comprehensive description
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
  // Implementation
  return { products: [], totalCount: 0 }
})
```

### 4. Predictable Behavior

Tools should behave consistently:

```typescript
// ✅ GOOD: Predictable, idempotent
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

// ⚠️ WARNING: Side effects should be explicit in name
const sendEmailTool = toolDefinition({
  name: 'send_confirmation_email', // Clear: this DOES something
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

## Parameter Design

### Schema Best Practices

```typescript
const exemplaryTool = toolDefinition({
  name: 'search_knowledge_base',
  description: 'Search company knowledge base',
  inputSchema: z.object({
    // Required string with validation
    query: z.string()
      .min(3, 'Query must be at least 3 characters')
      .max(200, 'Query too long')
      .describe('Search query'),
    
    // Optional with default
    maxResults: z.number()
      .int()
      .min(1)
      .max(50)
      .default(10)
      .describe('Maximum results (1-50, default: 10)'),
    
    // Enum for finite choices
    category: z.enum(['policies', 'procedures', 'faqs', 'guides'])
      .optional()
      .describe('Filter by content category'),
    
    // Boolean with default
    includeArchived: z.boolean()
      .default(false)
      .describe('Include archived articles'),
    
    // Nested object
    filters: z.object({
      dateRange: z.object({
        start: z.string().datetime(),
        end: z.string().datetime(),
      }).optional(),
      tags: z.array(z.string()).optional(),
    }).optional()
      .describe('Advanced filters'),
    
    // Custom validation
    sortBy: z.enum(['relevance', 'date', 'popularity'])
      .default('relevance')
      .describe('Sort order'),
  }).refine(
    (data) => {
      // Cross-field validation
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
  // Type-safe implementation
  return {
    articles: [],
    totalResults: 0,
    hasMore: false,
  }
})
```

### Common Patterns

**File paths:**
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

**Dates:**
```typescript
date: z.string()
  .datetime()
  .describe('ISO 8601 datetime string')

// Or with parsing
date: z.string()
  .refine((val) => !isNaN(Date.parse(val)), 'Invalid date')
  .transform((val) => new Date(val))
```

**Arrays:**
```typescript
items: z.array(z.string())
  .min(1, 'At least one item required')
  .max(100, 'Too many items')
  .describe('List of items to process')
```

---

## Error Handling

### Pattern 1: Throw Errors

Best for unrecoverable errors:

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

### Pattern 2: Return Error States

Best when errors are recoverable or expected:

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

### Pattern 3: Retry Logic

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

### Pattern 4: Timeout Protection

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
      30000, // 30 second timeout
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

## Async Patterns

### Parallel Execution

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
  // ❌ BAD: Sequential (slow)
  // const products = []
  // for (const id of productIds) {
  //   products.push(await fetchProduct(id))
  // }
  
  // ✅ GOOD: Parallel (fast)
  const products = await Promise.all(
    productIds.map(id => fetchProduct(id))
  )
  
  return { products }
})
```

### Rate Limiting

```typescript
import pLimit from 'p-limit'

const limiter = pLimit(5) // Max 5 concurrent operations

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
  // Execute with max 5 concurrent requests
  const results = await Promise.all(
    queries.map(query =>
      limiter(() => searchAPI(query))
    )
  )
  
  return { results }
})
```

### Streaming Results

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
  
  // Stream and process chunks
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

## Performance Optimization

### Caching

```typescript
import { LRUCache } from 'lru-cache'

const cache = new LRUCache<string, any>({
  max: 500, // Max 500 items
  ttl: 1000 * 60 * 5, // 5 minute TTL
})

const cachedTool = toolDefinition({
  name: 'fetch_cached_data',
  description: 'Fetch data with caching',
  inputSchema: z.object({ key: z.string() }),
  outputSchema: z.object({ data: z.any() }),
}).server(async ({ key }) => {
  // Check cache
  const cached = cache.get(key)
  if (cached) {
    console.log('Cache hit:', key)
    return { data: cached }
  }
  
  // Fetch and cache
  console.log('Cache miss:', key)
  const data = await fetchExpensiveData(key)
  cache.set(key, data)
  
  return { data }
})
```

### Connection Pooling

```typescript
import { Pool } from 'pg'

const pool = new Pool({
  max: 20, // Max 20 connections
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
    client.release() // Return to pool
  }
})
```

### Lazy Initialization

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

## Testing

### Unit Tests

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

describe('searchProductsTool', () => {
  beforeEach(() => {
    // Setup
  })
  
  afterEach(() => {
    // Cleanup
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
        query: 'a', // Too short (min 2)
        maxResults: 10,
      })
    ).rejects.toThrow('at least 2 characters')
  })
  
  it('should handle API errors gracefully', async () => {
    // Mock API failure
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

### Integration Tests

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

### Mock External Services

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

## Best Practices Checklist

### Design
- [ ] Tool has single, clear responsibility
- [ ] Name is specific and descriptive
- [ ] Description explains what, when, and why
- [ ] Parameters are well-documented

### Schema
- [ ] Required vs optional parameters are clear
- [ ] Defaults are sensible
- [ ] Validation is comprehensive
- [ ] Types are as specific as possible

### Error Handling
- [ ] Errors provide actionable guidance
- [ ] Retries for transient failures
- [ ] Timeouts prevent hanging
- [ ] Graceful degradation when possible

### Performance
- [ ] Async operations run in parallel
- [ ] Rate limiting prevents overload
- [ ] Caching for expensive operations
- [ ] Resource pooling for connections

### Testing
- [ ] Unit tests for happy path
- [ ] Tests for error cases
- [ ] Edge case coverage
- [ ] Integration tests with agents

---

## Common Pitfalls

### 1. Overly Generic Tools

```typescript
// ❌ BAD
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

// ✅ GOOD
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

### 2. Poor Error Messages

```typescript
// ❌ BAD
throw new Error('Error')

// ✅ GOOD
throw new Error(
  `User ${userId} not found. ` +
  `Verify the user ID and try again, or use search_users to find the correct ID.`
)
```

### 3. Blocking Operations

```typescript
// ❌ BAD: Sequential
for (const id of ids) {
  await process(id)
}

// ✅ GOOD: Parallel
await Promise.all(ids.map(id => process(id)))
```

### 4. No Validation

```typescript
// ❌ BAD
inputSchema: z.object({
  email: z.string(), // Any string accepted!
})

// ✅ GOOD
inputSchema: z.object({
  email: z.string()
    .email('Invalid email format')
    .toLowerCase()
    .trim(),
})
```

---

## Next Steps

- **[Building Agents](./building-agents.md)** - Use tools in agents
- **[MCP Integration](./mcp.md)** - Use Model Context Protocol tools
- **[Testing Guide](./testing.md)** - Advanced testing strategies
- **[Performance Guide](./performance.md)** - Optimization techniques

---

## Additional Resources

- **[Core Concepts: Tools](/docs/core-concepts/tools.md)** - Detailed documentation
- **[API Reference](/docs/api/core.md#tools)** - Complete API
- **[Examples](/examples/)** - Code examples
