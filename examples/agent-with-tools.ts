import * as dotenv from 'dotenv';
import * as path from 'path';
import { z } from 'zod';
import { createAgent } from '@seashore/agent';
import { defineTool } from '@seashore/tool';
import { openaiText } from '@seashore/llm';

// Load environment variables
dotenv.config();

async function main() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error('Error: OPENAI_API_KEY is not set in examples/.env');
    process.exit(1);
  }

  // 1. Define a tool
  const calculatorTool = defineTool({
    name: 'calculator',
    description: 'Perform basic arithmetic operations',
    parameters: z.object({
      operation: z.enum(['add', 'subtract', 'multiply', 'divide']),
      a: z.number(),
      b: z.number(),
    }),
    execute: async ({ operation, a, b }) => {
      console.log(`🛠️  Tool called: calculator(${operation}, ${a}, ${b})`);
      switch (operation) {
        case 'add':
          return a + b;
        case 'subtract':
          return a - b;
        case 'multiply':
          return a * b;
        case 'divide':
          return a / b;
      }
    },
  });

  // 2. Create an agent
  const agent = createAgent({
    name: 'math-assistant',
    model: openaiText('gpt-4o', { apiKey }),
    tools: [calculatorTool],
    systemPrompt: 'You are a helpful math assistant. Use the calculator tool for calculations.',
  });

  console.log('🤖 Agent initialized. Asking a math question...');
  const query = 'What is (123 * 45) + 678?';
  console.log(`❓ User: ${query}`);

  // 3. Run the agent
  const result = await agent.run(query);

  console.log('\n📝 Agent Response:');
  console.log(result.content);
}

main().catch(console.error);
