/**
 * @seashore/vectordb - Text Search
 *
 * PostgreSQL full-text search using tsvector
 */

import { sql, eq, and } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { documents } from '../schema/index.js';
import type { Collection, SearchResult, ScoredDocument, TextSearchOptions } from '../types.js';

/**
 * Perform full-text search using PostgreSQL tsvector
 */
export async function textSearch(
  db: PostgresJsDatabase,
  collection: Collection,
  query: string,
  options: TextSearchOptions = {}
): Promise<SearchResult> {
  const {
    limit = 10,
    language = 'english',
    filter,
    ranking = 'ts_rank_cd',
    normalization = 0,
  } = options;

  const startTime = Date.now();

  // Build conditions
  const conditions = [eq(documents.collectionId, collection.id)];

  // Add metadata filter if provided
  if (filter && Object.keys(filter).length > 0) {
    conditions.push(sql`${documents.metadata} @> ${JSON.stringify(filter)}::jsonb`);
  }

  // Generate tsquery from search text
  const tsquery = sql`websearch_to_tsquery(${language}, ${query})`;

  // Add text search condition
  conditions.push(sql`${documents.searchVector} @@ ${tsquery}`);

  // Calculate rank
  const rankExpr =
    ranking === 'ts_rank'
      ? sql`ts_rank(${documents.searchVector}, ${tsquery}, ${normalization})`
      : sql`ts_rank_cd(${documents.searchVector}, ${tsquery}, ${normalization})`;

  // Execute search
  const results = await db
    .select({
      id: documents.id,
      collectionId: documents.collectionId,
      content: documents.content,
      embedding: sql<null>`NULL`,
      metadata: documents.metadata,
      createdAt: documents.createdAt,
      rank: rankExpr.as('rank'),
    })
    .from(documents)
    .where(and(...conditions))
    .orderBy(sql`rank DESC`)
    .limit(limit);

  // Convert to scored documents
  const scoredDocuments: ScoredDocument[] = results.map((row) => ({
    document: {
      id: row.id,
      collectionId: row.collectionId,
      content: row.content,
      embedding: null,
      metadata: row.metadata,
      createdAt: row.createdAt,
    },
    score: Number(row.rank),
  }));

  return {
    documents: scoredDocuments,
    totalCount: scoredDocuments.length,
    searchType: 'text',
    durationMs: Date.now() - startTime,
  };
}

/**
 * Perform prefix text search (for autocomplete)
 */
export async function prefixTextSearch(
  db: PostgresJsDatabase,
  collection: Collection,
  prefix: string,
  options: Omit<TextSearchOptions, 'ranking'> = {}
): Promise<SearchResult> {
  const { limit = 10, language = 'english', filter } = options;

  const startTime = Date.now();

  // Build conditions
  const conditions = [eq(documents.collectionId, collection.id)];

  // Add metadata filter if provided
  if (filter && Object.keys(filter).length > 0) {
    conditions.push(sql`${documents.metadata} @> ${JSON.stringify(filter)}::jsonb`);
  }

  // Generate prefix tsquery (each word followed by :*)
  const prefixQuery = prefix
    .trim()
    .split(/\s+/)
    .map((word) => `${word}:*`)
    .join(' & ');

  const tsquery = sql`to_tsquery(${language}, ${prefixQuery})`;

  // Add text search condition
  conditions.push(sql`${documents.searchVector} @@ ${tsquery}`);

  // Execute search
  const results = await db
    .select({
      id: documents.id,
      collectionId: documents.collectionId,
      content: documents.content,
      embedding: sql<null>`NULL`,
      metadata: documents.metadata,
      createdAt: documents.createdAt,
      rank: sql`ts_rank_cd(${documents.searchVector}, ${tsquery})`.as('rank'),
    })
    .from(documents)
    .where(and(...conditions))
    .orderBy(sql`rank DESC`)
    .limit(limit);

  // Convert to scored documents
  const scoredDocuments: ScoredDocument[] = results.map((row) => ({
    document: {
      id: row.id,
      collectionId: row.collectionId,
      content: row.content,
      embedding: null,
      metadata: row.metadata,
      createdAt: row.createdAt,
    },
    score: Number(row.rank),
  }));

  return {
    documents: scoredDocuments,
    totalCount: scoredDocuments.length,
    searchType: 'text',
    durationMs: Date.now() - startTime,
  };
}

/**
 * Get search suggestions based on indexed terms
 */
export async function getSearchSuggestions(
  db: PostgresJsDatabase,
  collection: Collection,
  prefix: string,
  limit = 10
): Promise<readonly string[]> {
  // Query unique lexemes from documents
  const results = await db.execute<{ word: string }>(sql`
    SELECT DISTINCT unnest(
      tsvector_to_array(${documents.searchVector})
    ) as word
    FROM ${documents}
    WHERE ${documents.collectionId} = ${collection.id}
      AND unnest(tsvector_to_array(${documents.searchVector})) LIKE ${prefix + '%'}
    LIMIT ${limit}
  `);

  return results.map((row) => row.word);
}
