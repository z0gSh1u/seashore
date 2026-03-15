/**
 * Example: Simple Tool
 *
 * Purpose: Shows how to create custom tools and use them with an LLM.
 *          Demonstrates the toolkit pattern and tool definitions.
 *
 * Prerequisites:
 * - OPENAI_API_KEY in .env file
 *
 * Learning Objectives:
 * 1. How to define tool parameters using Zod schemas
 * 2. How to create a tool with description and execution logic
 * 3. How to use tools with an LLM for function calling
 *
 * Expected Output:
 * ```
 * 🛠️ Available Tools:
 *    - calculate: Performs mathematical calculations
 *    - getCurrentTime: Returns the current date and time
 *
 * 💬 User: "What is 25 * 17 and what time is it?"
 *
 * 🤖 Assistant uses tools and responds with the calculation result and time
 * ```
 */

import { createLLMAdapter, createToolkit } from '@seashore/core.js';
import { tool, chat } from '@tanstack/ai';
import { z } from 'zod';

// Validate environment variables
const apiKey = process.env.OPENAI_API_KEY;
const baseURL = process.env.OPENAI_BASE_URL;

if (!apiKey) {
  console.error('❌ Error: OPENAI_API_KEY is required');
  console.error('Please copy .env.example to .env and add your OpenAI API key');
  process.exit(1);
}

async function main(): Promise<void> {
  console.log('🛠️ Simple Tool Example\n');

  // Step 1: Define tool schemas and implementations

  // Tool 1: Calculator
  const calculateTool = tool({
    name: 'calculate',
    description: 'Performs mathematical calculations. Use this for any math operations.',
    parameters: z.object({
      expression: z.string().describe('The mathematical expression to evaluate (e.g., "25 * 17")'),
    }),
    execute: async ({ expression }) => {
      console.log(`  🔧 Tool called: calculate("${expression}")`);
      try {
        // Note: In production, use a proper math library
        // eslint-disable-next-line no-eval
        const result = eval(expression);
        return String(result);
      } catch {
        return 'Error: Invalid expression';
      }
    },
  });

  // Tool 2: Get current time
  const timeTool = tool({
    name: 'getCurrentTime',
    description: 'Returns the current date and time in a human-readable format',
    parameters: z.object({}),
    execute: async () => {
      console.log('  🔧 Tool called: getCurrentTime()');
      const now = new Date();
      return now.toLocaleString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    },
  });

  // Step 2: Create a toolkit (collection of tools)
  const toolkit = createToolkit([calculateTool, timeTool]);

  console.log('📦 Available Tools:');
  for (const t of toolkit) {
    console.log(`  - ${t.name}: ${t.description}`);
  }
  console.log();

  // Step 3: Create LLM adapter
  const adapter = createLLMAdapter({
    provider: 'openai',
    apiKey,
    baseURL,
  });

  // Step 4: Prepare the conversation with tools
  const userMessage = 'What is 25 * 17 and what time is it?';
  console.log(`💬 User: "${userMessage}"\n`);

  try {
    // Step 5: Call the LLM with tools
    const response = await chat({
      adapter: adapter('gpt-4o-mini'),
      system:
        `You are a helpful assistant with access to tools. ` +
        `When the user asks for calculations or time, use the appropriate tool. ` +
        `Always provide clear, helpful responses.`,
      messages: [
        {
          role: 'user',
          content: userMessage,
        },
      ],
      tools: toolkit,
    });

    // Step 6: Handle the response
    console.log('🤖 Assistant:', response.text);

    // Show tool calls if any
    if (response.toolCalls && response.toolCalls.length > 0) {
      console.log('\n📋 Tool Calls Made:');
      for (const tc of response.toolCalls) {
        console.log(`  - ${tc.name}: ${JSON.stringify(tc.args)}`);
      }
    }

    console.log('\n✅ Example completed successfully!');
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('rate limit')) {
        console.error('\n❌ Rate limit exceeded. Please wait a moment and try again.');
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
