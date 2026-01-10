/**
 * Example 02 - Agent with Tools and Stream
 *
 * This example demonstrates how to create an agent that utilizes tools,
 * and how to handle streaming responses from the agent.
 */

import 'dotenv/config';
import { createAgent } from '@seashore/agent';
import { openaiText } from '@seashore/llm';
import { defineTool } from '@seashore/tool';
import { z } from 'zod';

// Define the weather query tool
const weatherTool = defineTool({
  name: 'get_weather',
  description: 'Get the current weather for a specified city (in Celsius).',
  // Define its input schema using zod
  inputSchema: z.object({
    city: z.string().describe('City name, e.g., "Beijing", "Shanghai"'),
  }),
  execute: async (input) => {
    const { city } = input;
    // Mock weather data (in a real application, call a real API)
    const mockWeather: Record<string, { temp: number; condition: string }> = {
      Beijing: { temp: 5, condition: 'Clear' },
      Shanghai: { temp: 12, condition: 'Cloudy' },
      Shenzhen: { temp: 22, condition: 'Clear' },
      Tokyo: { temp: 8, condition: 'Overcast' },
    };

    const weather = mockWeather[city] || { temp: 0, condition: 'Unknown' };
    return {
      city,
      temperature: weather.temp,
      condition: weather.condition,
    };
  },
});

// Define the calculator tool
const calculatorTool = defineTool({
  name: 'calculator',
  description: 'Perform basic mathematical calculations given an expression.',
  inputSchema: z.object({
    expression: z.string().describe('Mathematical expression, e.g., "2 + 3 * 4"'),
  }),
  execute: async (input) => {
    const { expression } = input;
    try {
      // Note: In a real application, use a safe math expression parser
      const sanitized = expression.replace(/[^0-9+\-*/().%\s]/g, '');
      const result = Function(`"use strict"; return (${sanitized})`)();
      return { expression, result: Number(result) };
    } catch {
      return { expression, error: 'Unable to calculate the expression' };
    }
  },
});

async function main() {
  console.log('[Example 02: Agent with Tools]\n');

  // Create an agent with tools
  const agent = createAgent({
    name: 'tool-assistant',
    model: openaiText('gpt-5.1', {
      baseURL: process.env.OPENAI_API_BASE_URL || 'https://api.openai.com/v1',
      apiKey: process.env.OPENAI_API_KEY || '',
    }),
    systemPrompt:
      'You are a helpful assistant that can query the weather and perform mathematical calculations.',
    tools: [weatherTool, calculatorTool],
  });

  // Test the both tools in a single interaction with streaming response
  console.log('--- Combination Test ---\n');
  const userPrompt = 'What is the temperature difference between Shanghai and Shenzhen?';
  console.log(`📝 User: ${userPrompt}`);

  for await (const chunk of agent.stream(userPrompt)) {
    if (chunk.type === 'content' && chunk.delta) {
      // For text content, output the delta
      process.stdout.write(chunk.delta);
    } else if (chunk.type === 'tool-call-start' && chunk.toolCall) {
      // Log tool call start
      console.log(`[Calling Tool: ${chunk.toolCall.name}]`);
    } else if (chunk.type === 'tool-result' && chunk.toolResult) {
      // Log tool result
      console.log(`[Tool Result: ${JSON.stringify(chunk.toolResult.data)}]`);
    }
  }
}

main().catch(console.error);

// [Example 02: Agent with Tools]

// --- Combination Test ---

// 📝 User: What is the temperature difference between Shanghai and Shenzhen?

// [Calling Tool: get_weather]
// [Calling Tool: get_weather]
// [Tool Result: {"city":"Shanghai","temperature":12,"condition":"Cloudy"}]
// [Tool Result: {"city":"Shenzhen","temperature":22,"condition":"Clear"}]
// [Calling Tool: calculator]
// [Tool Result: {"expression":"22 - 12","result":10}]
// The temperature difference between Shanghai and Shenzhen is 10°C, with Shenzhen being warmer.
