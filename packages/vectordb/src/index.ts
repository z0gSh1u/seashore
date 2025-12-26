/**
 * @seashore/vectordb
 *
 * Vector database utilities for pgvector
 * HNSW indexing, hybrid search (vector + full-text)
 */

// Types
export type {
  EmbeddingVector,
  Collection,
  CollectionConfig,
  Document,
  NewDocument,
  DocumentUpdate,
  ScoredDocument,
  VectorSearchOptions,
  TextSearchOptions,
  HybridSearchOptions,
  SearchResult,
  VectorStore,
  VectorStoreStats,
  EmbeddingFunction,
  VectorStoreOptions,
  DistanceMetric,
} from './types.js';

// Schema (for migrations/setup)
export * as schema from './schema/index.js';
export { collections, collectionsRelations } from './schema/collections.js';
export {
  documents,
  documentsRelations,
  vector,
  tsvector,
  generateSearchVector,
  generateSearchQuery,
  generateWebSearchQuery,
} from './schema/documents.js';

// Store
export {
  createVectorStore,
  createCollection,
  getCollection,
  deleteCollection,
  listCollections,
  VectorStoreError,
  CollectionNotFoundError,
} from './store.js';

// Search functions (for advanced usage)
export {
  vectorSearch,
  batchVectorSearch,
  textSearch,
  prefixTextSearch,
  getSearchSuggestions,
  hybridSearch,
  hybridSearchLinear,
} from './search/index.js';
