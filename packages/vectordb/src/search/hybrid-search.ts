/**
 * @seashore/vectordb - Hybrid Search
 *
 * Combined vector + text search with RRF fusion
 */

import { sql, eq, and } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { documents } from '../schema/index.js';
import type {
  Collection,
  EmbeddingVector,
  HybridSearchOptions,
  SearchResult,
  ScoredDocument,
} from '../types.js';

/**
 * Reciprocal Rank Fusion (RRF) scoring
 *
 * RRF combines multiple ranked lists by assigning each document
 * a score based on its rank in each list: 1 / (k + rank)
 *
 * @param vectorRank - Rank in vector search results (1-indexed)
 * @param textRank - Rank in text search results (1-indexed)
 * @param k - RRF constant (default: 60)
 * @param vectorWeight - Weight for vector results (0-1)
 */
function calculateRRFScore(
  vectorRank: number | null,
  textRank: number | null,
  k: number,
  vectorWeight: number
): number {
  const textWeight = 1 - vectorWeight;
  let score = 0;

  if (vectorRank !== null) {
    score += vectorWeight * (1 / (k + vectorRank));
  }

  if (textRank !== null) {
    score += textWeight * (1 / (k + textRank));
  }

  return score;
}

/**
 * Perform hybrid search combining vector similarity and full-text search
 */
export async function hybridSearch(
  db: PostgresJsDatabase,
  collection: Collection,
  query: string,
  embedding: EmbeddingVector,
  options: HybridSearchOptions = {}
): Promise<SearchResult> {
  const { limit = 10, vectorWeight = 0.5, rrfK = 60, minScore = 0, filter } = options;

  const startTime = Date.now();

  // Build base conditions
  const baseConditions = [eq(documents.collectionId, collection.id)];

  if (filter && Object.keys(filter).length > 0) {
    baseConditions.push(sql`${documents.metadata} @> ${JSON.stringify(filter)}::jsonb`);
  }

  const vectorLiteral = `[${embedding.join(',')}]::vector`;
  const distanceExpr = sql`${documents.embedding} <=> ${sql.raw(vectorLiteral)}`;
  const tsquery = sql`websearch_to_tsquery('english', ${query})`;

  // Use a CTE-based approach for RRF fusion
  // This performs both searches and combines results
  const results = await db.execute<{
    id: string;
    collection_id: string;
    content: string;
    metadata: Record<string, unknown> | null;
    created_at: Date;
    vector_rank: number | null;
    text_rank: number | null;
  }>(sql`
    WITH vector_results AS (
      SELECT
        id,
        ROW_NUMBER() OVER (ORDER BY embedding <=> ${sql.raw(vectorLiteral)}) as rank
      FROM ${documents}
      WHERE ${sql.raw(baseConditions.map((c) => `(${c.getSQL()})`).join(' AND '))}
        AND embedding IS NOT NULL
      LIMIT ${limit * 2}
    ),
    text_results AS (
      SELECT
        id,
        ROW_NUMBER() OVER (ORDER BY ts_rank_cd(search_vector, ${tsquery}) DESC) as rank
      FROM ${documents}
      WHERE ${sql.raw(baseConditions.map((c) => `(${c.getSQL()})`).join(' AND '))}
        AND search_vector @@ ${tsquery}
      LIMIT ${limit * 2}
    ),
    combined AS (
      SELECT DISTINCT d.id
      FROM ${documents} d
      LEFT JOIN vector_results vr ON d.id = vr.id
      LEFT JOIN text_results tr ON d.id = tr.id
      WHERE vr.id IS NOT NULL OR tr.id IS NOT NULL
    )
    SELECT
      d.id,
      d.collection_id,
      d.content,
      d.metadata,
      d.created_at,
      vr.rank as vector_rank,
      tr.rank as text_rank
    FROM ${documents} d
    JOIN combined c ON d.id = c.id
    LEFT JOIN vector_results vr ON d.id = vr.id
    LEFT JOIN text_results tr ON d.id = tr.id
    LIMIT ${limit * 2}
  `);

  // Calculate RRF scores and sort
  const scoredResults = results.map((row) => ({
    document: {
      id: row.id,
      collectionId: row.collection_id,
      content: row.content,
      embedding: null,
      metadata: row.metadata,
      createdAt: row.created_at,
    },
    score: calculateRRFScore(row.vector_rank, row.text_rank, rrfK, vectorWeight),
    vectorRank: row.vector_rank,
    textRank: row.text_rank,
  }));

  // Sort by RRF score and filter
  const sortedResults = scoredResults
    .filter((r) => r.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  const scoredDocuments: ScoredDocument[] = sortedResults.map((r) => ({
    document: r.document,
    score: r.score,
  }));

  return {
    documents: scoredDocuments,
    totalCount: scoredDocuments.length,
    searchType: 'hybrid',
    durationMs: Date.now() - startTime,
  };
}

/**
 * Alternative hybrid search using weighted linear combination
 */
export async function hybridSearchLinear(
  db: PostgresJsDatabase,
  collection: Collection,
  query: string,
  embedding: EmbeddingVector,
  options: HybridSearchOptions = {}
): Promise<SearchResult> {
  const { limit = 10, vectorWeight = 0.5, minScore = 0, filter } = options;

  const startTime = Date.now();

  const baseConditions = [eq(documents.collectionId, collection.id)];

  if (filter && Object.keys(filter).length > 0) {
    baseConditions.push(sql`${documents.metadata} @> ${JSON.stringify(filter)}::jsonb`);
  }

  const vectorLiteral = `[${embedding.join(',')}]::vector`;
  const tsquery = sql`websearch_to_tsquery('english', ${query})`;

  // Combined scoring using linear combination
  // Vector similarity: 1 - cosine_distance (0-1 range)
  // Text similarity: normalized ts_rank (0-1 range approximation)
  const results = await db
    .select({
      id: documents.id,
      collectionId: documents.collectionId,
      content: documents.content,
      metadata: documents.metadata,
      createdAt: documents.createdAt,
      vectorScore:
        sql<number>`COALESCE(1 - (${documents.embedding} <=> ${sql.raw(vectorLiteral)}), 0)`.as(
          'vector_score'
        ),
      textScore: sql<number>`COALESCE(ts_rank_cd(${documents.searchVector}, ${tsquery}), 0)`.as(
        'text_score'
      ),
    })
    .from(documents)
    .where(and(...baseConditions))
    .orderBy(
      sql`(${vectorWeight} * COALESCE(1 - (${documents.embedding} <=> ${sql.raw(vectorLiteral)}), 0) + 
          ${1 - vectorWeight} * COALESCE(ts_rank_cd(${documents.searchVector}, ${tsquery}), 0)) DESC`
    )
    .limit(limit);

  const textWeight = 1 - vectorWeight;

  const scoredDocuments: ScoredDocument[] = results
    .map((row) => ({
      document: {
        id: row.id,
        collectionId: row.collectionId,
        content: row.content,
        embedding: null,
        metadata: row.metadata,
        createdAt: row.createdAt,
      },
      score: vectorWeight * row.vectorScore + textWeight * row.textScore,
    }))
    .filter((r) => r.score >= minScore);

  return {
    documents: scoredDocuments,
    totalCount: scoredDocuments.length,
    searchType: 'hybrid',
    durationMs: Date.now() - startTime,
  };
}
