import * as dotenv from 'dotenv';
import * as path from 'path';
import { openaiText, openaiEmbed, generateEmbedding, chat } from '@seashore/llm';
import type {
  VectorStore,
  Collection,
  NewDocument,
  Document,
  EmbeddingVector,
  VectorSearchOptions,
  SearchResult,
  CollectionStats,
} from '@seashore/vectordb';

// Load environment variables
dotenv.config();

// --- Mock Vector Store Implementation ---

class InMemoryVectorStore implements VectorStore {
  private docs: Document[] = [];

  constructor(public collection: Collection) {}

  async addDocuments(newDocs: readonly NewDocument[]): Promise<readonly Document[]> {
    const added = newDocs.map((doc, i) => ({
      id: `doc-${Date.now()}-${i}`,
      collectionId: this.collection.id,
      content: doc.content,
      embedding: doc.embedding || null,
      metadata: doc.metadata || null,
      createdAt: new Date(),
    }));
    this.docs.push(...added);
    return added;
  }

  async searchByVector(
    embedding: EmbeddingVector,
    options?: VectorSearchOptions
  ): Promise<SearchResult> {
    const scored = this.docs
      .filter((d) => d.embedding)
      .map((d) => ({
        document: d,
        score: cosineSimilarity(embedding, d.embedding!),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, options?.limit || 3);

    return {
      documents: scored,
      totalCount: scored.length,
      searchType: 'vector',
      durationMs: 0,
    };
  }

  // Unused methods for this example
  async getDocument(id: string): Promise<Document | null> {
    return null;
  }
  async updateDocument(id: string, update: any): Promise<Document> {
    throw new Error('Not implemented');
  }
  async deleteDocument(id: string): Promise<void> {}
  async deleteDocuments(filter: any): Promise<number> {
    return 0;
  }
  async searchByText(query: string, options?: any): Promise<SearchResult> {
    throw new Error('Not implemented');
  }
  async searchHybrid(query: string, embedding: any, options?: any): Promise<SearchResult> {
    throw new Error('Not implemented');
  }
  async getStats(): Promise<CollectionStats> {
    return {
      documentCount: this.docs.length,
      embeddedCount: this.docs.length,
      avgEmbeddingSize: 0,
      storageBytes: 0,
    };
  }
}

function cosineSimilarity(a: number[], b: number[]): number {
  const dot = a.reduce((sum, v, i) => sum + v * b[i], 0);
  const magA = Math.sqrt(a.reduce((sum, v) => sum + v * v, 0));
  const magB = Math.sqrt(b.reduce((sum, v) => sum + v * v, 0));
  return dot / (magA * magB);
}

// --- Main Example ---

async function main() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error('Error: OPENAI_API_KEY is not set in examples/.env');
    process.exit(1);
  }

  console.log('📚 Initializing Knowledge Base...');

  // 1. Setup Mock Vector Store
  const collection: Collection = {
    id: 'mock-collection',
    name: 'knowledge-base',
    description: 'Example knowledge base',
    dimensions: 1536,
    distanceMetric: 'cosine',
    hnswM: 16,
    hnswEfConstruction: 64,
    documentCount: 0,
    metadata: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const vectorStore = new InMemoryVectorStore(collection);

  // 2. Ingest Documents
  const documents = [
    'Seashore is a modern agent framework for TypeScript.',
    'Seashore supports ReAct agents, Workflows, and RAG.',
    'The framework is built on top of TanStack AI.',
    'Seashore provides built-in memory and observability features.',
  ];

  console.log(`📥 Ingesting ${documents.length} documents...`);

  const embedModel = openaiEmbed('text-embedding-3-small', { apiKey });

  for (const content of documents) {
    const { embedding } = await generateEmbedding({ model: embedModel, value: content });
    await vectorStore.addDocuments([{ content, embedding }]);
  }

  // 3. Query
  const query = 'What is Seashore built on?';
  console.log(`\n❓ Query: "${query}"`);

  // 4. Retrieve
  console.log('🔍 Retrieving relevant context...');
  const { embedding: queryEmbedding } = await generateEmbedding({
    model: embedModel,
    value: query,
  });
  const searchResult = await vectorStore.searchByVector(queryEmbedding, { limit: 2 });

  const context = searchResult.documents.map((d) => d.document.content).join('\n');
  console.log('📄 Context found:', context);

  // 5. Generate Answer
  console.log('\n🤖 Generating answer...');
  const chatModel = openaiText('gpt-4o', { apiKey });
  const response = await chat({
    model: chatModel,
    messages: [
      { role: 'system', content: `Answer the question based on the context:\n${context}` },
      { role: 'user', content: query },
    ],
  });

  console.log('\n📝 Answer:');
  console.log(response.content);
}

main().catch(console.error);
