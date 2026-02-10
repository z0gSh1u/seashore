import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { streamSSE } from 'hono/streaming'
import type { StorageService } from '@seashore/data'

interface DeployableAgent {
  name: string
  stream(input: string, options?: unknown): AsyncIterable<unknown>
  run(input: string, options?: unknown): Promise<unknown>
}

export interface SeashoreMiddlewareConfig {
  agent: DeployableAgent
  storage?: StorageService
  guardrails?: unknown[]
  cors?: boolean
}

export function seashoreMiddleware(config: SeashoreMiddlewareConfig) {
  const app = new Hono()

  if (config.cors) {
    app.use('*', cors())
  }

  // POST /chat — streaming chat
  app.post('/chat', async (c) => {
    const body = await c.req.json<{
      messages: Array<{ role: string; content: string }>
      threadId?: string
      stream?: boolean
    }>()

    const lastMessage = body.messages.at(-1)
    if (!lastMessage) {
      return c.json({ error: 'No messages provided' }, 400)
    }

    // Persist incoming message if storage is configured
    if (config.storage && body.threadId) {
      await config.storage.addMessage(body.threadId, {
        role: lastMessage.role as 'user',
        content: lastMessage.content,
      })
    }

    if (body.stream === false) {
      // Non-streaming response
      const result = await config.agent.run(lastMessage.content, {
        messages: body.messages,
      })
      return c.json({ content: result })
    }

    // Streaming SSE response
    return streamSSE(c, async (stream) => {
      const iterable = config.agent.stream(lastMessage.content, {
        messages: body.messages,
      })
      for await (const chunk of iterable) {
        await stream.writeSSE({
          data: JSON.stringify(chunk),
          event: 'message',
        })
      }
      await stream.writeSSE({
        data: '[DONE]',
        event: 'done',
      })
    })
  })

  // Thread endpoints (only if storage is provided)
  if (config.storage) {
    const storage = config.storage

    app.get('/threads', async (c) => {
      const limit = Number(c.req.query('limit') ?? '50')
      const offset = Number(c.req.query('offset') ?? '0')
      const threadList = await storage.listThreads({ limit, offset })
      return c.json(threadList)
    })

    app.get('/threads/:id/messages', async (c) => {
      const id = c.req.param('id')
      const limit = Number(c.req.query('limit') ?? '100')
      const offset = Number(c.req.query('offset') ?? '0')
      const msgs = await storage.getMessages(id, { limit, offset })
      return c.json(msgs)
    })

    app.post('/threads', async (c) => {
      const body = await c.req.json<{ title?: string; metadata?: Record<string, unknown> }>()
      const thread = await storage.createThread(body)
      return c.json(thread, 201)
    })
  }

  return app
}
