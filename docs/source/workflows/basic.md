# Basic Workflows

A workflow is a directed graph of nodes that process data in sequence. Workflows are perfect for multi-step processes like content generation, data processing, and complex agent tasks.

## Creating a Workflow

```typescript
import { createWorkflow, createLLMNode } from '@seashore/workflow'
import { openaiText } from '@seashore/llm'

// Create nodes
const generateOutline = createLLMNode({
  name: 'generate-outline',
  adapter: openaiText('gpt-4o'),
  systemPrompt: 'You are an outline generator.',
  prompt: (input) => `Create an outline for: ${input.topic}`,
})

const writeContent = createLLMNode({
  name: 'write-content',
  adapter: openaiText('gpt-4o'),
  systemPrompt: 'You are a content writer.',
  messages: (input, ctx) => [
    { role: 'system', content: 'Write content based on the outline.' },
    { role: 'user', content: `Topic: ${input.topic}\nOutline: ${ctx.nodeOutputs['generate-outline']?.content}` },
  ],
})

// Create workflow
const workflow = createWorkflow({
  name: 'article-writer',
  nodes: [generateOutline, writeContent],
  edges: [
    { from: 'generate-outline', to: 'write-content' },
  ],
  startNode: 'generate-outline',
})

// Execute
const result = await workflow.execute({ topic: 'AI in 2024' })

console.log(result.nodeOutputs['generate-outline']?.content)
console.log(result.nodeOutputs['write-content']?.content)
```

## Workflow Structure

A workflow consists of:

- **Nodes** — Processing steps (LLM calls, tools, custom logic)
- **Edges** — Connections between nodes
- **Start Node** — Where execution begins
- **Context** — Shared data between nodes

## LLM Nodes

Nodes that call language models:

```typescript
import { createLLMNode } from '@seashore/workflow'

const node = createLLMNode({
  name: 'summarize',
  adapter: openaiText('gpt-4o'),
  systemPrompt: 'Summarize the input text.',
  prompt: (input) => `Text: ${input.text}`,
})
```

### Using Messages

For multi-turn conversations:

```typescript
const chatNode = createLLMNode({
  name: 'chat',
  adapter: openaiText('gpt-4o'),
  messages: (input, ctx) => {
    const history = ctx.nodeOutputs['previous']?.messages ?? []
    return [
      ...history,
      { role: 'user', content: input.message },
    ]
  },
})
```

## Tool Nodes

Nodes that execute tools:

```typescript
import { createToolNode } from '@seashore/workflow'
import { defineTool } from '@seashore/tool'

const weatherTool = defineTool({
  name: 'get_weather',
  description: 'Get weather for a city',
  inputSchema: z.object({
    city: z.string(),
  }),
  execute: async ({ city }) => {
    return { temperature: 22, condition: 'sunny' }
  },
})

const toolNode = createToolNode({
  name: 'fetch-weather',
  tool: weatherTool,
  inputMapping: { city: 'input.city' }, // Map workflow input to tool input
})
```

## Custom Nodes

Nodes with custom logic:

```typescript
import { createTransformNode } from '@seashore/workflow'

const processNode = createTransformNode({
  name: 'process',
  transform: async (input, ctx) => {
    const previousOutput = ctx.nodeOutputs['previous']?.content ?? ''
    return {
      processed: previousOutput.toUpperCase(),
      length: previousOutput.length,
    }
  },
})
```

## Accessing Previous Outputs

Use `ctx.nodeOutputs` to access outputs from previous nodes:

```typescript
const node = createLLMNode({
  name: 'analyze',
  adapter: openaiText('gpt-4o'),
  messages: (input, ctx) => {
    const outline = ctx.nodeOutputs['outline']?.content ?? ''
    const draft = ctx.nodeOutputs['draft']?.content ?? ''

    return [
      { role: 'system', content: 'Analyze the article.' },
      { role: 'user', content: `Outline:\n${outline}\n\nDraft:\n${draft}` },
    ]
  },
})
```

## Workflow Input/Output

Define input and output schemas:

```typescript
import { z } from 'zod'

const workflow = createWorkflow({
  name: 'article-writer',
  nodes: [outlineNode, contentNode],
  edges: [{ from: 'outline', to: 'content' }],
  startNode: 'outline',
  inputSchema: z.object({
    topic: z.string(),
    tone: z.enum(['formal', 'casual']).default('casual'),
  }),
})
```

## Execution Result

The workflow result contains:

```typescript
const result = await workflow.execute({ topic: 'AI' })

console.log(result.nodeOutputs)   // All node outputs
console.log(result.output)        // Final node output
console.log(result.durationMs)    // Execution time
console.log(result.executionId)   // Unique execution ID
```

## Common Patterns

### Sequential Processing

```typescript
const workflow = createWorkflow({
  name: 'pipeline',
  nodes: [extract, transform, load],
  edges: [
    { from: 'extract', to: 'transform' },
    { from: 'transform', to: 'load' },
  ],
  startNode: 'extract',
})
```

### Multi-stage Generation

```typescript
// 1. Research
// 2. Outline
// 3. Draft
// 4. Edit
// 5. Finalize

const workflow = createWorkflow({
  name: 'content-factory',
  nodes: [research, outline, draft, edit, finalize],
  edges: [
    { from: 'research', to: 'outline' },
    { from: 'outline', to: 'draft' },
    { from: 'draft', to: 'edit' },
    { from: 'edit', to: 'finalize' },
  ],
  startNode: 'research',
})
```

## Next Steps

- [Node Types](./nodes.md) — All available node types
- [Control Flow](./control-flow.md) — Branches and loops
- [Error Handling](./errors.md) — Retry and fallback strategies
