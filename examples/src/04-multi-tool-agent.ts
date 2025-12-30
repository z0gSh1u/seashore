/**
 * Example 04 - Multi-Tool Agent
 *
 * 展示多工具协作的 Agent。
 * 包含搜索和网页内容获取两个工具，模拟研究场景。
 */

import 'dotenv/config';
import { createAgent } from '@seashore/agent';
import { openaiText } from '@seashore/llm';
import { defineTool } from '@seashore/tool';
import { z } from 'zod';

// These tool names might conflict:
// apply_patch
// code_interpreter
// computer_use_preview
// file_search
// image_generation
// local_shell
// mcp
// shell
// web_search_preview
// web_search
// custom

// 模拟搜索工具（实际应用中使用 serperTool）
const searchTool = defineTool({
  name: 'search_web',
  description: '在互联网上搜索信息',
  inputSchema: z.object({
    query: z.string().describe('搜索关键词'),
  }),
  execute: async (input) => {
    const { query } = input;
    console.log(`  🔍 [搜索] "${query}"`);

    // 模拟搜索结果
    const mockResults = [
      {
        title: `${query} - 维基百科`,
        url: `https://zh.wikipedia.org/wiki/${encodeURIComponent(query)}`,
        snippet: `${query}是一个重要的概念，在多个领域都有应用...`,
      },
      {
        title: `${query}入门指南`,
        url: `https://example.com/${query}-guide`,
        snippet: `本文将为您详细介绍${query}的基础知识和最佳实践...`,
      },
      {
        title: `最新${query}趋势分析`,
        url: `https://example.com/${query}-trends`,
        snippet: `2024年${query}领域的最新发展和未来展望...`,
      },
    ];

    return { query, results: mockResults };
  },
});

// 模拟网页内容获取工具（实际应用中使用 firecrawlTool）
const fetchPageTool = defineTool({
  name: 'fetch_page_content',
  description: '获取网页的详细内容',
  inputSchema: z.object({
    url: z.string().describe('要获取内容的网页 URL'),
  }),
  execute: async (input) => {
    const { url } = input;
    console.log(`  📄 [获取页面] ${url}`);

    // 模拟页面内容
    const mockContent = `
这是来自 ${url} 的模拟内容。

在实际应用中，这里会返回真实的网页内容。
Firecrawl 等工具可以帮助你抓取和解析网页，
提取干净的文本内容供 Agent 分析使用。

主要特点：
1. 自动处理 JavaScript 渲染的页面
2. 提取正文内容，过滤广告和导航
3. 保持文档结构
    `.trim();

    return { url, content: mockContent, wordCount: mockContent.length };
  },
});

async function main() {
  console.log('🤖 Example 04: Multi-Tool Agent\n');

  // 创建多工具 Agent
  const agent = createAgent({
    name: 'research-assistant',
    model: openaiText('gpt-5.1', {
      baseURL: process.env.OPENAI_API_BASE_URL || 'https://api.openai.com/v1',
      apiKey: process.env.OPENAI_API_KEY || '',
    }),
    systemPrompt: `你是一个研究助手。当用户询问某个话题时，你可以：
1. 使用 web_search 工具搜索相关信息
2. 使用 fetch_page_content 工具获取搜索结果中感兴趣页面的详细内容
3. 综合信息给出回答

请用中文回答，并引用信息来源。`,
    tools: [searchTool, fetchPageTool],
  });

  console.log('📝 User: 请帮我研究一下 TypeScript 的主要特点\n');

  const result = await agent.run('请帮我研究一下 TypeScript 的主要特点');

  console.log(`\n🤖 Agent:\n${result.content}`);
}

main().catch(console.error);
