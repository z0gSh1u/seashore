# Quick Start

Let's build your first AI agent with Seashore. In just a few minutes, you'll have a working agent that can answer questions.

## Your First Agent

Create a file called `agent.ts`:

```typescript
import { createAgent } from '@seashore/agent'
import { openaiText } from '@seashore/llm'

// Create an agent
const agent = createAgent({
  name: 'my-first-agent',
  model: openaiText('gpt-4o'),
  systemPrompt: 'You are a helpful assistant.',
})

// Run the agent
const result = await agent.run('What is TypeScript?')

console.log(result.content)
```

That's it! You've created an AI agent. Let's break down what happened:

1. **createAgent** — Creates a new agent with a name and model
2. **openaiText** — Creates an adapter for OpenAI's text models
3. **agent.run** — Sends a message to the agent and gets a response

Run it with:

```bash
npx tsx agent.ts
```

## Adding a Tool

Agents become powerful when they can use tools — functions that let them interact with the world:

```typescript
import { createAgent } from '@seashore/agent'
import { openaiText } from '@seashore/llm'
import { defineTool } from '@seashore/tool'
import { z } from 'zod'

// Define a tool
const weatherTool = defineTool({
  name: 'get_weather',
  description: 'Get the weather for a city',
  inputSchema: z.object({
    city: z.string().describe('The city name'),
  }),
  execute: async ({ city }) => {
    // In a real app, call a weather API
    return { temperature: 22, condition: 'sunny' }
  },
})

// Create an agent with the tool
const agent = createAgent({
  name: 'weather-agent',
  model: openaiText('gpt-4o'),
  systemPrompt: 'You are a helpful weather assistant.',
  tools: [weatherTool],
})

// The agent will automatically use the tool
const result = await agent.run('What is the weather in Tokyo?')
console.log(result.content)
// Output: "The weather in Tokyo is 22°C and sunny."
```

## Streaming Responses

For a better user experience, stream responses as they're generated:

```typescript
const agent = createAgent({
  name: 'streaming-agent',
  model: openaiText('gpt-4o'),
  systemPrompt: 'You are a helpful assistant.',
})

// Stream the response
for await (const chunk of agent.chat('Tell me a short story')) {
  if (chunk.type === 'content' && chunk.delta) {
    process.stdout.write(chunk.delta)
  }
}
```

## Multi-turn Conversations

Maintain conversation context by passing message history:

```typescript
const messages = [
  { role: 'user' as const, content: 'My name is Alice' },
  { role: 'assistant' as const, content: 'Hello Alice!' },
  { role: 'user' as const, content: 'What is my name?' },
]

for await (const chunk of agent.chat(messages)) {
  if (chunk.type === 'content' && chunk.delta) {
    process.stdout.write(chunk.delta)
  }
}
// Output: "Your name is Alice."
```

## What's Next?

You've built your first agent! Here's what to explore next:

- Learn about [Core Concepts](./concepts.md) to understand how agents work
- Explore [Tools](../tools/index.md) to add more capabilities
- Build [Workflows](../workflows/index.md) for complex tasks
- Add [Memory](../memory/index.md) to remember conversations

Happy building!
