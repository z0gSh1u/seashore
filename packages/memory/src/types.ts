/**
 * @seashore/memory - Type Definitions
 *
 * Types for agent memory system (short/mid/long-term)
 */

/**
 * Memory entry types
 */
export type MemoryType = 'short' | 'mid' | 'long';

/**
 * Memory entry stored in the system
 */
export interface MemoryEntry {
  /**
   * Unique identifier
   */
  id: string;

  /**
   * Agent ID this memory belongs to
   */
  agentId: string;

  /**
   * Thread/conversation ID (optional)
   */
  threadId?: string;

  /**
   * Memory type
   */
  type: MemoryType;

  /**
   * Content of the memory
   */
  content: string;

  /**
   * Importance score (0-1)
   */
  importance: number;

  /**
   * Embedding vector for semantic search
   */
  embedding?: readonly number[];

  /**
   * When memory was created
   */
  createdAt: Date;

  /**
   * When memory was last accessed
   */
  lastAccessedAt: Date;

  /**
   * Access count
   */
  accessCount: number;

  /**
   * Additional metadata
   */
  metadata?: Record<string, unknown>;
}

/**
 * New memory entry (for creation)
 */
export interface NewMemoryEntry {
  agentId: string;
  threadId?: string;
  type: MemoryType;
  content: string;
  importance?: number;
  embedding?: readonly number[];
  metadata?: Record<string, unknown>;
}

/**
 * Memory query options
 */
export interface MemoryQueryOptions {
  /**
   * Filter by agent ID
   */
  agentId: string;

  /**
   * Filter by thread ID
   */
  threadId?: string;

  /**
   * Filter by memory types
   */
  types?: readonly MemoryType[];

  /**
   * Minimum importance threshold
   */
  minImportance?: number;

  /**
   * Maximum number of results
   */
  limit?: number;

  /**
   * Offset for pagination
   */
  offset?: number;

  /**
   * Include embeddings in results
   */
  includeEmbeddings?: boolean;
}

/**
 * Semantic search options
 */
export interface SemanticSearchOptions extends MemoryQueryOptions {
  /**
   * Query text for semantic search
   */
  query: string;

  /**
   * Minimum similarity score
   */
  minScore?: number;
}

/**
 * Memory store interface
 */
export interface MemoryStore {
  /**
   * Add a new memory entry
   */
  add(entry: NewMemoryEntry): Promise<MemoryEntry>;

  /**
   * Get memory by ID
   */
  get(id: string): Promise<MemoryEntry | null>;

  /**
   * Update memory entry
   */
  update(id: string, updates: Partial<NewMemoryEntry>): Promise<MemoryEntry>;

  /**
   * Delete memory entry
   */
  delete(id: string): Promise<void>;

  /**
   * Query memories
   */
  query(options: MemoryQueryOptions): Promise<readonly MemoryEntry[]>;

  /**
   * Semantic search
   */
  search(options: SemanticSearchOptions): Promise<readonly MemoryEntry[]>;

  /**
   * Record memory access (updates lastAccessedAt and accessCount)
   */
  recordAccess(id: string): Promise<void>;

  /**
   * Get memory statistics
   */
  getStats(agentId: string): Promise<MemoryStats>;
}

/**
 * Memory statistics
 */
export interface MemoryStats {
  totalCount: number;
  byType: {
    short: number;
    mid: number;
    long: number;
  };
  avgImportance: number;
  oldestMemory: Date | null;
  newestMemory: Date | null;
}

/**
 * Short-term memory configuration
 */
export interface ShortTermMemoryConfig {
  /**
   * Maximum number of entries to keep
   * @default 10
   */
  maxEntries?: number;

  /**
   * TTL in milliseconds (default: 1 hour)
   * @default 3600000
   */
  ttlMs?: number;
}

/**
 * Mid-term memory configuration
 */
export interface MidTermMemoryConfig {
  /**
   * Maximum number of entries to keep
   * @default 100
   */
  maxEntries?: number;

  /**
   * TTL in milliseconds (default: 24 hours)
   * @default 86400000
   */
  ttlMs?: number;

  /**
   * Minimum importance to promote from short-term
   * @default 0.5
   */
  promotionThreshold?: number;
}

/**
 * Long-term memory configuration
 */
export interface LongTermMemoryConfig {
  /**
   * Maximum number of entries to keep
   * @default 1000
   */
  maxEntries?: number;

