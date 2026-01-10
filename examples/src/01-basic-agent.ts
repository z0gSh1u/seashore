/**
 * Example 01 - Basic Agent
 *
 * This example demonstrates how to create and use a basic agent with the Seashore framework.
 * No tools are integrated in this example; it simply showcases the agent's ability to respond to user inputs.
 */

import 'dotenv/config';
import { createAgent } from '@seashore/agent';
import { openaiText } from '@seashore/llm';

async function main() {
  console.log('[Example 01: Basic Agent]\n');

  // Create a basic agent without any tools.
  const agent = createAgent({
    name: 'basic-assistant',
    model: openaiText('gpt-5.1', {
      baseURL: process.env.OPENAI_API_BASE_URL || 'https://api.openai.com/v1',
      apiKey: process.env.OPENAI_API_KEY || '',
    }),
    // Add your custom system prompt to guide the agent's behavior.
    systemPrompt: 'You are a helpful assistant. Answer the user queries concisely.',
  });

  console.log('--- Single Turn Interaction ---\n');
  // `run` method runs a single-turn interaction with the agent without streaming.
  const userPrompt = 'Hello! Please introduce yourself in one sentence.';
  console.log(`📝 User: ${userPrompt}`);
  const result = await agent.run(userPrompt);
  // Display the agent's response.
  console.log(`🤖 Agent: ${result.content}`);

  console.log('\n--- Multi-Turn Interaction with Streaming ---\n');
  // Prepare a series of messages history for multi-turn interaction.
  const messages = [
    { role: 'user', content: 'My name is David.' },
    {
      role: 'assistant',
      content: 'Hello David! How can I assist you today?',
    },
    { role: 'user', content: "What's the first letter in my name?" },
  ] as const;
  console.log(
    messages
      .map((msg) => `${msg.role === 'user' ? '📝 User' : '🤖 Agent'}: ${msg.content}`)
      .join('\n')
  );
  // `chat` method runs a multi-turn interaction with the agent with streaming.
  process.stdout.write('🤖 Agent: ');
  for await (const chunk of agent.chat(messages)) {
    if (chunk.type === 'content' && chunk.delta) {
      process.stdout.write(chunk.delta);
    }
  }
  console.log('\n');
}

main().catch(console.error);

// [Example 01: Basic Agent]

// --- Single Turn Interaction ---

// 📝 User: Hello! Please introduce yourself in one sentence.
// 🤖 Agent: I’m ChatGPT, an AI assistant created by OpenAI to help answer questions, solve problems, and support you with clear, useful information.

// --- Multi-Turn Interaction with Streaming ---

// 📝 User: My name is David.
// 🤖 Agent: Hello David! How can I assist you today?
// 📝 User: What's the first letter in my name?
// 🤖 Agent: The first letter of your name, David, is **D**.
