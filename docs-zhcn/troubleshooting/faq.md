# 常见问题(FAQ)

关于 Seashore 的常见问题,按主题组织。

## 总体问题

### 什么是 Seashore?

Seashore 是一个 TypeScript 优先的框架,用于构建生产就绪的 AI agent。它提供:
- 类型安全的 LLM 适配器(OpenAI、Anthropic、Google)
- 带工具调用的 ReAct agent
- 基于 DAG 的工作流编排
- 使用 pgvector 的 RAG 管道
- 部署工具(Hono、MCP、护栏)

### Seashore 与 LangChain/LlamaIndex 有何不同?

**Seashore:**
- 纯 TypeScript(不是 Python 优先)
- 使用 TanStack AI(不是自定义抽象)
- 更小的打包大小(~300KB vs ~2MB)
- 从第一天起就为生产设计
- ESM 优先,现代工具

**LangChain/LlamaIndex:**
- Python 优先,带 TS 移植版本
- 更大的生态系统
- 更多集成
- 成熟的社区

查看[迁移指南](../migration/migration-guide.md)了解详细对比。

### Seashore 是生产就绪的吗?

是的! Seashore 为生产设计:
- TypeScript 严格模式
- 全面的错误处理
- 在生产应用中经过实战测试
- 内置监控和可观测性
- 所有主要平台的部署指南

### Seashore 是什么许可证?

MIT 许可证 - 免费用于商业和个人使用。

---

## 入门

### 开始需要什么?

**最低要求:**
- Node.js 20+
- TypeScript 5.7+
- LLM API 密钥(OpenAI、Anthropic 或 Google)

**推荐:**
- pnpm(比 npm 更快)
- VSCode 和 TypeScript 扩展
- PostgreSQL(用于 RAG 功能)

### 可以在 JavaScript 中使用 Seashore 吗?

可以,但**强烈推荐** TypeScript。Seashore 的 API 是为 TypeScript 设计的,你将失去:
- 类型安全
- 自动完成
- 内联文档
- 编译时错误检查

### 支持哪些 LLM 提供商?

当前支持:
- OpenAI(GPT-4o、GPT-4o-mini 等)
- Anthropic(Claude 3.5、Claude 3)
- Google(Gemini Pro、Gemini Ultra)

即将支持:
- Cohere
- Mistral AI
- 本地模型(Ollama、LM Studio)

### 需要所有包吗?

不需要!按需使用:

| 包 | 何时使用 |
|---|---------|
| `@seashore/core` | 始终(LLM 适配器、工具、嵌入) |
| `@seashore/agent` | 用于 agent 和工作流 |
| `@seashore/data` | 用于 RAG、向量搜索、PostgreSQL |
| `@seashore/platform` | 用于 MCP、护栏、部署 |
| `@seashore/react` | 用于 React 前端 |

---

## 开发

### 为什么导入需要 .js 扩展名?

Seashore 使用纯 ESM。在 ESM 中,相对导入**必须**包含文件扩展名。

```typescript
// ✅ 正确
import { createTool } from './utils.js'

// ❌ 错误
import { createTool } from './utils'
```

TypeScript 文件编译为 `.js`,所以导入引用输出文件。

### 可以使用 CommonJS 吗?

不可以。Seashore 仅支持 ESM。这提供了:
- 更好的 tree-shaking
- 更快的构建
- 现代 JavaScript 标准
- 更小的打包大小

如果需要 CommonJS,需要使用 esbuild 等打包器。

### 如何调试我的 agent?

```typescript
// 1. 启用调试模式
const agent = createReActAgent({
  llm,
  tools,
  debug: true,  // 记录每一步
});

// 2. 使用结构化日志
import { logger } from './logger.js';

logger.debug('Agent input', { message });
const result = await agent.run({ message });
logger.debug('Agent output', { result });

// 3. 检查工具调用
const tool = createTool({
  name: 'my_tool',
  // ...
  execute: async (params) => {
    console.log('Tool called with:', params);
    const result = await doWork(params);
    console.log('Tool returning:', result);
    return result;
  },
});
```

### 如何测试 agent?

```typescript
import { describe, it, expect } from 'vitest';
import { createReActAgent } from '@seashore/agent';

describe('Agent', () => {
  it('should use calculator tool', async () => {
    const agent = createReActAgent({
      llm: createLLMAdapter({
        provider: 'openai',
        apiKey: process.env.OPENAI_API_KEY,
      }),
      tools: [calculatorTool],
    });
    
    const result = await agent.run({
      message: 'What is 5 + 3?',
    });
    
    expect(result.message).toContain('8');
  });
});
```

要在不调用 LLM API 的情况下测试,模拟 LLM 适配器:

```typescript
import { vi } from 'vitest';

const mockLLM = {
  chat: vi.fn().mockResolvedValue({
    message: 'Mocked response',
    toolCalls: [],
  }),
};

const agent = createReActAgent({
  llm: mockLLM as any,
  tools: [],
});
```

