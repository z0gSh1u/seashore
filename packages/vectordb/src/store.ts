/**
 * @seashore/vectordb - Vector Store
 *
 * Main vector store implementation
 */

import { eq, sql, and, inArray } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { collections, documents, generateSearchVector } from './schema/index.js';
import type {
  Collection,
  CollectionConfig,
  CollectionStats,
  Document,
  EmbeddingFunction,
  EmbeddingVector,
  HybridSearchOptions,
  NewDocument,
  SearchResult,
  ScoredDocument,
  TextSearchOptions,
  VectorSearchOptions,
  VectorStore,
  VectorStoreOptions,
} from './types.js';
import { vectorSearch } from './search/vector-search.js';
import { textSearch } from './search/text-search.js';
import { hybridSearch } from './search/hybrid-search.js';

/**
 * Vector store error
 */
export class VectorStoreError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'VectorStoreError';
  }
}

/**
 * Collection not found error
 */
export class CollectionNotFoundError extends VectorStoreError {
  constructor(name: string) {
    super(`Collection not found: ${name}`);
    this.name = 'CollectionNotFoundError';
  }
}

/**
 * Create or get a collection
 */
export async function createCollection(
  db: PostgresJsDatabase,
  config: CollectionConfig
): Promise<Collection> {
  const existing = await db
    .select()
    .from(collections)
    .where(eq(collections.name, config.name))
    .limit(1);

  if (existing.length > 0) {
    const col = existing[0]!;
    return {
      id: col.id,
      name: col.name,
      description: col.description,
      dimensions: col.dimensions,
      distanceMetric: col.distanceMetric,
      hnswM: col.hnswM,
      hnswEfConstruction: col.hnswEfConstruction,
      documentCount: col.documentCount,
      metadata: col.metadata,
      createdAt: col.createdAt,
      updatedAt: col.updatedAt,
    };
  }

  const [inserted] = await db
    .insert(collections)
    .values({
      name: config.name,
      description: config.description,
      dimensions: config.dimensions,
      distanceMetric: config.distanceMetric ?? 'cosine',
      hnswM: config.hnswConfig?.m ?? 16,
      hnswEfConstruction: config.hnswConfig?.efConstruction ?? 64,
      metadata: {},
    })
    .returning();

  if (!inserted) {
    throw new VectorStoreError('Failed to create collection');
  }

  return {
    id: inserted.id,
    name: inserted.name,
    description: inserted.description,
    dimensions: inserted.dimensions,
    distanceMetric: inserted.distanceMetric,
    hnswM: inserted.hnswM,
    hnswEfConstruction: inserted.hnswEfConstruction,
    documentCount: inserted.documentCount,
    metadata: inserted.metadata,
    createdAt: inserted.createdAt,
    updatedAt: inserted.updatedAt,
  };
}

/**
 * Get a collection by name
 */
export async function getCollection(
  db: PostgresJsDatabase,
  name: string
): Promise<Collection | null> {
  const result = await db.select().from(collections).where(eq(collections.name, name)).limit(1);

  if (result.length === 0) {
    return null;
  }

  const col = result[0]!;
  return {
    id: col.id,
    name: col.name,
    description: col.description,
    dimensions: col.dimensions,
    distanceMetric: col.distanceMetric,
    hnswM: col.hnswM,
    hnswEfConstruction: col.hnswEfConstruction,
    documentCount: col.documentCount,
    metadata: col.metadata,
    createdAt: col.createdAt,
    updatedAt: col.updatedAt,
  };
}

/**
 * Delete a collection and all its documents
 */
export async function deleteCollection(db: PostgresJsDatabase, name: string): Promise<void> {
  await db.delete(collections).where(eq(collections.name, name));
}

/**
 * List all collections
 */
export async function listCollections(db: PostgresJsDatabase): Promise<readonly Collection[]> {
  const result = await db.select().from(collections).orderBy(collections.name);

  return result.map((col) => ({
    id: col.id,
    name: col.name,
    description: col.description,
    dimensions: col.dimensions,
    distanceMetric: col.distanceMetric,
    hnswM: col.hnswM,
    hnswEfConstruction: col.hnswEfConstruction,
    documentCount: col.documentCount,
    metadata: col.metadata,
    createdAt: col.createdAt,
    updatedAt: col.updatedAt,
  }));
}

/**
 * Create a vector store for a collection
 */
export async function createVectorStore(options: VectorStoreOptions): Promise<VectorStore> {
  const db = options.db as PostgresJsDatabase;
  const { collectionName, embeddings, createIfNotExists = true, collectionConfig } = options;

  let collection = await getCollection(db, collectionName);

  if (!collection) {
    if (!createIfNotExists) {
      throw new CollectionNotFoundError(collectionName);
    }

    collection = await createCollection(db, {
      name: collectionName,
      dimensions: collectionConfig?.dimensions ?? 1536,
      ...collectionConfig,
    });
  }

  return createVectorStoreForCollection(db, collection, embeddings);
}

/**
 * Internal: Create vector store for an existing collection
 */
