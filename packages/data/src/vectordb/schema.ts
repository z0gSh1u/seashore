import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  index,
  customType,
} from 'drizzle-orm/pg-core'
import { vector } from 'drizzle-orm/pg-core'

/**
 * Custom tsvector type for full-text search
 * (Drizzle doesn't have native tsvector support)
 */
const tsvector = customType<{ data: string }>({
  dataType() {
    return 'tsvector'
  },
})

/**
 * Embeddings table for vector storage with pgvector
 * Supports hybrid search with HNSW vector index + GIN text index
 */
export const embeddings = pgTable(
  'seashore_embeddings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    collection: text('collection').notNull(),
    content: text('content').notNull(),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
    embedding: vector('embedding', { dimensions: 1536 }),
    contentTsv: tsvector('content_tsv'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    // HNSW index for fast approximate nearest neighbor search
    index('seashore_embedding_hnsw_idx').using(
      'hnsw',
      table.embedding.op('vector_cosine_ops')
    ),
    // GIN index for full-text search
    index('seashore_content_tsv_idx').using('gin', table.contentTsv),
    // B-tree index for collection filtering
    index('seashore_collection_idx').on(table.collection),
  ]
)
