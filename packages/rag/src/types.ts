/**
 * @seashore/rag - Type Definitions
 *
 * Types for RAG (Retrieval-Augmented Generation) pipeline
 */

import type { Document, VectorStore, SearchResult } from '@seashore/vectordb';

/**
 * Metadata associated with a loaded document
 */
export interface DocumentMetadata {
  source: string;
  sourceType: 'file' | 'url' | 'string';
  filename?: string;
  url?: string;
  mimeType?: string;
  title?: string;
  author?: string;
  createdAt?: Date;
  modifiedAt?: Date;
  fileSize?: number;
  encoding?: string;
  language?: string;
  [key: string]: unknown;
}

/**
 * A document loaded from a source (before chunking)
 */
export interface LoadedDocument {
  /**
   * Raw content of the document
   */
  content: string;

  /**
   * Metadata about the document source
   */
  metadata: DocumentMetadata;

  /**
   * Page content for multi-page documents (e.g., PDFs)
   */
  pages?: readonly string[];
}

/**
 * A chunk of a document after splitting
 */
export interface DocumentChunk {
  /**
   * Chunk content
   */
  content: string;

  /**
   * Metadata inherited from source document + chunk-specific metadata
   */
  metadata: DocumentMetadata & {
    chunkIndex: number;
    chunkCount?: number;
    startPosition?: number;
    endPosition?: number;
    pageNumber?: number;
  };
}

/**
 * Document loader interface
 */
export interface DocumentLoader {
  /**
   * Load documents from source(s)
   */
  load(): Promise<readonly LoadedDocument[]>;

  /**
   * Lazy loading - yields documents one at a time
   */
  loadLazy?(): AsyncGenerator<LoadedDocument>;
}

/**
 * Options for text splitters
 */
export interface SplitterOptions {
  /**
   * Target chunk size in characters
   * @default 1000
   */
  chunkSize?: number;

  /**
   * Overlap between chunks in characters
   * @default 200
   */
  chunkOverlap?: number;

  /**
   * Separators to use for splitting (in order of priority)
   */
  separators?: readonly string[];

  /**
   * Whether to keep separator in chunks
   * @default false
   */
  keepSeparator?: boolean;

  /**
   * Strip whitespace from chunks
   * @default true
   */
  stripWhitespace?: boolean;

  /**
   * Length function for measuring chunk size
   * @default (text) => text.length
   */
  lengthFunction?: (text: string) => number;
}

/**
 * Document splitter interface
 */
export interface DocumentSplitter {
  /**
   * Split a document into chunks
   */
  split(document: LoadedDocument): Promise<readonly DocumentChunk[]>;

  /**
   * Split multiple documents
   */
  splitDocuments(documents: readonly LoadedDocument[]): Promise<readonly DocumentChunk[]>;
}

/**
 * Retriever options
 */
export interface RetrieverOptions {
  /**
   * Number of documents to retrieve
   * @default 4
   */
  k?: number;

  /**
   * Minimum relevance score threshold
   * @default 0
   */
  minScore?: number;

  /**
   * Metadata filter
   */
  filter?: Record<string, unknown>;

  /**
   * Search type: 'vector' | 'text' | 'hybrid'
   * @default 'vector'
   */
  searchType?: 'vector' | 'text' | 'hybrid';

  /**
   * Weight for vector search in hybrid mode (0-1)
   * @default 0.5
   */
  vectorWeight?: number;

  /**
   * Include document embeddings in results
   * @default false
   */
  includeEmbeddings?: boolean;
}

/**
 * Retrieved document with score
 */
export interface RetrievedDocument {
  /**
   * Document content
   */
  content: string;

  /**
   * Document metadata
   */
  metadata: Record<string, unknown>;

  /**
   * Relevance score (higher is more relevant)
   */
  score: number;

  /**
   * Original document ID in vector store
   */
  id: string;
}

/**
 * Retriever interface
 */
export interface Retriever {
  /**
   * Retrieve relevant documents for a query
   */
  retrieve(query: string, options?: RetrieverOptions): Promise<readonly RetrievedDocument[]>;

  /**
   * Add documents to the retriever's store
   */
  addDocuments(chunks: readonly DocumentChunk[]): Promise<readonly string[]>;

  /**
   * Delete documents from the store
   */
  deleteDocuments(ids: readonly string[]): Promise<void>;

  /**
   * Get the underlying vector store
   */
  getVectorStore(): VectorStore;
}

/**
 * RAG pipeline configuration
 */
export interface RAGConfig {
  /**
   * Retriever to use
   */
  retriever: Retriever;

  /**
   * System prompt template with {context} placeholder
   */
  systemPrompt?: string;

  /**
   * Maximum number of tokens for context
   * @default 4000
   */
  maxContextTokens?: number;

  /**
   * Number of documents to retrieve
   * @default 4
   */
  k?: number;

  /**
   * Include source citations in response
   * @default true
   */
  includeSources?: boolean;

  /**
   * Context format: 'text' | 'xml' | 'markdown'
   * @default 'text'
   */
  contextFormat?: 'text' | 'xml' | 'markdown';
}

/**
 * RAG context prepared for LLM
 */
export interface RAGContext {
  /**
   * Formatted context string
   */
  formattedContext: string;

  /**
   * Retrieved documents
   */
  documents: readonly RetrievedDocument[];

  /**
   * Total tokens used by context (approximate)
   */
  tokenCount?: number;
}

/**
 * RAG response with sources
 */
export interface RAGResponse {
  /**
   * Generated answer
   */
  answer: string;

  /**
   * Source documents used
   */
  sources: readonly RetrievedDocument[];

  /**
   * Context provided to LLM
   */
  context: RAGContext;

  /**
   * Generation metadata
   */
  metadata?: {
    tokensUsed?: number;
    latencyMs?: number;
    model?: string;
  };
}

/**
 * RAG pipeline interface
 */
export interface RAGPipeline {
  /**
   * Get context for a query without generating
   */
  getContext(query: string): Promise<RAGContext>;

  /**
   * Ingest documents into the RAG pipeline
   */
  ingest(
    loader: DocumentLoader,
    splitter: DocumentSplitter
  ): Promise<{ documentCount: number; chunkCount: number }>;

  /**
   * Get the underlying retriever
   */
  getRetriever(): Retriever;
}

/**
 * Embedding function type
 */
export type EmbeddingFunction = (texts: readonly string[]) => Promise<readonly number[][]>;

/**
 * Factory options for creating loaders
 */
export interface TextLoaderOptions {
  path: string;
  encoding?: BufferEncoding;
}

export interface MarkdownLoaderOptions {
  path: string;
  extractMetadata?: boolean;
}

export interface PDFLoaderOptions {
  path: string;
  splitPages?: boolean;
}

export interface WebLoaderOptions {
  url: string;
  selector?: string;
  timeout?: number;
  headers?: Record<string, string>;
}

/**
 * Token splitter specific options
 */
export interface TokenSplitterOptions extends SplitterOptions {
  /**
   * Model to use for tokenization
   * @default 'gpt-4'
   */
  model?: string;

  /**
   * Use encoding name directly
   */
  encoding?: string;
}

/**
 * Markdown splitter specific options
 */
export interface MarkdownSplitterOptions extends SplitterOptions {
  /**
   * Split on headers of specific levels
   * @default [1, 2, 3]
   */
  headerLevels?: readonly number[];

  /**
   * Include header in chunk content
   * @default true
   */
  includeHeader?: boolean;

  /**
   * Split code blocks separately
   * @default true
   */
  splitCodeBlocks?: boolean;
}
