/**
 * Example 10 - Evaluation QA
 *
 * 展示如何使用 Evaluation 模块评估 Agent 的回答质量。
 * 包含：相关性、连贯性、有害性等多维度评估。
 */

import 'dotenv/config';
import {
  createEvaluator,
  evaluateBatch,
  relevanceMetric,
  coherenceMetric,
  customMetric,
  type TestCase,
} from '@seashore/evaluation';
import { createAgent } from '@seashore/agent';
import { openaiText } from '@seashore/llm';

async function main() {
  console.log('📊 Example 10: Evaluation QA\n');

  // LLM 配置：使用自定义的 baseURL 和 API key
  const model = openaiText('gpt-5.1', {
    baseURL: process.env.OPENAI_API_BASE_URL || 'https://api.openai.com/v1',
    apiKey: process.env.OPENAI_API_KEY,
  });

  // 创建要评估的 Agent
  const agent = createAgent({
    name: 'qa-agent',
    model,
    systemPrompt: '你是一个知识问答助手。请简洁准确地回答问题。',
  });

  // 定义测试数据集
  const testCases: TestCase[] = [
    {
      id: 'q1',
      input: '什么是 TypeScript？',
      reference: 'TypeScript 是 JavaScript 的超集，添加了静态类型系统。',
    },
    {
      id: 'q2',
      input: 'React 的主要特点是什么？',
      reference:
        'React 是一个用于构建用户界面的 JavaScript 库，主要特点包括组件化、虚拟 DOM 和单向数据流。',
    },
    {
      id: 'q3',
      input: 'Node.js 适合做什么？',
      reference: 'Node.js 适合构建高并发的网络应用、API 服务、实时应用（如聊天）和工具脚本。',
    },
  ];

  console.log(`📋 测试用例数: ${testCases.length}\n`);

  // 生成 Agent 回答
  console.log('--- 生成回答 ---\n');
  for (const testCase of testCases) {
    console.log(`📝 问题: ${testCase.input}`);
    const result = await agent.run(testCase.input);
    testCase.output = result.content;
    console.log(`🤖 回答: ${result.content}`);
    console.log(`📖 参考: ${testCase.reference}\n`);
  }

  // 创建 LLM 适配器用于 LLM-based 评估
  const llmAdapter = {
    generate: async (prompt: string): Promise<string> => {
      const result = await agent.run(prompt);
      return result.content;
    },
  };

  // 定义评估指标
  const metrics = [
    // 相关性：回答是否与问题相关
    relevanceMetric({
      threshold: 0.7,
      weight: 1.0,
    }),

    // 连贯性：回答是否逻辑清晰
    coherenceMetric({
      threshold: 0.6,
      weight: 0.8,
    }),

    // 自定义规则：回答长度检查
    customMetric({
      name: 'length_check',
      description: '检查回答长度是否合理（10-500字符）',
      type: 'rule',
      threshold: 0.8,
      evaluate: (input: string, output: string) => {
        const len = output.length;
        const passed = len >= 10 && len <= 500;
        return {
          score: passed ? 1.0 : 0.5,
          reason: passed ? '长度合适' : `长度不合适: ${len} 字符`,
        };
      },
    }),
  ];

  // 创建评估器
  const evaluator = createEvaluator({
    metrics,
    llmAdapter,
    concurrency: 2,
  });

  // 执行批量评估
  console.log('--- 开始评估 ---\n');
  const batchResult = await evaluateBatch({
    evaluator,
    testCases,
    onProgress: (completed, total) => {
      console.log(`   进度: ${completed}/${total}`);
    },
  });

  // 显示评估结果
  console.log('--- 评估结果 ---\n');

  batchResult.results.forEach((result, index) => {
    console.log(`📋 测试用例 ${index + 1}:`);
    console.log(`   输入: ${result.input.slice(0, 40)}...`);
    console.log(`   总分: ${(result.overallScore * 100).toFixed(1)}%`);
    console.log(`   通过: ${result.passed ? '✅' : '❌'}`);
    console.log('   指标详情:');
    result.details.forEach((detail) => {
      const status = detail.passed ? '✅' : '❌';
      console.log(`      ${status} ${detail.metric}: ${(detail.score * 100).toFixed(1)}%`);
      if (detail.reason) {
        console.log(`         原因: ${detail.reason}`);
      }
    });
    console.log();
  });

  // 汇总统计
  console.log('--- 汇总统计 ---\n');
  console.log(`📊 总测试数: ${batchResult.results.length}`);
  console.log(`✅ 通过数: ${batchResult.passedCount}`);
  console.log(`❌ 失败数: ${batchResult.failedCount}`);
  console.log(`📈 通过率: ${(batchResult.passRate * 100).toFixed(1)}%`);
  console.log(`📈 平均得分: ${(batchResult.overallAverage * 100).toFixed(1)}%`);
  console.log(`⏱️ 耗时: ${batchResult.durationMs}ms`);

  console.log('\n--- Evaluation 示例完成 ---');
}

main().catch(console.error);
