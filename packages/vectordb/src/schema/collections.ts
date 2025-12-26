/**
 * @seashore/vectordb - Collections Schema
 *
 * Database schema for vector collections
 */

import {
  pgTable,
  uuid,
  text,
  integer,
  real,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

/**
 * Collections table - stores vector collection metadata
 */
export const collections = pgTable(
  'collections',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    description: text('description'),
    dimensions: integer('dimensions').notNull(),
    distanceMetric: text('distance_metric')
      .notNull()
      .default('cosine')
      .$type<'cosine' | 'euclidean' | 'inner_product'>(),
    hnswM: integer('hnsw_m').notNull().default(16),
    hnswEfConstruction: integer('hnsw_ef_construction').notNull().default(64),
    documentCount: integer('document_count').notNull().default(0),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('idx_collections_name').on(table.name),
    index('idx_collections_created').on(table.createdAt),
  ]
);

/**
 * Type for inserting a new collection
 */
export type NewCollection = typeof collections.$inferInsert;

/**
 * Type for selecting a collection
 */
export type SelectCollection = typeof collections.$inferSelect;
