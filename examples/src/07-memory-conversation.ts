/**
 * Example 07 - Memory Conversation
 *
 * 展示如何使用 Memory 模块管理对话上下文。
 * 包含短期记忆的添加、检索和清理。
 */

import 'dotenv/config';
import { createAgent } from '@seashore/agent';
import { openaiText } from '@seashore/llm';
import { createShortTermMemory, type NewMemoryEntry } from '@seashore/memory';

async function main() {
  console.log('🤖 Example 07: Memory Conversation\n');

  // 创建短期记忆存储
  const memory = createShortTermMemory({
    maxEntries: 20, // 每个 agent 最多保存 20 条记忆
    ttlMs: 1000 * 60 * 30, // 30 分钟过期
  });

  const agentId = 'memory-assistant';
  const threadId = 'conversation-001';

  // 创建 Agent
  const agent = createAgent({
    name: agentId,
    model: openaiText('gpt-5.1', {
      baseURL: process.env.OPENAI_API_BASE_URL || 'https://api.openai.com/v1',
      apiKey: process.env.OPENAI_API_KEY || '',
    }),
    systemPrompt: '你是一个有记忆的助手。请根据对话历史给出连贯的回答。',
  });

  console.log('--- 对话示例 ---\n');

  // 模拟多轮对话
  const conversations = [
    '你好！我叫小明。',
    '我喜欢编程，特别是 TypeScript。',
    '你还记得我叫什么名字吗？',
    '我喜欢什么编程语言？',
  ];

  for (const userMessage of conversations) {
    console.log(`📝 User: ${userMessage}`);

    // 1. 保存用户消息到记忆
    const userEntry: NewMemoryEntry = {
      agentId,
      threadId,
      type: 'short',
      content: `用户说: ${userMessage}`,
      importance: 0.7,
      metadata: { role: 'user' },
    };
    memory.add(userEntry);

    // 2. 获取历史记忆作为上下文
    const memories = memory.queryByAgent(agentId, { threadId });
    const context = memories.map((m: { content: string }) => m.content).join('\n');

    // 3. 构建带上下文的提示
    const promptWithContext = `
对话历史：
${context}

当前问题：${userMessage}

请根据对话历史回答用户的问题。`;

    // 4. 获取 Agent 回答
    const result = await agent.run(promptWithContext);
    console.log(`🤖 Agent: ${result.content}\n`);

    // 5. 保存 Agent 回答到记忆
    const assistantEntry: NewMemoryEntry = {
      agentId,
      threadId,
      type: 'short',
      content: `助手说: ${result.content}`,
      importance: 0.6,
      metadata: { role: 'assistant' },
    };
    memory.add(assistantEntry);
  }

  // 显示记忆统计
  console.log('--- 记忆统计 ---\n');
  const allMemories = memory.queryByAgent(agentId);
  console.log(`📊 总记忆条数: ${allMemories.length}`);

  const threadMemories = memory.queryByAgent(agentId, { threadId });
  console.log(`📊 当前对话记忆: ${threadMemories.length} 条`);

  // 清理记忆
  memory.dispose();
  console.log('\n✅ 记忆已清理');
}

main().catch(console.error);
