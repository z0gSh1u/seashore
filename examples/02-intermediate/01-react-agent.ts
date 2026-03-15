/**
 * Example: ReAct Agent
 *
 * Purpose: Demonstrates a ReAct (Reasoning + Acting) agent with tools.
 *          Shows how to create an agent that can use tools and iterate to solve tasks.
 *
 * Prerequisites:
 * - OPENAI_API_KEY in .env file
 *
 * Learning Objectives:
 * 1. How to create a ReAct agent with createReActAgent()
 * 2. How to configure tools for the agent
 * 3. How to run the agent with conversation history
 * 4. How to handle multi-step reasoning with tool calls
 *
 * Expected Output:
 * ```
 * 🤖 ReAct Agent Example
 *
 * Available Tools:
 *  - calculate: Performs mathematical calculations
 *  - searchKnowledge: Searches a knowledge base
 *
 * User: "What is 123 * 456, and tell me about neural networks?"
 *
 * 🤖 Agent is thinking...
 * 🔧 Using tool: calculate
 * 🔧 Using tool: searchKnowledge
 *
 * 🤖 Response:
 * The result of 123 * 456 is 56,088. Neural networks are...
 *
 * ✅ Example completed successfully!
 * ```
 */

import { createLLMAdapter } from '@seashore/core.js';
import { createReActAgent, type Message } from '@seashore/agent.js';
import { tool } from '@tanstack/ai';
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
  console.log('🤖 ReAct Agent Example\n');

  // Step 1: Create the LLM adapter
  const adapter = createLLMAdapter({
    provider: 'openai',
    apiKey,
    baseURL,
  });

  // Step 2: Define tools for the agent

  // Tool 1: Calculator
  const calculateTool = tool({
    name: 'calculate',
    description:
      'Performs mathematical calculations with precision. ' +
      'Use this for any arithmetic, percentages, or mathematical operations.',
    parameters: z.object({
      expression: z
        .string()
        .describe('The mathematical expression (e.g., "123 * 456", "15% of 200")'),
    }),
    execute: async ({ expression }) => {
      console.log(`  🔧 Tool called: calculate("${expression}")`);
      try {
        // Simple eval for demo - use proper math library in production
        // eslint-disable-next-line no-eval
        const result = eval(expression.replace(/ /g, ''));
        console.log(`     Result: ${result}`);
        return String(result);
      } catch (error) {
        console.log(`     Error: Invalid expression`);
        return `Error: Could not evaluate "${expression}"`;
      }
    },
  });

  // Tool 2: Knowledge base search (mock)
  const searchTool = tool({
    name: 'searchKnowledge',
    description:
      'Searches the knowledge base for information about ' +
      'programming, AI, and technology topics.',
    parameters: z.object({
      topic: z.string().describe('The topic to search for'),
    }),
    execute: async ({ topic }) => {
      console.log(`  🔧 Tool called: searchKnowledge("${topic}")`);

      // Mock knowledge base
      const knowledgeBase: Record<string, string> = {
        'neural networks':
          'Neural networks are computational models inspired by biological neural networks. ' +
          'They consist of layers of interconnected nodes (neurons) that process information. ' +
          'Deep learning uses neural networks with many layers to learn complex patterns.',
        typescript:
          'TypeScript is a strongly typed superset of JavaScript developed by Microsoft. ' +
          'It adds optional static typing, interfaces, and advanced IDE support ' +
          'while compiling to plain JavaScript.',
        react:
          'React is a JavaScript library for building user interfaces. ' +
          'It uses a component-based architecture and virtual DOM for efficient rendering. ' +
          'React was developed by Facebook and is maintained by Meta.',
      };

      const normalizedTopic = topic.toLowerCase();
      const result =
        knowledgeBase[normalizedTopic] ||
        `No specific information found about "${topic}". ` +
          `Try searching for: neural networks, typescript, or react.`;

      console.log(`     Found: ${result.substring(0, 50)}...`);
      return result;
    },
  });

  // Step 3: Create the ReAct agent
  console.log('Creating ReAct agent...');

  const agent = createReActAgent({
    model: () => adapter('gpt-4o-mini'),
    systemPrompt:
      'You are a helpful assistant that can perform calculations and search a knowledge base. ' +
      'Always use tools when appropriate. Be concise but thorough.',
    tools: [calculateTool, searchTool],
    maxIterations: 5,
  });

  console.log('✓ Agent created with 2 tools\n');

  // Step 4: Run the agent with a user query
  const userQuery = 'What is 123 * 456, and tell me about neural networks?';
  console.log(`💬 User: "${userQuery}"\n`);

  const messages: Message[] = [{ role: 'user', content: userQuery }];

  try {
    console.log('🤖 Agent is thinking...\n');

    const response = await agent.run(messages);

    // Display tool calls if any
    if (response.result.toolCalls.length > 0) {
      console.log('\n📋 Tool Calls Summary:');
      for (const tc of response.result.toolCalls) {
        console.log(`  - ${tc.name}(${JSON.stringify(tc.arguments)})`);
      }
    }

    // Display the response
    console.log('\n💬 Agent Response:');
    console.log(response.result.content);

    // Show conversation history
    console.log('\n\n📜 Full Conversation:');
    console.log('='.repeat(80));
    for (const msg of response.messages) {
      if (msg.role === 'user') {
        console.log(`\n👤 User: ${msg.content}`);
      } else if (msg.role === 'assistant') {
        console.log(
          `\n🤖 Assistant: ${msg.content.substring(0, 100)}${msg.content.length > 100 ? '...' : ''}`,
        );
      }
    }

    console.log('\n\n✅ Example completed successfully!');
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
