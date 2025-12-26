/**
 * @seashore/memory - Short-Term Memory
 *
 * In-memory cache for recent conversation context
 */

import type { MemoryEntry, NewMemoryEntry, MemoryStore, ShortTermMemoryConfig } from './types.js';

/**
 * Default short-term memory configuration
 */
const DEFAULT_CONFIG: Required<ShortTermMemoryConfig> = {
  maxEntries: 10,
  ttlMs: 3600000, // 1 hour
};

/**
 * In-memory short-term memory store
 */
export class ShortTermMemory {
  private entries: Map<string, MemoryEntry> = new Map();
  private agentIndex: Map<string, Set<string>> = new Map();
  private threadIndex: Map<string, Set<string>> = new Map();
  private config: Required<ShortTermMemoryConfig>;
  private cleanupTimer?: ReturnType<typeof setInterval>;

  constructor(config: ShortTermMemoryConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.startCleanupTimer();
  }

  /**
   * Start periodic cleanup timer
   */
  private startCleanupTimer(): void {
    // Run cleanup every minute
    this.cleanupTimer = setInterval(() => this.cleanup(), 60000);
  }

  /**
   * Stop cleanup timer
   */
  public dispose(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
  }

  /**
   * Add an entry to short-term memory
   */
  public add(entry: NewMemoryEntry): MemoryEntry {
    const now = new Date();
    const id = crypto.randomUUID();

    const memoryEntry: MemoryEntry = {
      id,
      agentId: entry.agentId,
      threadId: entry.threadId,
      type: 'short',
      content: entry.content,
      importance: entry.importance ?? 0.5,
      embedding: entry.embedding,
      createdAt: now,
      lastAccessedAt: now,
      accessCount: 0,
      metadata: entry.metadata,
    };

    this.entries.set(id, memoryEntry);

    // Update agent index
    let agentSet = this.agentIndex.get(entry.agentId);
    if (!agentSet) {
      agentSet = new Set();
      this.agentIndex.set(entry.agentId, agentSet);
    }
    agentSet.add(id);

    // Update thread index if applicable
    if (entry.threadId) {
      let threadSet = this.threadIndex.get(entry.threadId);
      if (!threadSet) {
        threadSet = new Set();
        this.threadIndex.set(entry.threadId, threadSet);
      }
      threadSet.add(id);
    }

    // Enforce max entries per agent
    this.enforceLimit(entry.agentId);

    return memoryEntry;
  }

  /**
   * Get entry by ID
   */
  public get(id: string): MemoryEntry | null {
    const entry = this.entries.get(id);
    if (!entry) return null;

    // Check if expired
    if (this.isExpired(entry)) {
      this.delete(id);
      return null;
    }

    // Update access
    entry.lastAccessedAt = new Date();
    entry.accessCount++;

    return entry;
  }

  /**
   * Delete entry
   */
  public delete(id: string): void {
    const entry = this.entries.get(id);
    if (!entry) return;

    this.entries.delete(id);

    // Update agent index
    const agentSet = this.agentIndex.get(entry.agentId);
    agentSet?.delete(id);

    // Update thread index
    if (entry.threadId) {
      const threadSet = this.threadIndex.get(entry.threadId);
      threadSet?.delete(id);
    }
  }

  /**
   * Query entries for an agent
   */
  public queryByAgent(
    agentId: string,
    options: { threadId?: string; limit?: number } = {}
  ): readonly MemoryEntry[] {
    const { threadId, limit = this.config.maxEntries } = options;

    let ids: Set<string>;

    if (threadId) {
      ids = this.threadIndex.get(threadId) ?? new Set();
    } else {
      ids = this.agentIndex.get(agentId) ?? new Set();
    }

    const entries: MemoryEntry[] = [];

    for (const id of ids) {
      const entry = this.entries.get(id);
      if (entry && !this.isExpired(entry)) {
        entries.push(entry);
      }
    }

    // Sort by creation time (most recent first)
    entries.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    return entries.slice(0, limit);
  }

  /**
   * Get all entries ready for consolidation (high importance or frequently accessed)
   */
  public getConsolidationCandidates(
    agentId: string,
    minImportance: number
  ): readonly MemoryEntry[] {
    const agentIds = this.agentIndex.get(agentId) ?? new Set();
    const candidates: MemoryEntry[] = [];

    for (const id of agentIds) {
      const entry = this.entries.get(id);
      if (
        entry &&
        !this.isExpired(entry) &&
        (entry.importance >= minImportance || entry.accessCount >= 3)
      ) {
        candidates.push(entry);
      }
    }

    return candidates;
  }

  /**
   * Get expired entries for cleanup
   */
  public getExpiredEntries(agentId: string): readonly MemoryEntry[] {
    const agentIds = this.agentIndex.get(agentId) ?? new Set();
    const expired: MemoryEntry[] = [];

    for (const id of agentIds) {
      const entry = this.entries.get(id);
      if (entry && this.isExpired(entry)) {
        expired.push(entry);
      }
    }

    return expired;
  }

  /**
   * Check if entry is expired
   */
  private isExpired(entry: MemoryEntry): boolean {
    const age = Date.now() - entry.createdAt.getTime();
    return age > this.config.ttlMs;
  }

  /**
   * Enforce max entries limit for an agent
   */
  private enforceLimit(agentId: string): void {
    const agentIds = this.agentIndex.get(agentId);
    if (!agentIds || agentIds.size <= this.config.maxEntries) return;

    // Get all entries and sort by importance * recency
    const entries: Array<{ id: string; score: number }> = [];
    for (const id of agentIds) {
      const entry = this.entries.get(id);
      if (entry) {
        // Score based on importance and recency
        const recency = 1 - (Date.now() - entry.createdAt.getTime()) / this.config.ttlMs;
        const score = entry.importance * 0.7 + Math.max(0, recency) * 0.3;
        entries.push({ id, score });
      }
    }

    // Sort by score (lowest first)
    entries.sort((a, b) => a.score - b.score);

    // Remove excess entries (lowest scores)
    const toRemove = entries.slice(0, entries.length - this.config.maxEntries);
    for (const { id } of toRemove) {
      this.delete(id);
    }
  }

  /**
   * Cleanup expired entries
   */
  private cleanup(): void {
    for (const [id, entry] of this.entries) {
      if (this.isExpired(entry)) {
        this.delete(id);
      }
    }
  }

  /**
   * Get stats
   */
  public getStats(agentId: string): {
    count: number;
    avgImportance: number;
  } {
    const agentIds = this.agentIndex.get(agentId) ?? new Set();
    let totalImportance = 0;
    let count = 0;

    for (const id of agentIds) {
      const entry = this.entries.get(id);
      if (entry && !this.isExpired(entry)) {
        totalImportance += entry.importance;
        count++;
      }
    }

    return {
      count,
      avgImportance: count > 0 ? totalImportance / count : 0,
    };
  }

  /**
   * Clear all entries for an agent
   */
  public clear(agentId: string): void {
    const agentIds = this.agentIndex.get(agentId);
    if (!agentIds) return;

    for (const id of agentIds) {
      const entry = this.entries.get(id);
      if (entry?.threadId) {
        const threadSet = this.threadIndex.get(entry.threadId);
        threadSet?.delete(id);
      }
      this.entries.delete(id);
    }

    this.agentIndex.delete(agentId);
  }
}

/**
 * Create a short-term memory instance
 */
export function createShortTermMemory(config?: ShortTermMemoryConfig): ShortTermMemory {
  return new ShortTermMemory(config);
}
