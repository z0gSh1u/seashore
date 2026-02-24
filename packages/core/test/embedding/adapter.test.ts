import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createEmbeddingAdapter } from '../../src/embedding/adapter.js'

// Mock global fetch
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

describe('createEmbeddingAdapter', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should create an OpenAI embedding adapter', () => {
    const adapter = createEmbeddingAdapter({
      provider: 'openai',
      model: 'text-embedding-3-small',
      apiKey: 'test-key',
    })
    expect(adapter).toBeDefined()
    expect(typeof adapter.embed).toBe('function')
  })

  it('should call OpenAI embeddings API with correct payload', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [{ embedding: [0.1, 0.2, 0.3] }],
      }),
    })

    const adapter = createEmbeddingAdapter({
      provider: 'openai',
      model: 'text-embedding-3-small',
      apiKey: 'test-key',
    })

    const result = await adapter.embed('hello world')
    expect(result).toEqual([[0.1, 0.2, 0.3]])
    expect(mockFetch).toHaveBeenCalledOnce()

    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://api.openai.com/v1/embeddings')
    expect(init.method).toBe('POST')

    const body = JSON.parse(init.body as string)
    expect(body.model).toBe('text-embedding-3-small')
    expect(body.input).toEqual(['hello world'])
  })

  it('should handle batch input', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [
          { embedding: [0.1, 0.2] },
          { embedding: [0.3, 0.4] },
        ],
      }),
    })

    const adapter = createEmbeddingAdapter({
      provider: 'openai',
      model: 'text-embedding-3-small',
      apiKey: 'test-key',
    })

    const result = await adapter.embed(['hello', 'world'])
    expect(result).toEqual([[0.1, 0.2], [0.3, 0.4]])
  })

  it('should support custom baseURL', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [{ embedding: [0.1] }] }),
    })

    const adapter = createEmbeddingAdapter({
      provider: 'openai',
      model: 'text-embedding-3-small',
      apiKey: 'test-key',
      baseURL: 'https://custom.api.com/v1',
    })

    await adapter.embed('test')
    const [url] = mockFetch.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://custom.api.com/v1/embeddings')
  })

  it('should support dimensions option', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [{ embedding: [0.1] }] }),
    })

    const adapter = createEmbeddingAdapter({
      provider: 'openai',
      model: 'text-embedding-3-small',
      apiKey: 'test-key',
      dimensions: 256,
    })

    await adapter.embed('test')
    const body = JSON.parse((mockFetch.mock.calls[0] as [string, RequestInit])[1].body as string)
    expect(body.dimensions).toBe(256)
  })

  it('should throw on API error', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      text: async () => 'Invalid API key',
    })

    const adapter = createEmbeddingAdapter({
      provider: 'openai',
      model: 'text-embedding-3-small',
      apiKey: 'bad-key',
    })

    await expect(adapter.embed('test')).rejects.toThrow()
  })
})
