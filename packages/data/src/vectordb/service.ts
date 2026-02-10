import { eq, sql, and } from 'drizzle-orm'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import { embeddings } from './schema.js'
import type { EmbeddingAdapter } from '@seashore/core'

/**
 * Document to be inserted into the vector database
 */
export interface DocumentInput {
  content: string
  metadata?: Record<string, unknown>
}

/**
 * Search result from the vector database
 */
export interface SearchResult {
  id: string
  content: string
  metadata: Record<string, unknown> | null
  score: number
}

/**
 * Search query with multiple modes
 */
export interface SearchQuery {
  vector?: number[]
  text?: string
  mode: 'vector' | 'text' | 'hybrid'
  topK: number
  filter?: Record<string, unknown>
  hybridWeights?: { vector: number; text: number }
}

/**
 * Metadata filter for deletion
 */
export interface MetadataFilter {
  collection?: string
  metadata?: Record<string, unknown>
}

/**
 * Vector database service interface
 */
export interface VectorDBService {
  upsert(
    collection: string,
    docs: DocumentInput[],
    embeddingAdapter: EmbeddingAdapter
  ): Promise<void>
  search(collection: string, query: SearchQuery): Promise<SearchResult[]>
  delete(collection: string, filter?: MetadataFilter): Promise<void>
}

/**
 * Creates a vector database service with pgvector and full-text search.
 *
 * Supports three search modes:
 * - Vector: Semantic similarity using pgvector HNSW index
 * - Text: Full-text search using PostgreSQL tsvector/tsquery
 * - Hybrid: Combines vector and text search with Reciprocal Rank Fusion (RRF)
 *
 * @param db - Drizzle database instance (PostgresJsDatabase)
 * @returns Vector database service instance
 *
 * @example
 * ```typescript
 * import { drizzle } from 'drizzle-orm/postgres-js'
 * import postgres from 'postgres'
 * import { createVectorDBService, createEmbeddingAdapter } from '@seashore/data'
 *
 * const client = postgres(process.env.DATABASE_URL!)
 * const db = drizzle(client)
 * const vectordb = createVectorDBService(db)
 * const embedder = createEmbeddingAdapter('openai', { apiKey: process.env.OPENAI_API_KEY! })
 *
 * // Insert documents
 * await vectordb.upsert('docs', [
 *   { content: 'Seashore is an agent framework' },
 *   { content: 'Built on TanStack AI' }
 * ], embedder)
 *
 * // Search with vector similarity
 * const results = await vectordb.search('docs', {
 *   mode: 'vector',
 *   topK: 5,
 *   vector: await embedder.embed(['agent framework'])[0]
 * })
 * ```
 */
export function createVectorDBService(db: PostgresJsDatabase): VectorDBService {
  return {
    async upsert(collection, docs, embeddingAdapter) {
      const texts = docs.map((d) => d.content)
      const vectors = await embeddingAdapter.embed(texts)

      const values = docs.map((doc, i) => ({
        collection,
        content: doc.content,
        metadata: doc.metadata ?? {},
        embedding: vectors[i]!,
        contentTsv: sql`to_tsvector('english', ${doc.content})`,
      }))

      for (const value of values) {
        await db.insert(embeddings).values(value as never)
      }
    },

    async search(collection, query) {
      switch (query.mode) {
        case 'vector':
          return searchVector(db, collection, query)
        case 'text':
          return searchText(db, collection, query)
        case 'hybrid':
          return searchHybrid(db, collection, query)
        default: {
          const _exhaustive: never = query.mode
          throw new Error(`Unsupported search mode: ${String(_exhaustive)}`)
        }
      }
    },

    async delete(collection, filter) {
      const conditions = [eq(embeddings.collection, collection)]
      // Additional metadata filtering could be added here
      await db.delete(embeddings).where(and(...conditions))
    },
  }
}

/**
 * Vector similarity search using pgvector cosine distance
 */
async function searchVector(
  db: PostgresJsDatabase,
  collection: string,
  query: SearchQuery
): Promise<SearchResult[]> {
  if (!query.vector) throw new Error('vector is required for vector search')

  const vectorStr = `[${query.vector.join(',')}]`
  const rows = await db.execute(sql`
    SELECT id, content, metadata,
      1 - (embedding <=> ${vectorStr}::vector) as score
    FROM seashore_embeddings
    WHERE collection = ${collection}
    ORDER BY embedding <=> ${vectorStr}::vector
    LIMIT ${query.topK}
  `)

  return rows as unknown as SearchResult[]
}

/**
 * Full-text search using PostgreSQL tsvector/tsquery
 */
async function searchText(
  db: PostgresJsDatabase,
  collection: string,
  query: SearchQuery
): Promise<SearchResult[]> {
  if (!query.text) throw new Error('text is required for text search')

  const rows = await db.execute(sql`
    SELECT id, content, metadata,
      ts_rank(content_tsv, plainto_tsquery('english', ${query.text})) as score
    FROM seashore_embeddings
    WHERE collection = ${collection}
      AND content_tsv @@ plainto_tsquery('english', ${query.text})
    ORDER BY score DESC
    LIMIT ${query.topK}
  `)

  return rows as unknown as SearchResult[]
}

/**
 * Hybrid search using Reciprocal Rank Fusion (RRF)
 * Combines vector similarity and full-text search results
 */
async function searchHybrid(
  db: PostgresJsDatabase,
  collection: string,
  query: SearchQuery
): Promise<SearchResult[]> {
  if (!query.vector || !query.text) {
    throw new Error('Both vector and text are required for hybrid search')
  }

  const weights = query.hybridWeights ?? { vector: 0.7, text: 0.3 }
  const vectorStr = `[${query.vector.join(',')}]`

  // Reciprocal Rank Fusion (RRF) constant
  const k = 60

  const rows = await db.execute(sql`
    WITH vector_results AS (
      SELECT id, content, metadata,
        ROW_NUMBER() OVER (ORDER BY embedding <=> ${vectorStr}::vector) as rank_v
      FROM seashore_embeddings
      WHERE collection = ${collection}
      ORDER BY embedding <=> ${vectorStr}::vector
      LIMIT ${query.topK * 2}
    ),
    text_results AS (
      SELECT id, content, metadata,
        ROW_NUMBER() OVER (ORDER BY ts_rank(content_tsv, plainto_tsquery('english', ${query.text})) DESC) as rank_t
      FROM seashore_embeddings
      WHERE collection = ${collection}
        AND content_tsv @@ plainto_tsquery('english', ${query.text})
      ORDER BY ts_rank(content_tsv, plainto_tsquery('english', ${query.text})) DESC
      LIMIT ${query.topK * 2}
    )
    SELECT
      COALESCE(v.id, t.id) as id,
      COALESCE(v.content, t.content) as content,
      COALESCE(v.metadata, t.metadata) as metadata,
      (
        ${weights.vector} * COALESCE(1.0 / (${k} + v.rank_v), 0) +
        ${weights.text} * COALESCE(1.0 / (${k} + t.rank_t), 0)
      ) as score
    FROM vector_results v
    FULL OUTER JOIN text_results t ON v.id = t.id
    ORDER BY score DESC
    LIMIT ${query.topK}
  `)

  return rows as unknown as SearchResult[]
}
