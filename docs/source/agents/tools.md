# Adding Tools

Tools extend an agent's capabilities by allowing it to interact with external systems, APIs, and data. With tools, agents can do more than just generate text — they can take actions.

## What Are Tools?

A tool is a function that an agent can call. It has:
- A **name** and **description** (for the agent to understand)
- An **input schema** (for validation)
- An **execute** function (that does the work)

```typescript
import { defineTool } from '@seashore/tool'
import { z } from 'zod'

const weatherTool = defineTool({
  name: 'get_weather',
  description: 'Get the current weather for a city',
  inputSchema: z.object({
    city: z.string().describe('The city name'),
  }),
  execute: async ({ city }) => {
    // Call a weather API
    const response = await fetch(`https://api.weather.com/${city}`)
    return await response.json()
  },
})
```

## Creating Tools

Use `defineTool` to create a tool:

```typescript
import { defineTool } from '@seashore/tool'
import { z } from 'zod'

const searchTool = defineTool({
  name: 'search',
  description: 'Search the web for information',
  inputSchema: z.object({
    query: z.string().describe('The search query'),
    numResults: z.number().default(5).describe('Number of results'),
  }),
  execute: async ({ query, numResults }) => {
    // Implementation
    return { results: [...] }
  },
})
```

### Tool Properties

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `name` | `string` | Yes | Unique identifier for the tool |
| `description` | `string` | Yes | What the tool does (helps agent decide when to use it) |
| `inputSchema` | `ZodSchema` | Yes | Validates input parameters |
| `execute` | `function` | Yes | The function that runs when tool is called |

## Adding Tools to Agents

Pass tools when creating an agent:

```typescript
const agent = createAgent({
  name: 'assistant',
  model: openaiText('gpt-4o'),
  systemPrompt: 'You are a helpful assistant.',
  tools: [weatherTool, searchTool],
})
```

## How Tool Calling Works

When an agent uses a tool:

1. **Decision** — The agent decides which tool to use based on the user's request
2. **Parameter Generation** — The agent generates parameters for the tool
3. **Validation** — Parameters are validated against the input schema
4. **Execution** — The tool's execute function runs
5. **Response** — The agent uses the tool's result to formulate a final answer

```typescript
const result = await agent.run('What is the weather in Tokyo?')

// Internally:
// 1. Agent decides to use get_weather
// 2. Generates parameters: { city: "Tokyo" }
// 3. Tool executes: fetch weather data
// 4. Agent uses result: "The weather in Tokyo is..."
```

## Tool Examples

### API Call Tool

```typescript
const getUserTool = defineTool({
  name: 'get_user',
  description: 'Get user information by ID',
  inputSchema: z.object({
    userId: z.string().describe('The user ID'),
  }),
  execute: async ({ userId }) => {
    const response = await fetch(`https://api.example.com/users/${userId}`)
    if (!response.ok) {
      throw new Error(`User not found: ${userId}`)
    }
    return await response.json()
  },
})
```

### Database Query Tool

```typescript
const queryDatabaseTool = defineTool({
  name: 'query_database',
  description: 'Query the database for customer orders',
  inputSchema: z.object({
    customerId: z.string(),
    status: z.enum(['pending', 'completed', 'cancelled']).optional(),
  }),
  execute: async ({ customerId, status }) => {
    const results = await db
      .select()
      .from(orders)
      .where(and(
        eq(orders.customerId, customerId),
        status ? eq(orders.status, status) : undefined
      ))
    return { orders: results }
  },
})
```

### File System Tool

```typescript
const readFileTool = defineTool({
  name: 'read_file',
  description: 'Read the contents of a file',
  inputSchema: z.object({
    path: z.string().describe('File path'),
  }),
  execute: async ({ path }) => {
    const content = await fs.readFile(path, 'utf-8')
    return { content }
  },
})
```

## Tool Errors

Handle errors in your tool execute function:

```typescript
const riskyTool = defineTool({
  name: 'risky_operation',
  description: 'An operation that might fail',
  inputSchema: z.object({
    input: z.string(),
  }),
  execute: async ({ input }) => {
    try {
      const result = await someApiCall(input)
      return { success: true, data: result }
    } catch (error) {
      // Return error info to the agent
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  },
})
```

The agent will use the error information to try again or explain the issue to the user.

## Multiple Tools

Agents can use multiple tools in a single response:

```typescript
const agent = createAgent({
  name: 'researcher',
  model: openaiText('gpt-4o'),
  systemPrompt: 'You are a research assistant.',
  tools: [searchTool, weatherTool, calculatorTool],
})

const result = await agent.run(
  'What is the weather in Tokyo and what is 15 * 7?'
)

// Agent will:
// 1. Call get_weather for Tokyo
// 2. Call calculator for 15 * 7
// 3. Combine both results in the answer
```

## Preset Tools

Seashore includes preset tools for common operations:

```typescript
import { serperTool, firecrawlTool } from '@seashore/tool'

const agent = createAgent({
  name: 'web-assistant',
  model: openaiText('gpt-4o'),
  tools: [
    serperTool({ apiKey: process.env.SERPER_API_KEY }),
    firecrawlTool({ apiKey: process.env.FIRECRAWL_API_KEY }),
  ],
})
```

See [Preset Tools](../tools/presets.md) for more information.

## Best Practices

1. **Clear Descriptions** — Help the agent understand when to use the tool
2. **Precise Schemas** — Use Zod's `.describe()` for parameter documentation
3. **Error Handling** — Return meaningful errors the agent can explain
4. **Idempotency** — Make tools safe to call multiple times
5. **Validation** — Validate inputs before making external calls

## Next Steps

- [Tool Validation](../tools/validation.md) — Advanced validation patterns
- [Preset Tools](../tools/presets.md) — Using built-in tools
- [Streaming Responses](./streaming.md) — Real-time tool execution feedback
