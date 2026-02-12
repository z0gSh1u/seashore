/**
 * Full-Stack Seashore Example - Backend Server
 *
 * This example demonstrates a production-ready Hono server with:
 * - Streaming SSE chat endpoint using seashoreMiddleware
 * - Thread management with PostgreSQL storage
 * - ReAct agent with sample tools
 * - CORS and error handling
 */

import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { createReActAgent } from '@seashore/agent'
import type { Message } from '@seashore/agent'
import { createLLMAdapter } from '@seashore/core'
import { createStorageService } from '@seashore/data'
import { seashoreMiddleware } from '@seashore/platform'
import { z } from 'zod'

// ============================================================================
// Configuration
// ============================================================================

const PORT = Number(process.env.PORT) || 3001
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://localhost:5432/seashore'
const OPENAI_API_KEY = process.env.OPENAI_API_KEY

if (!OPENAI_API_KEY) {
  console.error('❌ OPENAI_API_KEY is required')
  process.exit(1)
}

// ============================================================================
// Database Setup
// ============================================================================

const client = postgres(DATABASE_URL)
const db = drizzle(client)
const storage = createStorageService(db)

// ============================================================================
// Tools - Sample utilities for the agent
// ============================================================================

/**
 * Calculator tool - performs basic arithmetic
 */
const calculatorTool = {
  name: 'calculator',
  description: 'Performs basic arithmetic operations (add, subtract, multiply, divide)',
  parameters: z.object({
    operation: z.enum(['add', 'subtract', 'multiply', 'divide']),
    a: z.number().describe('First number'),
    b: z.number().describe('Second number'),
  }),
  execute: async ({ operation, a, b }: { operation: string; a: number; b: number }) => {
    console.log(`🔧 Calculator: ${a} ${operation} ${b}`)

    switch (operation) {
      case 'add':
        return { result: a + b }
      case 'subtract':
        return { result: a - b }
      case 'multiply':
        return { result: a * b }
      case 'divide':
        if (b === 0) throw new Error('Cannot divide by zero')
        return { result: a / b }
      default:
        throw new Error(`Unknown operation: ${operation}`)
    }
  },
}

/**
 * Get current time tool
 */
const getTimeTool = {
  name: 'get_current_time',
  description: 'Returns the current date and time',
  parameters: z.object({
    timezone: z.string().optional().describe('Timezone (e.g., "America/New_York")'),
  }),
  execute: async ({ timezone }: { timezone?: string }) => {
    console.log(`🔧 Get Time: ${timezone || 'UTC'}`)

    const now = new Date()
    const options: Intl.DateTimeFormatOptions = {
      timeZone: timezone,
      dateStyle: 'full',
      timeStyle: 'long',
    }

    return {
      timestamp: now.toISOString(),
      formatted: now.toLocaleString('en-US', options),
      timezone: timezone || 'UTC',
    }
  },
}

/**
 * Random number generator tool
 */
const randomNumberTool = {
  name: 'random_number',
  description: 'Generates a random number within a specified range',
  parameters: z.object({
    min: z.number().describe('Minimum value (inclusive)'),
    max: z.number().describe('Maximum value (inclusive)'),
  }),
  execute: async ({ min, max }: { min: number; max: number }) => {
    console.log(`🔧 Random Number: ${min} to ${max}`)

    if (min > max) {
      throw new Error('min must be less than or equal to max')
    }

    const result = Math.floor(Math.random() * (max - min + 1)) + min
    return { number: result, min, max }
  },
}

// ============================================================================
// Agent Setup
// ============================================================================

const llmAdapter = createLLMAdapter({
  provider: 'openai',
  apiKey: OPENAI_API_KEY,
  model: 'gpt-4o-mini',
})

const agent = createReActAgent({
  model: llmAdapter,
  systemPrompt: `You are a helpful AI assistant with access to tools.

You can:
- Perform calculations using the calculator tool
- Get the current time in any timezone
- Generate random numbers within a range

Be concise and friendly. When using tools, explain what you're doing and why.`,
  tools: [calculatorTool, getTimeTool, randomNumberTool],
  maxIterations: 5,
})

// ============================================================================
// Wrapper for seashoreMiddleware compatibility
// ============================================================================

/**
 * Wrapper to make ReActAgent compatible with seashoreMiddleware
 * The middleware expects { stream, run } methods that return specific formats
 */
const deployableAgent = {
  name: 'fullstack-agent',

  /**
   * Streaming response for SSE
   */
  async *stream(input: string, options?: { messages?: Message[] }) {
    const messages: Message[] = options?.messages || [{ role: 'user', content: input }]

    const response = await agent.stream(messages)

    // Stream content chunks
    for await (const chunk of response.stream) {
      if (chunk.type === 'text-delta' && chunk.textDelta) {
        yield {
          type: 'content',
          delta: chunk.textDelta,
        }
      } else if (chunk.type === 'tool-call') {
        yield {
          type: 'tool_call',
          name: chunk.toolName,
          args: chunk.args,
        }
      } else if (chunk.type === 'tool-result') {
        yield {
          type: 'tool_result',
          name: chunk.toolName,
          result: chunk.result,
        }
      }
    }

    // Final result
    yield {
      type: 'done',
      content: response.result.content,
    }
  },

  /**
   * Non-streaming response
   */
  async run(input: string, options?: { messages?: Message[] }) {
    const messages: Message[] = options?.messages || [{ role: 'user', content: input }]
    const response = await agent.run(messages)
    return response.result.content
  },
}

// ============================================================================
// Server Setup
// ============================================================================

const app = new Hono()

// Global middleware
app.use('*', logger())
app.use(
  '*',
  cors({
    origin: ['http://localhost:5173', 'http://localhost:3000'], // Vite dev + production
    credentials: true,
  })
)

// Health check
app.get('/health', (c) => {
  return c.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  })
})

// Mount Seashore middleware at /api
app.route(
  '/api',
  seashoreMiddleware({
    agent: deployableAgent,
    storage,
    cors: false, // Already handled globally
  })
)

// Global error handler
app.onError((err, c) => {
  console.error('❌ Server Error:', err)
  return c.json(
    {
      error: err.message || 'Internal Server Error',
      timestamp: new Date().toISOString(),
    },
    500
  )
})

// 404 handler
app.notFound((c) => {
  return c.json({ error: 'Not Found' }, 404)
})

// ============================================================================
// Start Server
// ============================================================================

console.log(`🚀 Starting Seashore Full-Stack Backend...`)
console.log(`📊 Database: ${DATABASE_URL}`)
console.log(`🤖 Agent: ReAct with ${agent.name || 'tools'}`)

serve(
  {
    fetch: app.fetch,
    port: PORT,
  },
  (info) => {
    console.log(`✅ Server running at http://localhost:${info.port}`)
    console.log(`\nAvailable endpoints:`)
    console.log(`  GET  /health`)
    console.log(`  POST /api/chat`)
    console.log(`  GET  /api/threads`)
    console.log(`  POST /api/threads`)
    console.log(`  GET  /api/threads/:id/messages`)
  }
)

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n⏹️  Shutting down gracefully...')
  await client.end()
  process.exit(0)
})
