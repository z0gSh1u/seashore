# Quick Start

Build your first Seashore agent in 5 minutes.

## 1. Install Seashore

```bash
pnpm add @seashore/core @seashore/agent
```

## 2. Get an API Key

Seashore works with multiple LLM providers. Choose one:

- **OpenAI**: Get a key from [platform.openai.com](https://platform.openai.com/api-keys)
- **Anthropic**: Get a key from [console.anthropic.com](https://console.anthropic.com/)
- **Google**: Get a key from [aistudio.google.com](https://aistudio.google.com/app/apikey)

Set your API key:
```bash
export OPENAI_API_KEY='sk-...'
```

## 3. Create Your First Agent

Create `agent.ts`:

```typescript
import { createLLMAdapter, createTool } from '@seashore/core';
import { createReActAgent } from '@seashore/agent';
import { z } from 'zod';

// 1. Setup LLM
const llm = createLLMAdapter({
  provider: 'openai',
  model: 'gpt-4o',
  apiKey: process.env.OPENAI_API_KEY!,
});

// 2. Create a tool
const calculatorTool = createTool({
  name: 'calculator',
  description: 'Perform basic arithmetic operations',
  parameters: z.object({
    operation: z.enum(['add', 'subtract', 'multiply', 'divide']),
    a: z.number(),
    b: z.number(),
  }),
  execute: async ({ operation, a, b }) => {
    switch (operation) {
      case 'add': return a + b;
      case 'subtract': return a - b;
      case 'multiply': return a * b;
      case 'divide': return a / b;
    }
  },
});

// 3. Create agent
const agent = createReActAgent({
  llm,
  tools: [calculatorTool],
  systemPrompt: 'You are a helpful calculator assistant.',
});

// 4. Run!
const result = await agent.run({
  message: 'What is 234 * 567?',
});

console.log(result.message);
// Output: "234 * 567 = 132,678"
```

## 4. Run Your Agent

```bash
tsx agent.ts
```

You should see the agent:
1. Receive your question
2. Call the calculator tool
3. Return the result

## What Just Happened?

Let's break down the code:

### 1. LLM Adapter
```typescript
const llm = createLLMAdapter({
  provider: 'openai',
  model: 'gpt-4o',
  apiKey: process.env.OPENAI_API_KEY!,
});
```

This creates an adapter for OpenAI's GPT-4. You can swap `provider` to `'anthropic'` or `'gemini'` without changing any other code.

### 2. Tool Definition
```typescript
const calculatorTool = createTool({
  name: 'calculator',
  description: 'Perform basic arithmetic operations',
  parameters: z.object({...}),
  execute: async ({operation, a, b}) => {...},
});
```

Tools are functions the agent can call. The `parameters` schema uses Zod for type-safe validation.

### 3. ReAct Agent
```typescript
const agent = createReActAgent({
  llm,
  tools: [calculatorTool],
  systemPrompt: 'You are a helpful calculator assistant.',
});
```

The **ReAct** pattern (Reasoning + Acting) allows the agent to:
1. **Reason** about what to do
2. **Act** by calling tools
3. **Observe** the results
4. Repeat until the task is complete

### 4. Running the Agent
```typescript
const result = await agent.run({
  message: 'What is 234 * 567?',
});
```

The agent processes your message, decides to use the calculator tool, and returns the result.

## Try More Examples

### Example 1: Multiple Tools

```typescript
const weatherTool = createTool({
  name: 'get_weather',
  description: 'Get current weather for a location',
  parameters: z.object({
    location: z.string(),
  }),
  execute: async ({ location }) => {
    // In production, call a weather API
    return `Weather in ${location}: 72°F, sunny`;
  },
});

const agent = createReActAgent({
  llm,
  tools: [calculatorTool, weatherTool],
});

const result = await agent.run({
  message: 'What is the weather in Tokyo and what is 15 + 27?',
});
```

The agent will use both tools to answer your question.

### Example 2: Streaming

```typescript
const stream = await agent.stream({
  message: 'Calculate 123 * 456 and explain the steps',
});

for await (const chunk of stream) {
  if (chunk.type === 'text') {
    process.stdout.write(chunk.content);
  }
}
```

Get token-by-token streaming for real-time responses.

### Example 3: Multi-turn Conversation

```typescript
const agent = createReActAgent({
  llm,
  tools: [calculatorTool],
});

// First message
const result1 = await agent.run({
  message: 'Calculate 100 + 200',
  threadId: 'session-1',
});

// Follow-up (uses context from previous message)
const result2 = await agent.run({
  message: 'Now multiply that by 3',
  threadId: 'session-1',
});

console.log(result2.message);
// Output: "900 (which is 300 * 3)"
```

## Next Steps

**Build a workflow:**
[Workflow Orchestration Guide](../core-concepts/workflows.md) - Chain multiple steps with DAG-based execution.

**Add RAG:**
[RAG Tutorial](./tutorial.md#adding-rag) - Give your agent knowledge from documents.

**Deploy to production:**
[Deployment Guide](../deployment/overview.md) - Deploy with Hono, Docker, or serverless.

**Explore examples:**
Check out the [examples directory](../../examples) for complete applications.

## Common Patterns

### Pattern: Error Handling

```typescript
try {
  const result = await agent.run({
    message: 'What is 10 / 0?',
  });
} catch (error) {
  if (error instanceof ToolExecutionError) {
    console.error('Tool failed:', error.message);
  }
}
```

### Pattern: Timeout

```typescript
const agent = createReActAgent({
  llm,
  tools: [calculatorTool],
  maxIterations: 5,  // Prevent infinite loops
  timeout: 30000,     // 30 second timeout
});
```

### Pattern: Structured Output

```typescript
const result = await agent.run({
  message: 'Calculate 15 * 23',
  outputSchema: z.object({
    result: z.number(),
    steps: z.array(z.string()),
  }),
});

console.log(result.data);
// { result: 345, steps: ['Multiplied 15 by 23'] }
```

## Troubleshooting

**Agent doesn't use the tool:**
- Make sure your tool `description` clearly explains what it does
- The LLM decides when to use tools based on the description

**"API key not found" error:**
- Set your environment variable: `export OPENAI_API_KEY='sk-...'`
- Or pass it directly: `apiKey: 'sk-...'`

**TypeScript errors:**
- Ensure you're using TypeScript 5.7+
- Check your `tsconfig.json` has `"moduleResolution": "bundler"`

For more help, see [Troubleshooting](../troubleshooting/common-issues.md).
