/**
 * Example: Embedding
 *
 * Purpose: Demonstrates text embedding generation and similarity comparison.
 *          Shows how to use the embedding adapter for semantic search preparation.
 *
 * Prerequisites:
 * - OPENAI_API_KEY in .env file
 *
 * Learning Objectives:
 * 1. How to create an embedding adapter
 * 2. How to generate embeddings for text
 * 3. How to calculate cosine similarity between embeddings
 * 4. How to use embeddings for semantic matching
 *
 * Expected Output:
 * ```
 * 📊 Embedding Example
 *
 * Generating embeddings for 5 documents...
 * ✓ Generated 5 embeddings (1536 dimensions each)
 *
 * Query: "machine learning"
 *
 * Top 3 Similar Documents:
 * 1. "Deep learning is a subset of machine learning..." (0.9234)
 * 2. "Neural networks are computational models..." (0.8912)
 * 3. "Python is a programming language..." (0.6543)
 *
 * ✅ Example completed successfully!
 * ```
 */

import { createEmbeddingAdapter } from '@seashore/core.js'

// Validate environment variables
const apiKey = process.env.OPENAI_API_KEY
const baseURL = process.env.OPENAI_BASE_URL

if (!apiKey) {
  console.error('❌ Error: OPENAI_API_KEY is required')
  console.error('Please copy .env.example to .env and add your OpenAI API key')
  process.exit(1)
}

// Sample documents for semantic search
const documents = [
  {
    id: '1',
    text: 'Deep learning is a subset of machine learning based on artificial neural networks.',
  },
  {
    id: '2',
    text: 'Neural networks are computational models inspired by biological neural networks.',
  },
  {
    id: '3',
    text: 'Python is a high-level programming language known for its readability and versatility.',
  },
  {
    id: '4',
    text: 'PostgreSQL is a powerful open-source relational database management system.',
  },
  {
    id: '5',
    text: 'Docker containers package applications with their dependencies for consistent deployment.',
  },
]

async function main(): Promise<void> {
  console.log('📊 Embedding Example\n')

  // Step 1: Create the embedding adapter
  const adapter = createEmbeddingAdapter({
    provider: 'openai',
    apiKey,
    baseURL,
  })

  // Step 2: Create embedder for a specific model
  const embedder = adapter('text-embedding-3-small')

  console.log(`Generating embeddings for ${documents.length} documents...`)

  // Step 3: Generate embeddings for all documents
  const documentEmbeddings: Array<{ id: string; text: string; embedding: number[] }> = []

  try {
    for (const doc of documents) {
      const embedding = await embedder.embed(doc.text)
      documentEmbeddings.push({
        id: doc.id,
        text: doc.text,
        embedding,
      })
      console.log(`  ✓ Document ${doc.id}: ${embedding.length} dimensions`)
    }

    console.log(`\n✓ Generated ${documentEmbeddings.length} embeddings\n`)

    // Step 4: Perform semantic search
    const query = 'machine learning'
    console.log(`🔍 Query: "${query}"\n`)

    const queryEmbedding = await embedder.embed(query)

    // Step 5: Calculate similarities and rank documents
    const results = documentEmbeddings
      .map((doc) => ({
        ...doc,
        similarity: cosineSimilarity(queryEmbedding, doc.embedding),
      }))
      .sort((a, b) => b.similarity - a.similarity)

    // Step 6: Display top results
    console.log('Top 3 Similar Documents:')
    console.log('-'.repeat(80))

    for (let i = 0; i < Math.min(3, results.length); i++) {
      const result = results[i]
      console.log(`${i + 1}. ${result.text.substring(0, 60)}...`)
      console.log(`   Similarity: ${result.similarity.toFixed(4)}\n`)
    }

    // Bonus: Show distance calculation
    console.log('📐 Similarity Analysis:')
    console.log('-'.repeat(80))

    const topResult = results[0]
    const bottomResult = results[results.length - 1]

    console.log(`Most similar:    "${topResult.text.substring(0, 50)}..."`)
    console.log(`                 Score: ${topResult.similarity.toFixed(4)}`)
    console.log()
    console.log(`Least similar:   "${bottomResult.text.substring(0, 50)}..."`)
    console.log(`                 Score: ${bottomResult.similarity.toFixed(4)}`)

    console.log('\n✅ Example completed successfully!')
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('rate limit')) {
        console.error('\n❌ Rate limit exceeded. Please wait a moment and try again.')
      } else if (error.message.includes('authentication')) {
        console.error('\n❌ Authentication failed. Please check your API key.')
      } else {
        console.error('\n❌ Error:', error.message)
      }
    }
    throw error
  }
}

/**
 * Calculate cosine similarity between two vectors
 * Result ranges from -1 (opposite) to 1 (identical)
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have the same dimensions')
  }

  let dotProduct = 0
  let normA = 0
  let normB = 0

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }

  if (normA === 0 || normB === 0) {
    return 0
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB))
}

// Run with error handling
main().catch((error: Error) => {
  console.error('\n💥 Fatal error:', error.message)
  process.exit(1)
})
