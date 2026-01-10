/**
 * Example 05 - Memory Conversation
 *
 * This example demonstrates how to create an agent with short-term memory.
 */

import 'dotenv/config';
import { createAgent } from '@seashore/agent';
import { openaiText } from '@seashore/llm';
import { createShortTermMemory, type NewMemoryEntry } from '@seashore/memory';

async function main() {
  console.log('[Example 05: Memory Conversation]\n');

  // 创建短期记忆存储
  const memory = createShortTermMemory({
    maxEntries: 20,
  });

  const agentId = 'memory-assistant';
  const threadId = 'conversation-001';

  // Create agent with OpenAI text adapter
  const agent = createAgent({
    name: agentId,
    model: openaiText('gpt-5.1', {
      baseURL: process.env.OPENAI_API_BASE_URL || 'https://api.openai.com/v1',
      apiKey: process.env.OPENAI_API_KEY || '',
    }),
    systemPrompt:
      'You are a memory-enabled assistant. Please provide coherent answers based on the conversation history.',
  });

  console.log('--- Conversation Example ---\n');

  // Simulate multi-turn conversation
  const userMessages = [
    'Hello! My name is Xiaoming.',
    'I enjoy programming, especially TypeScript.',
    'Do you remember what my name is?',
    'Which programming language do I like?',
  ];

  for (const userMessage of userMessages) {
    console.log(`📝 User: ${userMessage}`);

    // 1. Save user message to memory
    const userEntry: NewMemoryEntry = {
      agentId,
      threadId,
      type: 'short',
      content: `User said: ${userMessage}`,
      importance: 0.7,
      metadata: { role: 'user' },
    };
    memory.add(userEntry);

    // 2. Get historical memories as context
    const memories = memory.queryByAgent(agentId, { threadId });
    const context = memories.map((m: { content: string }) => m.content).join('\n');

    // 3. Build prompt with context
    const promptWithContext = `
Conversation History:
${context}

Current Question: ${userMessage}

Please answer the user's question based on the conversation history.`;

    // 4. Get agent response
    const result = await agent.run(promptWithContext);
    console.log(`🤖 Agent: ${result.content}\n`);

    // 5. Update agent response to memory
    const assistantEntry: NewMemoryEntry = {
      agentId,
      threadId,
      type: 'short',
      content: `Assistant said: ${result.content}`,
      importance: 0.6,
      metadata: { role: 'assistant' },
    };
    memory.add(assistantEntry);
  }

  // 显示记忆统计
  const allMemories = memory.queryByAgent(agentId);
  const threadMemories = memory.queryByAgent(agentId, { threadId });
  console.log(`Total memories for agent '${agentId}': ${allMemories.length}`);
  console.log(`Memories in thread '${threadId}': ${threadMemories.length}`);

  // 清理记忆
  memory.dispose();
}

main().catch(console.error);

// [Example 05: Memory Conversation]
// --- Conversation Example ---

// 📝 User: Hello! My name is Xiaoming.
// 🤖 Agent: Nice to see you again, Xiaoming! 👋

// You already told me your name earlier, so I remember you. How can I help you today?

// 📝 User: I enjoy programming, especially TypeScript.
// 🤖 Agent: That’s awesome, Xiaoming—TypeScript is a great choice.

// If you’d like to go deeper with TypeScript, here are a few focused ideas depending on your level:

// **1. If you’re still getting comfortable:**
// - Practice with:
//   - `type` vs `interface`
//   - Generics in functions and components
//   - `unknown` vs `any`
// - Try adding TypeScript to a small project:
//   - A simple Node script (with `ts-node`)
//   - Or a small React + TypeScript app (e.g., a todo list)

// **2. If you’re intermediate:**
// - Explore:
//   - Utility types: `Partial`, `Pick`, `Omit`, `Record`
//   - Discriminated unions for modeling complex data
//   - Strict mode (`"strict": true` in `tsconfig.json`)
// - Refactor an existing JS project to TypeScript and fix types step by step.

// **3. If you’re advanced / want a challenge:**
// - Dive into:
//   - Conditional types: `T extends U ? X : Y`
//   - Mapped types
//   - Template literal types
// - Implement strongly-typed APIs:
//   - Typed API client (infers response types)
//   - Form schemas that infer TypeScript types

// If you tell me what you’ve already done with TypeScript (e.g., “I’ve used it with React” or “I mostly write backend code”), I can suggest a concrete mini-project or give you some tailored exercises.

// 📝 User: Do you remember what my name is?
// 🤖 Agent: Yes, your name is Xiaoming.

// 📝 User: Which programming language do I like?
// 🤖 Agent: You like **TypeScript**.

// Total memories for agent 'memory-assistant': 8
// Memories in thread 'conversation-001': 8
