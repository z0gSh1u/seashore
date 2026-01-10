# Memory Consolidation

Memory consolidation moves important information from short-term to long-term memory, mimicking how human brains work.

## Why Consolidate?

- **Short-term memory** is limited and temporary
- **Long-term memory** is permanent but slower
- **Consolidation** moves important memories to long-term storage

## Manual Consolidation

Manually move memories between tiers:

```typescript
import {
  createShortTermMemory,
  createLongTermMemory,
} from '@seashore/memory'

const shortTerm = createShortTermMemory({ maxEntries: 20 })
const longTerm = await createLongTermMemory({
  connectionString: process.env.DATABASE_URL,
})

// Get important memories from short-term
const importantMemories = shortTerm.queryByAgent('assistant', {
  minImportance: 0.7,
})

// Move to long-term
for (const memory of importantMemories) {
  await longTerm.add({
    ...memory,
    type: 'long',
  })
}

// Remove from short-term
shortTerm.clear()
```

## Automatic Consolidation

Consolidate memories automatically:

```typescript
import { consolidateMemories } from '@seashore/memory'

// Consolidate from short-term to mid-term
await consolidateMemories({
  from: shortTerm,
  to: midTerm,
  threshold: 0.7, // Only consolidate memories with importance >= 0.7
  maxAge: 1000 * 60 * 30, // Older than 30 minutes
})

// Consolidate from mid-term to long-term
await consolidateMemories({
  from: midTerm,
  to: longTerm,
  threshold: 0.8, // Higher threshold for long-term
  maxAge: 1000 * 60 * 60 * 24, // Older than 24 hours
})
```

## Smart Consolidation

Use LLM to consolidate and summarize:

```typescript
import { openaiText } from '@seashore/llm'

async function smartConsolidate(
  memories: MemoryEntry[],
  targetTier: 'mid' | 'long'
) {
  const model = openaiText('gpt-4o')

  // Group by topic
  const groups = groupMemoriesByTopic(memories)

  const consolidated = []

  for (const [topic, groupMemories] of Object.entries(groups)) {
    // Summarize the group
    const summary = await model.chat({
      messages: [
        {
          role: 'system',
          content: 'Summarize these memories into a single concise statement.',
        },
        {
          role: 'user',
          content: groupMemories.map(m => m.content).join('\n'),
        },
      ],
    })

    consolidated.push({
      agentId: 'assistant',
      type: targetTier,
      content: summary.content,
      importance: Math.max(...groupMemories.map(m => m.importance)),
      metadata: {
        consolidatedFrom: groupMemories.length,
        topic,
      },
    })
  }

  return consolidated
}
```

## Scheduled Consolidation

Run consolidation on a schedule:

```typescript
import { setInterval } from 'timers/promises'

async function runConsolidation() {
  // Every 30 minutes
  setInterval(async () => {
    await consolidateMemories({
      from: shortTerm,
      to: midTerm,
      threshold: 0.7,
      maxAge: 1000 * 60 * 30,
    })
  }, 1000 * 60 * 30)

  // Every 24 hours
  setInterval(async () => {
    await consolidateMemories({
      from: midTerm,
      to: longTerm,
      threshold: 0.8,
      maxAge: 1000 * 60 * 60 * 24,
    })
  }, 1000 * 60 * 60 * 24)
}
```

## Consolidation Triggers

Consolidate based on events:

```typescript
class MemoryManager {
  private shortTerm = createShortTermMemory({ maxEntries: 20 })
  private midTerm = await createMidTermMemory({ ... })
  private longTerm = await createLongTermMemory({ ... })

  async addMemory(entry: MemoryEntry) {
    this.shortTerm.add(entry)

    // Check if we should consolidate
    const count = this.shortTerm.queryByAgent('assistant').length

    if (count >= 15) {
      // Short-term is filling up, consolidate
      await this.consolidateToMid()
    }
  }

  async consolidateToMid() {
    await consolidateMemories({
      from: this.shortTerm,
      to: this.midTerm,
      threshold: 0.6,
    })
  }

  async consolidateToLong() {
    await consolidateMemories({
      from: this.midTerm,
      to: this.longTerm,
      threshold: 0.8,
    })
  }
}
```

## Deduplication

Remove duplicate memories during consolidation:

```typescript
async function deduplicateMemories(memories: MemoryEntry[]) {
  const seen = new Set<string>()
  const unique: MemoryEntry[] = []

  for (const memory of memories) {
    // Simple dedup by content
    const key = memory.content.toLowerCase().trim()

    if (!seen.has(key)) {
      seen.add(key)
      unique.push(memory)
    } else {
      // Keep the one with higher importance
      const existing = unique.find(m =>
        m.content.toLowerCase().trim() === key
      )
      if (existing && memory.importance > existing.importance) {
        Object.assign(existing, memory)
      }
    }
  }

  return unique
}
```

## Memory Compression

Compress similar memories:

```typescript
async function compressMemories(memories: MemoryEntry[]) {
  // Cluster similar memories
  const clusters = await clusterMemories(memories)

  const compressed = []

  for (const cluster of clusters) {
    // Create a summary
    const summary = await summarizeMemories(cluster)

    compressed.push({
      ...cluster[0],
      content: summary,
      importance: Math.max(...cluster.map(m => m.importance)),
      metadata: {
        compressedFrom: cluster.length,
        originalIds: cluster.map(m => m.id),
      },
    })
  }

  return compressed
}
```

## Best Practices

1. **Threshold Tuning** — Adjust thresholds based on your use case
2. **Regular Consolidation** — Run on a schedule to prevent overflow
3. **Summarization** — Summarize when consolidating many memories
4. **Deduplication** — Remove duplicates to save space
5. **Importance Scoring** — Recalculate importance during consolidation

## Next Steps

- [Using Memory](./usage.md) — Integrate memory with agents
- [Deployment](../integrations/deploy.md) — Deploy production memory systems
