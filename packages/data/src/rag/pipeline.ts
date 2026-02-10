import type { EmbeddingAdapter } from '@seashore/core'
import type {
  VectorDBService,
  SearchResult,
  DocumentInput,
} from '../vectordb/service.js'
import { createChunker, type ChunkerConfig } from './chunker.js'

/**
 * RAG pipeline configuration
 */
export interface RAGConfig {
  embedding: EmbeddingAdapter
  vectordb: VectorDBService
  collection: string
  searchMode?: 'vector' | 'text' | 'hybrid'
  topK?: number
  hybridWeights?: { vector: number; text: number }
  chunker?: ChunkerConfig
}

/**
 * RAG pipeline interface for Retrieval-Augmented Generation
 */
export interface RAGPipeline {
  ingest(docs: DocumentInput[]): Promise<void>
  retrieve(query: string): Promise<SearchResult[]>
}

/**
 * Creates a RAG (Retrieval-Augmented Generation) pipeline.
 *
 * Combines embedding generation, vector storage, and hybrid search
 * to enable semantic retrieval of relevant documents.
 *
 * @param config - RAG pipeline configuration
 * @returns RAG pipeline instance
 *
 * @example
 * ```typescript
 * import { createRAG, createVectorDBService, createEmbeddingAdapter } from '@seashore/data'
 * import { drizzle } from 'drizzle-orm/postgres-js'
 * import postgres from 'postgres'
 *
 * const client = postgres(process.env.DATABASE_URL!)
 * const db = drizzle(client)
 *
 * const rag = createRAG({
 *   embedding: createEmbeddingAdapter('openai', { apiKey: process.env.OPENAI_API_KEY! }),
 *   vectordb: createVectorDBService(db),
 *   collection: 'documentation',
 *   searchMode: 'hybrid',
 *   topK: 5,
 *   chunker: {
 *     strategy: 'recursive',
 *     chunkSize: 1000,
 *     overlap: 100
 *   }
 * })
 *
 * // Ingest documents
 * await rag.ingest([
 *   { content: 'Seashore is an agent framework...' },
 *   { content: 'Built on TanStack AI...' }
 * ])
 *
 * // Retrieve relevant documents
 * const results = await rag.retrieve('How do I build agents?')
 * ```
 */
export function createRAG(config: RAGConfig): RAGPipeline {
  const searchMode = config.searchMode ?? 'vector'
  const topK = config.topK ?? 5
  const hybridWeights = config.hybridWeights ?? { vector: 0.7, text: 0.3 }

  return {
    async ingest(docs) {
      let docsToIngest = docs

      // Apply chunking if configured
      if (config.chunker) {
        const chunker = createChunker(config.chunker)
        docsToIngest = docs.flatMap((doc) => {
          const chunks = chunker.chunk(doc.content)
          return chunks.map((chunk) => ({
            content: chunk,
            metadata: { ...doc.metadata, _originalContent: doc.content.slice(0, 100) },
          }))
        })
      }

      await config.vectordb.upsert(config.collection, docsToIngest, config.embedding)
    },

    async retrieve(query) {
      const queryVector =
        searchMode !== 'text' ? (await config.embedding.embed(query))[0] : undefined

      return config.vectordb.search(config.collection, {
        mode: searchMode,
        topK,
        vector: queryVector,
        text: searchMode !== 'vector' ? query : undefined,
        hybridWeights,
      })
    },
  }
}
