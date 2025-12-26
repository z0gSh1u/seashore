/**
 * @seashore/rag - Hybrid Retriever
 *
 * Retriever combining vector and text search with RRF fusion
 */

import type { VectorStore, VectorStoreOptions, EmbeddingFunction } from '@seashore/vectordb';
import { createVectorStore } from '@seashore/vectordb';
import type { Retriever, RetrieverOptions, RetrievedDocument, DocumentChunk } from '../types.js';

/**
 * Options for creating a hybrid retriever
 */
export interface HybridRetrieverOptions {
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
   * Default weight for vector search (0-1)
   * 0 = text only, 1 = vector only, 0.5 = balanced
   * @default 0.5
   */
  defaultVectorWeight?: number;

  /**
   * RRF constant (higher = more emphasis on top results)
   * @default 60
   */
  rrfK?: number;
}

/**
 * Create a hybrid retriever using both vector and text search
 */
export async function createHybridRetriever(options: HybridRetrieverOptions): Promise<Retriever> {
  const {
    vectorStore: existingStore,
    vectorStoreOptions,
    embeddings,
    defaultK = 4,
    defaultMinScore = 0,
    defaultVectorWeight = 0.5,
    rrfK = 60,
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
        searchType = 'hybrid',
        vectorWeight = defaultVectorWeight,
      } = options;

      // Route to appropriate search type
      if (searchType === 'vector') {
        const [queryEmbedding] = await embeddingFn([query]);
        if (!queryEmbedding) {
          throw new Error('Failed to generate query embedding');
        }

        const results = await vectorStore.searchByVector(queryEmbedding, {
          limit: k,
          minScore,
          filter,
        });

        return results.documents.map((scored) => ({
          id: scored.document.id,
          content: scored.document.content,
          metadata: scored.document.metadata ?? {},
          score: scored.score,
        }));
      }

      if (searchType === 'text') {
        const results = await vectorStore.searchByText(query, {
          limit: k,
          filter,
        });

        return results.documents
          .filter((scored) => scored.score >= minScore)
          .map((scored) => ({
            id: scored.document.id,
            content: scored.document.content,
            metadata: scored.document.metadata ?? {},
            score: scored.score,
          }));
      }

      // Hybrid search
      const [queryEmbedding] = await embeddingFn([query]);
      if (!queryEmbedding) {
        throw new Error('Failed to generate query embedding');
      }

      const results = await vectorStore.searchHybrid(query, queryEmbedding, {
        limit: k,
        minScore,
        filter,
        vectorWeight,
        rrfK,
      });

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
 * Create a reranking retriever that reorders results from a base retriever
 */
export function createRerankingRetriever(
  baseRetriever: Retriever,
  rerankFn: (
    query: string,
    documents: readonly RetrievedDocument[]
  ) => Promise<readonly RetrievedDocument[]>
): Retriever {
  return {
    async retrieve(
      query: string,
      options: RetrieverOptions = {}
    ): Promise<readonly RetrievedDocument[]> {
      const { k = 4 } = options;

      // Get more results from base retriever for reranking
      const baseResults = await baseRetriever.retrieve(query, {
        ...options,
        k: k * 3, // Fetch 3x for better reranking
      });

      // Rerank
      const reranked = await rerankFn(query, baseResults);

      // Return top k
      return reranked.slice(0, k);
    },

    async addDocuments(chunks: readonly DocumentChunk[]): Promise<readonly string[]> {
      return baseRetriever.addDocuments(chunks);
    },

    async deleteDocuments(ids: readonly string[]): Promise<void> {
      return baseRetriever.deleteDocuments(ids);
    },

    getVectorStore(): VectorStore {
      return baseRetriever.getVectorStore();
    },
  };
}

/**
 * Create a multi-retriever that combines results from multiple retrievers
 */
export function createMultiRetriever(
  retrievers: readonly Retriever[],
  weights?: readonly number[]
): Retriever {
  const retrieverWeights = weights ?? retrievers.map(() => 1 / retrievers.length);

  if (retrieverWeights.length !== retrievers.length) {
    throw new Error('Weights array must match retrievers array length');
  }

  return {
    async retrieve(
      query: string,
      options: RetrieverOptions = {}
    ): Promise<readonly RetrievedDocument[]> {
      const { k = 4, minScore = 0 } = options;

      // Get results from all retrievers
      const allResults = await Promise.all(
        retrievers.map((r, i) =>
          r.retrieve(query, { ...options, k: k * 2 }).then((docs) =>
            docs.map((doc) => ({
              ...doc,
              score: doc.score * (retrieverWeights[i] ?? 1),
            }))
          )
        )
      );

      // Combine and deduplicate by content
      const seen = new Set<string>();
      const combined: RetrievedDocument[] = [];

      for (const results of allResults) {
        for (const doc of results) {
          // Use content hash for deduplication
          const key = doc.content.slice(0, 100);
          if (!seen.has(key)) {
            seen.add(key);
            combined.push(doc);
          }
        }
      }

      // Sort by score and filter
      return combined
        .filter((doc) => doc.score >= minScore)
        .sort((a, b) => b.score - a.score)
        .slice(0, k);
    },

    async addDocuments(chunks: readonly DocumentChunk[]): Promise<readonly string[]> {
      // Add to all retrievers
      const results = await Promise.all(retrievers.map((r) => r.addDocuments(chunks)));
      return results[0] ?? [];
    },

    async deleteDocuments(ids: readonly string[]): Promise<void> {
      await Promise.all(retrievers.map((r) => r.deleteDocuments(ids)));
    },

    getVectorStore(): VectorStore {
      return retrievers[0]!.getVectorStore();
    },
  };
}
