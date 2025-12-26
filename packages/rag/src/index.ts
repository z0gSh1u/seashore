/**
 * @seashore/rag
 *
 * RAG (Retrieval-Augmented Generation) utilities
 * Document loaders, splitters, retrievers, and pipeline
 */

// Types
export type {
  DocumentMetadata,
  LoadedDocument,
  DocumentChunk,
  DocumentLoader,
  DocumentSplitter,
  SplitterOptions,
  RetrieverOptions,
  RetrievedDocument,
  Retriever,
  RAGConfig,
  RAGContext,
  RAGResponse,
  RAGPipeline,
  EmbeddingFunction,
  TextLoaderOptions,
  MarkdownLoaderOptions,
  PDFLoaderOptions,
  WebLoaderOptions,
  TokenSplitterOptions,
  MarkdownSplitterOptions,
} from './types.js';

// Loaders
export {
  createTextLoader,
  createStringLoader,
  createMultiTextLoader,
  createGlobLoader,
  createMarkdownLoader,
  createMultiMarkdownLoader,
  createMarkdownStringLoader,
  createPDFLoader,
  createMultiPDFLoader,
  createPDFBufferLoader,
  createWebLoader,
  createMultiWebLoader,
  createSitemapLoader,
} from './loaders/index.js';

// Splitters
export {
  createRecursiveSplitter,
  createCharacterSplitter,
  createTokenSplitter,
  createCustomTokenSplitter,
  estimateTokens,
  createMarkdownSplitter,
  createHeaderSplitter,
} from './splitters/index.js';

// Retrievers
export {
  createVectorRetriever,
  createInMemoryRetriever,
  createHybridRetriever,
  createRerankingRetriever,
  createMultiRetriever,
  type VectorRetrieverOptions,
  type HybridRetrieverOptions,
} from './retrievers/index.js';

// RAG Pipeline
export {
  createRAG,
  buildRAGPrompt,
  createCitations,
  createRAGChain,
  type QuestionAnswerResult,
  type RAGChainOptions,
} from './rag.js';
