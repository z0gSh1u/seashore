/**
 * @seashore/vectordb - Vector Search
 *
 * HNSW-based vector similarity search
 */

import { sql, eq, and } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { documents } from '../schema/index.js';
import type {
  Collection,
  EmbeddingVector,
  SearchResult,
  ScoredDocument,
  VectorSearchOptions,
} from '../types.js';

/**
 * Distance function SQL based on metric
 */
function getDistanceFunction(metric: string, embedding: EmbeddingVector) {
  const vectorLiteral = `[${embedding.join(',')}]::vector`;

  switch (metric) {
    case 'euclidean':
      return sql`${documents.embedding} <-> ${sql.raw(vectorLiteral)}`;
    case 'inner_product':
      return sql`${documents.embedding} <#> ${sql.raw(vectorLiteral)}`;
    case 'cosine':
    default:
      return sql`${documents.embedding} <=> ${sql.raw(vectorLiteral)}`;
  }
}

/**
 * Convert distance to similarity score
 */
function distanceToScore(distance: number, metric: string): number {
  switch (metric) {
    case 'euclidean':
      // Euclidean: smaller distance = more similar, convert to 0-1 range
      return 1 / (1 + distance);
    case 'inner_product':
      // Inner product: higher = more similar (negative distance in pgvector)
      return -distance;
    case 'cosine':
    default:
      // Cosine distance: 0 = identical, 2 = opposite
      // Convert to similarity: 1 - (distance / 2)
      return 1 - distance / 2;
  }
}

/**
 * Perform vector similarity search using HNSW index
 */
export async function vectorSearch(
  db: PostgresJsDatabase,
  collection: Collection,
  embedding: EmbeddingVector,
  options: VectorSearchOptions = {}
): Promise<SearchResult> {
  const { limit = 10, minScore = 0, filter, efSearch = 40, includeEmbeddings = false } = options;

  const startTime = Date.now();

  // Set HNSW search parameters
  await db.execute(sql`SET hnsw.ef_search = ${efSearch}`);

  // Build conditions
  const conditions = [eq(documents.collectionId, collection.id)];

  // Add metadata filter if provided
  if (filter && Object.keys(filter).length > 0) {
    conditions.push(sql`${documents.metadata} @> ${JSON.stringify(filter)}::jsonb`);
  }

  // Only search documents with embeddings
  conditions.push(sql`${documents.embedding} IS NOT NULL`);

  const distanceExpr = getDistanceFunction(collection.distanceMetric, embedding);

  // Execute search
  const results = await db
    .select({
      id: documents.id,
      collectionId: documents.collectionId,
      content: documents.content,
      embedding: includeEmbeddings ? documents.embedding : sql<null>`NULL`,
      metadata: documents.metadata,
      createdAt: documents.createdAt,
      distance: distanceExpr.as('distance'),
    })
    .from(documents)
    .where(and(...conditions))
    .orderBy(distanceExpr)
    .limit(limit * 2); // Fetch extra for filtering

  // Convert to scored documents and filter by min score
  const scoredDocuments: ScoredDocument[] = [];

  for (const row of results) {
    const score = distanceToScore(Number(row.distance), collection.distanceMetric);

    if (score >= minScore) {
      scoredDocuments.push({
        document: {
          id: row.id,
          collectionId: row.collectionId,
          content: row.content,
          embedding: row.embedding ?? null,
          metadata: row.metadata,
          createdAt: row.createdAt,
        },
        score,
      });
    }

    if (scoredDocuments.length >= limit) {
      break;
    }
  }

  return {
    documents: scoredDocuments,
    totalCount: scoredDocuments.length,
    searchType: 'vector',
    durationMs: Date.now() - startTime,
  };
}

/**
 * Batch vector search for multiple queries
 */
export async function batchVectorSearch(
  db: PostgresJsDatabase,
  collection: Collection,
  embeddings: readonly EmbeddingVector[],
  options: VectorSearchOptions = {}
): Promise<readonly SearchResult[]> {
  const results: SearchResult[] = [];

  for (const embedding of embeddings) {
    const result = await vectorSearch(db, collection, embedding, options);
    results.push(result);
  }

  return results;
}
