# 教程：构建完整的 AI 应用程序

在本教程中，你将构建一个完整的 AI 应用程序，包括：
- 带有自定义工具的 ReAct 智能体
- 用于文档知识的 RAG
- 使用 Hono 的 Web API
- React 前端

**时间：** 约 30 分钟  
**难度：** 初级到中级

## 前置要求

- Node.js 18+
- 已安装 pnpm
- OpenAI API 密钥
- PostgreSQL 和 pgvector（用于 RAG 部分）

## 第 1 部分：构建研究助手

让我们构建一个可以搜索网络并回答问题的智能体。

### 步骤 1：设置项目

```bash
mkdir research-assistant
cd research-assistant
pnpm init
pnpm add @seashore/core @seashore/agent tsx typescript zod
```

### 步骤 2：创建网络搜索工具

创建 `tools.ts`：

```typescript
import { z } from 'zod';

// 在本教程中，我们将模拟网络搜索
// 在生产环境中，使用 Serper、Brave Search 或 Tavily 等 API
export const webSearchTool = {
  name: 'web_search',
  description: 'Search the web for current information. Use this when you need up-to-date facts.',
  parameters: z.object({
    query: z.string().describe('The search query'),
  }),
  execute: async ({ query }: { query: string }) => {
    // 模拟搜索结果
    const mockResults = {
      'TypeScript': 'TypeScript is a strongly typed programming language that builds on JavaScript, developed by Microsoft.',
      'Seashore framework': 'Seashore is a TypeScript-first AI agent framework built on TanStack AI.',
      'default': `Search results for "${query}": [Various relevant articles and information]`,
    };
    
    for (const [key, value] of Object.entries(mockResults)) {
      if (query.toLowerCase().includes(key.toLowerCase())) {
        return value;
      }
    }
    
    return mockResults.default;
  },
};
```

### 步骤 3：创建智能体

创建 `agent.ts`：

```typescript
import { createLLMAdapter } from '@seashore/core';
import { createReActAgent } from '@seashore/agent';
import { webSearchTool } from './tools.js';

export function createResearchAgent() {
  const llm = createLLMAdapter({
    provider: 'openai',
    model: 'gpt-4o',
    apiKey: process.env.OPENAI_API_KEY!,
  });

  const agent = createReActAgent({
    llm,
    tools: [webSearchTool],
    systemPrompt: `You are a helpful research assistant. 
    Use the web_search tool to find current information when needed.
    Always cite your sources and be thorough in your responses.`,
    maxIterations: 5,
  });

  return agent;
}
```

### 步骤 4：测试智能体

创建 `index.ts`：

```typescript
import { createResearchAgent } from './agent.js';

async function main() {
  const agent = createResearchAgent();

  console.log('🔬 Research Assistant Ready!\n');

  // 测试查询
  const result = await agent.run({
    message: 'What is TypeScript and why is it useful?',
  });

  console.log('📝 Answer:', result.message);
  console.log('\n🔧 Tools used:', result.toolCalls?.length || 0);
}

main().catch(console.error);
```

运行它：
```bash
export OPENAI_API_KEY='sk-...'
tsx index.ts
```

## 第 2 部分：添加 RAG 用于文档知识

现在让我们为智能体提供来自文档的知识。

### 步骤 1：安装 Data 包

```bash
pnpm add @seashore/data drizzle-orm postgres
```

### 步骤 2：设置数据库

```bash
# 创建数据库
createdb research_assistant

# 启用 pgvector
psql research_assistant -c "CREATE EXTENSION IF NOT EXISTS vector;"
```

设置环境变量：
```bash
export DATABASE_URL="postgresql://localhost/research_assistant"
```

### 步骤 3：创建 RAG 管道

创建 `rag.ts`：

