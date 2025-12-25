/**
 * Database schema definitions for Seashore Agent Framework
 * 
 * This module defines the core data structures for storing conversation threads
 * and messages using Drizzle ORM with PostgreSQL.
 */

import { pgTable, uuid, text, timestamp, jsonb, integer, index } from 'drizzle-orm/pg-core';

/**
 * Thread table schema
 * 
 * Represents a conversation thread that groups related messages together.
 * Each thread maintains metadata about the conversation context.
 * 
 * @example
 * ```typescript
 * const thread = {
 *   id: '123e4567-e89b-12d3-a456-426614174000',
 *   title: 'Customer Support Query',
 *   metadata: { userId: 'user123', tags: ['support', 'billing'] },
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * };
 * ```
 */
export const threads = pgTable('threads', {
  /**
   * Unique identifier for the thread (UUID v4)
   */
  id: uuid('id').defaultRandom().primaryKey(),
  
  /**
   * Human-readable title for the thread
   */
  title: text('title'),
  
  /**
   * Additional metadata stored as JSON (e.g., user ID, tags, context)
   * This allows flexible storage of thread-specific information without schema changes.
   */
  metadata: jsonb('metadata').$type<Record<string, unknown>>(),
  
  /**
   * Timestamp when the thread was created
   */
  createdAt: timestamp('created_at').notNull().defaultNow(),
  
  /**
   * Timestamp when the thread was last updated
   */
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  /**
   * Index on createdAt for efficient chronological queries
   */
  createdAtIdx: index('threads_created_at_idx').on(table.createdAt),
  
  /**
   * Index on updatedAt for recent thread queries
   */
  updatedAtIdx: index('threads_updated_at_idx').on(table.updatedAt),
}));

/**
 * Message table schema
 * 
 * Represents individual messages within a conversation thread.
 * Messages can be from users, assistants, or system, and support tool calls.
 * 
 * @example
 * ```typescript
 * const message = {
 *   id: '123e4567-e89b-12d3-a456-426614174001',
 *   threadId: '123e4567-e89b-12d3-a456-426614174000',
 *   role: 'user',
 *   content: 'What is the weather today?',
 *   metadata: {},
 *   createdAt: new Date()
 * };
 * ```
 */
export const messages = pgTable('messages', {
  /**
   * Unique identifier for the message (UUID v4)
   */
  id: uuid('id').defaultRandom().primaryKey(),
  
  /**
   * Foreign key reference to the parent thread
   */
  threadId: uuid('thread_id').notNull().references(() => threads.id, {
    onDelete: 'cascade',
  }),
  
  /**
   * Role of the message sender: 'user', 'assistant', or 'system'
   */
  role: text('role', { enum: ['user', 'assistant', 'system', 'tool'] }).notNull(),
  
  /**
   * The text content of the message
   */
  content: text('content').notNull(),
  
  /**
   * Optional name identifier (e.g., function name for tool calls)
   */
  name: text('name'),
  
  /**
   * Tool calls made in this message (for assistant messages)
   * Stores an array of tool call objects with id, name, and arguments
   */
  toolCalls: jsonb('tool_calls').$type<Array<{
    id: string;
    type: 'function';
    function: {
      name: string;
      arguments: string;
    };
  }>>(),
  
  /**
   * Tool call ID (for tool response messages)
   */
  toolCallId: text('tool_call_id'),
  
  /**
   * Additional metadata for the message (e.g., model info, tokens used)
   */
  metadata: jsonb('metadata').$type<Record<string, unknown>>(),
  
  /**
   * Sequence number within the thread for ordering
   */
  sequence: integer('sequence').notNull(),
  
  /**
   * Timestamp when the message was created
   */
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  /**
   * Index on threadId for efficient message retrieval by thread
   */
  threadIdIdx: index('messages_thread_id_idx').on(table.threadId),
  
  /**
   * Composite index on threadId and sequence for ordered retrieval
   */
  threadSequenceIdx: index('messages_thread_sequence_idx').on(table.threadId, table.sequence),
  
  /**
   * Index on createdAt for temporal queries
   */
  createdAtIdx: index('messages_created_at_idx').on(table.createdAt),
}));

/**
 * Type inference helpers for TypeScript
 */
export type Thread = typeof threads.$inferSelect;
export type NewThread = typeof threads.$inferInsert;
export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;
