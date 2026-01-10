# Core Concepts

Understanding Seashore's core concepts will help you build better AI applications. This section explains the fundamental building blocks of the framework.

## Agents

An **Agent** is the main building block. It's an AI entity that can:

- **Understand** natural language input
- **Reason** about what to do
- **Act** by using tools or generating responses
- **Remember** conversation context

Agents use the **ReAct pattern** (Reasoning + Acting):
1. The agent thinks about what to do
2. It decides whether to call a tool or respond directly
3. If a tool is needed, it calls it with the right parameters
4. It uses the tool result to formulate a final answer

```typescript
const agent = createAgent({
  name: 'assistant',
  model: openaiText('gpt-4o'),
  systemPrompt: 'You are a helpful assistant.',
  tools: [myTools],
})

const result = await agent.run('What time is it?')
```

## Tools

**Tools** are functions that agents can call to perform actions. They extend an agent's capabilities beyond just generating text.

A tool has:
- A **name** and **description** (so the agent knows what it does)
- An **input schema** (for type-safe validation)
- An **execute** function (that does the actual work)

```typescript
const searchTool = defineTool({
  name: 'search',
  description: 'Search the web for information',
  inputSchema: z.object({
    query: z.string().describe('The search query'),
  }),
  execute: async ({ query }) => {
    // Call a search API
    return { results: [...] }
  },
})
```

When an agent uses a tool:
1. The agent decides which tool to use
2. It generates the right parameters
3. The tool executes with those parameters
4. The agent uses the result to continue

## LLM Adapters

**LLM Adapters** provide a unified interface to different language model providers. Seashore supports:

- **OpenAI** — GPT-4o, GPT-4o-mini, etc.
- **Anthropic** — Claude 3.5 Sonnet, Haiku, etc.
- **Gemini** — Google's Gemini models

Adapters handle:
- Provider-specific API differences
- Retry logic and error handling
- Streaming responses
- Token counting

```typescript
// OpenAI
const openai = openaiText('gpt-4o')

// Anthropic
const claude = anthropicText('claude-sonnet-3-5')

// Gemini
const gemini = geminiText('gemini-2.0-flash-exp')
```

## Messages

**Messages** represent conversation turns. Seashore uses a standard message format:

```typescript
type Message = {
  role: 'user' | 'assistant' | 'system'
  content: string
}
```

**Conversation flow:**
1. Start with an optional system prompt
2. Alternate between user and assistant messages
3. Pass message history to maintain context

```typescript
const messages: Message[] = [
  { role: 'system', content: 'You are a helpful assistant.' },
  { role: 'user', content: 'Hello!' },
  { role: 'assistant', content: 'Hi! How can I help?' },
  { role: 'user', content: 'What is my name?' },
]
```

## Streaming vs Blocking

Seashore supports both blocking and streaming operations:

**Blocking** — Wait for the complete response:
```typescript
const result = await agent.run('Hello')
console.log(result.content)
```

**Streaming** — Get chunks as they arrive:
```typescript
for await (const chunk of agent.stream('Hello')) {
  if (chunk.type === 'content') {
    process.stdout.write(chunk.delta)
  }
}
```

Streaming is better for:
- Real-time user interfaces
- Long-running responses
- Reducing perceived latency

## Type Safety

Seashore uses **Zod** for runtime type validation:

- Tool inputs are validated before execution
- Structured outputs ensure you get the right shape
- TypeScript types are inferred from Zod schemas

```typescript
// Define a tool with type-safe input
const calculator = defineTool({
  name: 'calculate',
  inputSchema: z.object({
    a: z.number(),
    b: z.number(),
    op: z.enum(['add', 'subtract']),
  }),
  execute: async ({ a, b, op }) => {
    // TypeScript knows a and b are numbers
    // Runtime validation ensures they are
    return op === 'add' ? a + b : a - b
  },
})
```

## Next Steps

Now that you understand the core concepts, dive deeper:

- [Creating Your First Agent](../agents/first-agent.md) — Build practical agents
- [Adding Tools](../agents/tools.md) — Extend agent capabilities
- [LLM Integration](../llm/index.md) — Work with different models
