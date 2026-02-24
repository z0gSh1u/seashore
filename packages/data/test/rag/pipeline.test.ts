import { describe, it, expect, vi } from 'vitest'
import { createRAG } from '../../src/rag/pipeline.js'

describe('createRAG', () => {
  it('should create a RAG pipeline', () => {
    const rag = createRAG({
      embedding: { embed: vi.fn() } as any,
      vectordb: {
        upsert: vi.fn(),
        search: vi.fn().mockResolvedValue([]),
        delete: vi.fn(),
      } as any,
      collection: 'test',
    })
    expect(rag).toBeDefined()
    expect(typeof rag.ingest).toBe('function')
    expect(typeof rag.retrieve).toBe('function')
  })

  it('should call vectordb.search on retrieve', async () => {
    const mockSearch = vi.fn().mockResolvedValue([
      { id: '1', content: 'result', metadata: {}, score: 0.9 },
    ])
    const mockEmbed = vi.fn().mockResolvedValue([[0.1, 0.2]])

    const rag = createRAG({
      embedding: { embed: mockEmbed } as any,
      vectordb: {
        upsert: vi.fn(),
        search: mockSearch,
        delete: vi.fn(),
      } as any,
      collection: 'test',
      searchMode: 'vector',
      topK: 3,
    })

    const results = await rag.retrieve('query')
    expect(mockEmbed).toHaveBeenCalledWith('query')
    expect(mockSearch).toHaveBeenCalledWith(
      'test',
      expect.objectContaining({
        mode: 'vector',
        topK: 3,
      })
    )
    expect(results).toHaveLength(1)
  })
})
