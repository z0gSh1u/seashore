/**
 * @seashore/memory - Mid-Term Memory
 *
 * Session-level memory stored in database with TTL
 */

import { eq, and, gte, lte, desc, sql } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { memories } from './schema.js';
import type { MemoryEntry, NewMemoryEntry, MidTermMemoryConfig } from './types.js';

/**
 * Default mid-term memory configuration
 */
const DEFAULT_CONFIG: Required<MidTermMemoryConfig> = {
  maxEntries: 100,
  ttlMs: 86400000, // 24 hours
  promotionThreshold: 0.5,
};

/**
 * Mid-term memory store
 */
export class MidTermMemory {
  private db: PostgresJsDatabase;
  private config: Required<MidTermMemoryConfig>;

  constructor(db: PostgresJsDatabase, config: MidTermMemoryConfig = {}) {
    this.db = db;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Add an entry to mid-term memory
   */
  public async add(entry: NewMemoryEntry): Promise<MemoryEntry> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.config.ttlMs);

    const [inserted] = await this.db
      .insert(memories)
      .values({
        agentId: entry.agentId,
        threadId: entry.threadId ?? null,
        type: 'mid',
        content: entry.content,
        importance: entry.importance ?? 0.5,
        embedding: entry.embedding as number[] | undefined,
        metadata: entry.metadata ?? null,
        createdAt: now,
        lastAccessedAt: now,
        accessCount: 0,
        expiresAt,
      })
      .returning();

    if (!inserted) {
      throw new Error('Failed to insert memory entry');
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
      .where(and(eq(memories.id, id), eq(memories.type, 'mid')));

    if (!entry) return null;

    // Check expiration
    if (entry.expiresAt && entry.expiresAt < new Date()) {
      await this.delete(id);
      return null;
    }

    // Update access
    await this.recordAccess(id);

    return this.toMemoryEntry(entry);
  }

  /**
   * Delete entry
   */
  public async delete(id: string): Promise<void> {
    await this.db.delete(memories).where(eq(memories.id, id));
  }

  /**
   * Query entries for an agent
   */
  public async queryByAgent(
    agentId: string,
    options: { threadId?: string; limit?: number; minImportance?: number } = {}
  ): Promise<readonly MemoryEntry[]> {
    const { threadId, limit = this.config.maxEntries, minImportance } = options;

    const conditions = [eq(memories.agentId, agentId), eq(memories.type, 'mid')];

    if (threadId) {
      conditions.push(eq(memories.threadId, threadId));
    }

    if (minImportance !== undefined) {
      conditions.push(gte(memories.importance, minImportance));
    }

    // Exclude expired
    conditions.push(sql`(${memories.expiresAt} IS NULL OR ${memories.expiresAt} > NOW())`);

    const results = await this.db
      .select()
      .from(memories)
      .where(and(...conditions))
      .orderBy(desc(memories.createdAt))
      .limit(limit);

    return results.map((r) => this.toMemoryEntry(r));
  }

  /**
   * Get candidates for promotion to long-term
   */
  public async getPromotionCandidates(
    agentId: string,
    minImportance: number
  ): Promise<readonly MemoryEntry[]> {
    const results = await this.db
      .select()
      .from(memories)
      .where(
        and(
          eq(memories.agentId, agentId),
          eq(memories.type, 'mid'),
          gte(memories.importance, minImportance)
        )
      )
      .orderBy(desc(memories.importance), desc(memories.accessCount));

    return results.map((r) => this.toMemoryEntry(r));
  }

  /**
   * Get expired entries
   */
  public async getExpiredEntries(agentId: string): Promise<readonly MemoryEntry[]> {
    const now = new Date();

    const results = await this.db
      .select()
      .from(memories)
      .where(
        and(eq(memories.agentId, agentId), eq(memories.type, 'mid'), lte(memories.expiresAt, now))
      );

    return results.map((r) => this.toMemoryEntry(r));
  }

  /**
   * Delete expired entries
   */
  public async cleanupExpired(agentId: string): Promise<number> {
    const now = new Date();

    const result = await this.db
      .delete(memories)
      .where(
        and(eq(memories.agentId, agentId), eq(memories.type, 'mid'), lte(memories.expiresAt, now))
      );

    return result.rowCount ?? 0;
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
   * Enforce max entries limit
   */
  private async enforceLimit(agentId: string): Promise<void> {
    // Get count
    const [{ count }] = await this.db
      .select({ count: sql<number>`COUNT(*)` })
      .from(memories)
      .where(and(eq(memories.agentId, agentId), eq(memories.type, 'mid')));

    if (count <= this.config.maxEntries) return;

    // Get IDs to delete (oldest with lowest importance)
    const toDelete = await this.db
      .select({ id: memories.id })
      .from(memories)
      .where(and(eq(memories.agentId, agentId), eq(memories.type, 'mid')))
      .orderBy(memories.importance, memories.createdAt)
      .limit(count - this.config.maxEntries);

    if (toDelete.length > 0) {
      await this.db.delete(memories).where(
        sql`${memories.id} IN (${sql.join(
          toDelete.map((r) => sql`${r.id}`),
          sql`, `
        )})`
      );
    }
  }

  /**
   * Get stats
   */
  public async getStats(agentId: string): Promise<{
    count: number;
    avgImportance: number;
  }> {
    const [result] = await this.db
      .select({
        count: sql<number>`COUNT(*)`,
        avgImportance: sql<number>`COALESCE(AVG(${memories.importance}), 0)`,
      })
      .from(memories)
      .where(
        and(
          eq(memories.agentId, agentId),
          eq(memories.type, 'mid'),
          sql`(${memories.expiresAt} IS NULL OR ${memories.expiresAt} > NOW())`
        )
      );

    return {
      count: Number(result?.count ?? 0),
      avgImportance: Number(result?.avgImportance ?? 0),
    };
  }

  /**
   * Clear all entries for an agent
   */
  public async clear(agentId: string): Promise<void> {
    await this.db
      .delete(memories)
      .where(and(eq(memories.agentId, agentId), eq(memories.type, 'mid')));
  }

  /**
   * Convert database row to MemoryEntry
   */
  private toMemoryEntry(row: typeof memories.$inferSelect): MemoryEntry {
    return {
      id: row.id,
      agentId: row.agentId,
      threadId: row.threadId ?? undefined,
      type: row.type as 'mid',
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
 * Create a mid-term memory instance
 */
export function createMidTermMemory(
  db: PostgresJsDatabase,
  config?: MidTermMemoryConfig
): MidTermMemory {
  return new MidTermMemory(db, config);
}
