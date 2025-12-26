/**
 * @seashore/memory - Long-Term Memory
 *
 * Persistent memory with vector search support
 */

import { eq, and, gte, desc, sql } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import type { VectorStore, EmbeddingFunction } from '@seashore/vectordb';
import { memories } from './schema.js';
import type {
  MemoryEntry,
  NewMemoryEntry,
  LongTermMemoryConfig,
  SemanticSearchOptions,
} from './types.js';

/**
 * Default long-term memory configuration
 */
const DEFAULT_CONFIG: Required<LongTermMemoryConfig> = {
  maxEntries: 1000,
  promotionThreshold: 0.7,
  enableVectorSearch: true,
};

/**
 * Long-term memory store with optional vector search
 */
export class LongTermMemory {
  private db: PostgresJsDatabase;
  private config: Required<LongTermMemoryConfig>;
  private vectorStore?: VectorStore;
  private embeddings?: EmbeddingFunction;

  constructor(
    db: PostgresJsDatabase,
    config: LongTermMemoryConfig = {},
    options?: {
      vectorStore?: VectorStore;
      embeddings?: EmbeddingFunction;
    }
  ) {
    this.db = db;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.vectorStore = options?.vectorStore;
    this.embeddings = options?.embeddings;
  }

  /**
   * Add an entry to long-term memory
   */
  public async add(entry: NewMemoryEntry): Promise<MemoryEntry> {
    const now = new Date();

    // Generate embedding if function provided and not already present
    let embedding = entry.embedding;
    if (!embedding && this.embeddings && this.config.enableVectorSearch) {
      const [emb] = await this.embeddings([entry.content]);
      embedding = emb;
    }

    const [inserted] = await this.db
      .insert(memories)
      .values({
        agentId: entry.agentId,
        threadId: entry.threadId ?? null,
        type: 'long',
        content: entry.content,
        importance: entry.importance ?? 0.7, // Higher default for long-term
        embedding: embedding as number[] | undefined,
        metadata: entry.metadata ?? null,
        createdAt: now,
        lastAccessedAt: now,
        accessCount: 0,
        expiresAt: null, // Long-term memories don't expire
      })
      .returning();

    if (!inserted) {
      throw new Error('Failed to insert memory entry');
    }

    // Add to vector store if enabled
    if (this.vectorStore && embedding) {
      await this.vectorStore.addDocuments([
        {
          content: entry.content,
          embedding: embedding as number[],
          metadata: {
            memoryId: inserted.id,
            agentId: entry.agentId,
            threadId: entry.threadId,
            ...entry.metadata,
          },
        },
      ]);
    }

    // Enforce limit
    await this.enforceLimit(entry.agentId);

    return this.toMemoryEntry(inserted);
  }

  /**
   * Get entry by ID
   */
  public async get(id: string): Promise<MemoryEntry | null> {
    const [entry] = await this.db
      .select()
      .from(memories)
      .where(and(eq(memories.id, id), eq(memories.type, 'long')));

    if (!entry) return null;

    // Update access
    await this.recordAccess(id);

    return this.toMemoryEntry(entry);
  }

  /**
   * Delete entry
   */
  public async delete(id: string): Promise<void> {
    await this.db.delete(memories).where(eq(memories.id, id));

    // Also delete from vector store if enabled
    if (this.vectorStore) {
      try {
        await this.vectorStore.deleteDocuments([id]);
      } catch {
        // Vector store might not have this document
      }
    }
  }

  /**
   * Query entries for an agent
   */
  public async queryByAgent(
    agentId: string,
    options: { threadId?: string; limit?: number; minImportance?: number } = {}
  ): Promise<readonly MemoryEntry[]> {
    const { threadId, limit = 50, minImportance } = options;

    const conditions = [eq(memories.agentId, agentId), eq(memories.type, 'long')];

    if (threadId) {
      conditions.push(eq(memories.threadId, threadId));
    }

    if (minImportance !== undefined) {
      conditions.push(gte(memories.importance, minImportance));
    }

    const results = await this.db
      .select()
      .from(memories)
      .where(and(...conditions))
      .orderBy(desc(memories.importance), desc(memories.lastAccessedAt))
      .limit(limit);

    return results.map((r) => this.toMemoryEntry(r));
  }

