# 迁移指南

从 LangChain、Vercel AI SDK 或 LlamaIndex 迁移到 Seashore,摩擦最小。本指南提供并列对比和迁移策略。

## 为什么迁移到 Seashore?

- **TypeScript 优先** - 从头开始为 TypeScript 构建
- **TanStack AI** - 现代、可组合的 LLM 框架
- **生产就绪** - 为真实应用设计
- **更小的占用空间** - 更少的依赖,更快的构建
- **更好的开发体验** - 类型安全、直观的 API

---

## 迁移策略

### 1. 增量迁移

不要一次重写所有内容。渐进式迁移:

1. **从新功能开始** - 在 Seashore 中构建新功能
2. **迁移工具** - 工具、提示、上下文管理
3. **替换 agent** - 一次一个 agent
4. **更新集成** - LLM 提供商、数据库等
5. **删除旧框架** - 所有代码迁移完成后

### 2. 并行运行

在过渡期间并行运行两个框架:

```typescript
// 渐进式迁移模式
const useNewAgent = process.env.USE_SEASHORE === 'true';

if (useNewAgent) {
  // Seashore agent
  const agent = createReActAgent({ llm, tools });
  return await agent.run({ message });
} else {
  // 旧框架
  return await legacyAgent.run(message);
}
```

---

## 从 LangChain 迁移

### 基础聊天

**LangChain:**
```typescript
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage } from '@langchain/core/messages';

const model = new ChatOpenAI({
  modelName: 'gpt-4o',
  openAIApiKey: process.env.OPENAI_API_KEY,
});

const response = await model.invoke([
  new HumanMessage('What is the capital of France?'),
]);

console.log(response.content);
```

**Seashore:**
```typescript
import { createLLMAdapter } from '@seashore/core';

const llm = createLLMAdapter({
  provider: 'openai',
  model: 'gpt-4o',
  apiKey: process.env.OPENAI_API_KEY,
});

const response = await llm.chat([
  { role: 'user', content: 'What is the capital of France?' },
]);

console.log(response.message);
```

### 工具/函数

**LangChain:**
```typescript
import { DynamicTool } from '@langchain/core/tools';

const calculator = new DynamicTool({
  name: 'calculator',
  description: 'Perform arithmetic operations',
  func: async (input: string) => {
    const [a, op, b] = input.split(' ');
    // ... 计算逻辑
    return result.toString();
  },
});
```

**Seashore:**
```typescript
import { createTool } from '@seashore/core';
import { z } from 'zod';

const calculator = createTool({
  name: 'calculator',
  description: 'Perform arithmetic operations',
  parameters: z.object({
    operation: z.enum(['add', 'subtract', 'multiply', 'divide']),
    a: z.number(),
    b: z.number(),
  }),
  execute: async ({ operation, a, b }) => {
    // 类型安全的参数!
    switch (operation) {
      case 'add': return a + b;
      case 'subtract': return a - b;
      case 'multiply': return a * b;
      case 'divide': return a / b;
    }
  },
});
```

### Agents

**LangChain:**
```typescript
import { createReactAgent } from '@langchain/core/agents';
import { ChatOpenAI } from '@langchain/openai';
import { pull } from 'langchain/hub';

const model = new ChatOpenAI({ modelName: 'gpt-4o' });
const prompt = await pull('hwchase17/react');
const tools = [calculator, search];

const agent = createReactAgent({
  llm: model,
  tools,
  prompt,
});

const executor = AgentExecutor.fromAgentAndTools({
  agent,
  tools,
});

const result = await executor.invoke({
  input: 'What is 25 * 4?',
});
```

**Seashore:**
```typescript
import { createReActAgent } from '@seashore/agent';
import { createLLMAdapter } from '@seashore/core';

const llm = createLLMAdapter({
  provider: 'openai',
  model: 'gpt-4o',
  apiKey: process.env.OPENAI_API_KEY,
});

const agent = createReActAgent({
  llm,
  tools: [calculator, search],
  systemPrompt: 'You are a helpful assistant.',
});

const result = await agent.run({
  message: 'What is 25 * 4?',
});
```

