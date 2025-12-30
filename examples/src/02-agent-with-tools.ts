/**
 * Example 02 - Agent with Tools
 *
 * 展示如何为 Agent 添加工具能力。
 * 包含两个工具：天气查询和计算器。
 */

import 'dotenv/config';
import { createAgent } from '@seashore/agent';
import { openaiText } from '@seashore/llm';
import { defineTool } from '@seashore/tool';
import { z } from 'zod';

// 定义天气查询工具
const weatherTool = defineTool({
  name: 'get_weather',
  description: '获取指定城市的当前天气信息',
  inputSchema: z.object({
    city: z.string().describe('城市名称，如 "北京"、"上海"'),
  }),
  execute: async (input) => {
    const { city } = input;
    // 模拟天气数据（实际应用中会调用真实 API）
    const mockWeather: Record<string, { temp: number; condition: string }> = {
      北京: { temp: 5, condition: '晴朗' },
      上海: { temp: 12, condition: '多云' },
      深圳: { temp: 22, condition: '晴朗' },
      东京: { temp: 8, condition: '阴天' },
    };

    const weather = mockWeather[city] || { temp: 15, condition: '未知' };
    return {
      city,
      temperature: weather.temp,
      condition: weather.condition,
      unit: '摄氏度',
    };
  },
});

// 定义计算器工具
const calculatorTool = defineTool({
  name: 'calculator',
  description: '执行数学计算',
  inputSchema: z.object({
    expression: z.string().describe('数学表达式，如 "2 + 3 * 4"'),
  }),
  execute: async (input) => {
    const { expression } = input;
    try {
      // 注意：实际应用中应使用安全的数学表达式解析器
      // 这里仅作演示，不要在生产环境使用 eval
      const sanitized = expression.replace(/[^0-9+\-*/().%\s]/g, '');
      const result = Function(`"use strict"; return (${sanitized})`)();
      return { expression, result: Number(result) };
    } catch {
      return { expression, error: '无法计算该表达式' };
    }
  },
});

async function main() {
  console.log('🤖 Example 02: Agent with Tools\n');

  // 创建带工具的 Agent
  const agent = createAgent({
    name: 'tool-assistant',
    model: openaiText('gpt-5.1', {
      baseURL: process.env.OPENAI_API_BASE_URL || 'https://api.openai.com/v1',
      apiKey: process.env.OPENAI_API_KEY || '',
    }),
    systemPrompt: '你是一个有用的助手，可以查询天气和进行数学计算。请用中文回答。',
    tools: [weatherTool, calculatorTool],
  });

  // 测试天气查询
  console.log('--- 天气查询测试 ---\n');
  const weatherResult = await agent.run('今天北京的天气怎么样？');
  console.log('📝 User: 今天北京的天气怎么样？');
  console.log(`🤖 Agent: ${weatherResult.content}\n`);

  // 测试计算器
  console.log('--- 计算器测试 ---\n');
  const calcResult = await agent.run('帮我算一下 15 * 7 + 23 等于多少？');
  console.log('📝 User: 帮我算一下 15 * 7 + 23 等于多少？');
  console.log(`🤖 Agent: ${calcResult.content}\n`);

  // 测试组合使用
  console.log('--- 组合测试 ---\n');
  const comboResult = await agent.run('上海和深圳的温度差是多少度？');
  console.log('📝 User: 上海和深圳的温度差是多少度？');
  console.log(`🤖 Agent: ${comboResult.content}`);
}

main().catch(console.error);