function createVectorStoreForCollection(
  db: PostgresJsDatabase,
  collection: Collection,
  embeddings?: EmbeddingFunction
): VectorStore {
  const mapDocument = (doc: typeof documents.$inferSelect): Document => ({
    id: doc.id,
    collectionId: doc.collectionId,
    content: doc.content,
    embedding: doc.embedding ?? null,
    metadata: doc.metadata,
    createdAt: doc.createdAt,
  });

  return {
    collection,

    async addDocuments(docs: readonly NewDocument[]): Promise<readonly Document[]> {
      if (docs.length === 0) {
        return [];
      }

      // Generate embeddings if function provided and not already present
      let processedDocs = [...docs];
      if (embeddings) {
        const textsToEmbed = docs
          .map((doc, i) => ({ text: doc.content, index: i, needsEmbed: !doc.embedding }))
          .filter((item) => item.needsEmbed);

        if (textsToEmbed.length > 0) {
          const embeddingResults = await embeddings(textsToEmbed.map((t) => t.text));
          textsToEmbed.forEach((item, i) => {
            processedDocs[item.index] = {
              ...processedDocs[item.index]!,
              embedding: embeddingResults[i],
            };
          });
        }
      }

      const values = processedDocs.map((doc) => ({
        collectionId: collection.id,
        content: doc.content,
        embedding: doc.embedding,
        searchVector: sql`to_tsvector('english', ${doc.content})`,
        metadata: doc.metadata ?? {},
      }));

      const inserted = await db.insert(documents).values(values).returning();

      // Update document count
      await db
        .update(collections)
        .set({
          documentCount: sql`${collections.documentCount} + ${docs.length}`,
          updatedAt: new Date(),
        })
        .where(eq(collections.id, collection.id));

      return inserted.map(mapDocument);
    },

    async getDocument(id: string): Promise<Document | null> {
      const result = await db
        .select()
        .from(documents)
        .where(and(eq(documents.id, id), eq(documents.collectionId, collection.id)))
        .limit(1);

      return result.length > 0 ? mapDocument(result[0]!) : null;
    },

    async updateDocument(
      id: string,
      update: Partial<Pick<NewDocument, 'content' | 'embedding' | 'metadata'>>
    ): Promise<Document> {
      const updateValues: Record<string, unknown> = {};

      if (update.content !== undefined) {
        updateValues['content'] = update.content;
        updateValues['searchVector'] = generateSearchVector(update.content);

        // Re-embed if embedding function provided
        if (embeddings && !update.embedding) {
          const [newEmbedding] = await embeddings([update.content]);
          updateValues['embedding'] = newEmbedding;
        }
      }

      if (update.embedding !== undefined) {
        updateValues['embedding'] = update.embedding;
      }

      if (update.metadata !== undefined) {
        updateValues['metadata'] = update.metadata;
      }

      const [updated] = await db
        .update(documents)
        .set(updateValues)
        .where(and(eq(documents.id, id), eq(documents.collectionId, collection.id)))
        .returning();

      if (!updated) {
        throw new VectorStoreError(`Document not found: ${id}`);
      }

      return mapDocument(updated);
    },

    async deleteDocument(id: string): Promise<void> {
      const result = await db
        .delete(documents)
        .where(and(eq(documents.id, id), eq(documents.collectionId, collection.id)))
        .returning({ id: documents.id });

      if (result.length > 0) {
        await db
          .update(collections)
          .set({
            documentCount: sql`${collections.documentCount} - 1`,
            updatedAt: new Date(),
          })
          .where(eq(collections.id, collection.id));
      }
    },

    async deleteDocuments(filter: Record<string, unknown>): Promise<number> {
      // Build conditions from filter
      const conditions = [eq(documents.collectionId, collection.id)];

      // Simple metadata filtering
      if (Object.keys(filter).length > 0) {
        conditions.push(sql`${documents.metadata} @> ${JSON.stringify(filter)}::jsonb`);
      }

      const deleted = await db
        .delete(documents)
        .where(and(...conditions))
        .returning({ id: documents.id });

      if (deleted.length > 0) {
        await db
          .update(collections)
          .set({
            documentCount: sql`${collections.documentCount} - ${deleted.length}`,
            updatedAt: new Date(),
          })
          .where(eq(collections.id, collection.id));
      }

      return deleted.length;
    },

    async searchByVector(
      embedding: EmbeddingVector,
      options?: VectorSearchOptions
    ): Promise<SearchResult> {
      return vectorSearch(db, collection, embedding, options);
    },

    async searchByText(query: string, options?: TextSearchOptions): Promise<SearchResult> {
      return textSearch(db, collection, query, options);
    },

    async searchHybrid(
      query: string,
      embedding: EmbeddingVector,
      options?: HybridSearchOptions
    ): Promise<SearchResult> {
      return hybridSearch(db, collection, query, embedding, options);
    },

    async getStats(): Promise<CollectionStats> {
      const result = await db
        .select({
          documentCount: sql<number>`count(*)`,
          embeddedCount: sql<number>`count(${documents.embedding})`,
          avgEmbeddingSize: sql<number>`avg(array_length(${documents.embedding}, 1))`,
        })
        .from(documents)
        .where(eq(documents.collectionId, collection.id));

      const stats = result[0];

      return {
        documentCount: Number(stats?.documentCount ?? 0),
        embeddedCount: Number(stats?.embeddedCount ?? 0),
        avgEmbeddingSize: Number(stats?.avgEmbeddingSize ?? 0),
        storageBytes: 0, // Would need pg_total_relation_size
      };
    },
  };
}