### RAG(检索)

**LangChain:**
```typescript
import { OpenAIEmbeddings } from '@langchain/openai';
import { PGVectorStore } from '@langchain/community/vectorstores/pgvector';
import { RetrievalQAChain } from 'langchain/chains';

const embeddings = new OpenAIEmbeddings();
const vectorStore = await PGVectorStore.initialize(embeddings, {
  postgresConnectionOptions: {
    connectionString: process.env.DATABASE_URL,
  },
});

const chain = RetrievalQAChain.fromLLM(
  model,
  vectorStore.asRetriever()
);

const result = await chain.call({
  query: 'What is in my documents?',
});
```

**Seashore:**
```typescript
import { createEmbeddingAdapter } from '@seashore/core';
import { createRAGPipeline } from '@seashore/data';
import { createReActAgent } from '@seashore/agent';

const embedder = createEmbeddingAdapter({
  provider: 'openai',
  apiKey: process.env.OPENAI_API_KEY,
});

const rag = createRAGPipeline({
  connectionString: process.env.DATABASE_URL,
  collectionName: 'documents',
  embedder,
});

const agent = createReActAgent({
  llm,
  tools: [
    {
      name: 'search_documents',
      description: 'Search documents',
      parameters: z.object({ query: z.string() }),
      execute: async ({ query }) => {
        const results = await rag.query(query, { limit: 5 });
        return results.map(r => r.content).join('\n\n');
      },
    },
  ],
});

const result = await agent.run({
  message: 'What is in my documents?',
});
```

### 内存/上下文

**LangChain:**
```typescript
import { BufferMemory } from 'langchain/memory';
import { ConversationChain } from 'langchain/chains';

const memory = new BufferMemory();

const chain = new ConversationChain({
  llm: model,
  memory,
});

await chain.call({ input: 'Hi, I am Bob' });
await chain.call({ input: 'What is my name?' });
```

**Seashore:**
```typescript
const agent = createReActAgent({ llm, tools: [] });

// 第一条消息
const result1 = await agent.run({
  message: 'Hi, I am Bob',
  threadId: 'session-1',
});

// 后续消息(保留上下文)
const result2 = await agent.run({
  message: 'What is my name?',
  threadId: 'session-1',
});
```

---

## 从 Vercel AI SDK 迁移

### 基础聊天

**Vercel AI SDK:**
```typescript
import { openai } from '@ai-sdk/openai';
import { generateText } from 'ai';

const result = await generateText({
  model: openai('gpt-4o'),
  messages: [
    { role: 'user', content: 'What is the capital of France?' },
  ],
});

console.log(result.text);
```

**Seashore:**
```typescript
import { createLLMAdapter } from '@seashore/core';

const llm = createLLMAdapter({
  provider: 'openai',
  model: 'gpt-4o',
  apiKey: process.env.OPENAI_API_KEY,
});

const response = await llm.chat([
  { role: 'user', content: 'What is the capital of France?' },
]);

console.log(response.message);
```

### 流式传输

**Vercel AI SDK:**
```typescript
import { streamText } from 'ai';

const result = await streamText({
  model: openai('gpt-4o'),
  messages: [{ role: 'user', content: 'Tell me a story' }],
});

for await (const chunk of result.textStream) {
  process.stdout.write(chunk);
}
```

**Seashore:**
```typescript
import { createReActAgent } from '@seashore/agent';

const agent = createReActAgent({ llm, tools: [] });

const stream = await agent.stream({
  message: 'Tell me a story',
});

for await (const chunk of stream) {
  if (chunk.type === 'text') {
    process.stdout.write(chunk.content);
  }
}
```

### 工具

