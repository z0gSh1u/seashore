import * as dotenv from 'dotenv';
import * as path from 'path';
import { createShortTermMemory } from '@seashore/memory';
import { createAgent } from '@seashore/agent';
import { openaiText } from '@seashore/llm';

// Load environment variables
dotenv.config();

async function main() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error('Error: OPENAI_API_KEY is not set in examples/.env');
    process.exit(1);
  }

  // 1. Initialize Memory
  const memory = createShortTermMemory({ maxEntries: 10 });
  const agentId = 'memory-agent';
  const threadId = 'conversation-1';

  // 2. Create Agent
  const agent = createAgent({
    name: agentId,
    model: openaiText('gpt-4o', { apiKey }),
    systemPrompt: 'You are a helpful assistant with memory.',
  });

  // Helper to run agent with memory context
  async function chat(userMessage: string) {
    console.log(`\n👤 User: ${userMessage}`);

    // Retrieve context
    const recentMemories = memory.queryByAgent(agentId, { threadId, limit: 5 });
    // Reverse to show oldest first in context
    const context = [...recentMemories]
      .reverse()
      .map((m) => m.content)
      .join('\n');

    // Run agent with context injected
    const response = await agent.run(
      `Context from previous turns:\n${context}\n\nCurrent User Message: ${userMessage}`
    );

    console.log(`🤖 Agent: ${response.content}`);

    // Save interaction to memory
    memory.add({
      agentId,
      threadId,
      content: `User: ${userMessage}\nAgent: ${response.content}`,
      importance: 1,
    });
  }

  // 3. Conversation
  console.log('🧠 Starting conversation with memory...');
  await chat('Hi, my name is Alice and I love coding in TypeScript.');
  await chat('What is my name?');
  await chat('What do I love doing?');
}

main().catch(console.error);
