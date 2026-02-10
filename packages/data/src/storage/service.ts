import { eq, desc } from 'drizzle-orm'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import { threads, messages, workflowRuns } from './schema.js'

/**
 * Pagination options for list operations
 */
export interface PaginationOpts {
  limit?: number
  offset?: number
}

/**
 * New message to be added to a thread
 */
export interface NewMessage {
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: unknown
  toolCalls?: unknown[]
  toolResults?: unknown[]
  tokenUsage?: {
    promptTokens?: number
    completionTokens?: number
    totalTokens?: number
  }
}

/**
 * Inferred types from Drizzle schema
 */
export type Thread = typeof threads.$inferSelect
export type Message = typeof messages.$inferSelect
export type WorkflowRun = typeof workflowRuns.$inferSelect

/**
 * Storage service interface for managing threads, messages, and workflow runs
 */
export interface StorageService {
  // Threads
  createThread(opts?: { title?: string; metadata?: Record<string, unknown> }): Promise<Thread>
  getThread(id: string): Promise<Thread | undefined>
  listThreads(opts?: PaginationOpts): Promise<Thread[]>
  deleteThread(id: string): Promise<void>

  // Messages
  addMessage(threadId: string, message: NewMessage): Promise<Message>
  getMessages(threadId: string, opts?: PaginationOpts): Promise<Message[]>

  // Workflow Runs
  saveWorkflowRun(
    run: Partial<typeof workflowRuns.$inferInsert> & { id?: string }
  ): Promise<WorkflowRun>
  getWorkflowRun(id: string): Promise<WorkflowRun | undefined>
  updateWorkflowRun(id: string, data: Partial<typeof workflowRuns.$inferInsert>): Promise<void>
}

/**
 * Creates a storage service with Drizzle ORM.
 *
 * @param db - Drizzle database instance (PostgresJsDatabase)
 * @returns Storage service instance
 *
 * @example
 * ```typescript
 * import { drizzle } from 'drizzle-orm/postgres-js'
 * import postgres from 'postgres'
 * import { createStorageService } from '@seashore/data'
 *
 * const client = postgres(process.env.DATABASE_URL!)
 * const db = drizzle(client)
 * const storage = createStorageService(db)
 *
 * // Create a thread
 * const thread = await storage.createThread({ title: 'My Conversation' })
 *
 * // Add a message
 * await storage.addMessage(thread.id, {
 *   role: 'user',
 *   content: 'Hello!'
 * })
 *
 * // Get messages
 * const messages = await storage.getMessages(thread.id)
 * ```
 */
export function createStorageService(db: PostgresJsDatabase): StorageService {
  return {
    async createThread(opts) {
      const [thread] = await db
        .insert(threads)
        .values({
          title: opts?.title,
          metadata: opts?.metadata,
        })
        .returning()
      return thread!
    },

    async getThread(id) {
      const [thread] = await db.select().from(threads).where(eq(threads.id, id)).limit(1)
      return thread
    },

    async listThreads(opts) {
      return db
        .select()
        .from(threads)
        .orderBy(desc(threads.updatedAt))
        .limit(opts?.limit ?? 50)
        .offset(opts?.offset ?? 0)
    },

    async deleteThread(id) {
      await db.delete(threads).where(eq(threads.id, id))
    },

    async addMessage(threadId, message) {
      const [msg] = await db
        .insert(messages)
        .values({
          threadId,
          role: message.role,
          content: message.content,
          toolCalls: message.toolCalls,
          toolResults: message.toolResults,
          tokenUsage: message.tokenUsage,
        })
        .returning()

      // Touch thread updatedAt
      await db
        .update(threads)
        .set({ updatedAt: new Date() })
        .where(eq(threads.id, threadId))

      return msg!
    },

    async getMessages(threadId, opts) {
      return db
        .select()
        .from(messages)
        .where(eq(messages.threadId, threadId))
        .orderBy(messages.createdAt)
        .limit(opts?.limit ?? 100)
        .offset(opts?.offset ?? 0)
    },

    async saveWorkflowRun(run) {
      const [result] = await db
        .insert(workflowRuns)
        .values(run as typeof workflowRuns.$inferInsert)
        .returning()
      return result!
    },

    async getWorkflowRun(id) {
      const [run] = await db
        .select()
        .from(workflowRuns)
        .where(eq(workflowRuns.id, id))
        .limit(1)
      return run
    },

    async updateWorkflowRun(id, data) {
      await db
        .update(workflowRuns)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(workflowRuns.id, id))
    },
  }
}
