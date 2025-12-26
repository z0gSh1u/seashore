/**
 * @seashore/rag - Vector Retriever
 *
 * Retriever using vector similarity search
 */

import type { VectorStore, VectorStoreOptions, EmbeddingFunction } from '@seashore/vectordb';
import { createVectorStore } from '@seashore/vectordb';
import type { Retriever, RetrieverOptions, RetrievedDocument, DocumentChunk } from '../types.js';

/**
 * Options for creating a vector retriever
 */
export interface VectorRetrieverOptions {
  /**
   * Existing vector store to use
   */
  vectorStore?: VectorStore;

  /**
   * Options to create a new vector store
   */
  vectorStoreOptions?: VectorStoreOptions;

  /**
   * Embedding function (required if not using existing store)
   */
  embeddings?: EmbeddingFunction;

  /**
   * Default number of results to return
   * @default 4
   */
  defaultK?: number;

  /**
   * Default minimum score threshold
   * @default 0
   */
  defaultMinScore?: number;

  /**
   * HNSW ef_search parameter
   * @default 40
   */
  efSearch?: number;
}

/**
 * Create a vector-based retriever
 */
export async function createVectorRetriever(options: VectorRetrieverOptions): Promise<Retriever> {
  const {
    vectorStore: existingStore,
    vectorStoreOptions,
    embeddings,
    defaultK = 4,
    defaultMinScore = 0,
    efSearch = 40,
  } = options;

  // Get or create vector store
  let vectorStore: VectorStore;

  if (existingStore) {
    vectorStore = existingStore;
  } else if (vectorStoreOptions) {
    vectorStore = await createVectorStore(vectorStoreOptions);
  } else {
    throw new Error('Either vectorStore or vectorStoreOptions must be provided');
  }

  // Get embedding function
  const embeddingFn = embeddings ?? vectorStoreOptions?.embeddings;
  if (!embeddingFn) {
    throw new Error('Embedding function must be provided');
  }

  return {
    async retrieve(
      query: string,
      options: RetrieverOptions = {}
    ): Promise<readonly RetrievedDocument[]> {
      const {
        k = defaultK,
        minScore = defaultMinScore,
        filter,
        includeEmbeddings = false,
      } = options;

      // Generate query embedding
      const [queryEmbedding] = await embeddingFn([query]);

      if (!queryEmbedding) {
        throw new Error('Failed to generate query embedding');
      }

      // Search vector store
      const results = await vectorStore.searchByVector(queryEmbedding, {
        limit: k,
        minScore,
        filter,
        efSearch,
        includeEmbeddings,
      });

      // Convert to RetrievedDocuments
      return results.documents.map((scored) => ({
        id: scored.document.id,
        content: scored.document.content,
        metadata: scored.document.metadata ?? {},
        score: scored.score,
      }));
    },

    async addDocuments(chunks: readonly DocumentChunk[]): Promise<readonly string[]> {
      // Generate embeddings for all chunks
      const contents = chunks.map((c) => c.content);
      const embeddings = await embeddingFn(contents);

      // Prepare documents for vector store
      const documents = chunks.map((chunk, i) => ({
        content: chunk.content,
        embedding: embeddings[i] as number[],
        metadata: chunk.metadata as Record<string, unknown>,
      }));

      // Add to vector store
      return vectorStore.addDocuments(documents);
    },

    async deleteDocuments(ids: readonly string[]): Promise<void> {
      await vectorStore.deleteDocuments(ids);
    },

    getVectorStore(): VectorStore {
      return vectorStore;
    },
  };
}

/**
 * Create a simple in-memory retriever for testing
 */
export function createInMemoryRetriever(embeddingFn: EmbeddingFunction): Retriever {
  const documents: Map<
    string,
    { content: string; embedding: number[]; metadata: Record<string, unknown> }
  > = new Map();

  let idCounter = 0;

  /**
   * Calculate cosine similarity
   */
  function cosineSimilarity(a: number[], b: number[]): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += (a[i] ?? 0) * (b[i] ?? 0);
      normA += (a[i] ?? 0) ** 2;
      normB += (b[i] ?? 0) ** 2;
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  return {
    async retrieve(
      query: string,
      options: RetrieverOptions = {}
    ): Promise<readonly RetrievedDocument[]> {
      const { k = 4, minScore = 0, filter } = options;

      // Generate query embedding
      const [queryEmbedding] = await embeddingFn([query]);

      if (!queryEmbedding) {
        throw new Error('Failed to generate query embedding');
      }

      // Calculate similarities
      const results: Array<{
        id: string;
        score: number;
        content: string;
        metadata: Record<string, unknown>;
      }> = [];

      for (const [id, doc] of documents) {
        // Apply filter
        if (filter) {
          const matches = Object.entries(filter).every(
            ([key, value]) => doc.metadata[key] === value
          );
          if (!matches) continue;
        }

        const score = cosineSimilarity(queryEmbedding, doc.embedding);
        if (score >= minScore) {
          results.push({
            id,
            score,
            content: doc.content,
            metadata: doc.metadata,
          });
        }
      }

      // Sort by score and take top k
      results.sort((a, b) => b.score - a.score);
      return results.slice(0, k);
    },

    async addDocuments(chunks: readonly DocumentChunk[]): Promise<readonly string[]> {
      const contents = chunks.map((c) => c.content);
      const embeddings = await embeddingFn(contents);

      const ids: string[] = [];

      for (let i = 0; i < chunks.length; i++) {
        const id = `doc-${++idCounter}`;
        documents.set(id, {
          content: chunks[i]!.content,
          embedding: embeddings[i] as number[],
          metadata: chunks[i]!.metadata as Record<string, unknown>,
        });
        ids.push(id);
      }

      return ids;
    },

    async deleteDocuments(ids: readonly string[]): Promise<void> {
      for (const id of ids) {
        documents.delete(id);
      }
    },

    getVectorStore(): VectorStore {
      throw new Error('In-memory retriever does not have a vector store');
    },
  };
}
