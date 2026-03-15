/**
 * Example: Hello LLM
 *
 * Purpose: Demonstrates the most basic usage of Seashore's LLM adapter.
 *          Shows how to create an adapter and make a simple chat completion.
 *
 * Prerequisites:
 * - OPENAI_API_KEY in .env file
 *
 * Learning Objectives:
 * 1. How to create an LLM adapter with custom base URL support
 * 2. How to call the TanStack AI chat function
 * 3. How to handle different providers (OpenAI, Anthropic, Gemini)
 *
 * Expected Output:
 * ```
 * Sending message: "What is TypeScript?"
 *
 * Response:
 * TypeScript is a strongly typed programming language that builds on JavaScript...
 *
 * ✓ Example completed successfully
 * ```
 */

import { createLLMAdapter, systemPrompt } from '@seashore/core';
import { chat } from '@tanstack/ai';

// Validate environment variables
const apiKey = process.env.OPENAI_API_KEY;
const baseURL = process.env.OPENAI_BASE_URL;

if (!apiKey) {
  console.error('❌ Error: OPENAI_API_KEY is required');
  console.error('Please copy .env.example to .env and add your OpenAI API key');
  process.exit(1);
}

async function main(): Promise<void> {
  console.log('🚀 Hello LLM Example\n');

  // Step 1: Create the LLM adapter
  // The adapter supports custom baseURL for proxies, Azure, or local models
  const adapter = createLLMAdapter({
    provider: 'openai',
    apiKey,
    baseURL,
  });

  // Step 2: Create a chat adapter for a specific model
  const chatAdapter = adapter('gpt-4o-mini');

  // Step 3: Prepare the conversation
  const userMessage = 'What is TypeScript?';
  console.log(`📝 Sending message: "${userMessage}"\n`);

  try {
    // Step 4: Call the LLM
    const response = await chat({
      adapter: chatAdapter,
      system: systemPrompt`You are a helpful assistant. Provide concise, accurate answers.`,
      messages: [
        {
          role: 'user',
          content: userMessage,
        },
      ],
    });

    // Step 5: Handle the response
    console.log('💬 Response:');
    console.log(response.text);
    console.log('\n✅ Example completed successfully!');

    // Bonus: Show token usage if available
    if (response.usage) {
      console.log(`\n📊 Token Usage:`);
      console.log(`  Prompt: ${response.usage.promptTokens}`);
      console.log(`  Completion: ${response.usage.completionTokens}`);
      console.log(`  Total: ${response.usage.totalTokens}`);
    }
  } catch (error) {
    // Handle common API errors
    if (error instanceof Error) {
      if (error.message.includes('rate limit')) {
        console.error('\n❌ Rate limit exceeded. Please wait a moment and try again.');
      } else if (error.message.includes('authentication')) {
        console.error('\n❌ Authentication failed. Please check your API key.');
      } else {
        console.error('\n❌ Error:', error.message);
      }
    }
    throw error;
  }
}

// Run with error handling
main().catch((error: Error) => {
  console.error('\n💥 Fatal error:', error.message);
  process.exit(1);
});
