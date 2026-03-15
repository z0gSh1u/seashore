/**
 * Example: Document Chatbot
 *
 * Purpose: Demonstrates a complete RAG-powered document chatbot.
 *          Combines RAG retrieval, conversation history, and agent responses.
 *
 * Prerequisites:
 * - OPENAI_API_KEY in .env file
 * - DATABASE_URL in .env file (with pgvector extension)
 *
 * Learning Objectives:
 * 1. How to build a production-ready document Q&A system
 * 2. How to combine RAG with conversation persistence
 * 3. How to handle multi-turn conversations with context
 * 4. How to manage document indexing and updates
 *
 * Expected Output:
 * ```
 * 📚 Document Chatbot Example
 *
 * Initializing knowledge base...
 * ✓ Connected to database
 * ✓ Indexed 3 documents (12 chunks)
 *
 * Starting chat session...
 * 💬 User: "What is TypeScript?"
 * 🤖 Bot: TypeScript is a typed superset of JavaScript...
 *    (Retrieved from: doc1, doc2)
 *
 * 💬 User: "How is it different from JavaScript?"
 * 🤖 Bot: Unlike JavaScript, TypeScript adds static typing...
 *    (Retrieved from: doc1)
 *
 * 💬 User: "Thanks, that helps!"
 * 🤖 Bot: You're welcome!...
 *
 * Saving conversation history...
 * ✓ Thread saved (ID: thread_abc123)
 *
 * ✅ Example completed successfully!
 * ```
 */

import { createLLMAdapter, createEmbeddingAdapter } from '@seashore/core.js';
import { createReActAgent, type Message } from '@seashore/agent.js';
import {
  createVectorDBService,
  createRAG,
  createChunker,
  createStorageService,
} from '@seashore/data.js';
import { chat } from '@tanstack/ai';

// Validate environment variables
const apiKey = process.env.OPENAI_API_KEY;
const baseURL = process.env.OPENAI_BASE_URL;
const databaseUrl = process.env.DATABASE_URL;

if (!apiKey || !databaseUrl) {
  console.error('❌ Error: OPENAI_API_KEY and DATABASE_URL are required');
  console.error('Please copy .env.example to .env and fill in the required values');
  process.exit(1);
}

// Sample knowledge base documents
const knowledgeBase = [
  {
    id: 'ts-overview',
    content: `
      TypeScript is a strongly typed programming language that builds on JavaScript.
      It was developed by Microsoft and first released in 2012. TypeScript adds optional
      static typing to JavaScript, which helps catch errors at compile time rather than
      runtime. It includes features like interfaces, generics, decorators, and advanced
      type inference. TypeScript compiles to plain JavaScript and can run anywhere
      JavaScript runs: in browsers, on Node.js, or in any JavaScript engine.
    `,
    metadata: { topic: 'typescript', source: 'overview' },
  },
  {
    id: 'ts-vs-js',
    content: `
      TypeScript differs from JavaScript in several key ways. JavaScript is dynamically
      typed, meaning types are checked at runtime, while TypeScript is statically typed
      with types checked at compile time. TypeScript requires a compilation step to
      convert TypeScript code to JavaScript. TypeScript offers better IDE support with
      autocompletion, refactoring tools, and inline documentation. TypeScript also
      supports modern JavaScript features and can target different ECMAScript versions.
    `,
    metadata: { topic: 'typescript', source: 'comparison' },
  },
  {
    id: 'ts-benefits',
    content: `
      The main benefits of TypeScript include: 1) Early error detection through static
      type checking, catching bugs before runtime. 2) Improved developer experience
      with intelligent code completion and navigation. 3) Better code maintainability
      through explicit type contracts and interfaces. 4) Easier refactoring with
      confidence that changes won't break other parts of the codebase. 5) Enhanced
      documentation through type definitions. 6) Better collaboration in large teams
      with clear interfaces between components.
    `,
    metadata: { topic: 'typescript', source: 'benefits' },
  },
];

