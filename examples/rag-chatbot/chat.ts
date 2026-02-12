/**
 * RAG Chatbot Example
 *
 * This example demonstrates:
 * - Document indexing with chunking
 * - Vector embeddings with OpenAI
 * - Hybrid search (semantic + BM25)
 * - RAG-powered conversations
 */

import 'dotenv/config'
import { createLLMAdapter, createEmbeddingAdapter } from '@seashore/core'
import { createReActAgent } from '@seashore/agent'
import { createVectorDBService, createRAG } from '@seashore/data'
import { z } from 'zod'
import * as readline from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'

// Configuration
const OPENAI_API_KEY = process.env.OPENAI_API_KEY!
const DATABASE_URL = process.env.DATABASE_URL!

if (!OPENAI_API_KEY) {
  console.error('❌ OPENAI_API_KEY not set')
  process.exit(1)
}

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL not set')
  console.error('Set it to: postgresql://localhost/rag_chatbot')
  process.exit(1)
}

async function main() {
  console.log('🚀 Initializing RAG Chatbot...\n')

  // 1. Setup embedder
  const embedder = createEmbeddingAdapter({
    provider: 'openai',
    model: 'text-embedding-3-small',
    apiKey: OPENAI_API_KEY,
  })

  // 2. Setup vector database
  const vectorDB = await createVectorDBService({
    connectionString: DATABASE_URL,
  })

  // 3. Create RAG pipeline
  const rag = createRAG({
    embedder,
    vectorDB,
    chunkSize: 512,
    chunkOverlap: 50,
  })

  // 4. Create knowledge retrieval tool
  const knowledgeTool = {
    name: 'search_knowledge',
    description:
      'Search the knowledge base for information. Use this to find relevant context before answering questions.',
    parameters: z.object({
      query: z.string().describe('The search query'),
    }),
    execute: async ({ query }: { query: string }) => {
      console.log(`  🔍 Searching knowledge base for: "${query}"`)

      const results = await rag.retrieve({
        query,
        topK: 3,
        hybridAlpha: 0.5, // Balanced semantic + keyword search
      })

      if (results.length === 0) {
        return 'No relevant information found in the knowledge base.'
      }

      console.log(`  ✓ Found ${results.length} relevant documents\n`)

      // Format results
      return results
        .map((r, i) => {
          const title = r.metadata.title || 'Untitled'
          const score = r.score?.toFixed(3) || 'N/A'
          return `[Document ${i + 1}] ${title} (score: ${score})\n${r.content}`
        })
        .join('\n\n---\n\n')
    },
  }

  // 5. Create LLM
  const llm = createLLMAdapter({
    provider: 'openai',
    model: 'gpt-4o-mini', // Fast and cost-effective for RAG
    apiKey: OPENAI_API_KEY,
  })

  // 6. Create agent
  const agent = createReActAgent({
    llm,
    tools: [knowledgeTool],
    systemPrompt: `You are a helpful assistant with access to a knowledge base.

When answering questions:
1. Use the search_knowledge tool to find relevant information
2. Base your answers on the retrieved context
3. If the knowledge base doesn't have the information, say so
4. Always cite your sources by mentioning the document titles

Be concise and accurate.`,
    maxIterations: 3,
  })

  console.log('✅ RAG Chatbot ready!\n')
  console.log('💡 Try asking:')
  console.log('  - "What is Seashore?"')
  console.log('  - "How do I create a ReAct agent?"')
  console.log('  - "What packages does Seashore have?"\n')
  console.log('Type "exit" to quit.\n')

  // 7. Interactive loop
  const rl = readline.createInterface({ input, output })

  let threadId = 'chat-' + Date.now()

  while (true) {
    const question = await rl.question('You: ')

    if (question.toLowerCase() === 'exit') {
      console.log('\n👋 Goodbye!')
      rl.close()
      process.exit(0)
    }

    if (!question.trim()) {
      continue
    }

    try {
      console.log('\n🤖 Assistant:')

      const result = await agent.run({
        message: question,
        threadId,
      })

      console.log(result.message)
      console.log()
    } catch (error) {
      console.error('❌ Error:', error)
      console.log()
    }
  }
}

main().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
