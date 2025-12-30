/**
 * Example 03 - Streaming Response
 *
 * 展示如何使用流式响应，实现打字机效果。
 */

import 'dotenv/config';
import { createAgent } from '@seashore/agent';
import { openaiText } from '@seashore/llm';

async function main() {
  console.log('🤖 Example 03: Streaming Response\n');

  // 创建 Agent
  const agent = createAgent({
    name: 'streaming-assistant',
    model: openaiText('gpt-5.1', {
      baseURL: process.env.OPENAI_API_BASE_URL || 'https://api.openai.com/v1',
      apiKey: process.env.OPENAI_API_KEY || '',
    }),
    systemPrompt: '你是一个讲故事的助手。请用生动的语言讲述故事。',
  });

  console.log('📝 User: 请给我讲一个关于勇敢小兔子的简短故事（100字以内）。\n');
  console.log('🤖 Agent: ');

  // 使用流式响应 - stream 方法接受字符串输入
  for await (const chunk of agent.stream('请给我讲一个关于勇敢小兔子的简短故事（100字以内）。')) {
    if (chunk.type === 'content' && chunk.delta) {
      // 逐字输出，实现打字机效果
      process.stdout.write(chunk.delta);
    } else if (chunk.type === 'tool-call-start' && chunk.toolCall) {
      console.log(`\n[调用工具: ${chunk.toolCall.name}]`);
    } else if (chunk.type === 'tool-result' && chunk.toolResult) {
      console.log(`[工具结果: ${JSON.stringify(chunk.toolResult.data)}]`);
    }
  }

  console.log('\n\n--- 流式响应完成 ---');
}

main().catch(console.error);