async function main(): Promise<void> {
  console.log('📚 Document Chatbot Example\n');

  // Step 1: Initialize adapters and services
  console.log('Initializing knowledge base...');

  const llmAdapter = createLLMAdapter({
    provider: 'openai',
    apiKey,
    baseURL,
  });

  const embeddingAdapter = createEmbeddingAdapter({
    provider: 'openai',
    apiKey,
    baseURL,
  });

  const vectorDB = createVectorDBService({
    connectionString: databaseUrl,
  });

  const storage = createStorageService({
    connectionString: databaseUrl,
  });

  // Step 2: Set up RAG pipeline
  const chunker = createChunker({
    chunkSize: 300,
    chunkOverlap: 50,
  });

  const rag = createRAG({
    embedder: embeddingAdapter('text-embedding-3-small'),
    vectorDB,
    chunker,
    hybridAlpha: 0.8,
  });

  // Step 3: Index documents
  try {
    await vectorDB.testConnection();
    console.log('✓ Connected to database');

    const indexResult = await rag.indexDocuments(knowledgeBase);
    console.log(
      `✓ Indexed ${indexResult.documentCount} documents (${indexResult.chunkCount} chunks)\n`,
    );
  } catch (error) {
    console.error('❌ Failed to initialize knowledge base:', error);
    process.exit(1);
  }

  // Step 4: Create conversation thread
  const thread = await storage.createThread({
    metadata: {
      title: 'TypeScript Q&A Session',
      type: 'doc-chatbot',
    },
  });

  console.log(`Created conversation thread: ${thread.id}\n`);
  console.log('='.repeat(80));
  console.log('💬 Starting chat session (simulated)\n');

  // Step 5: Simulate multi-turn conversation
  const conversation: Array<{ role: 'user' | 'assistant'; content: string }> = [
    { role: 'user', content: 'What is TypeScript?' },
    { role: 'user', content: 'How is it different from JavaScript?' },
    { role: 'user', content: 'What are the main benefits?' },
  ];

  const messages: Message[] = [];

  for (let turn = 0; turn < conversation.length; turn++) {
    const userMessage = conversation[turn];

    // Display user message
    console.log(`\n👤 User: ${userMessage.content}`);

    // Add to conversation history
    messages.push(userMessage);

    // Step 6: Retrieve relevant context using RAG
    const searchResults = await rag.retrieve({
      query: userMessage.content,
      topK: 2,
    });

    // Build context from retrieved documents
    const context = searchResults.map((r, i) => `[Source ${i + 1}] ${r.content}`).join('\n\n');

    // Step 7: Generate response with context
    const systemPrompt =
      'You are a helpful assistant answering questions about TypeScript. ' +
      'Use the provided context to answer accurately. ' +
      'If the context does not contain enough information, say so. ' +
      'Be concise but informative. ' +
      'Consider the conversation history for context.';

    const response = await chat({
      adapter: llmAdapter('gpt-4o-mini'),
      system: `${systemPrompt}\n\nRelevant Context:\n${context}`,
      messages,
    });

    // Display assistant response
    console.log(`\n🤖 Bot: ${response.text}`);
    console.log(`   (Sources: ${searchResults.map((r) => r.metadata.source).join(', ')})`);

    // Add assistant response to history
    messages.push({
      role: 'assistant',
      content: response.text,
    });

    // Save messages to storage
    await storage.addMessage({
      threadId: thread.id,
      role: 'user',
      content: userMessage.content,
    });

    await storage.addMessage({
      threadId: thread.id,
      role: 'assistant',
      content: response.text,
      metadata: {
        sources: searchResults.map((r) => r.metadata.source),
      },
    });

    // Simulate delay between turns
    if (turn < conversation.length - 1) {
      await delay(1000);
    }
  }

  // Step 8: Display conversation summary
  console.log('\n\n' + '='.repeat(80));
  console.log('\n📊 Conversation Summary\n');

  const threadMessages = await storage.getMessages(thread.id);
  console.log(`Total messages: ${threadMessages.length}`);
  console.log(`Thread ID: ${thread.id}`);

  console.log('\nConversation History:');
  for (const msg of threadMessages) {
    const timestamp = new Date(msg.createdAt).toLocaleTimeString();
    console.log(`\n[${timestamp}] ${msg.role}:`);
    console.log(`  ${msg.content.substring(0, 100)}...`);
  }

  // Cleanup
  console.log('\n\nCleaning up...');
  await storage.close();
  await vectorDB.close();

  console.log('\n✅ Example completed successfully!');
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Run with error handling
main().catch((error: Error) => {
  console.error('\n💥 Fatal error:', error.message);
  process.exit(1);
});
