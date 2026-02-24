import { describe, it, expect, vi, beforeEach } from 'vitest'
import { z } from 'zod'
import { createReActAgent } from '../../src/react-agent/agent.js'

// Mock @tanstack/ai
vi.mock('@tanstack/ai', () => ({
  chat: vi.fn(),
  maxIterations: vi.fn((n: number) => ({ type: 'maxIterations', value: n })),
}))

describe('ReAct Agent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should create a ReAct agent with basic config', async () => {
    const { chat } = await import('@tanstack/ai')
    const mockChat = vi.mocked(chat)

    // Mock the chat function to return a result
    mockChat.mockResolvedValue({
      messages: [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there!' },
      ],
      result: { content: 'Hi there!', toolCalls: [] },
    })

    const agent = createReActAgent({
      model: () => ({ provider: 'openai', model: 'gpt-4' }) as any,
      systemPrompt: 'You are a helpful assistant',
    })

    const result = await agent.run([{ role: 'user', content: 'Hello' }])

    expect(mockChat).toHaveBeenCalled()
    expect(result.messages).toHaveLength(2)
    expect(result.result.content).toBe('Hi there!')
  })

  it('should pass tools to the chat function', async () => {
    const { chat } = await import('@tanstack/ai')
    const mockChat = vi.mocked(chat)

    mockChat.mockResolvedValue({
      messages: [{ role: 'user', content: 'Search' }],
      result: { content: 'Found results', toolCalls: [] },
    })

    const mockTool = {
      name: 'search',
      description: 'Search the web',
      parameters: z.object({ query: z.string() }),
      execute: vi.fn(),
    }

    const agent = createReActAgent({
      model: () => ({ provider: 'openai', model: 'gpt-4' }) as any,
      systemPrompt: 'Assistant',
      tools: [mockTool],
    })

    await agent.run([{ role: 'user', content: 'Search' }])

    const callArgs = mockChat.mock.calls[0]?.[0]
    expect(callArgs?.tools).toContain(mockTool)
  })

  it('should use maxIterations', async () => {
    const { chat, maxIterations } = await import('@tanstack/ai')
    const mockChat = vi.mocked(chat)
    const mockMaxIterations = vi.mocked(maxIterations)

    mockChat.mockResolvedValue({
      messages: [],
      result: { content: 'Done', toolCalls: [] },
    })

    const agent = createReActAgent({
      model: () => ({ provider: 'openai', model: 'gpt-4' }) as any,
      systemPrompt: 'Assistant',
      maxIterations: 5,
    })

    await agent.run([{ role: 'user', content: 'Task' }])

    expect(mockMaxIterations).toHaveBeenCalledWith(5)
    const callArgs = mockChat.mock.calls[0]?.[0]
    expect((callArgs as any)?.maxSteps).toEqual({ type: 'maxIterations', value: 5 })
  })

  it('should default maxIterations to 10', async () => {
    const { chat, maxIterations } = await import('@tanstack/ai')
    const mockChat = vi.mocked(chat)
    const mockMaxIterations = vi.mocked(maxIterations)

    mockChat.mockResolvedValue({
      messages: [],
      result: { content: 'Done', toolCalls: [] },
    })

    const agent = createReActAgent({
      model: () => ({ provider: 'openai', model: 'gpt-4' }) as any,
      systemPrompt: 'Assistant',
    })

    await agent.run([{ role: 'user', content: 'Task' }])

    expect(mockMaxIterations).toHaveBeenCalledWith(10)
  })

  it('should apply beforeRequest guardrail', async () => {
    const { chat } = await import('@tanstack/ai')
    const mockChat = vi.mocked(chat)

    mockChat.mockResolvedValue({
      messages: [],
      result: { content: 'Done', toolCalls: [] },
    })

    const beforeRequest = vi.fn((messages) => {
      return [...messages, { role: 'system', content: 'Safety rule' }]
    })

    const agent = createReActAgent({
      model: () => ({ provider: 'openai', model: 'gpt-4' }) as any,
      systemPrompt: 'Assistant',
      guardrails: [{ beforeRequest }],
    })

    await agent.run([{ role: 'user', content: 'Task' }])

    expect(beforeRequest).toHaveBeenCalled()
    const callArgs = mockChat.mock.calls[0]?.[0]
    expect(callArgs?.messages).toContainEqual({
      role: 'system',
      content: 'Safety rule',
    })
  })

  it('should apply afterResponse guardrail', async () => {
    const { chat } = await import('@tanstack/ai')
    const mockChat = vi.mocked(chat)

    mockChat.mockResolvedValue({
      messages: [{ role: 'assistant', content: 'Response' }],
      result: { content: 'Response', toolCalls: [] },
    })

    const afterResponse = vi.fn((response) => {
      return { ...response, content: 'Modified: ' + response.content }
    })

    const agent = createReActAgent({
      model: () => ({ provider: 'openai', model: 'gpt-4' }) as any,
      systemPrompt: 'Assistant',
      guardrails: [{ afterResponse }],
    })

    const result = await agent.run([{ role: 'user', content: 'Task' }])

    expect(afterResponse).toHaveBeenCalled()
    expect(result.result.content).toBe('Modified: Response')
  })

  it('should validate output against schema', async () => {
    const { chat } = await import('@tanstack/ai')
    const mockChat = vi.mocked(chat)

    const outputSchema = z.object({
      answer: z.string(),
      confidence: z.number(),
    })

    mockChat.mockResolvedValue({
      messages: [],
      result: {
        content: JSON.stringify({ answer: 'Test', confidence: 0.95 }),
        toolCalls: [],
      },
    })

    const agent = createReActAgent({
      model: () => ({ provider: 'openai', model: 'gpt-4' }) as any,
      systemPrompt: 'Assistant',
      outputSchema,
    })

    await agent.run([{ role: 'user', content: 'Task' }])

    const callArgs = mockChat.mock.calls[0]?.[0]
    expect((callArgs as any)?.output).toEqual(outputSchema)
  })

  it('should support streaming', async () => {
    const { chat } = await import('@tanstack/ai')
    const mockChat = vi.mocked(chat)

    const mockStream = {
      [Symbol.asyncIterator]: async function* () {
        yield { type: 'text-delta', textDelta: 'Hello' }
        yield { type: 'text-delta', textDelta: ' world' }
      },
    }

    mockChat.mockResolvedValue({
      messages: [],
      result: { content: 'Hello world', toolCalls: [] },
      stream: mockStream as any,
    })

    const agent = createReActAgent({
      model: () => ({ provider: 'openai', model: 'gpt-4' }) as any,
      systemPrompt: 'Assistant',
    })

    const result = await agent.stream([{ role: 'user', content: 'Task' }])

    expect(result.stream).toBeDefined()
    const chunks = []
    for await (const chunk of result.stream) {
      chunks.push(chunk)
    }
    expect(chunks).toHaveLength(2)
  })

  it('should support AbortController', async () => {
    const { chat } = await import('@tanstack/ai')
    const mockChat = vi.mocked(chat)

    mockChat.mockImplementation(
      ({ abortSignal }: any) =>
        new Promise((resolve, reject) => {
          if (abortSignal?.aborted) {
            reject(new Error('Aborted'))
            return
          }
          abortSignal?.addEventListener('abort', () => {
            reject(new Error('Aborted'))
          })
          // Keep promise pending until aborted
        })
    )

    const agent = createReActAgent({
      model: () => ({ provider: 'openai', model: 'gpt-4' }) as any,
      systemPrompt: 'Assistant',
    })

    const controller = new AbortController()
    const promise = agent.run([{ role: 'user', content: 'Task' }], {
      abortSignal: controller.signal,
    })

    // Abort immediately
    setTimeout(() => controller.abort(), 10)

    await expect(promise).rejects.toThrow('Aborted')
  })
})
