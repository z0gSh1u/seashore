# Seashore 🌊

**基于 TanStack AI 构建的 TypeScript 优先 AI 框架**

[English](README.md) | 简体中文

Seashore 为构建生产级 AI 智能体提供模块化、类型安全的基础设施，包含工作流编排、RAG 能力和部署基础设施。

[![Version](https://img.shields.io/npm/v/@seashore/core.svg)](https://www.npmjs.org/package/@seashore/core)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

## 特性

- **🤖 灵活的智能体** - 基于 ReAct 模式，支持工具调用和结构化输出
- **🔄 工作流编排** - 基于 DAG 的并行执行引擎
- **🧠 RAG 集成** - PostgreSQL + pgvector 混合搜索（语义 + BM25）
- **🔌 MCP 支持** - 模型上下文协议客户端集成
- **🛡️ 安全防护** - 内置护栏（自定义 + 基于大模型）
- **📊 评估系统** - 自定义指标和大模型评测套件
- **🚀 部署就绪** - Hono 中间件支持 SSE 流式传输
- **⚛️ React Hooks** - 一等公民的 React 集成

## 包

| 包                                        | 描述                           | 版本                                                                                                            |
| ----------------------------------------- | ------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| [@seashore/core](./packages/core)         | LLM 适配器、嵌入、工具、上下文 | [![npm](https://img.shields.io/npm/v/@seashore/core.svg)](https://www.npmjs.org/package/@seashore/core)         |
| [@seashore/agent](./packages/agent)       | ReAct 智能体和 DAG 工作流      | [![npm](https://img.shields.io/npm/v/@seashore/agent.svg)](https://www.npmjs.org/package/@seashore/agent)       |
| [@seashore/data](./packages/data)         | PostgreSQL 存储、pgvector、RAG | [![npm](https://img.shields.io/npm/v/@seashore/data.svg)](https://www.npmjs.org/package/@seashore/data)         |
| [@seashore/platform](./packages/platform) | MCP、护栏、评估、部署          | [![npm](https://img.shields.io/npm/v/@seashore/platform.svg)](https://www.npmjs.org/package/@seashore/platform) |
| [@seashore/react](./packages/react)       | 流式聊天 React hooks           | [![npm](https://img.shields.io/npm/v/@seashore/react.svg)](https://www.npmjs.org/package/@seashore/react)       |

## 快速开始

### 安装

```bash
# 核心智能体功能
npm install @seashore/core @seashore/agent

# 添加 RAG 能力
npm install @seashore/data

# 添加平台特性（MCP、护栏、部署）
npm install @seashore/platform

# 添加 React hooks
npm install @seashore/react
```

### 基础 ReAct 智能体

```typescript
import { createLLMAdapter, createTool } from '@seashore/core';
import { createReActAgent } from '@seashore/agent';

// 设置 LLM
const llm = createLLMAdapter({
  provider: 'openai',
  model: 'gpt-4o',
  apiKey: process.env.OPENAI_API_KEY,
});

// 创建工具
const weatherTool = createTool({
  name: 'get_weather',
  description: '获取指定地点的当前天气',
  parameters: z.object({
    location: z.string(),
  }),
  execute: async ({ location }) => {
    return `${location}的天气：72°F，晴天`;
  },
});

// 创建智能体
const agent = createReActAgent({
  llm,
  tools: [weatherTool],
  systemPrompt: '你是一个有用的天气助手。',
});

// 运行
const result = await agent.run({
  message: '旧金山的天气怎么样？',
});

console.log(result.message);
```

### DAG 工作流

```typescript
import { createWorkflow, createStep } from '@seashore/agent';

const workflow = createWorkflow({
  name: 'data-pipeline',
  steps: [
    createStep({
      id: 'fetch',
      fn: async () => ({ data: [1, 2, 3] }),
    }),
    createStep({
      id: 'process',
      fn: async ({ fetch }) => fetch.data.map((x) => x * 2),
      dependencies: ['fetch'],
    }),
    createStep({
      id: 'save',
      fn: async ({ process }) => {
        console.log('已保存：', process);
      },
      dependencies: ['process'],
    }),
  ],
});

await workflow.execute();
```

### RAG 管道

```typescript
import { createEmbeddingAdapter } from '@seashore/core';
import { createVectorDB, createRAGPipeline } from '@seashore/data';

// 设置嵌入模型
const embedder = createEmbeddingAdapter({
  provider: 'openai',
  model: 'text-embedding-3-small',
  apiKey: process.env.OPENAI_API_KEY,
});

// 创建向量数据库
const vectorDB = createVectorDB({
  connectionString: process.env.DATABASE_URL,
});

// 创建 RAG 管道
const rag = createRAGPipeline({
  embedder,
  vectorDB,
  chunkSize: 512,
  chunkOverlap: 50,
});

// 索引文档
await rag.indexDocuments([
  { id: '1', content: 'TypeScript 是 JavaScript 的类型化超集。' },
  { id: '2', content: 'React 是用于构建用户界面的 JavaScript 库。' },
]);

// 检索
const results = await rag.retrieve({
  query: '什么是 TypeScript？',
  topK: 3,
  hybridAlpha: 0.5, // 0.5 = 平衡的语义 + 关键词搜索
});
```

### 使用 Hono 部署

```typescript
import { Hono } from 'hono';
import { createAgentMiddleware } from '@seashore/platform';
import { createReActAgent } from '@seashore/agent';

const app = new Hono();

const agent = createReActAgent({
  llm: createLLMAdapter({ provider: 'openai', model: 'gpt-4o' }),
  tools: [weatherTool],
});

app.post('/chat', createAgentMiddleware({ agent }));

export default app;
```

### React 集成

```typescript
import { useSeashorChat } from '@seashore/react';

function ChatComponent() {
  const { messages, input, setInput, sendMessage, isLoading } = useSeashorChat({
    endpoint: '/api/chat',
  });

  return (
    <div>
      {messages.map((msg, i) => (
        <div key={i}>{msg.content}</div>
      ))}
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        disabled={isLoading}
      />
      <button onClick={sendMessage}>发送</button>
    </div>
  );
}
```

## 架构

Seashore 构建为模块化 monorepo，职责分离清晰：

```
@seashore/core       → 基础工具（LLM、嵌入、工具）
        ↓
@seashore/agent      → 智能体实现（ReAct、工作流）
        ↓
@seashore/data       → 数据持久化和 RAG
        ↓
@seashore/platform   → 平台服务（MCP、护栏、部署）
        ↓
@seashore/react      → React 集成
```

每个包都可以独立使用或组合使用。

## 为什么选择 Seashore？

### 对比 LangChain

- **类型安全**：完整的 TypeScript 支持，带类型推断
- **模块化**：按需使用
- **现代化**：基于 TanStack AI 构建（而非 Vercel AI SDK）
- **更简洁**：更少的抽象开销

### 对比 Vercel AI SDK

- **框架无关**：不绑定 Vercel/Next.js
- **生产就绪**：内置护栏、评估、MCP
- **工作流引擎**：包含 DAG 编排
- **内置 RAG**：开箱即用的 pgvector + 混合搜索

### 对比 LlamaIndex

- **TypeScript 优先**：不是 Python 移植版
- **更轻量**：聚焦核心功能，清晰的 API
- **TanStack AI**：利用 TanStack 生态系统

## 开发

```bash
# 安装依赖
pnpm install

# 运行测试
pnpm nx run-many -t test

# 构建所有包
pnpm nx run-many -t build

# 运行单个包的测试
pnpm --filter @seashore/core test
```

## 系统要求

- Node.js 18+
- pnpm 9+
- TypeScript 5.7+
- PostgreSQL 15+（用于 @seashore/data）
- pgvector 扩展（用于向量搜索）

## 文档

- [设计理念](./docs/plans/2026-02-10-seashore-framework-design.md)
- [实现计划](./docs/plans/2026-02-10-seashore-implementation-plan.md)
- [API 文档](#)（即将推出）

## 示例

查看 [examples](./examples) 目录获取完整应用示例：

- [简单 ReAct 智能体](./examples/basic-agent)
- [DAG 工作流](./examples/workflow)
- [RAG 聊天机器人](./examples/rag-chatbot)
- [全栈应用](./examples/fullstack-app)

## 贡献

欢迎贡献！请先阅读我们的[贡献指南](./CONTRIBUTING.md)。

## 许可证

MIT © Seashore 贡献者

## 致谢

基于以下项目构建：

- [TanStack AI](https://tanstack.com/ai) - 现代化 AI 框架
- [Drizzle ORM](https://orm.drizzle.team/) - 类型安全的 SQL
- [Hono](https://hono.dev/) - 快速 Web 框架
- [Vitest](https://vitest.dev/) - 快速测试运行器
- [Nx](https://nx.dev/) - Monorepo 工具
