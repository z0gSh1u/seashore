# Tool Validation

Validation ensures tools receive correct input and return well-structured output. Seashore uses Zod for runtime type checking.

## Input Validation

Zod schemas automatically validate tool inputs:

```typescript
import { z } from 'zod'

const createUserTool = defineTool({
  name: 'create_user',
  description: 'Create a new user',
  inputSchema: z.object({
    name: z.string().min(2).max(50),
    email: z.string().email(),
    age: z.number().min(13).max(120),
    role: z.enum(['user', 'admin', 'moderator']).default('user'),
  }),
  execute: async ({ name, email, age, role }) => {
    // TypeScript knows all types
    // Runtime validation ensures correctness
    return { user: { name, email, age, role } }
  },
})
```

If the agent passes invalid input, the validation error is returned and the agent can retry.

## Custom Validation

Add custom validation with `.refine()`:

```typescript
const passwordTool = defineTool({
  name: 'set_password',
  description: 'Set a user password',
  inputSchema: z.object({
    password: z.string()
      .min(8)
      .refine(
        (pwd) => /[A-Z]/.test(pwd),
        'Password must contain an uppercase letter'
      )
      .refine(
        (pwd) => /[0-9]/.test(pwd),
        'Password must contain a number'
      ),
  }),
  execute: async ({ password }) => {
    return { success: true }
  },
})
```

## Conditional Validation

Validate based on other fields:

```typescript
const scheduleTool = defineTool({
  name: 'schedule_meeting',
  description: 'Schedule a meeting',
  inputSchema: z.object({
    type: z.enum(['online', 'in-person']),
    location: z.string().optional(),
    meetingUrl: z.string().url().optional(),
  }).refine(
    (data) => {
      if (data.type === 'in-person') {
        return !!data.location
      }
      return true
    },
    { message: 'In-person meetings require a location' }
  ).refine(
    (data) => {
      if (data.type === 'online') {
        return !!data.meetingUrl
      }
      return true
    },
    { message: 'Online meetings require a URL' }
  ),
  execute: async (input) => {
    return { success: true }
  },
})
```

## Transforming Input

Transform input before validation:

```typescript
const searchTool = defineTool({
  name: 'search',
  description: 'Search the database',
  inputSchema: z.object({
    query: z.string().transform((s) => s.trim().toLowerCase()),
    tags: z.array(z.string()).transform((arr) =>
      arr.map((s) => s.trim().toLowerCase())
    ),
  }),
  execute: async ({ query, tags }) => {
    // query and tags are already normalized
    return { results: [] }
  },
})
```

## Default Values

Provide sensible defaults:

```typescript
const paginateTool = defineTool({
  name: 'paginate',
  description: 'Get paginated results',
  inputSchema: z.object({
    page: z.number().min(1).default(1),
    pageSize: z.number().min(1).max(100).default(20),
    sortBy: z.enum(['name', 'date', 'relevance']).default('relevance'),
  }),
  execute: async ({ page, pageSize, sortBy }) => {
    return { results: [], page, pageSize, sortBy }
  },
})
```

## Union Types

Handle multiple input shapes:

```typescript
const queryTool = defineTool({
  name: 'query',
  description: 'Query the database',
  inputSchema: z.object({
    filter: z.union([
      z.object({
        type: z.literal('id'),
        value: z.number(),
      }),
      z.object({
        type: z.literal('name'),
        value: z.string(),
      }),
      z.object({
        type: z.literal('date'),
        value: z.string().datetime(),
      }),
    ]),
  }),
  execute: async ({ filter }) => {
    if (filter.type === 'id') {
      // filter.value is number
    } else if (filter.type === 'name') {
      // filter.value is string
    }
    return { results: [] }
  },
})
```

## Discriminated Unions

Better type safety with discriminators:

```typescript
const actionTool = defineTool({
  name: 'perform_action',
  description: 'Perform an action',
  inputSchema: z.discriminatedUnion('type', [
    z.object({
      type: z.literal('send_email'),
      to: z.string().email(),
      subject: z.string(),
      body: z.string(),
    }),
    z.object({
      type: z.literal('create_task'),
      title: z.string(),
      priority: z.enum(['low', 'medium', 'high']),
      assignee: z.string(),
    }),
    z.object({
      type: z.literal('schedule_call'),
      participant: z.string(),
      time: z.string().datetime(),
    }),
  ]),
  execute: async (input) => {
    switch (input.type) {
      case 'send_email':
        // TypeScript knows: input.to, input.subject, input.body
        return { sent: true }
      case 'create_task':
        // TypeScript knows: input.title, input.priority, input.assignee
        return { created: true }
      case 'schedule_call':
        // TypeScript knows: input.participant, input.time
        return { scheduled: true }
    }
  },
})
```

## Array Validation

Validate array contents:

```typescript
const bulkImportTool = defineTool({
  name: 'bulk_import',
  description: 'Import multiple items',
  inputSchema: z.object({
    items: z.array(z.object({
      id: z.string().uuid(),
      name: z.string().min(1),
      value: z.number().positive(),
    })).min(1).max(100),
  }),
  execute: async ({ items }) => {
    return { imported: items.length }
  },
})
```

## Validation Errors

When validation fails, the agent receives detailed error information:

```typescript
const tool = defineTool({
  name: 'strict_tool',
  inputSchema: z.object({
    email: z.string().email('Invalid email format'),
    age: z.number().min(18, 'Must be 18 or older'),
  }),
  execute: async ({ email, age }) => {
    return { success: true }
  },
})

// If agent passes: { email: 'invalid', age: 15 }
// Error: {
//   email: 'Invalid email format',
//   age: 'Must be 18 or older'
// }
```

The agent can use these errors to correct its input and retry.

## Best Practices

1. **Validate Everything** — Never trust external input
2. **Clear Messages** — Provide helpful error messages
3. **Sensible Defaults** — Reduce decision burden on the agent
4. **Transform Early** — Normalize input in the schema
5. **Use Discriminators** — For complex unions, discriminators improve type safety

## Next Steps

- [Preset Tools](./presets.md) — Built-in tools with validation
- [LLM Integration](../llm/index.md) — Working with language models
