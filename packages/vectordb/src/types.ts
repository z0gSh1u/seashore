/**
 * @seashore/vectordb - Types
 *
 * Type definitions for vector database operations
 */

import type { ZodSchema } from 'zod';

/**
 * Embedding vector type
 */
export type EmbeddingVector = readonly number[];

/**
 * Distance metric for vector similarity
 */
export type DistanceMetric = 'cosine' | 'euclidean' | 'inner_product';

/**
 * Collection configuration
 */
export interface CollectionConfig {
  /** Collection name (unique identifier) */
  readonly name: string;

  /** Optional description */
  readonly description?: string;

  /** Vector dimensions (e.g., 1536 for OpenAI text-embedding-3-small) */
  readonly dimensions: number;

  /** Distance metric for similarity search */
  readonly distanceMetric?: DistanceMetric;

  /** HNSW index parameters */
  readonly hnswConfig?: HNSWConfig;

  /** Custom metadata schema */
  readonly metadataSchema?: ZodSchema;
}

/**
 * HNSW index configuration
 */
export interface HNSWConfig {
  /** Maximum number of connections per element */
  readonly m?: number;

  /** Size of dynamic candidate list during construction */
  readonly efConstruction?: number;
}

/**
 * Collection entity
 */
export interface Collection {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  readonly dimensions: number;
  readonly distanceMetric: DistanceMetric;
  readonly hnswM: number;
  readonly hnswEfConstruction: number;
  readonly documentCount: number;
  readonly metadata: Record<string, unknown> | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/**
 * Document in vector store
 */
export interface Document {
  readonly id: string;
  readonly collectionId: string;
  readonly content: string;
  readonly embedding: EmbeddingVector | null;
  readonly metadata: Record<string, unknown> | null;
  readonly createdAt: Date;
}

/**
 * New document input
 */
export interface NewDocument {
  readonly content: string;
  readonly embedding?: EmbeddingVector;
  readonly metadata?: Record<string, unknown>;
}

/**
 * Document with score from search
 */
export interface ScoredDocument {
  readonly document: Document;
  readonly score: number;
}

/**
 * Vector search options
 */
export interface VectorSearchOptions {
  /** Number of results to return */
  readonly limit?: number;

  /** Minimum similarity score threshold */
  readonly minScore?: number;

  /** Metadata filter */
  readonly filter?: Record<string, unknown>;

  /** HNSW ef_search parameter (higher = more accurate but slower) */
  readonly efSearch?: number;

  /** Include embeddings in results */
  readonly includeEmbeddings?: boolean;
}

/**
 * Text search options
 */
export interface TextSearchOptions {
  /** Number of results to return */
  readonly limit?: number;

  /** Search language (default: 'english') */
  readonly language?: string;

  /** Metadata filter */
  readonly filter?: Record<string, unknown>;

  /** Ranking algorithm */
  readonly ranking?: 'ts_rank' | 'ts_rank_cd';

  /** Normalization options for ts_rank */
  readonly normalization?: number;
}

/**
 * Hybrid search options
 */
export interface HybridSearchOptions {
  /** Number of results to return */
  readonly limit?: number;

  /** Weight for vector search (0-1), text weight = 1 - vectorWeight */
  readonly vectorWeight?: number;

  /** RRF fusion constant k (default: 60) */
  readonly rrfK?: number;

  /** Minimum similarity score threshold */
  readonly minScore?: number;

  /** Metadata filter */
  readonly filter?: Record<string, unknown>;
}

/**
 * Search result
 */
export interface SearchResult {
  readonly documents: readonly ScoredDocument[];
  readonly totalCount: number;
  readonly searchType: 'vector' | 'text' | 'hybrid';
  readonly durationMs: number;
}

/**
 * Vector store interface
 */
export interface VectorStore {
  /** Collection this store operates on */
  readonly collection: Collection;

  /** Add documents to the store */
  addDocuments(documents: readonly NewDocument[]): Promise<readonly Document[]>;

  /** Get document by ID */
  getDocument(id: string): Promise<Document | null>;

  /** Update document */
  updateDocument(
    id: string,
    update: Partial<Pick<NewDocument, 'content' | 'embedding' | 'metadata'>>
  ): Promise<Document>;

  /** Delete document */
  deleteDocument(id: string): Promise<void>;

  /** Delete documents by filter */
  deleteDocuments(filter: Record<string, unknown>): Promise<number>;

  /** Search by vector similarity */
  searchByVector(embedding: EmbeddingVector, options?: VectorSearchOptions): Promise<SearchResult>;

  /** Search by text (full-text search) */
  searchByText(query: string, options?: TextSearchOptions): Promise<SearchResult>;

  /** Hybrid search combining vector and text */
  searchHybrid(
    query: string,
    embedding: EmbeddingVector,
    options?: HybridSearchOptions
  ): Promise<SearchResult>;

  /** Get collection statistics */
  getStats(): Promise<CollectionStats>;
}

/**
 * Collection statistics
 */
export interface CollectionStats {
  readonly documentCount: number;
  readonly embeddedCount: number;
  readonly avgEmbeddingSize: number;
  readonly storageBytes: number;
}

/**
 * Embedding function type
 */
export type EmbeddingFunction = (texts: readonly string[]) => Promise<readonly EmbeddingVector[]>;

/**
 * Vector store factory options
 */
export interface VectorStoreOptions {
  /** Database connection string or pool */
  readonly db: unknown;

  /** Collection name */
  readonly collectionName: string;

  /** Optional embedding function for automatic embedding */
  readonly embeddings?: EmbeddingFunction;

  /** Create collection if it doesn't exist */
  readonly createIfNotExists?: boolean;

  /** Collection configuration (used when creating) */
  readonly collectionConfig?: Omit<CollectionConfig, 'name'>;
}
