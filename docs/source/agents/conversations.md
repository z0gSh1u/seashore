# Multi-turn Conversations

Real conversations have history — questions follow answers, and context builds over time. This guide shows how to manage multi-turn conversations with Seashore.

## Message History

Pass message history to maintain context:

```typescript
const messages = [
  { role: 'user' as const, content: 'My name is Alice' },
  { role: 'assistant' as const, content: 'Hello Alice! Nice to meet you.' },
  { role: 'user' as const, content: 'What is my name?' },
]

const result = await agent.run({ messages })
console.log(result.content)
// Output: "Your name is Alice."
```

Without history, the agent wouldn't remember the name:

```typescript
const result = await agent.run('What is my name?')
// Output: "I don't know your name."
```

## Building Conversation History

As the conversation progresses, append messages:

```typescript
const conversation: Message[] = []

async function sendMessage(userMessage: string) {
  // Add user message
  conversation.push({ role: 'user', content: userMessage })

  // Get response
  const result = await agent.run({ messages: conversation })

  // Add assistant response
  conversation.push({ role: 'assistant', content: result.content })

  return result.content
}

// Use it
await sendMessage('My name is Bob')
await sendMessage('What is my name?') // Agent remembers: "Bob"
```

## Using agent.chat()

The `chat()` method returns a stream and accepts history:

```typescript
const messages: Message[] = [
  { role: 'user', content: 'Hello' },
  { role: 'assistant', content: 'Hi there!' },
]

let response = ''
for await (const chunk of agent.chat(messages)) {
  if (chunk.type === 'content' && chunk.delta) {
    response += chunk.delta
    process.stdout.write(chunk.delta)
  }
}

// Don't forget to add the response to history!
messages.push({ role: 'assistant', content: response })
```

## Conversation Limits

LLMs have context window limits. Be mindful of history size:

```typescript
const MAX_TOKENS = 4000 // Adjust based on model

function trimMessages(messages: Message[], maxTokens: number) {
  // Simple strategy: keep last N messages
  // Better: use token counting
  return messages.slice(-10)
}
```

For production, use token counting:

```typescript
import { countTokens } from '@seashore/llm'

function trimByTokens(messages: Message[], maxTokens: number) {
  let total = 0
  const kept: Message[] = []

  for (let i = messages.length - 1; i >= 0; i--) {
    const tokens = countTokens(messages[i].content)
    if (total + tokens > maxTokens) break
    kept.unshift(messages[i])
    total += tokens
  }

  return kept
}
```

## System Prompt in History

Include the system prompt as the first message:

```typescript
const messages: Message[] = [
  { role: 'system', content: 'You are a helpful assistant.' },
  { role: 'user', content: 'Hello' },
  { role: 'assistant', content: 'Hi there!' },
  { role: 'user', content: 'How are you?' },
]
```

Or use the agent's system prompt and don't include it in history:

```typescript
const agent = createAgent({
  name: 'assistant',
  model: openaiText('gpt-4o'),
  systemPrompt: 'You are a helpful assistant.',
})

const messages: Message[] = [
  { role: 'user', content: 'Hello' },
  { role: 'assistant', content: 'Hi there!' },
]

// Agent will add its own system prompt internally
```

## Thread-Based Conversations

For production apps, organize conversations into threads:

```typescript
interface Thread {
  id: string
  messages: Message[]
  metadata: Record<string, unknown>
}

const threads = new Map<string, Thread>()

function getThread(threadId: string): Thread {
  if (!threads.has(threadId)) {
    threads.set(threadId, {
      id: threadId,
      messages: [],
      metadata: {},
    })
  }
  return threads.get(threadId)!
}

async function chat(threadId: string, userMessage: string) {
  const thread = getThread(threadId)

  thread.messages.push({ role: 'user', content: userMessage })

  const result = await agent.run({ messages: thread.messages })

  thread.messages.push({ role: 'assistant', content: result.content })

  return result
}
```

## Conversation State

Track conversation metadata:

```typescript
interface ConversationState {
  threadId: string
  userId: string
  messages: Message[]
  startedAt: Date
  lastActivity: Date
  metadata: {
    title?: string
    tags?: string[]
  }
}

// Use for analytics, recovery, etc.
```

## Best Practices

1. **Persist Conversations** — Store messages for later retrieval
2. **Summarize Old Context** — For long conversations, summarize earlier parts
3. **Handle Context Limits** — Trim or summarize when approaching token limits
4. **Include Metadata** — Track user IDs, timestamps, etc.
5. **Use Memory** — For persistent memory across conversations, see [Memory](../memory/index.md)

## Next Steps

- [Memory](../memory/index.md) — Persistent memory across conversations
- [Deployment](../integrations/deploy.md) — Build production chat APIs