  /**
   * Minimum importance to promote from mid-term
   * @default 0.7
   */
  promotionThreshold?: number;

  /**
   * Enable vector search for long-term memory
   * @default true
   */
  enableVectorSearch?: boolean;
}

/**
 * Memory manager configuration
 */
export interface MemoryManagerConfig {
  /**
   * Agent ID
   */
  agentId: string;

  /**
   * Memory store instance
   */
  store: MemoryStore;

  /**
   * Embedding function for semantic search
   */
  embeddings?: (texts: readonly string[]) => Promise<readonly number[][]>;

  /**
   * Short-term memory config
   */
  shortTerm?: ShortTermMemoryConfig;

  /**
   * Mid-term memory config
   */
  midTerm?: MidTermMemoryConfig;

  /**
   * Long-term memory config
   */
  longTerm?: LongTermMemoryConfig;

  /**
   * Enable automatic consolidation
   * @default true
   */
  autoConsolidate?: boolean;

  /**
   * Consolidation interval in milliseconds
   * @default 300000 (5 minutes)
   */
  consolidationInterval?: number;
}

/**
 * Memory manager interface
 */
export interface MemoryManager {
  /**
   * Add a memory (automatically determines type based on importance)
   */
  remember(content: string, options?: RememberOptions): Promise<MemoryEntry>;

  /**
   * Recall memories relevant to a query
   */
  recall(query: string, options?: RecallOptions): Promise<readonly MemoryEntry[]>;

  /**
   * Get recent conversation context
   */
  getContext(threadId: string, options?: ContextOptions): Promise<string>;

  /**
   * Forget a specific memory
   */
  forget(id: string): Promise<void>;

  /**
   * Consolidate memories (promote important ones, remove old ones)
   */
  consolidate(): Promise<ConsolidationResult>;

  /**
   * Get memory statistics
   */
  getStats(): Promise<MemoryStats>;

  /**
   * Clear all memories for this agent
   */
  clear(): Promise<void>;
}

/**
 * Options for remembering
 */
export interface RememberOptions {
  /**
   * Thread ID to associate with
   */
  threadId?: string;

  /**
   * Override automatic importance calculation
   */
  importance?: number;

  /**
   * Force specific memory type
   */
  type?: MemoryType;

  /**
   * Additional metadata
   */
  metadata?: Record<string, unknown>;
}

/**
 * Options for recalling
 */
export interface RecallOptions {
  /**
   * Thread ID to filter by
   */
  threadId?: string;

  /**
   * Memory types to include
   */
  types?: readonly MemoryType[];

  /**
   * Maximum number of memories to return
   * @default 10
   */
  limit?: number;

  /**
   * Minimum relevance score
   * @default 0.5
   */
  minScore?: number;

  /**
   * Include recent short-term memories regardless of score
   * @default true
   */
  includeRecent?: boolean;
}

/**
 * Options for getting context
 */
export interface ContextOptions {
  /**
   * Maximum number of messages to include
   * @default 10
   */
  maxMessages?: number;

  /**
   * Include relevant long-term memories
   * @default true
   */
  includeLongTerm?: boolean;

  /**
   * Format: 'text' | 'json'
   * @default 'text'
   */
  format?: 'text' | 'json';
}

/**
 * Result of memory consolidation
 */
export interface ConsolidationResult {
  /**
   * Memories promoted from short to mid
   */
  promotedToMid: number;

  /**
   * Memories promoted from mid to long
   */
  promotedToLong: number;

  /**
   * Expired short-term memories removed
   */
  expiredShort: number;

  /**
   * Expired mid-term memories removed
   */
  expiredMid: number;

  /**
   * Low-importance memories removed
   */
  removed: number;
}

/**
 * Importance evaluator function
 */
export type ImportanceEvaluator = (
  content: string,
  context?: { threadId?: string; recentMemories?: readonly MemoryEntry[] }
) => Promise<number>;

/**
 * Agent wrapper options
 */
export interface WithMemoryOptions {
  /**
   * Memory manager instance
   */
  memory: MemoryManager;

  /**
   * Include memory context in system prompt
   * @default true
   */
  includeInSystemPrompt?: boolean;

  /**
   * Maximum memories to include in context
   * @default 5
   */
  maxMemoriesInContext?: number;

  /**
   * Auto-remember user messages
   * @default true
   */
  autoRemember?: boolean;

  /**
   * Auto-remember assistant responses
   * @default false
   */
  autoRememberResponses?: boolean;
}
