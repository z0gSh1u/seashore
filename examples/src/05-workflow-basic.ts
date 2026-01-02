/**
 * Example 05 - Workflow Basic
 *
 * 展示如何创建简单的两步工作流：
 * 1. 第一步：生成文章大纲
 * 2. 第二步：根据大纲生成正文
 *
 * 本示例同时展示两种 LLM Node 配置方式：
 * - 方式 1: 使用 openaiText() 适配器（支持 baseURL、apiKey 等完整配置）
 * - 方式 2: 使用简单配置对象（向后兼容，适合快速原型）
 */

import 'dotenv/config';
import { createWorkflow, createLLMNode, type WorkflowContext } from '@seashore/workflow';
import { openaiText } from '@seashore/llm';

async function main() {
  console.log('🤖 Example 05: Workflow Basic\n');

  // ============================================================
  // 方式 1: 使用 openaiText() 适配器（推荐用于生产环境）
  // 支持完整的配置选项：baseURL、apiKey、organization 等
  // ============================================================
  const adapterWithFullConfig = openaiText('gpt-5.1', {
    // 可选：自定义 API 端点（用于代理、私有部署、兼容 API 等）
    baseURL: process.env.OPENAI_API_BASE_URL || 'https://api.openai.com/v1',
    // 可选：显式指定 API Key（默认从 OPENAI_API_KEY 环境变量读取）
    apiKey: process.env.OPENAI_API_KEY || '',
    // 可选：组织 ID
    // organization: process.env.OPENAI_ORG_ID,
  });

  // ============================================================
  // 方式 2: 使用简单配置对象（向后兼容）
  // 适合快速原型，自动从环境变量读取 API Key
  // ============================================================
  const adapterSimple = {
    provider: 'openai' as const,
    model: 'gpt-4o',
    // 也支持以下可选配置：
    // baseURL: 'https://your-proxy.com/v1',
    // apiKey: 'your-api-key',
  };

  // 选择使用的适配器（本示例使用完整配置方式）
  const adapter = adapterWithFullConfig;

  // 步骤 1：生成大纲
  const outlineNode = createLLMNode({
    name: 'generate-outline',
    adapter,
    systemPrompt: '你是一个文章大纲生成专家。请根据主题生成简洁的文章大纲。',
    prompt: (input) =>
      `请为以下主题生成一个简短的文章大纲（3-4个要点）：\n\n主题：${(input as { topic: string }).topic}`,
  });

  // 步骤 2：根据大纲生成正文
  const contentNode = createLLMNode({
    name: 'generate-content',
    adapter,
    systemPrompt: '你是一个文章写作专家。请根据大纲撰写正文。',
    messages: (input, ctx: WorkflowContext) => {
      const outlineOutput = ctx.nodeOutputs['generate-outline'] as { content: string } | undefined;
      const outline = outlineOutput?.content ?? '';
      return [
        { role: 'system', content: '你是一个文章写作专家。请根据大纲撰写正文（150字以内）。' },
        {
          role: 'user',
          content: `主题：${(input as { topic: string }).topic}\n\n大纲：\n${outline}\n\n请根据以上大纲撰写正文。`,
        },
      ];
    },
  });

  // ============================================================
  // 高级用法：为不同节点使用不同的 API 配置
  // 例如：使用不同团队的 API 配额
  // ============================================================
  // const teamAAdapter = openaiText('gpt-4o', { apiKey: process.env.TEAM_A_API_KEY });
  // const teamBAdapter = openaiText('gpt-4o', { apiKey: process.env.TEAM_B_API_KEY });
  //
  // 或者使用本地部署的模型
  // const localAdapter = openaiText('local-model', {
  //   baseURL: 'http://localhost:1234/v1',
  //   apiKey: 'not-needed',
  // });

  // 创建工作流
  const workflow = createWorkflow({
    name: 'article-generation',
    nodes: [outlineNode, contentNode],
    edges: [{ from: 'generate-outline', to: 'generate-content' }],
    startNode: 'generate-outline',
  });

  const topic = 'TypeScript 的优势';
  console.log(`📝 主题: ${topic}\n`);
  console.log('--- 开始工作流 ---\n');

  // 执行工作流
  const result = await workflow.execute({ topic });

  console.log('📋 步骤 1 - 大纲:');
  const outlineOutput = result.nodeOutputs['generate-outline'] as { content: string } | undefined;
  console.log(outlineOutput?.content ?? '[无输出]');

  console.log('\n📄 步骤 2 - 正文:');
  const contentOutput = result.nodeOutputs['generate-content'] as { content: string } | undefined;
  console.log(contentOutput?.content ?? '[无输出]');

  console.log('\n--- 工作流完成 ---');
  console.log(`总执行时间: ${result.durationMs}ms`);
}

main().catch(console.error);