---

## Agent 和工具

### 我的 agent 不使用我创建的工具

**常见原因:**

1. **工具描述不清楚**
   ```typescript
   // ❌ 不好
   description: 'Does stuff'
   
   // ✅ 好
   description: 'Searches weather data for any city worldwide. Use this when user asks about weather, temperature, or forecast.'
   ```

2. **系统提示冲突**
   ```typescript
   // ❌ 阻止工具使用
   systemPrompt: 'Answer directly without external tools'
   
   // ✅ 鼓励工具使用
   systemPrompt: 'Use available tools to provide accurate information'
   ```

3. **错误的模型** - 有些模型不支持工具调用。使用 GPT-4o、Claude 3 或 Gemini Pro。

### agent 应该有多少工具?

**建议:** 每个 agent 3-10 个工具。

**太少(<3):** Agent 可能无法处理多样化的任务。

**太多(>15):** LLM 会对使用哪个工具感到困惑。

**最佳实践:** 创建具有专注工具集的专业 agent。

```typescript
// ❌ 一个 agent 有 20 个工具
const agent = createReActAgent({
  llm,
  tools: [...20 tools],
});

// ✅ 多个专业 agent
const weatherAgent = createReActAgent({
  llm,
  tools: [getWeather, getForecast],
});

const financeAgent = createReActAgent({
  llm,
  tools: [getStockPrice, getExchangeRate],
});
```

### 工具可以调用其他工具吗?

不能直接调用,但可以:

1. **使用工作流**链接工具执行
2. **从工具调用 agent**(用于复杂逻辑)

```typescript
const complexTool = createTool({
  name: 'complex_analysis',
  description: 'Performs complex multi-step analysis',
  parameters: z.object({ query: z.string() }),
  execute: async ({ query }) => {
    // 使用子 agent
    const analyst = createReActAgent({
      llm,
      tools: [toolA, toolB, toolC],
    });
    
    const result = await analyst.run({ message: query });
    return result.message;
  },
});
```

### 如何处理工具错误?

```typescript
const tool = createTool({
  name: 'api_call',
  description: 'Calls external API',
  parameters: z.object({ query: z.string() }),
  execute: async ({ query }) => {
    try {
      const response = await fetch(`https://api.example.com?q=${query}`);
      
      if (!response.ok) {
        // 返回错误消息(agent 会看到它)
        return `API returned error: ${response.status}`;
      }
      
      const data = await response.json();
      return JSON.stringify(data);
      
    } catch (error) {
      // 返回错误消息
      return `Failed to call API: ${error.message}`;
    }
  },
});
```

Agent 会看到错误消息并决定如何继续(重试、使用不同工具、通知用户等)。

---

## RAG 和向量搜索

### 需要 pgvector 吗?

仅当您构建 RAG(检索增强生成)应用时需要。如果只使用基本聊天 agent,则不需要。

### 可以使用不同的向量数据库吗?

目前,Seashore 内置支持 pgvector(PostgreSQL)。对于其他数据库:

```typescript
// 您可以实现自己的适配器
import { createEmbeddingAdapter } from '@seashore/core';

const embedder = createEmbeddingAdapter({
  provider: 'openai',
  apiKey: process.env.OPENAI_API_KEY,
});

// 与 Pinecone、Weaviate 等一起使用
const embedding = await embedder.embed(text);
await pinecone.upsert([{ id: '1', values: embedding }]);
```

我们正在开发官方适配器:
- Pinecone
- Weaviate
- Qdrant
- ChromaDB

### 如何为 RAG 选择分块大小?

**一般准则:**

| 使用场景 | 分块大小 | 重叠 |
|----------|----------|------|
| 简短问答 | 200-400 字符 | 50-100 |
| 一般文档 | 500-1000 字符 | 100-200 |
| 长篇内容 | 1000-2000 字符 | 200-400 |

```typescript
const chunks = chunkText(document, {
  size: 500,      // 每块字符数
  overlap: 100,   // 块之间的重叠
});

for (const chunk of chunks) {
  await rag.addDocument(chunk, metadata);
}
```

**测试和迭代** - 最佳大小取决于您的内容和用例。

---

## 部署

### 应该使用哪个部署平台?

取决于您的需求:

| 优先级 | 推荐平台 |
|--------|---------|
| 最快部署 | Cloudflare Workers |
| 最低成本(低流量) | AWS Lambda 或 Workers |
| 需要 PostgreSQL | Hono on VPS 或 Docker |
| 最大控制 | Docker + Kubernetes |
| 现有 AWS 设置 | AWS Lambda + ECS |

查看[部署概览](../deployment/overview.md)了解详细对比。

### 可以将 Seashore 部署到 Vercel 吗?

可以,但有限制:

- **Vercel Functions:** 类似于 AWS Lambda
- **Edge Runtime:** 类似于 Cloudflare Workers(有限的 Node.js API)
- **无长时间运行进程:** 最长 60s 执行时间

```typescript
// api/chat.ts
import { createReActAgent } from '@seashore/agent';

