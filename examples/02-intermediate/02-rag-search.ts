/**
 * Example: RAG Search
 *
 * Purpose: Demonstrates RAG (Retrieval-Augmented Generation) pipeline.
 *          Shows how to index documents and perform semantic search with hybrid ranking.
 *
 * Prerequisites:
 * - OPENAI_API_KEY in .env file
 * - DATABASE_URL in .env file (with pgvector extension)
 *
 * Learning Objectives:
 * 1. How to create a RAG pipeline with embeddings and vector DB
 * 2. How to chunk and index documents
 * 3. How to perform hybrid search (semantic + keyword)
 * 4. How to integrate retrieval with LLM responses
 *
 * Expected Output:
 * ```
 * 🔍 RAG Search Example
 *
 * Step 1: Indexing documents...
 * ✓ Indexed 3 documents (15 chunks total)
 *
 * Step 2: Searching for "neural networks"...
 *
 * Top Results:
 * 1. "Deep learning uses neural networks with many layers..." (Score: 0.89)
 * 2. "Neural networks are computational models..." (Score: 0.85)
 * 3. "Convolutional neural networks are widely used..." (Score: 0.72)
 *
 * Step 3: Generating answer with RAG...
 * 🤖 Answer: Based on the retrieved documents...
 *
 * ✅ Example completed successfully!
 * ```
 */

import { createLLMAdapter, createEmbeddingAdapter } from '@seashore/core.js'
import { createVectorDBService, createRAG, createChunker } from '@seashore/data.js'
import { chat } from '@tanstack/ai'

// Validate environment variables
const apiKey = process.env.OPENAI_API_KEY
const baseURL = process.env.OPENAI_BASE_URL
const databaseUrl = process.env.DATABASE_URL

if (!apiKey) {
  console.error('❌ Error: OPENAI_API_KEY is required')
  console.error('Please copy .env.example to .env and add your OpenAI API key')
  process.exit(1)
}

if (!databaseUrl) {
  console.error('❌ Error: DATABASE_URL is required')
  console.error('Please copy .env.example to .env and add your database connection string')
  process.exit(1)
}

// Sample documents for the knowledge base
const documents = [
  {
    id: 'doc1',
    content: `
      Deep learning is a subset of machine learning based on artificial neural networks.
      It uses multiple layers to progressively extract higher-level features from raw input.
      For example, in image processing, lower layers may identify edges, while higher layers
      may identify human-relevant concepts such as digits, letters, or faces.
    `,
    metadata: { category: 'ai', source: 'wikipedia' },
  },
  {
    id: 'doc2',
    content: `
      Neural networks are computational models inspired by biological neural networks.
      They consist of interconnected nodes called neurons organized in layers.
      Each connection can transmit a signal to other neurons, and neurons process
      the signals they receive and signal additional connected neurons.
    `,
    metadata: { category: 'ai', source: 'textbook' },
  },
  {
    id: 'doc3',
    content: `
      PostgreSQL is a powerful, open source object-relational database system.
      It has more than 35 years of active development and a proven architecture
      that has earned it a strong reputation for reliability, feature robustness, and performance.
      PostgreSQL supports various data types including JSON, arrays, and custom types.
    `,
    metadata: { category: 'database', source: 'official' },
  },
  {
    id: 'doc4',
    content: `
      Convolutional neural networks (CNNs) are a specialized type of neural network
      designed for processing grid-like data such as images. They use convolution operations
      that apply filters to local regions of the input, making them highly effective
      for computer vision tasks like image classification and object detection.
    `,
    metadata: { category: 'ai', source: 'research' },
  },
]

async function main(): Promise<void> {
  console.log('🔍 RAG Search Example\n')

  // Step 1: Set up adapters
  console.log('Setting up adapters...')

  const llmAdapter = createLLMAdapter({
    provider: 'openai',
    apiKey,
    baseURL,
  })

  const embeddingAdapter = createEmbeddingAdapter({
    provider: 'openai',
    apiKey,
    baseURL,
  })

  console.log('✓ Adapters created\n')

  // Step 2: Connect to vector database
  console.log('Connecting to vector database...')

  const vectorDB = createVectorDBService({
    connectionString: databaseUrl,
  })

  try {
    await vectorDB.testConnection()
    console.log('✓ Connected to PostgreSQL with pgvector\n')
  } catch (error) {
    console.error('❌ Failed to connect to database')
    if (error instanceof Error) {
      console.error('Error:', error.message)
      console.error('\nTroubleshooting:')
      console.error('1. Ensure PostgreSQL is running')
      console.error('2. Verify pgvector extension is installed')
      console.error('3. Check your DATABASE_URL')
    }
    process.exit(1)
  }

  // Step 3: Create chunker for document processing
  const chunker = createChunker({
    chunkSize: 200,
    chunkOverlap: 50,
  })

  // Step 4: Create RAG pipeline
  console.log('Creating RAG pipeline...')

  const rag = createRAG({
    embedder: embeddingAdapter('text-embedding-3-small'),
    vectorDB,
    chunker,
    hybridAlpha: 0.7, // 70% semantic, 30% keyword weight
  })

  console.log('✓ RAG pipeline created\n')

  // Step 5: Index documents
  console.log('Step 1: Indexing documents...')

  try {
    const indexResult = await rag.indexDocuments(documents)
    console.log(`✓ Indexed ${indexResult.documentCount} documents (${indexResult.chunkCount} chunks)\n`)
  } catch (error) {
    console.error('❌ Failed to index documents')
    if (error instanceof Error) {
      console.error('Error:', error.message)
    }
    process.exit(1)
  }

  // Step 6: Perform search
  const query = 'neural networks for image recognition'
  console.log(`Step 2: Searching for "${query}"...\n`)

  try {
    const searchResults = await rag.retrieve({
      query,
      topK: 3,
      filter: { category: 'ai' }, // Filter to AI documents only
    })

    console.log('Top Results:')
    console.log('-'.repeat(80))

    for (let i = 0; i < searchResults.length; i++) {
      const result = searchResults[i]
      console.log(`\n${i + 1}. [Score: ${result.score.toFixed(4)}]`)
      console.log(`   Source: ${result.metadata.source}`)
      console.log(`   ${result.content.substring(0, 150)}...`)
    }

    // Step 7: Generate answer using RAG
    console.log('\n\nStep 3: Generating answer with RAG...\n')

    const context = searchResults
      .map((r, i) => `[${i + 1}] ${r.content}`)
      .join('\n\n')

    const response = await chat({
      adapter: llmAdapter('gpt-4o-mini'),
      system:
        'You are a helpful assistant. Answer the question based on the provided context. ' +
        'If the context does not contain enough information, say so. ' +
        'Always cite your sources using [1], [2], etc.',
      messages: [
        {
          role: 'user',
          content: `Context:\n${context}\n\nQuestion: ${query}`,
        },
      ],
    })

    console.log('🤖 Answer:')
    console.log(response.text)

    // Show which documents were referenced
    console.log('\n📚 Sources:')
    for (const result of searchResults) {
      console.log(`  - ${result.metadata.source}: ${result.content.substring(0, 60)}...`)
    }

    console.log('\n\n✅ Example completed successfully!')
  } catch (error) {
    if (error instanceof Error) {
      console.error('\n❌ Error:', error.message)
    }
    throw error
  } finally {
    // Cleanup: Close database connection
    await vectorDB.close()
  }
}

// Run with error handling
main().catch((error: Error) => {
  console.error('\n💥 Fatal error:', error.message)
  process.exit(1)
})
