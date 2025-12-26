/**
 * @seashore/vectordb - Documents Schema
 *
 * Database schema for vector documents with pgvector and tsvector support
 */

import { pgTable, uuid, text, timestamp, jsonb, index, customType } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { collections } from './collections.js';

/**
 * Custom vector type for pgvector
 */
export const vector = customType<{
  data: number[];
  driverData: string;
  config: { dimensions: number };
}>({
  dataType(config) {
    return `vector(${config?.dimensions ?? 1536})`;
  },
  toDriver(value: number[]): string {
    return `[${value.join(',')}]`;
  },
  fromDriver(value: string): number[] {
    // Parse PostgreSQL vector format: [0.1,0.2,0.3]
    const match = value.match(/\[(.*)\]/);
    if (!match?.[1]) return [];
    return match[1].split(',').map(Number);
  },
});

/**
 * Custom tsvector type for full-text search
 */
export const tsvector = customType<{
  data: string;
  driverData: string;
}>({
  dataType() {
    return 'tsvector';
  },
  toDriver(value: string): string {
    return value;
  },
  fromDriver(value: string): string {
    return value;
  },
});

/**
 * Documents table - stores vector documents with embeddings
 */
export const documents = pgTable(
  'documents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    collectionId: uuid('collection_id')
      .notNull()
      .references(() => collections.id, { onDelete: 'cascade' }),
    content: text('content').notNull(),
    embedding: vector('embedding', { dimensions: 1536 }),
    searchVector: tsvector('search_vector'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_documents_collection').on(table.collectionId),
    index('idx_documents_created').on(table.createdAt),
    // HNSW index for vector similarity search
    index('idx_documents_embedding').using('hnsw', sql`${table.embedding} vector_cosine_ops`),
    // GIN index for full-text search
    index('idx_documents_search').using('gin', table.searchVector),
  ]
);

/**
 * Type for inserting a new document
 */
export type NewDocument = typeof documents.$inferInsert;

/**
 * Type for selecting a document
 */
export type SelectDocument = typeof documents.$inferSelect;

/**
 * SQL helper for generating tsvector from content
 */
export function generateSearchVector(content: string, language = 'english') {
  return sql`to_tsvector(${language}, ${content})`;
}

/**
 * SQL helper for generating tsquery from search text
 */
export function generateSearchQuery(query: string, language = 'english') {
  return sql`plainto_tsquery(${language}, ${query})`;
}

/**
 * SQL helper for websearch query (supports advanced syntax)
 */
export function generateWebSearchQuery(query: string, language = 'english') {
  return sql`websearch_to_tsquery(${language}, ${query})`;
}
