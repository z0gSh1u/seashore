import { pgTable, uuid, text, timestamp, jsonb } from 'drizzle-orm/pg-core'

/**
 * Threads table - represents conversation threads
 */
export const threads = pgTable('seashore_threads', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: text('title'),
  metadata: jsonb('metadata').$type<Record<string, unknown>>(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

/**
 * Messages table - stores individual messages within threads
 */
export const messages = pgTable('seashore_messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  threadId: uuid('thread_id')
    .references(() => threads.id, { onDelete: 'cascade' })
    .notNull(),
  role: text('role').$type<'user' | 'assistant' | 'system' | 'tool'>().notNull(),
  content: jsonb('content').notNull(),
  toolCalls: jsonb('tool_calls').$type<unknown[]>(),
  toolResults: jsonb('tool_results').$type<unknown[]>(),
  tokenUsage: jsonb('token_usage').$type<{
    promptTokens?: number
    completionTokens?: number
    totalTokens?: number
  }>(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

/**
 * Workflow runs table - tracks workflow execution state
 */
export const workflowRuns = pgTable('seashore_workflow_runs', {
  id: uuid('id').primaryKey().defaultRandom(),
  workflowName: text('workflow_name').notNull(),
  status: text('status')
    .$type<'running' | 'pending' | 'completed' | 'failed'>()
    .notNull()
    .default('running'),
  state: jsonb('state').$type<Record<string, unknown>>().notNull().default({}),
  currentStep: text('current_step'),
  error: text('error'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})
