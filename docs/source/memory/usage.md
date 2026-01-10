# Using Memory

Integrate memory with agents to enable contextual, persistent conversations.

## Memory with Agents

Add memory to an agent:

```typescript
import { createAgent } from '@seashore/agent'
import { openaiText } from '@seashore/llm'
import { createShortTermMemory } from '@seashore/memory'

const memory = createShortTermMemory({
  maxEntries: 20,
  ttlMs: 1000 * 60 * 30,
})

const agent = createAgent({
  name: 'assistant',
  model: openaiText('gpt-4o'),
  systemPrompt: 'You are a helpful assistant with memory.',
})

// Use memory in conversation
async function chat(userMessage: string) {
  const threadId = 'user-session-123'

  // Store user message
  memory.add({
    agentId: 'assistant',
    threadId,
    type: 'short',
    content: `User: ${userMessage}`,
    importance: 0.5,
  })

  // Get relevant memories
  const memories = memory.queryByAgent('assistant', { threadId })
  const context = memories.map(m => m.content).join('\n')

  // Generate response with context
  const result = await agent.run(`
Previous context:
${context}

Current message: ${userMessage}
  `)

  // Store assistant response
  memory.add({
    agentId: 'assistant',
    threadId,
    type: 'short',
    content: `Assistant: ${result.content}`,
    importance: 0.4,
  })

  return result.content
}
```

## Memory Middleware

Automatic memory management with middleware:

```typescript
import { withMemory } from '@seashore/memory'

const agent = createAgent({
  name: 'assistant',
  model: openaiText('gpt-4o'),
  systemPrompt: 'You are helpful.',
})

// Wrap agent with memory
const agentWithMemory = await withMemory(agent, {
  shortTerm: createShortTermMemory({ maxEntries: 20 }),
  midTerm: await createMidTermMemory({
    connectionString: process.env.DATABASE_URL,
  }),
  longTerm: await createLongTermMemory({
    connectionString: process.env.DATABASE_URL,
  }),
})

// Memory is automatic
const response1 = await agentWithMemory.run('My name is Alice')
const response2 = await agentWithMemory.run('What is my name?')
// "Your name is Alice."
```

## Memory-Aware Prompts

Include memory in agent prompts:

```typescript
async function promptWithMemory(agent, memory, message, threadId) {
  const memories = memory.queryByAgent(agent.name, { threadId })

  const context = memories
    .sort((a, b) => b.importance - a.importance)
    .slice(0, 10)
    .map(m => `- ${m.content}`)
    .join('\n')

  const prompt = `
Relevant context:
${context}

User message: ${message}

Respond helpfully using the context when relevant.
`

  return await agent.run(prompt)
}
```

## Thread Management

Organize conversations into threads:

```typescript
class ConversationManager {
  private memory = createShortTermMemory({ maxEntries: 20 })

  async sendMessage(threadId: string, message: string) {
    // Add user message to memory
    this.memory.add({
      agentId: 'assistant',
      threadId,
      type: 'short',
      content: `User: ${message}`,
      importance: 0.6,
    })

    // Get conversation history
    const history = this.memory.queryByAgent('assistant', { threadId })
    const context = history.map(m => m.content).join('\n')

    // Generate response
    const agent = createAgent({
      name: 'assistant',
      model: openaiText('gpt-4o'),
      systemPrompt: `You are a helpful assistant.\n\nConversation:\n${context}`,
    })

    const result = await agent.run(message)

    // Add assistant response to memory
    this.memory.add({
      agentId: 'assistant',
      threadId,
      type: 'short',
      content: `Assistant: ${result.content}`,
      importance: 0.5,
    })

    return result
  }

  getThreadHistory(threadId: string) {
    return this.memory.queryByAgent('assistant', { threadId })
  }
}
```

## Memory Search

Search memories by content:

```typescript
import { createLongTermMemory } from '@seashore/memory'

const longTerm = await createLongTermMemory({
  connectionString: process.env.DATABASE_URL,
})

// Store user preferences
await longTerm.add({
  agentId: 'assistant',
  userId: 'user-123',
  type: 'long',
  content: 'User prefers Python over JavaScript',
  importance: 0.8,
  metadata: { category: 'preference' },
})

// Search for relevant memories
const results = await longTerm.search('programming languages', {
  userId: 'user-123',
  limit: 5,
})

results.forEach(mem => {
  console.log(`${mem.content} (score: ${mem.score})`)
})
```

## Memory with RAG

Combine memory with retrieval:

```typescript
import { createRAG } from '@seashore/rag'
import { createShortTermMemory } from '@seashore/memory'

const memory = createShortTermMemory({ maxEntries: 20 })
const rag = createRAG({ retriever: vectorRetriever })

async function contextualQuery(query: string, threadId: string) {
  // Get conversation context
  const conversationMemories = memory.queryByAgent('assistant', { threadId })

  // Get relevant documents
  const docResults = await rag.retrieve(query)

  // Combine both
  const context = `
Conversation history:
${conversationMemories.map(m => m.content).join('\n')}

Relevant documents:
${docResults.map(d => d.content).join('\n')}
  `

  const agent = createAgent({
    name: 'assistant',
    model: openaiText('gpt-4o'),
    systemPrompt: `Use the context to answer:\n${context}`,
  })

  return await agent.run(query)
}
```

## Memory Expiration

Handle memory expiration gracefully:

```typescript
const memory = createShortTermMemory({
  maxEntries: 20,
  ttlMs: 1000 * 60 * 30,
  onExpire: (entry) => {
    console.log(`Memory expired: ${entry.content}`)

    // Optionally consolidate to long-term
    if (entry.importance > 0.7) {
      longTermMemory.add({
        ...entry,
        type: 'long',
      })
    }
  },
})
```

## Best Practices

1. **Relevant Context** — Only include relevant memories in prompts
2. **Importance Scoring** — Use importance to prioritize memories
3. **Cleanup** — Regularly clean expired memories
4. **Privacy** — Don't store sensitive information
5. **Thread Organization** — Group conversations by thread

## Next Steps

- [Memory Consolidation](./consolidation.md) — Move memories between tiers
- [Deployment](../integrations/deploy.md) — Deploy agents with memory