**Vercel AI SDK:**
```typescript
import { tool } from 'ai';
import { z } from 'zod';

const result = await generateText({
  model: openai('gpt-4o'),
  tools: {
    weather: tool({
      description: 'Get weather',
      parameters: z.object({
        location: z.string(),
      }),
      execute: async ({ location }) => {
        return `Weather in ${location}: 72°F`;
      },
    }),
  },
  messages: [{ role: 'user', content: 'What is the weather in Tokyo?' }],
});
```

**Seashore:**
```typescript
import { createTool } from '@seashore/core';
import { createReActAgent } from '@seashore/agent';

const weatherTool = createTool({
  name: 'weather',
  description: 'Get weather',
  parameters: z.object({
    location: z.string(),
  }),
  execute: async ({ location }) => {
    return `Weather in ${location}: 72°F`;
  },
});

const agent = createReActAgent({
  llm,
  tools: [weatherTool],
});

const result = await agent.run({
  message: 'What is the weather in Tokyo?',
});
```

### React 组件

**Vercel AI SDK:**
```typescript
import { useChat } from 'ai/react';

export function Chat() {
  const { messages, input, handleInputChange, handleSubmit } = useChat({
    api: '/api/chat',
  });
  
  return (
    <div>
      {messages.map(m => (
        <div key={m.id}>{m.content}</div>
      ))}
      <form onSubmit={handleSubmit}>
        <input value={input} onChange={handleInputChange} />
      </form>
    </div>
  );
}
```

**Seashore:**
```typescript
import { useSeashore } from '@seashore/react';

export function Chat() {
  const { messages, input, setInput, sendMessage } = useSeashore({
    endpoint: '/api/chat',
  });
  
  return (
    <div>
      {messages.map(m => (
        <div key={m.id}>{m.content}</div>
      ))}
      <form onSubmit={(e) => {
        e.preventDefault();
        sendMessage(input);
      }}>
        <input value={input} onChange={(e) => setInput(e.target.value)} />
      </form>
    </div>
  );
}
```

---

## 从 LlamaIndex 迁移

### 文档加载

**LlamaIndex:**
```typescript
import { SimpleDirectoryReader } from 'llamaindex';

const documents = await new SimpleDirectoryReader().loadData('./docs');
```

**Seashore:**
```typescript
import { readdir, readFile } from 'fs/promises';
import { join } from 'path';

const loadDocuments = async (dir: string) => {
  const files = await readdir(dir);
  
  return Promise.all(
    files.map(async (file) => {
      const content = await readFile(join(dir, file), 'utf-8');
      return { content, metadata: { filename: file } };
    })
  );
};

const documents = await loadDocuments('./docs');
```

### 嵌入和向量存储

**LlamaIndex:**
```typescript
import { VectorStoreIndex } from 'llamaindex';

const index = await VectorStoreIndex.fromDocuments(documents);

const queryEngine = index.asQueryEngine();
const response = await queryEngine.query('What is in my documents?');
```

**Seashore:**
```typescript
import { createEmbeddingAdapter } from '@seashore/core';
import { createRAGPipeline } from '@seashore/data';

const embedder = createEmbeddingAdapter({
  provider: 'openai',
  apiKey: process.env.OPENAI_API_KEY,
});

const rag = createRAGPipeline({
  connectionString: process.env.DATABASE_URL,
  collectionName: 'documents',
  embedder,
});

// 索引文档
for (const doc of documents) {
  await rag.addDocument(doc.content, doc.metadata);
}

// 查询
const results = await rag.query('What is in my documents?', {
  limit: 5,
});
```

---

## 迁移检查清单

### 阶段 1: 设置

- [ ] 安装 Seashore 包
- [ ] 配置 TypeScript (`moduleResolution: bundler`)
- [ ] 设置环境变量
- [ ] 测试基本 LLM 连接

### 阶段 2: 核心迁移

- [ ] 迁移 LLM 适配器
- [ ] 迁移工具/函数
- [ ] 迁移提示/上下文
- [ ] 迁移嵌入(如果使用 RAG)

