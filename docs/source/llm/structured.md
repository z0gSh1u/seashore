# Structured Output

Get type-safe, structured responses from LLMs. Perfect for data extraction, classification, and any task requiring consistent output format.

## Basic Structured Output

Define a schema and get validated results:

```typescript
import { openaiText } from '@seashore/llm'
import { generateStructured } from '@seashore/llm'
import { z } from 'zod'

const model = openaiText('gpt-4o')

const schema = z.object({
  sentiment: z.enum(['positive', 'negative', 'neutral']),
  topics: z.array(z.string()),
  confidence: z.number().min(0).max(1),
})

const result = await generateStructured(model, {
  schema,
  prompt: 'Analyze this review: The product was amazing, fast shipping!',
})

console.log.result
// {
//   sentiment: 'positive',
//   topics: ['shipping', 'product quality'],
//   confidence: 0.95
// }

// Type is inferred from schema
result.sentiment // TypeScript knows this is 'positive' | 'negative' | 'neutral'
```

## Using with Agents

```typescript
import { createAgent } from '@seashore/agent'
import { openaiText } from '@seashore/llm'

const extractorAgent = createAgent({
  name: 'extractor',
  model: openaiText('gpt-4o'),
  systemPrompt: 'Extract information from the input.',
})

const schema = z.object({
  entities: z.array(z.object({
    name: z.string(),
    type: z.enum(['person', 'organization', 'location']),
  })),
})

const result = await generateStructured(extractorAgent.model, {
  schema,
  prompt: 'Apple Inc. was founded by Steve Jobs in Cupertino.',
})
```

## Nested Schemas

Handle complex nested structures:

```typescript
const schema = z.object({
  user: z.object({
    name: z.string(),
    age: z.number(),
    address: z.object({
      street: z.string(),
      city: z.string(),
      country: z.string(),
    }),
  }),
  orders: z.array(z.object({
    id: z.string().uuid(),
    items: z.array(z.object({
      product: z.string(),
      quantity: z.number(),
      price: z.number(),
    })),
    total: z.number(),
  })),
})

const result = await generateStructured(model, {
  schema,
  prompt: 'Parse this order information...',
})
```

## Streaming Structured Output

Stream structured responses as they're generated:

```typescript
import { streamStructured } from '@seashore/llm'

for await (const chunk of streamStructured(model, {
  schema,
  prompt: 'Extract information from...',
})) {
  if (chunk.type === 'partial') {
    console.log('Partial:', chunk.value)
  } else if (chunk.type === 'complete') {
    console.log('Complete:', chunk.value)
  }
}
```

## Common Use Cases

### Data Extraction

```typescript
const invoiceSchema = z.object({
  invoiceNumber: z.string(),
  date: z.string().datetime(),
  items: z.array(z.object({
    description: z.string(),
    quantity: z.number(),
    unitPrice: z.number(),
    total: z.number(),
  })),
  total: z.number(),
})

const result = await generateStructured(model, {
  schema: invoiceSchema,
  prompt: invoiceText,
})
```

### Classification

```typescript
const classificationSchema = z.object({
  category: z.enum(['spam', 'promotional', 'transactional', 'personal']),
  urgency: z.enum(['low', 'medium', 'high']),
  tags: z.array(z.string()),
})

const result = await generateStructured(model, {
  schema: classificationSchema,
  prompt: emailContent,
})
```

### Entity Recognition

```typescript
const entitySchema = z.object({
  people: z.array(z.object({
    name: z.string(),
    role: z.string().optional(),
  })),
  organizations: z.array(z.string()),
  dates: z.array(z.string()),
  locations: z.array(z.string()),
})

const result = await generateStructured(model, {
  schema: entitySchema,
  prompt: articleText,
})
```

### Code Analysis

```typescript
const codeSchema = z.object({
  language: z.string(),
  functions: z.array(z.object({
    name: z.string(),
    parameters: z.array(z.object({
      name: z.string(),
      type: z.string(),
    })),
    returnType: z.string(),
  })),
  imports: z.array(z.string()),
})

const result = await generateStructured(model, {
  schema: codeSchema,
  prompt: codeSnippet,
})
```

## Validation

Structured output includes validation:

```typescript
const result = await generateStructured(model, {
  schema: z.object({
    email: z.string().email(),
    age: z.number().min(0).max(120),
  }),
  prompt: 'Extract user info from...',
})

// If validation fails, an error is thrown
// The model will retry to produce valid output
```

## Best Practices

1. **Clear Prompts** — Tell the model exactly what to extract
2. **Precise Schemas** — Use specific types and constraints
3. **Examples** — Include examples in complex prompts
4. **Validation** — Let Zod handle runtime validation
5. **Error Handling** — Catch and handle validation failures

## Next Steps

- [Tools](../tools/index.md) — Tools with structured input/output
- [Evaluation](../security/evaluation.md) — Evaluate structured outputs
