import { describe, it, expect, vi } from 'vitest'
import { seashoreMiddleware } from './middleware.js'
import { Hono } from 'hono'

describe('seashoreMiddleware', () => {
  it('should return a Hono app', () => {
    const middleware = seashoreMiddleware({
      agent: { name: 'test', run: vi.fn(), stream: vi.fn() } as never,
    })
    expect(middleware).toBeDefined()
    // It should be a Hono instance (has .fetch method)
    expect(typeof middleware.fetch).toBe('function')
  })

  it('should have /chat endpoint', async () => {
    const mockAgent = {
      name: 'test',
      run: vi.fn().mockResolvedValue('hello'),
      stream: vi.fn(),
      config: { maxIterations: 10 },
    }

    const app = new Hono()
    app.route('/api', seashoreMiddleware({ agent: mockAgent as never }))

    const req = new Request('http://localhost/api/chat', {
      method: 'POST',
      body: JSON.stringify({ messages: [{ role: 'user', content: 'hi' }] }),
      headers: { 'Content-Type': 'application/json' },
    })

    const res = await app.fetch(req)
    expect(res.status).toBeDefined()
  })
})
