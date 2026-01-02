/**
 * Example 11 - Observability Tracing
 *
 * 展示如何使用 Observability 模块追踪 Agent 执行。
 * 包含：日志记录、调用追踪、Token 计数。
 */

import 'dotenv/config';
import {
  createLogger,
  createTracer,
  createTokenCounter,
  createConsoleExporter,
} from '@seashore/observability';
import { createAgent } from '@seashore/agent';
import { openaiText } from '@seashore/llm';
import { defineTool } from '@seashore/tool';
import { z } from 'zod';

// 定义一个简单的计算器工具
const calculatorTool = defineTool({
  name: 'calculator',
  description: '执行数学计算',
  inputSchema: z.object({
    expression: z.string().describe('数学表达式'),
  }),
  execute: async (input) => {
    const { expression } = input;
    const sanitized = expression.replace(/[^0-9+\-*/().%\s]/g, '');
    const result = Function(`"use strict"; return (${sanitized})`)();
    return { result: Number(result) };
  },
});

async function main() {
  console.log('🔍 Example 11: Observability Tracing\n');

  // 1. 创建日志记录器
  const logger = createLogger({
    name: 'example-app',
    level: 'debug',
    format: 'pretty',
  });

  logger.info('示例启动', { example: '11-observability' });

  // 2. 创建控制台导出器
  const consoleExporter = createConsoleExporter();

  // 3. 创建追踪器
  const tracer = createTracer({
    serviceName: 'seashore-example',
    samplingRate: 1.0, // 100% 采样率
    exporters: [{ type: 'console' }],
  });

  // 4. 创建 Token 计数器
  const tokenCounter = createTokenCounter({
    defaultEncoding: 'cl100k_base',
  });

  // 5. 创建 Agent
  const agent = createAgent({
    name: 'traced-agent',
    model: openaiText('gpt-5.1', {
      baseURL: process.env.OPENAI_API_BASE_URL || 'https://api.openai.com/v1',
      apiKey: process.env.OPENAI_API_KEY,
    }),
    systemPrompt: '你是一个数学助手，可以帮助用户进行计算。',
    tools: [calculatorTool],
  });

  console.log('--- 带追踪的 Agent 执行 ---\n');

  const questions = ['你好！请帮我算一下 15 * 7 + 23 等于多少？', '那 100 除以 4 再减 5 呢？'];

  for (const question of questions) {
    logger.info('用户提问', { question });

    // 估算输入 Token
    const inputTokens = tokenCounter.count(question);
    logger.debug('Token 估算', { inputTokens });

    // 创建追踪 span
    const span = tracer.startSpan('agent.run', {
      type: 'agent',
      attributes: {
        'agent.name': agent.name,
        'input.tokens': inputTokens,
      },
    });

    try {
      console.log(`📝 User: ${question}`);

      const result = await agent.run(question);

      // 记录输出
      const outputTokens = tokenCounter.count(result.content);
      span.setAttributes({
        'output.tokens': outputTokens,
        'tool.calls': result.toolCalls.length,
      });

      console.log(`🤖 Agent: ${result.content}`);
      console.log(`📊 Token 使用: 输入 ~${inputTokens}, 输出 ~${outputTokens}`);

      // 显示工具调用
      if (result.toolCalls.length > 0) {
        console.log('🛠️ 工具调用:');
        result.toolCalls.forEach((call) => {
          console.log(`   - ${call.name}: ${JSON.stringify(call.arguments)}`);
          if (call.result.success) {
            console.log(`     结果: ${JSON.stringify(call.result.data)}`);
          }
        });
      }

      // 成功结束 span
      span.setStatus({ code: 'ok' });
      span.end();
      logger.info('Agent 执行成功', {
        durationMs: span.durationMs,
        toolCalls: result.toolCalls.length,
      });
    } catch (error) {
      // 错误结束 span
      const errorMessage = error instanceof Error ? error.message : String(error);
      span.setStatus({ code: 'error', message: errorMessage });
      span.end();
      logger.error('Agent 执行失败', { error: errorMessage });
    }

    console.log();
  }

  // 导出统计
  console.log('--- 追踪统计 ---\n');
  console.log('📊 Spans 已通过控制台导出器输出');

  // 关闭追踪器
  await tracer.shutdown();
  await consoleExporter.shutdown();

  console.log('\n--- Observability 示例完成 ---');
}

main().catch(console.error);
