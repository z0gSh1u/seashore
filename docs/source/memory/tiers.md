# Memory Tiers

Seashore provides three memory tiers, each optimized for different use cases.

## Memory Tiers Overview

| Tier | Duration | Size | Use Case |
|------|----------|------|----------|
| **Short-term** | Minutes to hours | Tens of entries | Current conversation context |
| **Mid-term** | Hours to days | Hundreds of entries | Recent sessions |
| **Long-term** | Indefinite | Unlimited | Important facts, preferences |

## Short-Term Memory

For active conversation context:

```typescript
import { createShortTermMemory } from '@seashore/memory'

const memory = createShortTermMemory({
  maxEntries: 20,           // Maximum memories per agent
  ttlMs: 1000 * 60 * 30,    // 30 minutes expiration
})

// Add a memory
memory.add({
  agentId: 'assistant',
  threadId: 'conversation-123',
  type: 'short',
  content: 'User prefers concise answers',
  importance: 0.8,
  metadata: { preference: true },
})

// Query memories
const memories = memory.queryByAgent('assistant', {
  threadId: 'conversation-123',
})

// Clean up when done
memory.dispose()
```

## Mid-Term Memory

For recent sessions and context:

```typescript
import { createMidTermMemory } from '@seashore/memory'

const memory = await createMidTermMemory({
  connectionString: process.env.DATABASE_URL,
  ttlMs: 1000 * 60 * 60 * 24, // 24 hours
})

// Memories persist across sessions
await memory.add({
  agentId: 'assistant',
  threadId: 'user-456',
  type: 'mid',
  content: 'User is working on a TypeScript project',
  importance: 0.7,
})

const recentMemories = await memory.queryByAgent('assistant', {
  threadId: 'user-456',
  limit: 10,
})
```

## Long-Term Memory

For persistent knowledge and user preferences:

```typescript
import { createLongTermMemory } from '@seashore/memory'

const memory = await createLongTermMemory({
  connectionString: process.env.DATABASE_URL,
  // No TTL - memories persist indefinitely
})

// Store important information
await memory.add({
  agentId: 'assistant',
  userId: 'user-789',
  type: 'long',
  content: 'User is a software engineer, prefers TypeScript',
  importance: 0.9,
  metadata: {
    category: 'profile',
    verified: true,
  },
})

// Search by content
const results = await memory.search('TypeScript', {
  userId: 'user-789',
  threshold: 0.7,
})
```

## Memory Entry Structure

All memory entries share a common structure:

```typescript
interface MemoryEntry {
  agentId: string
  threadId?: string
  userId?: string
  type: 'short' | 'mid' | 'long'
  content: string
  importance: number  // 0-1, higher = more important
  metadata: Record<string, unknown>
  createdAt: Date
  expiresAt?: Date
}
```

## Importance Scoring

Importance determines which memories to keep or consolidate:

```typescript
import { calculateImportance } from '@seashore/memory'

const importance = calculateImportance({
  content: 'User prefers Python',
  frequency: 5,          // Mentioned 5 times
  recency: Date.now(),   // Recent mention
  explicit: true,        // Explicitly stated
})

// Higher importance = longer retention
```

## Memory Selection

Select appropriate tier based on use case:

```typescript
// Current conversation
const shortTerm = createShortTermMemory({ maxEntries: 20 })

// Recent sessions (hours to days)
const midTerm = await createMidTermMemory({
  connectionString: process.env.DATABASE_URL,
  ttlMs: 1000 * 60 * 60 * 24, // 24 hours
})

// Permanent storage
const longTerm = await createLongTermMemory({
  connectionString: process.env.DATABASE_URL,
})
```

## Memory Querying

Query memories with filters:

```typescript
// By agent
const memories = memory.queryByAgent('assistant')

// By thread
const threadMemories = memory.queryByAgent('assistant', {
  threadId: 'conv-123',
})

// By importance
const importantMemories = memory.queryByAgent('assistant', {
  minImportance: 0.7,
})

// By time range
const recentMemories = memory.queryByAgent('assistant', {
  after: new Date(Date.now() - 1000 * 60 * 60), // Last hour
})
```

## Best Practices

1. **Right Tier** — Use the appropriate tier for your use case
2. **Importance** — Score memories to prioritize retention
3. **Consolidation** — Move important memories to long-term
4. **Cleanup** — Regularly clean expired memories
5. **Privacy** — Handle sensitive data appropriately

## Next Steps

- [Using Memory](./usage.md) — Integrate with agents
- [Memory Consolidation](./consolidation.md) — Move between tiers
