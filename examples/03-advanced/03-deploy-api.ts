/**
 * Example: Deploy API
 *
 * Purpose: Demonstrates deploying a Seashore agent as a Hono HTTP API.
 *          Shows how to create production-ready endpoints with streaming.
 *
 * Prerequisites:
 * - OPENAI_API_KEY in .env file
 * - Optional: DATABASE_URL for persistent storage
 *
 * Learning Objectives:
 * 1. How to deploy agents using Hono middleware
 * 2. How to handle chat requests and responses
 * 3. How to implement Server-Sent Events (SSE) streaming
 * 4. How to manage thread persistence in API endpoints
 *
 * Expected Output:
 * ```
 * 🚀 Deploy API Example
 *
 * Creating agent...
 * ✓ Agent initialized
 *
 * Starting server on http://localhost:3000
 *
 * Available Endpoints:
 *   POST /chat           - Non-streaming chat
 *   POST /chat/stream    - Streaming chat (SSE)
 *   GET  /health         - Health check
 *
 * Example usage:
 *   curl -X POST http://localhost:3000/chat \\
 *     -H "Content-Type: application/json" \\
 *     -d '{"message": "Hello!"}'
 *
 * Server running. Press Ctrl+C to stop.
 *
 * [Logs of incoming requests...]
 * ```
 *
 * Note: This example runs a real HTTP server. Use Ctrl+C to stop.
 */

import { createLLMAdapter } from '@seashore/core.js';
import { createReActAgent, type Message } from '@seashore/agent.js';
import { seashoreMiddleware } from '@seashore/platform.js';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';

// Validate environment variables
const apiKey = process.env.OPENAI_API_KEY;
const baseURL = process.env.OPENAI_BASE_URL;
const port = parseInt(process.env.PORT || '3000', 10);

if (!apiKey) {
  console.error('❌ Error: OPENAI_API_KEY is required');
  console.error('Please copy .env.example to .env and add your OpenAI API key');
  process.exit(1);
}

async function main(): Promise<void> {
  console.log('🚀 Deploy API Example\n');

  // Step 1: Create the agent
  console.log('Creating agent...');

  const adapter = createLLMAdapter({
    provider: 'openai',
    apiKey,
    baseURL,
  });

  const agent = createReActAgent({
    model: () => adapter('gpt-4o-mini'),
    systemPrompt:
      'You are a helpful assistant deployed as an API. ' +
      'Provide clear, concise responses. ' +
      'You can help with general knowledge, coding, and problem-solving.',
  });

  console.log('✓ Agent initialized\n');

  // Step 2: Create Hono app
  const app = new Hono();

  // Step 3: Add middleware
  app.use(logger());
  app.use(cors());

  // Step 4: Health check endpoint
  app.get('/health', (c) => {
    return c.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
    });
  });

  // Step 5: Add Seashore middleware
  // This creates /chat and /chat/stream endpoints automatically
  app.use(
    '/chat/*',
    seashoreMiddleware({
      agent,
      enableStreaming: true,
      // Optional: Add storage for persistence
      // storage: process.env.DATABASE_URL ? createStorageService({
      //   connectionString: process.env.DATABASE_URL
      // }) : undefined,
    }),
  );

  // Step 6: Custom endpoint example
  app.post('/agent/ask', async (c) => {
    try {
      const body = await c.req.json();
      const { question, threadId } = body;

      if (!question) {
        return c.json({ error: 'Question is required' }, 400);
      }

      console.log(`[Custom Endpoint] Question: ${question}`);

      const messages: Message[] = [{ role: 'user', content: question }];

      const response = await agent.run(messages);

      return c.json({
        answer: response.result.content,
        threadId: threadId || null,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error in /agent/ask:', error);
      return c.json({ error: 'Internal server error' }, 500);
    }
  });

  // Step 7: Start server
  console.log('='.repeat(80));
  console.log(`\nStarting server on http://localhost:${port}\n`);

  console.log('Available Endpoints:');
  console.log(`  GET  http://localhost:${port}/health           - Health check`);
  console.log(`  POST http://localhost:${port}/chat             - Chat (JSON)`);
  console.log(`  POST http://localhost:${port}/chat/stream      - Chat (SSE streaming)`);
  console.log(`  POST http://localhost:${port}/agent/ask        - Custom ask endpoint`);

  console.log('\nExample Usage:');
  console.log('  # Non-streaming chat:');
  console.log(`  curl -X POST http://localhost:${port}/chat \\\\`);
  console.log('    -H "Content-Type: application/json" \\\\');
  console.log('    -d \'{"message": "What is TypeScript?"}\'');

  console.log('\n  # Streaming chat:');
  console.log(`  curl -X POST http://localhost:${port}/chat/stream \\\\`);
  console.log('    -H "Content-Type: application/json" \\\\');
  console.log('    -d \'{"message": "Tell me a joke"}\'');

  console.log('\n  # Custom endpoint:');
  console.log(`  curl -X POST http://localhost:${port}/agent/ask \\\\`);
  console.log('    -H "Content-Type: application/json" \\\\');
  console.log('    -d \'{"question": "How does AI work?"}\'');

  console.log('\n' + '='.repeat(80));
  console.log('\nServer running. Press Ctrl+C to stop.\n');

  // Start the server
  Bun.serve({
    port,
    fetch: app.fetch,
  });

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n\n👋 Shutting down server...');
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    console.log('\n\n👋 Shutting down server...');
    process.exit(0);
  });
}

// Run with error handling
main().catch((error: Error) => {
  console.error('\n💥 Fatal error:', error.message);
  process.exit(1);
});
