import { createLLMAdapter, createTool } from '@seashore/core';
import { createReActAgent } from '@seashore/agent';
import { z } from 'zod';

/**
 * Basic ReAct Agent Example
 * 
 * This example demonstrates:
 * - Creating an LLM adapter
 * - Defining a custom tool
 * - Creating and running a ReAct agent
 */

async function main() {
  // 1. Setup LLM adapter
  const llm = createLLMAdapter({
    provider: 'openai',
    model: 'gpt-4o',
    apiKey: process.env.OPENAI_API_KEY || 'your-api-key-here',
  });

  // 2. Create a weather tool
  const weatherTool = createTool({
    name: 'get_weather',
    description: 'Get the current weather for a specified location',
    parameters: z.object({
      location: z.string().describe('The city or location to get weather for'),
      units: z.enum(['celsius', 'fahrenheit']).optional().default('celsius'),
    }),
    execute: async ({ location, units }) => {
      // Simulate API call
      const temp = units === 'celsius' ? '22°C' : '72°F';
      return `Weather in ${location}: ${temp}, sunny with light clouds`;
    },
  });

  // 3. Create a calculator tool
  const calculatorTool = createTool({
    name: 'calculator',
    description: 'Perform basic arithmetic operations',
    parameters: z.object({
      operation: z.enum(['add', 'subtract', 'multiply', 'divide']),
      a: z.number(),
      b: z.number(),
    }),
    execute: async ({ operation, a, b }) => {
      switch (operation) {
        case 'add': return a + b;
        case 'subtract': return a - b;
        case 'multiply': return a * b;
        case 'divide': return b !== 0 ? a / b : 'Error: Division by zero';
        default: return 'Unknown operation';
      }
    },
  });

  // 4. Create ReAct agent
  const agent = createReActAgent({
    llm,
    tools: [weatherTool, calculatorTool],
    systemPrompt: `You are a helpful assistant with access to weather information and a calculator.
Always explain your reasoning when using tools.`,
    maxIterations: 5,
  });

  // 5. Run the agent with different queries
  console.log('=== Example 1: Weather Query ===\n');
  const result1 = await agent.run({
    message: 'What is the weather like in San Francisco?',
  });
  console.log('Agent:', result1.message);
  console.log('Tool calls:', result1.toolCalls?.length || 0);

  console.log('\n=== Example 2: Math Query ===\n');
  const result2 = await agent.run({
    message: 'What is 15 multiplied by 8?',
  });
  console.log('Agent:', result2.message);

  console.log('\n=== Example 3: Complex Query ===\n');
  const result3 = await agent.run({
    message: 'If the temperature in London is 20°C and in Paris is 18°C, what is the average?',
  });
  console.log('Agent:', result3.message);

  // 6. Example with streaming
  console.log('\n=== Example 4: Streaming Response ===\n');
  const stream = agent.stream({
    message: 'Tell me about the weather in Tokyo and calculate 100 divided by 4.',
  });

  for await (const chunk of stream) {
    if (chunk.type === 'text') {
      process.stdout.write(chunk.content);
    } else if (chunk.type === 'tool-call') {
      console.log(`\n[Tool: ${chunk.toolName}]`);
    }
  }
  console.log('\n');
}

// Run the example
main().catch(console.error);