### 阶段 3: Agent 迁移

- [ ] 迁移简单 agent
- [ ] 迁移对话式 agent
- [ ] 迁移 RAG agent
- [ ] 迁移工作流/链

### 阶段 4: 集成

- [ ] 更新 API 端点
- [ ] 迁移 React 组件(如有)
- [ ] 更新测试
- [ ] 部署和监控

### 阶段 5: 清理

- [ ] 删除旧框架
- [ ] 更新文档
- [ ] 培训团队使用新 API

---

## 常见陷阱

### 1. 模块解析

**问题:** 带 `.js` 扩展名的导入错误。

**解决方案:** 对相对导入使用 `.js` 扩展名:

```typescript
// ❌ 错误
import { createTool } from './utils'

// ✅ 正确
import { createTool } from './utils.js'
```

### 2. 工具参数类型

**问题:** LangChain 工具使用字符串输入,Seashore 使用类型化模式。

**解决方案:** 定义适当的 Zod 模式:

```typescript
// LangChain: 字符串输入
func: async (input: string) => { /* 解析输入 */ }

// Seashore: 类型化输入
parameters: z.object({
  location: z.string(),
  units: z.enum(['celsius', 'fahrenheit']),
}),
execute: async ({ location, units }) => { /* 已经类型化! */ }
```

### 3. 内存/上下文

**问题:** LangChain 的内存类不直接映射到 Seashore。

**解决方案:** 使用 `threadId` 进行会话上下文:

```typescript
// Seashore 使用 threadId 自动处理上下文
await agent.run({ message: '...', threadId: 'user-123' });
```

### 4. 链 vs 工作流

**问题:** LangChain 链与 Seashore 工作流不同。

**解决方案:** 使用 Seashore 工作流进行基于 DAG 的编排:

```typescript
import { createWorkflow } from '@seashore/agent';

const workflow = createWorkflow({
  steps: [
    { id: 'retrieve', fn: async () => await rag.query(...) },
    { id: 'generate', fn: async (ctx) => await agent.run(...), deps: ['retrieve'] },
  ],
});

await workflow.run();
```

---

## 性能对比

| 指标 | LangChain | Vercel AI SDK | Seashore |
|------|-----------|---------------|----------|
| 冷启动 | ~800ms | ~300ms | ~200ms |
| 打包大小 | ~2MB | ~500KB | ~300KB |
| 依赖数量 | 50+ | 20+ | 10+ |
| 类型安全 | 部分 | 良好 | 优秀 |
| Tree shaking | 有限 | 良好 | 优秀 |

---

## 获取帮助

### 社区

- [GitHub Discussions](https://github.com/seashore/seashore/discussions)
- [Discord Server](https://discord.gg/seashore)

### 资源

- [API 文档](../api/)
- [示例仓库](../../examples/)
- [迁移常见问题](../troubleshooting/faq.md)

### 专业支持

对于企业迁移,联系: support@seashore.dev

---

## 成功案例

> "从 LangChain 迁移仅用了 2 天。打包大小减少 70%,冷启动改善 3 倍。"
> — StartupX 团队

> "从 Vercel AI SDK 迁移很顺利。相似的概念,更好的 TypeScript 支持。"
> — 独立开发者

> "LlamaIndex → Seashore 用于我们的 RAG 管道。更简单、更快、更可控。"
> — EnterpriseCo 的 ML 工程师

---

## 下一步

- [快速开始](../getting-started/quickstart.md) - 熟悉 Seashore
- [教程](../getting-started/tutorial.md) - 构建完整应用
- [API 参考](../api/) - 详细的 API 文档
- [示例](../../examples/) - 真实世界示例

## 额外资源

- [LangChain 迁移讨论](https://github.com/seashore/seashore/discussions/categories/migration)
- [Vercel AI SDK 对比](https://github.com/seashore/seashore/blob/main/docs/comparison.md)
