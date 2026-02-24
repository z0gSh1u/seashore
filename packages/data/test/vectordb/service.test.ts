import { describe, it, expect } from 'vitest'
import { embeddings } from '../../src/vectordb/schema.js'
import type { VectorDBService, SearchQuery } from '../../src/vectordb/service.js'

describe('VectorDB Schema', () => {
  it('should export embeddings table', () => {
    expect(embeddings).toBeDefined()
  })
})

describe('VectorDBService interface', () => {
  it('should define SearchQuery type correctly', () => {
    const query: SearchQuery = {
      mode: 'hybrid',
      topK: 5,
      vector: [0.1, 0.2],
      text: 'hello',
      hybridWeights: { vector: 0.7, text: 0.3 },
    }
    expect(query.mode).toBe('hybrid')
    expect(query.topK).toBe(5)
  })
})
