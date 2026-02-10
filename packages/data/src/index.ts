/**
 * @seashore/data
 *
 * Data layer for Seashore - Storage, Vector Search, and RAG
 */

// Storage - Drizzle ORM persistence
export { createStorageService } from './storage/index.js'
export type {
  StorageService,
  PaginationOpts,
  NewMessage,
  Thread,
  Message,
  WorkflowRun,
} from './storage/index.js'
export { threads, messages, workflowRuns } from './storage/index.js'

// VectorDB - pgvector hybrid search
export { createVectorDBService } from './vectordb/index.js'
export type {
  VectorDBService,
  SearchQuery,
  SearchResult,
  DocumentInput,
  MetadataFilter,
} from './vectordb/index.js'
export { embeddings } from './vectordb/index.js'

// RAG - Document chunking and retrieval pipeline
export { createRAG, createChunker } from './rag/index.js'
export type { RAGConfig, RAGPipeline, ChunkerConfig, Chunker } from './rag/index.js'
