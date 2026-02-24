import { describe, it, expect } from 'vitest'
import { createChunker } from '../../src/rag/chunker.js'

describe('createChunker', () => {
  it('should chunk text with fixed strategy', () => {
    const chunker = createChunker({ strategy: 'fixed', chunkSize: 10, overlap: 0 })
    const chunks = chunker.chunk('Hello World, this is a test string')
    expect(chunks.length).toBeGreaterThan(1)
    chunks.forEach((chunk) => {
      expect(chunk.length).toBeLessThanOrEqual(10)
    })
  })

  it('should chunk with overlap', () => {
    const chunker = createChunker({ strategy: 'fixed', chunkSize: 10, overlap: 3 })
    const chunks = chunker.chunk('0123456789ABCDEFGHIJ')
    expect(chunks.length).toBeGreaterThan(1)
  })

  it('should chunk with recursive strategy (by paragraphs first)', () => {
    const chunker = createChunker({ strategy: 'recursive', chunkSize: 100, overlap: 0 })
    const text = 'Paragraph one.\n\nParagraph two.\n\nParagraph three.'
    const chunks = chunker.chunk(text)
    expect(chunks.length).toBeGreaterThanOrEqual(1)
  })

  it('should return single chunk if text is smaller than chunkSize', () => {
    const chunker = createChunker({ strategy: 'fixed', chunkSize: 1000, overlap: 0 })
    const chunks = chunker.chunk('Short text')
    expect(chunks).toHaveLength(1)
    expect(chunks[0]).toBe('Short text')
  })
})
