/**
 * Example 12 - Deploy API Server
 *
 * 展示如何使用 Deploy 模块将 Agent 部署为 API 服务器。
 * 使用 Hono 框架，支持 REST API 和 SSE 流式响应。
 */

import 'dotenv/config';
import { createServer, type Agent as DeployAgent, type Message } from '@seashore/deploy';
import { createAgent } from '@seashore/agent';
import { openaiText } from '@seashore/llm';
import { defineTool } from '@seashore/tool';
import { z } from 'zod';
import { serve } from '@hono/node-server';

// 定义天气工具
const weatherTool = defineTool({
  name: 'get_weather',
  description: '获取指定城市的天气',
  inputSchema: z.object({
    city: z.string().describe('城市名称'),
  }),
  execute: async (input) => {
    const mockWeather: Record<string, { temp: number; condition: string }> = {
      北京: { temp: 5, condition: '晴朗' },
      上海: { temp: 12, condition: '多云' },
      深圳: { temp: 22, condition: '晴朗' },
    };
    const weather = mockWeather[input.city] || { temp: 15, condition: '未知' };
    return { city: input.city, ...weather };
  },
});

// 创建 Seashore Agent
const seashoreAgent = createAgent({
  name: 'api-assistant',
  model: openaiText('gpt-5.1', {
    baseURL: process.env.OPENAI_API_BASE_URL || 'https://api.openai.com/v1',
    apiKey: process.env.OPENAI_API_KEY,
  }),
  systemPrompt: '你是一个 API 助手，可以查询天气等信息。请用简洁的中文回答。',
  tools: [weatherTool],
});

// 创建 Deploy 兼容的 Agent 适配器
const deployAgent: DeployAgent = {
  name: seashoreAgent.name,
  async run(input: { messages: Message[] }) {
    // 提取最后一条用户消息
    const userMessages = input.messages.filter((m: Message) => m.role === 'user');
    const lastUserMessage = userMessages[userMessages.length - 1];
    const userInput = lastUserMessage?.content ?? '';

    const result = await seashoreAgent.run(userInput);

    return {
      content: result.content,
      toolCalls: result.toolCalls.map((tc) => ({
        id: tc.id,
        name: tc.name,
        arguments: tc.arguments as Record<string, unknown>,
        result: tc.result.data,
      })),
    };
  },
};

async function main() {
  console.log('🚀 Example 12: Deploy API Server\n');

  // 创建 API 服务器
  const server = createServer({
    agents: { assistant: deployAgent },
    cors: {
      origin: '*', // 生产环境应限制来源
      methods: ['GET', 'POST', 'OPTIONS'],
    },
    rateLimit: {
      requests: 60, // 每窗口期 60 请求
      window: '1m', // 1 分钟窗口
    },
  });

  const port = 3000;

  console.log('📋 可用端点:');
  console.log(`   GET  http://localhost:${port}/health`);
  console.log(`   POST http://localhost:${port}/api/chat`);
  console.log(`   POST http://localhost:${port}/api/agents/assistant/run`);
  console.log(`   POST http://localhost:${port}/api/agents/assistant/stream\n`);

  console.log('📖 示例请求:');
  console.log(`
  # 非流式请求
  curl -X POST http://localhost:${port}/api/agents/assistant/run \\
    -H "Content-Type: application/json" \\
    -d '{"input": "北京天气怎么样？"}'

  # Chat API
  curl -X POST http://localhost:${port}/api/chat \\
    -H "Content-Type: application/json" \\
    -d '{
      "model": "assistant",
      "messages": [{"role": "user", "content": "你好"}]
    }'
`);

  // 启动服务器
  console.log(`🌐 启动服务器 http://localhost:${port}`);
  console.log('   按 Ctrl+C 停止服务器\n');

  serve({
    fetch: server.app.fetch,
    port,
  });

  console.log('✅ 服务器已启动!\n');

  // 演示本地调用
  console.log('--- 本地调用测试 ---\n');

  const testRequest = new Request(`http://localhost:${port}/api/agents/assistant/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ input: '北京今天天气怎么样？' }),
  });

  const response = await server.app.fetch(testRequest);
  const result = await response.json();

  console.log('📝 请求: 北京今天天气怎么样？');
  console.log(`🤖 响应: ${JSON.stringify(result, null, 2)}`);
}

main().catch(console.error);
