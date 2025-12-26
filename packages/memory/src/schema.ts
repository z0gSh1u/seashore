/**
 * @seashore/memory - Schema Definitions
 *
 * Drizzle ORM schema for memory storage
 */

import {
  pgTable,
  text,
  timestamp,
  real,
  integer,
  jsonb,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';

/**
 * Memories table schema
 */
export const memories = pgTable(
  'memories',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    agentId: text('agent_id').notNull(),
    threadId: text('thread_id'),
    type: text('type', { enum: ['short', 'mid', 'long'] }).notNull(),
    content: text('content').notNull(),
    importance: real('importance').notNull().default(0.5),
    embedding: jsonb('embedding').$type<number[]>(),
    accessCount: integer('access_count').notNull().default(0),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    lastAccessedAt: timestamp('last_accessed_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
  },
  (table) => [
    index('memories_agent_id_idx').on(table.agentId),
    index('memories_thread_id_idx').on(table.threadId),
    index('memories_type_idx').on(table.type),
    index('memories_importance_idx').on(table.importance),
    index('memories_created_at_idx').on(table.createdAt),
    index('memories_last_accessed_idx').on(table.lastAccessedAt),
    index('memories_expires_at_idx').on(table.expiresAt),
    // Composite index for common queries
    index('memories_agent_type_idx').on(table.agentId, table.type),
  ]
);

/**
 * Memory summaries - condensed versions of conversation threads
 */
export const memorySummaries = pgTable(
  'memory_summaries',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    agentId: text('agent_id').notNull(),
    threadId: text('thread_id'),
    summary: text('summary').notNull(),
    keyPoints: jsonb('key_points').$type<string[]>(),
    entities: jsonb('entities').$type<string[]>(),
    embedding: jsonb('embedding').$type<number[]>(),
    sourceMemoryIds: jsonb('source_memory_ids').$type<string[]>(),
    messageCount: integer('message_count').notNull().default(0),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('memory_summaries_agent_id_idx').on(table.agentId),
    index('memory_summaries_thread_id_idx').on(table.threadId),
    uniqueIndex('memory_summaries_agent_thread_idx').on(table.agentId, table.threadId),
  ]
);

/**
 * Memory facts - extracted key facts for quick retrieval
 */
export const memoryFacts = pgTable(
  'memory_facts',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    agentId: text('agent_id').notNull(),
    subject: text('subject').notNull(),
    predicate: text('predicate').notNull(),
    object: text('object').notNull(),
    confidence: real('confidence').notNull().default(1.0),
    sourceMemoryId: text('source_memory_id'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('memory_facts_agent_id_idx').on(table.agentId),
    index('memory_facts_subject_idx').on(table.subject),
    index('memory_facts_predicate_idx').on(table.predicate),
    // For "user's name is X" type lookups
    index('memory_facts_agent_subject_predicate_idx').on(
      table.agentId,
      table.subject,
      table.predicate
    ),
  ]
);

/**
 * Relations
 */
export const memoriesRelations = relations(memories, ({ one }) => ({
  summary: one(memorySummaries, {
    fields: [memories.threadId],
    references: [memorySummaries.threadId],
  }),
}));

export const memorySummariesRelations = relations(memorySummaries, ({ many }) => ({
  memories: many(memories),
}));

export const memoryFactsRelations = relations(memoryFacts, ({ one }) => ({
  sourceMemory: one(memories, {
    fields: [memoryFacts.sourceMemoryId],
    references: [memories.id],
  }),
}));

/**
 * Type exports for Drizzle
 */
export type Memory = typeof memories.$inferSelect;
export type NewMemory = typeof memories.$inferInsert;

export type MemorySummary = typeof memorySummaries.$inferSelect;
export type NewMemorySummary = typeof memorySummaries.$inferInsert;

export type MemoryFact = typeof memoryFacts.$inferSelect;
export type NewMemoryFact = typeof memoryFacts.$inferInsert;
