/**
 * RAG (Retrieval-Augmented Generation) module
 *
 * Provides document chunking and retrieval pipeline for building
 * RAG-powered applications.
 */

export { createRAG } from './pipeline.js'
export type { RAGConfig, RAGPipeline } from './pipeline.js'
export { createChunker } from './chunker.js'
export type { ChunkerConfig, Chunker } from './chunker.js'