export const config = {
  runtime: 'nodejs',  // 或 'edge'
};

export default async function handler(req, res) {
  const { message } = req.body;
  
  const agent = createReActAgent({
    llm: createLLMAdapter({
      provider: 'openai',
      apiKey: process.env.OPENAI_API_KEY,
    }),
    tools: [],
  });
  
  const result = await agent.run({ message });
  res.json(result);
}
```

### 如何在生产环境处理密钥?

**永远不要:**
- 硬编码密钥
- 将密钥提交到 git
- 记录密钥值

**应该:**
- 使用环境变量
- 使用密钥管理(AWS Secrets Manager 等)
- 定期轮换密钥

查看[环境变量指南](../deployment/environment.md)。

### 运行 Seashore 的成本是多少?

**主要成本: LLM API 调用**(通常占总成本的 90%+)

**成本示例:**

| 场景 | LLM 成本/月 | 基础设施 | 总计 |
|------|-------------|----------|------|
| 1K 请求 | $5 | $0(免费层) | $5 |
| 100K 请求 | $500 | $5-50 | $505-550 |
| 1M 请求 | $5,000 | $50-500 | $5,050-5,500 |

**降低成本的技巧:**
- 使用更便宜的模型(GPT-4o-mini vs GPT-4o)
- 缓存常见查询
- 优化提示以使用更少 token
- 设置最大 token 限制

---

## 监控和调试

### 如何跟踪 LLM 成本?

```typescript
const PRICING = {
  'gpt-4o': { input: 0.005 / 1000, output: 0.015 / 1000 },
  'gpt-4o-mini': { input: 0.00015 / 1000, output: 0.0006 / 1000 },
};

let totalCost = 0;

app.post('/api/chat', async (c) => {
  const result = await agent.run({ message });
  
  const cost = 
    result.tokensPrompt * PRICING['gpt-4o'].input +
    result.tokensCompletion * PRICING['gpt-4o'].output;
  
  totalCost += cost;
  
  logger.info('Request cost', { cost, totalCost });
  
  return c.json(result);
});
```

查看[监控指南](../deployment/monitoring.md)了解全面的成本跟踪。

### 应该监控哪些指标?

**必需:**
- 错误率
- 响应时间(p50、p95、p99)
- LLM token 使用和成本
- 请求量

**重要:**
- 工具调用频率
- Agent 迭代次数
- 数据库查询时间
- 内存使用

**可选:**
- 用户满意度(反馈)
- 工具成功率
- 会话长度

查看[监控指南](../deployment/monitoring.md)了解实现。

---

## 性能

### 如何让我的 agent 更快?

1. **使用流式传输**
   ```typescript
   const stream = await agent.stream({ message });
   // 用户立即看到响应
   ```

2. **减少最大迭代次数**
   ```typescript
   const agent = createReActAgent({
     llm,
     tools,
     maxIterations: 3,  // 而不是 5
   });
   ```

3. **优化工具**
   - 并行 API 调用
   - 缓存结果
   - 添加超时

4. **使用更快的模型**
   - GPT-4o-mini 而不是 GPT-4o
   - Claude Haiku 而不是 Sonnet

5. **减少上下文**
   ```typescript
   const agent = createReActAgent({
     llm,
     tools,
     maxHistoryLength: 10,  // 仅保留最后 10 条消息
   });
   ```

### 为什么我的第一个请求很慢?

**冷启动** - 发生在:
- Lambda 函数启动
- Cloudflare Worker 初始化
- Docker 容器启动

**解决方案:**
- 接受它(通常 <1s)
- 使用预配置并发(Lambda)
- 使用健康检查保持服务温暖
- 使用持久服务器上的 Hono(无冷启动)

---

## 社区

### 如何获取帮助?

1. **搜索文档** - 查看[文档](../README.md)
2. **搜索问题** - [GitHub Issues](https://github.com/seashore/seashore/issues)
3. **查看 FAQ** - 你在这里!
4. **在 Discord 上提问** - [discord.gg/seashore](https://discord.gg/seashore)
5. **创建问题** - 用于 bug 或功能请求

### 如何贡献?

查看[贡献指南](../../CONTRIBUTING.md)。

贡献方式:
- 报告 bug
- 建议功能
- 改进文档
- 提交 pull request
- 在 Discord 上帮助他人
- 分享您的项目

### 在哪里可以找到示例?

- [示例目录](../../examples/)
- [GitHub Discussions](https://github.com/seashore/seashore/discussions)
- [社区展示](https://github.com/seashore/seashore/discussions/categories/show-and-tell)

---

## 故障排除

**还有问题?**

- [常见问题 →](./common-issues.md)
- [迁移指南 →](../migration/migration-guide.md)
- [GitHub Discussions](https://github.com/seashore/seashore/discussions)
- [Discord 社区](https://discord.gg/seashore)