  /**
   * Semantic search for relevant memories
   */
  public async search(options: SemanticSearchOptions): Promise<readonly MemoryEntry[]> {
    const { agentId, threadId, query, limit = 10, minScore = 0.5, types = ['long'] } = options;

    // Use vector store if available
    if (this.vectorStore && this.embeddings) {
      const [queryEmbedding] = await this.embeddings([query]);

      if (!queryEmbedding) {
        throw new Error('Failed to generate query embedding');
      }

      const filter: Record<string, unknown> = { agentId };
      if (threadId) {
        filter.threadId = threadId;
      }

      const results = await this.vectorStore.searchByVector(queryEmbedding, {
        limit,
        minScore,
        filter,
      });

      // Get full memory entries
      const memoryIds = results.documents
        .map((d) => d.document.metadata?.memoryId)
        .filter((id): id is string => typeof id === 'string');

      if (memoryIds.length === 0) {
        return [];
      }

      const entries = await this.db
        .select()
        .from(memories)
        .where(
          sql`${memories.id} IN (${sql.join(
            memoryIds.map((id) => sql`${id}`),
            sql`, `
          )})`
        );

      // Maintain order from vector search
      const entryMap = new Map(entries.map((e) => [e.id, e]));
      return memoryIds
        .map((id) => entryMap.get(id))
        .filter((e): e is typeof memories.$inferSelect => e !== undefined)
        .map((e) => this.toMemoryEntry(e));
    }

    // Fallback to basic text search
    const conditions = [eq(memories.agentId, agentId), eq(memories.type, 'long')];

    if (threadId) {
      conditions.push(eq(memories.threadId, threadId));
    }

    // Simple ILIKE search
    conditions.push(sql`${memories.content} ILIKE ${'%' + query + '%'}`);

    const results = await this.db
      .select()
      .from(memories)
      .where(and(...conditions))
      .orderBy(desc(memories.importance))
      .limit(limit);

    return results.map((r) => this.toMemoryEntry(r));
  }

  /**
   * Record access to an entry
   */
  public async recordAccess(id: string): Promise<void> {
    await this.db
      .update(memories)
      .set({
        lastAccessedAt: new Date(),
        accessCount: sql`${memories.accessCount} + 1`,
      })
      .where(eq(memories.id, id));
  }

  /**
   * Update importance of an entry
   */
  public async updateImportance(id: string, importance: number): Promise<void> {
    await this.db.update(memories).set({ importance }).where(eq(memories.id, id));
  }

  /**
   * Enforce max entries limit
   */
  private async enforceLimit(agentId: string): Promise<void> {
    // Get count
    const [{ count }] = await this.db
      .select({ count: sql<number>`COUNT(*)` })
      .from(memories)
      .where(and(eq(memories.agentId, agentId), eq(memories.type, 'long')));

    if (count <= this.config.maxEntries) return;

    // Get IDs to delete (lowest importance and least accessed)
    const toDelete = await this.db
      .select({ id: memories.id })
      .from(memories)
      .where(and(eq(memories.agentId, agentId), eq(memories.type, 'long')))
      .orderBy(memories.importance, memories.accessCount, memories.createdAt)
      .limit(count - this.config.maxEntries);

    if (toDelete.length > 0) {
      const ids = toDelete.map((r) => r.id);

      await this.db.delete(memories).where(
        sql`${memories.id} IN (${sql.join(
          ids.map((id) => sql`${id}`),
          sql`, `
        )})`
      );

      // Also delete from vector store
      if (this.vectorStore) {
        try {
          await this.vectorStore.deleteDocuments(ids);
        } catch {
          // Ignore errors
        }
      }
    }
  }

  /**
   * Get stats
   */
  public async getStats(agentId: string): Promise<{
    count: number;
    avgImportance: number;
    oldestMemory: Date | null;
    newestMemory: Date | null;
  }> {
    const [result] = await this.db
      .select({
        count: sql<number>`COUNT(*)`,
        avgImportance: sql<number>`COALESCE(AVG(${memories.importance}), 0)`,
        oldestMemory: sql<Date | null>`MIN(${memories.createdAt})`,
        newestMemory: sql<Date | null>`MAX(${memories.createdAt})`,
      })
      .from(memories)
      .where(and(eq(memories.agentId, agentId), eq(memories.type, 'long')));

    return {
      count: Number(result?.count ?? 0),
      avgImportance: Number(result?.avgImportance ?? 0),
      oldestMemory: result?.oldestMemory ?? null,
      newestMemory: result?.newestMemory ?? null,
    };
  }

  /**
   * Clear all entries for an agent
   */
  public async clear(agentId: string): Promise<void> {
    // Get all IDs first for vector store cleanup
    const entries = await this.db
      .select({ id: memories.id })
      .from(memories)
      .where(and(eq(memories.agentId, agentId), eq(memories.type, 'long')));

    await this.db
      .delete(memories)
      .where(and(eq(memories.agentId, agentId), eq(memories.type, 'long')));

    // Clean up vector store
    if (this.vectorStore && entries.length > 0) {
      try {
        await this.vectorStore.deleteDocuments(entries.map((e) => e.id));
      } catch {
        // Ignore errors
      }
    }
  }

  /**
   * Convert database row to MemoryEntry
   */
  private toMemoryEntry(row: typeof memories.$inferSelect): MemoryEntry {
    return {
      id: row.id,
      agentId: row.agentId,
      threadId: row.threadId ?? undefined,
      type: row.type as 'long',
      content: row.content,
      importance: row.importance,
      embedding: row.embedding ?? undefined,
      createdAt: row.createdAt,
      lastAccessedAt: row.lastAccessedAt,
      accessCount: row.accessCount,
      metadata: row.metadata ?? undefined,
    };
  }
}

/**
 * Create a long-term memory instance
 */
export function createLongTermMemory(
  db: PostgresJsDatabase,
  config?: LongTermMemoryConfig,
  options?: {
    vectorStore?: VectorStore;
    embeddings?: EmbeddingFunction;
  }
): LongTermMemory {
  return new LongTermMemory(db, config, options);
}