```typescript
import { createEmbeddingAdapter } from '@seashore/core';
import { createVectorDBService, createRAG } from '@seashore/data';

export async function setupRAG() {
  // 创建嵌入器
  const embedder = createEmbeddingAdapter({
    provider: 'openai',
    model: 'text-embedding-3-small',
    apiKey: process.env.OPENAI_API_KEY!,
  });

  // 创建向量数据库
  const vectorDB = await createVectorDBService({
    connectionString: process.env.DATABASE_URL!,
  });

  // 创建 RAG 管道
  const rag = createRAG({
    embedder,
    vectorDB,
    chunkSize: 512,
    chunkOverlap: 50,
  });

  return { rag, vectorDB };
}
```

### 步骤 4：索引文档

创建 `indexDocs.ts`：

```typescript
import { setupRAG } from './rag.js';

async function indexDocuments() {
  const { rag } = await setupRAG();

  // 关于 Seashore 的示例文档
  const docs = [
    {
      id: '1',
      content: `Seashore is a TypeScript-first AI agent framework built on TanStack AI. 
      It provides modular packages for building production AI agents with workflow orchestration, 
      RAG capabilities, and deployment infrastructure.`,
      metadata: { source: 'docs', title: 'Introduction' },
    },
    {
      id: '2',
      content: `Seashore includes five packages: core (LLM adapters, tools), 
      agent (ReAct agents, workflows), data (PostgreSQL + pgvector), 
      platform (MCP, guardrails, evaluation), and react (React hooks).`,
      metadata: { source: 'docs', title: 'Packages' },
    },
    {
      id: '3',
      content: `ReAct agents in Seashore use the Reasoning + Acting pattern. 
      They can call tools, observe results, and iterate until completing the task.`,
      metadata: { source: 'docs', title: 'ReAct Pattern' },
    },
  ];

  await rag.indexDocuments(docs);
  console.log('✅ Indexed', docs.length, 'documents');
}

indexDocuments().catch(console.error);
```

运行它：
```bash
tsx indexDocs.ts
```

### 步骤 5：创建知识检索工具

更新 `tools.ts`：

```typescript
import { setupRAG } from './rag.js';

let ragInstance: Awaited<ReturnType<typeof setupRAG>> | null = null;

export async function getRAGTool() {
  if (!ragInstance) {
    ragInstance = await setupRAG();
  }

  return {
    name: 'search_knowledge',
    description: 'Search the knowledge base for information about Seashore framework',
    parameters: z.object({
      query: z.string().describe('What to search for'),
    }),
    execute: async ({ query }: { query: string }) => {
      const results = await ragInstance!.rag.retrieve({
        query,
        topK: 3,
        hybridAlpha: 0.5,
      });

      if (results.length === 0) {
        return 'No relevant information found.';
      }

      return results
        .map(r => `[${r.metadata.title}] ${r.content}`)
        .join('\n\n');
    },
  };
}
```

### 步骤 6：使用 RAG 更新智能体

更新 `agent.ts`：

```typescript
import { webSearchTool } from './tools.js';
import { getRAGTool } from './tools.js';

export async function createResearchAgent() {
  const llm = createLLMAdapter({
    provider: 'openai',
    model: 'gpt-4o',
    apiKey: process.env.OPENAI_API_KEY!,
  });

  const knowledgeTool = await getRAGTool();

  const agent = createReActAgent({
    llm,
    tools: [webSearchTool, knowledgeTool],
    systemPrompt: `You are a helpful research assistant.
    Use search_knowledge for questions about Seashore framework.
    Use web_search for general information.
    Always cite your sources.`,
    maxIterations: 5,
  });

  return agent;
}
```

测试它：
```typescript
const agent = await createResearchAgent();

const result = await agent.run({
  message: 'How many packages does Seashore have and what are they?',
});

console.log(result.message);
// 智能体将使用知识库！
```

## 第 3 部分：构建 Web API

让我们将智能体暴露为 Web API。

### 步骤 1：安装 Hono

```bash
pnpm add hono @hono/node-server
```

### 步骤 2：创建 API

创建 `server.ts`：

