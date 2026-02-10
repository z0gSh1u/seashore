/**
 * VectorDB module - Pgvector-based semantic + full-text hybrid search
 */

export { createVectorDBService } from './service.js'
export type {
  VectorDBService,
  SearchQuery,
  SearchResult,
  DocumentInput,
  MetadataFilter,
} from './service.js'
export { embeddings } from './schema.js'
