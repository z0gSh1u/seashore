# Defining Tools

Tools are defined using `defineTool()` with a name, description, input schema, and execute function. This guide covers how to create effective tools.

## Basic Tool Definition

```typescript
import { defineTool } from '@seashore/tool'
import { z } from 'zod'

const helloTool = defineTool({
  name: 'hello',
  description: 'Say hello to someone',
  inputSchema: z.object({
    name: z.string().describe('The name to say hello to'),
  }),
  execute: async ({ name }) => {
    return { message: `Hello, ${name}!` }
  },
})
```

## Tool Structure

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `name` | `string` | Yes | Unique identifier for the tool |
| `description` | `string` | Yes | What the tool does (helps the agent decide when to use it) |
| `inputSchema` | `ZodSchema` | Yes | Validates input parameters |
| `execute` | `function` | Yes | The function that runs when the tool is called |

## Input Schemas with Zod

Use Zod to define and validate tool inputs:

```typescript
import { z } from 'zod'

const searchTool = defineTool({
  name: 'search',
  description: 'Search a database',
  inputSchema: z.object({
    query: z.string().min(1).describe('Search query'),
    limit: z.number().min(1).max(100).default(10).describe('Max results'),
    filters: z.record(z.string()).optional().describe('Filter criteria'),
  }),
  execute: async ({ query, limit, filters }) => {
    // TypeScript knows: query is string, limit is number, filters is optional
    return { results: [] }
  },
})
```

### Common Zod Patterns

```typescript
z.object({
  // Strings with validation
  email: z.string().email(),
  url: z.string().url(),
  minLength: z.string().min(5),

  // Numbers with ranges
  age: z.number().min(0).max(150),
  price: z.number().positive(),

  // Enums
  status: z.enum(['pending', 'active', 'complete']),

  // Arrays
  tags: z.array(z.string()),

  // Optionals
  description: z.string().optional(),

  // Defaults
  count: z.number().default(1),

  // Nested objects
  user: z.object({
    name: z.string(),
    age: z.number(),
  }),
})
```

### Describe for Agent Understanding

Use `.describe()` to explain parameters to the agent:

```typescript
inputSchema: z.object({
  city: z.string().describe('The city name, e.g. "Tokyo" or "New York"'),
  units: z.enum(['celsius', 'fahrenheit']).describe('Temperature units'),
})
```

The agent uses these descriptions to generate correct parameters.

## Async Execution

Tools can perform async operations:

```typescript
const fetchWeatherTool = defineTool({
  name: 'get_weather',
  description: 'Fetch weather from an API',
  inputSchema: z.object({
    city: z.string(),
  }),
  execute: async ({ city }) => {
    const response = await fetch(`https://api.weather.com/${city}`)
    if (!response.ok) {
      throw new Error(`Weather API error: ${response.status}`)
    }
    const data = await response.json()
    return {
      city,
      temperature: data.main.temp,
      condition: data.weather[0].main,
    }
  },
})
```

## Return Values

Return structured data that the agent can use:

```typescript
const calculateTool = defineTool({
  name: 'calculate',
  description: 'Perform a calculation',
  inputSchema: z.object({
    expression: z.string(),
  }),
  execute: async ({ expression }) => {
    const result = eval(expression) // Be careful with eval!
    return {
      expression,
      result,
      success: true,
    }
  },
})
```

Good return values:
- **Structured** — Use objects, not plain strings
- **Complete** — Include all relevant information
- **Typed** — Use consistent types
- **Minimal** — Don't return unnecessary data

## Error Handling

Handle errors gracefully:

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
      return { success: true, result }
    } catch (error) {
      // Return error information
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  },
})
```

The agent can use the error information to explain the issue or try alternatives.

## Tool Context

Access additional context in your tools:

```typescript
const contextAwareTool = defineTool({
  name: 'context_aware',
  description: 'A tool that uses context',
  inputSchema: z.object({
    input: z.string(),
  }),
  execute: async ({ input }, context) => {
    // context includes:
    // - agentId: string
    // - messageId: string
    // - metadata: Record<string, unknown>

    console.log(`Called by agent: ${context.agentId}`)

    return { result: input }
  },
})
```

## Tool Composition

Create tools that use other tools:

```typescript
const readFileTool = defineTool({
  name: 'read_file',
  description: 'Read a file',
  inputSchema: z.object({
    path: z.string(),
  }),
  execute: async ({ path }) => {
    return { content: await fs.readFile(path, 'utf-8') }
  },
})

const searchFilesTool = defineTool({
  name: 'search_files',
  description: 'Search for text in files',
  inputSchema: z.object({
    directory: z.string(),
    pattern: z.string(),
  }),
  execute: async ({ directory, pattern }) => {
    const files = await fs.readdir(directory)
    const results = []

    for (const file of files) {
      const { content } = await readFileTool.execute({
        path: path.join(directory, file),
      })
      if (content.includes(pattern)) {
        results.push({ file, matches: content.split(pattern).length - 1 })
      }
    }

    return { results }
  },
})
```

## Best Practices

1. **Clear Names** — Use verb_noun pattern: `get_weather`, `search_files`
2. **Descriptive Descriptions** — Help the agent understand when to use the tool
3. **Precise Schemas** — Validate thoroughly, describe clearly
4. **Structured Returns** — Return objects, not strings
5. **Error Handling** — Return meaningful error information
6. **Idempotency** — Make tools safe to call multiple times
7. **Timeout Protection** — Use timeouts for external calls

## Next Steps

- [Tool Validation](./validation.md) — Advanced validation patterns
- [Preset Tools](./presets.md) — Use built-in tools