```typescript
import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { createResearchAgent } from './agent.js';

const app = new Hono();

app.get('/', (c) => {
  return c.json({ message: 'Research Assistant API' });
});

app.post('/chat', async (c) => {
  try {
    const { message, threadId } = await c.req.json();
    
    if (!message) {
      return c.json({ error: 'Message is required' }, 400);
    }

    const agent = await createResearchAgent();
    const result = await agent.run({ message, threadId });

    return c.json({
      message: result.message,
      threadId: result.threadId,
      toolCalls: result.toolCalls?.length || 0,
    });
  } catch (error) {
    console.error(error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

const port = 3000;
console.log(`🚀 Server running on http://localhost:${port}`);
serve({ fetch: app.fetch, port });
```

运行它：
```bash
tsx server.ts
```

测试：
```bash
curl -X POST http://localhost:3000/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "What is Seashore?"}'
```

## 第 4 部分：构建 React 前端

### 步骤 1：创建 React 应用

```bash
pnpm create vite frontend --template react-ts
cd frontend
pnpm install
pnpm add @seashore/react
```

### 步骤 2：创建聊天组件

创建 `src/Chat.tsx`：

```typescript
import { useState } from 'react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export function Chat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const sendMessage = async () => {
    if (!input.trim()) return;

    const userMessage = { role: 'user' as const, content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const response = await fetch('http://localhost:3000/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: input }),
      });

      const data = await response.json();
      
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: data.message },
      ]);
    } catch (error) {
      console.error(error);
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: 'Error: Could not get response' },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: 20 }}>
      <h1>🔬 Research Assistant</h1>
      
      <div style={{ border: '1px solid #ddd', borderRadius: 8, padding: 20, marginBottom: 20, height: 400, overflowY: 'auto' }}>
        {messages.map((msg, i) => (
          <div key={i} style={{ marginBottom: 15 }}>
            <strong>{msg.role === 'user' ? '🧑 You' : '🤖 Assistant'}:</strong>
            <div style={{ marginTop: 5 }}>{msg.content}</div>
          </div>
        ))}
        {loading && <div>⏳ Thinking...</div>}
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
          placeholder="Ask a question..."
          style={{ flex: 1, padding: 10, fontSize: 16, borderRadius: 4, border: '1px solid #ddd' }}
          disabled={loading}
        />
        <button
          onClick={sendMessage}
          disabled={loading || !input.trim()}
          style={{ padding: '10px 20px', fontSize: 16, borderRadius: 4, background: '#007bff', color: 'white', border: 'none', cursor: 'pointer' }}
        >
          Send
        </button>
      </div>
    </div>
  );
}
```

更新 `src/App.tsx`：
```typescript
import { Chat } from './Chat';

function App() {
  return <Chat />;
}

export default App;
```

### 步骤 3：运行前端

```bash
pnpm dev
```

访问 `http://localhost:5173` 并与你的智能体聊天！

## 第 5 部分：添加流式传输

让我们使响应能够实时流式传输。

### 更新服务器

```typescript
app.post('/chat/stream', async (c) => {
  const { message } = await c.req.json();
  
  const agent = await createResearchAgent();
  const stream = await agent.stream({ message });

  return c.newResponse(
    new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            if (chunk.type === 'text') {
              controller.enqueue(new TextEncoder().encode(
                `data: ${JSON.stringify({ type: 'text', content: chunk.content })}\n\n`
              ));
            }
          }
          controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'));
          controller.close();
        } catch (error) {
          controller.error(error);
        }
      },
    }),
    {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    }
  );
});
```

## 总结

你已经构建了：
✅ 带有自定义工具的 ReAct 智能体  
✅ 使用 pgvector 的 RAG 管道  
✅ 使用 Hono 的 REST API  
✅ 带有聊天界面的 React 前端  
✅ 流式响应  

## 下一步

- **添加防护栏**：防止有害输出
- **添加评估**：测试智能体质量
- **部署**：使用 Docker 或无服务器
- **添加 MCP**：连接到外部工具

查看[指南](../guides)以获取更高级的模式！
