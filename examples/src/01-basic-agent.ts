/**
 * Example 01 - Basic Agent
 *
 * 最简单的 Agent 示例，展示如何创建一个基础对话 Agent。
 * 没有工具，只是简单的问答对话。
 */

import 'dotenv/config';
import { createAgent } from '@seashore/agent';
import { openaiText } from '@seashore/llm';

async function main() {
  console.log('🤖 Example 01: Basic Agent\n');

  // 创建一个简单的 Agent
  const agent = createAgent({
    name: 'basic-assistant',
    model: openaiText('gpt-5.1', {
      baseURL: process.env.OPENAI_API_BASE_URL || 'https://api.openai.com/v1',
      apiKey: process.env.OPENAI_API_KEY || '',
    }),
    systemPrompt: '你是一个友好的助手。请用简洁的中文回答用户的问题。',
  });

  // 运行 Agent - 使用字符串输入
  const result = await agent.run('你好！请用一句话介绍一下你自己。');

  console.log('📝 User: 你好！请用一句话介绍一下你自己。');
  console.log(`🤖 Agent: ${result.content}`);

  // 多轮对话示例 - 使用 chat 方法
  console.log('\n--- 多轮对话 ---\n');

  // chat 方法返回流式响应
  const messages = [
    { role: 'user' as const, content: '什么是 TypeScript？' },
    {
      role: 'assistant' as const,
      content: 'TypeScript 是 JavaScript 的超集，添加了静态类型系统。',
    },
    { role: 'user' as const, content: '它和 JavaScript 的主要区别是什么？' },
  ];

  console.log('📝 User: 它和 JavaScript 的主要区别是什么？');
  process.stdout.write('🤖 Agent: ');
  for await (const chunk of agent.chat(messages)) {
    if (chunk.type === 'content' && chunk.delta) {
      process.stdout.write(chunk.delta);
    }
  }
  console.log('\n');
}

main().catch(console.error);
