/**
 * Example: Storage
 *
 * Purpose: Demonstrates database persistence for messages and threads.
 *          Shows how to store conversation history using PostgreSQL.
 *
 * Prerequisites:
 * - DATABASE_URL in .env file
 * - PostgreSQL running locally or accessible
 * - pgvector extension installed (for vector search examples)
 *
 * Learning Objectives:
 * 1. How to create a storage service with Drizzle ORM
 * 2. How to create and manage conversation threads
 * 3. How to store and retrieve messages
 * 4. How to handle pagination
 *
 * Expected Output:
 * ```
 * 💾 Storage Example
 *
 * Connecting to database...
 * ✓ Connected to PostgreSQL
 *
 * Creating thread...
 * ✓ Thread created: thread_123abc
 *
 * Adding messages...
 * ✓ Added user message
 * ✓ Added assistant message
 *
 * Retrieving thread...
 * ✓ Retrieved 2 messages
 *
 * Thread History:
 * [user]: What is TypeScript?
 * [assistant]: TypeScript is a typed superset of JavaScript...
 *
 * ✅ Example completed successfully!
 * ```
 */

import { createStorageService } from '@seashore/data.js';

// Validate environment variables
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('❌ Error: DATABASE_URL is required');
  console.error('Please copy .env.example to .env and add your database connection string');
  console.error('Example: postgresql://user:password@localhost:5432/seashore');
  process.exit(1);
}

async function main(): Promise<void> {
  console.log('💾 Storage Example\n');

  // Step 1: Create storage service
  console.log('Connecting to database...');

  const storage = createStorageService({
    connectionString: databaseUrl,
  });

  try {
    // Test connection
    await storage.testConnection();
    console.log('✓ Connected to PostgreSQL\n');
  } catch (error) {
    console.error('❌ Failed to connect to database');
    if (error instanceof Error) {
      console.error('Error:', error.message);
      console.error('\nTroubleshooting:');
      console.error('1. Ensure PostgreSQL is running');
      console.error('2. Check your DATABASE_URL format');
      console.error('3. Verify database exists and user has permissions');
    }
    process.exit(1);
  }

  // Step 2: Create a new thread
  console.log('Creating thread...');

  const thread = await storage.createThread({
    metadata: {
      title: 'TypeScript Learning Session',
      userId: 'user_123',
    },
  });

  console.log(`✓ Thread created: ${thread.id}`);
  console.log(`  Created at: ${thread.createdAt}`);
  console.log(`  Title: ${thread.metadata.title}\n`);

  // Step 3: Add messages to the thread
  console.log('Adding messages...');

  const userMessage = await storage.addMessage({
    threadId: thread.id,
    role: 'user',
    content: 'What is TypeScript?',
    metadata: {
      clientTimestamp: new Date().toISOString(),
    },
  });
  console.log('✓ Added user message');

  const assistantMessage = await storage.addMessage({
    threadId: thread.id,
    role: 'assistant',
    content:
      'TypeScript is a strongly typed programming language that builds on JavaScript. ' +
      'It adds optional static typing, classes, and interfaces, making it easier to ' +
      'catch errors early and improve code quality.',
    metadata: {
      model: 'gpt-4o-mini',
      tokens: 42,
    },
  });
  console.log('✓ Added assistant message\n');

  // Step 4: Retrieve messages from the thread
  console.log('Retrieving thread history...');

  const messages = await storage.getMessages(thread.id);
  console.log(`✓ Retrieved ${messages.length} messages\n`);

  // Step 5: Display conversation
  console.log('Conversation History:');
  console.log('='.repeat(80));

  for (const msg of messages) {
    const timestamp = new Date(msg.createdAt).toLocaleTimeString();
    console.log(`\n[${timestamp}] ${msg.role}:`);
    console.log(msg.content);

    // Show metadata if present
    if (Object.keys(msg.metadata).length > 0) {
      console.log(`  (metadata: ${JSON.stringify(msg.metadata)})`);
    }
  }

  // Step 6: Demonstrate pagination
  console.log('\n\n--- Pagination Demo ---\n');

  // Add more messages to demonstrate pagination
  for (let i = 1; i <= 5; i++) {
    await storage.addMessage({
      threadId: thread.id,
      role: 'user',
      content: `Question ${i}: How do I use TypeScript with Node.js?`,
    });

    await storage.addMessage({
      threadId: thread.id,
      role: 'assistant',
      content: `Answer ${i}: You can use TypeScript with Node.js by...`,
    });
  }

  console.log('Added 10 more messages (5 Q&A pairs)');

  // Get first page (limit 5)
  const page1 = await storage.getMessages(thread.id, { limit: 5, offset: 0 });
  console.log(`\nPage 1 (first 5 messages):`);
  for (const msg of page1) {
    console.log(`  - [${msg.role}]: ${msg.content.substring(0, 40)}...`);
  }

  // Get second page
  const page2 = await storage.getMessages(thread.id, { limit: 5, offset: 5 });
  console.log(`\nPage 2 (next 5 messages):`);
  for (const msg of page2) {
    console.log(`  - [${msg.role}]: ${msg.content.substring(0, 40)}...`);
  }

  // Step 7: Update thread metadata
  console.log('\n\n--- Updating Thread ---\n');

  await storage.updateThread(thread.id, {
    metadata: {
      ...thread.metadata,
      messageCount: messages.length + 10,
      lastUpdated: new Date().toISOString(),
    },
  });
  console.log('✓ Updated thread metadata');

  const updatedThread = await storage.getThread(thread.id);
  console.log(`  New metadata: ${JSON.stringify(updatedThread?.metadata, null, 2)}`);

  // Step 8: Cleanup (optional - comment out if you want to keep the data)
  console.log('\n\n--- Cleanup ---\n');

  // Uncomment to clean up:
  // await storage.deleteThread(thread.id)
  // console.log('✓ Deleted thread and all messages')

  console.log('ℹ️  Thread data preserved for inspection');
  console.log(`   Thread ID: ${thread.id}`);

  console.log('\n✅ Example completed successfully!');

  // Close connection
  await storage.close();
}

// Run with error handling
main().catch((error: Error) => {
  console.error('\n💥 Fatal error:', error.message);
  process.exit(1);
});
