# 快速开始

5 分钟内构建你的第一个 Seashore 智能体。

## 1. 安装 Seashore

```bash
pnpm add @seashore/core @seashore/agent
```

## 2. 获取 API 密钥

Seashore 支持多个 LLM 提供商。选择一个：

- **OpenAI**: 从 [platform.openai.com](https://platform.openai.com/api-keys) 获取密钥
- **Anthropic**: 从 [console.anthropic.com](https://console.anthropic.com/) 获取密钥
- **Google**: 从 [aistudio.google.com](https://aistudio.google.com/app/apikey) 获取密钥

设置你的 API 密钥：
```bash
export OPENAI_API_KEY='sk-...'
```

## 3. 创建你的第一个智能体

创建 `agent.ts`：

```typescript
import { createLLMAdapter, createTool } from '@seashore/core';
import { createReActAgent } from '@seashore/agent';
import { z } from 'zod';

// 1. 设置 LLM
const llm = createLLMAdapter({
  provider: 'openai',
  model: 'gpt-4o',
  apiKey: process.env.OPENAI_API_KEY!,
});

// 2. 创建工具
const calculatorTool = createTool({
  name: 'calculator',
  description: 'Perform basic arithmetic operations',
  parameters: z.object({
    operation: z.enum(['add', 'subtract', 'multiply', 'divide']),
    a: z.number(),
    b: z.number(),
  }),
  execute: async ({ operation, a, b }) => {
    switch (operation) {
      case 'add': return a + b;
      case 'subtract': return a - b;
      case 'multiply': return a * b;
      case 'divide': return a / b;
    }
  },
});

// 3. 创建智能体
const agent = createReActAgent({
  llm,
  tools: [calculatorTool],
  systemPrompt: 'You are a helpful calculator assistant.',
});

// 4. 运行！
const result = await agent.run({
  message: 'What is 234 * 567?',
});

console.log(result.message);
// 输出: "234 * 567 = 132,678"
```

## 4. 运行你的智能体

```bash
tsx agent.ts
```

你会看到智能体：
1. 接收你的问题
2. 调用计算器工具
3. 返回结果

## 刚才发生了什么？

让我们分解这段代码：

### 1. LLM 适配器
```typescript
const llm = createLLMAdapter({
  provider: 'openai',
  model: 'gpt-4o',
  apiKey: process.env.OPENAI_API_KEY!,
});
```

这将为 OpenAI 的 GPT-4 创建一个适配器。你可以将 `provider` 切换为 `'anthropic'` 或 `'gemini'`，而无需更改任何其他代码。

### 2. 工具定义
```typescript
const calculatorTool = createTool({
  name: 'calculator',
  description: 'Perform basic arithmetic operations',
  parameters: z.object({...}),
  execute: async ({operation, a, b}) => {...},
});
```

工具是智能体可以调用的函数。`parameters` 模式使用 Zod 进行类型安全验证。

### 3. ReAct 智能体
```typescript
const agent = createReActAgent({
  llm,
  tools: [calculatorTool],
  systemPrompt: 'You are a helpful calculator assistant.',
});
```

**ReAct** 模式（推理 + 行动）允许智能体：
1. **推理** 要做什么
2. **行动** 通过调用工具
3. **观察** 结果
4. 重复直到任务完成

### 4. 运行智能体
```typescript
const result = await agent.run({
  message: 'What is 234 * 567?',
});
```

智能体处理你的消息，决定使用计算器工具，并返回结果。

## 尝试更多示例

### 示例 1：多个工具

```typescript
const weatherTool = createTool({
  name: 'get_weather',
  description: 'Get current weather for a location',
  parameters: z.object({
    location: z.string(),
  }),
  execute: async ({ location }) => {
    // 在生产环境中，调用天气 API
    return `Weather in ${location}: 72°F, sunny`;
  },
});

const agent = createReActAgent({
  llm,
  tools: [calculatorTool, weatherTool],
});

const result = await agent.run({
  message: 'What is the weather in Tokyo and what is 15 + 27?',
});
```

智能体将使用这两个工具来回答你的问题。

### 示例 2：流式传输

```typescript
const stream = await agent.stream({
  message: 'Calculate 123 * 456 and explain the steps',
});

for await (const chunk of stream) {
  if (chunk.type === 'text') {
    process.stdout.write(chunk.content);
  }
}
```

获取逐 token 的流式传输以实现实时响应。

### 示例 3：多轮对话

```typescript
const agent = createReActAgent({
  llm,
  tools: [calculatorTool],
});

// 第一条消息
const result1 = await agent.run({
  message: 'Calculate 100 + 200',
  threadId: 'session-1',
});

// 后续消息（使用上一条消息的上下文）
const result2 = await agent.run({
  message: 'Now multiply that by 3',
  threadId: 'session-1',
});

console.log(result2.message);
// 输出: "900 (which is 300 * 3)"
```

## 下一步

**构建工作流：**
[工作流编排指南](../core-concepts/workflows.md) - 使用基于 DAG 的执行来链接多个步骤。

**添加 RAG：**
[RAG 教程](./tutorial.md#adding-rag) - 为你的智能体提供文档知识。

**部署到生产环境：**
[部署指南](../deployment/overview.md) - 使用 Hono、Docker 或无服务器部署。

**探索示例：**
查看 [examples 目录](../../examples) 以获取完整的应用程序。

## 常用模式

### 模式：错误处理

```typescript
try {
  const result = await agent.run({
    message: 'What is 10 / 0?',
  });
} catch (error) {
  if (error instanceof ToolExecutionError) {
    console.error('Tool failed:', error.message);
  }
}
```

### 模式：超时

```typescript
const agent = createReActAgent({
  llm,
  tools: [calculatorTool],
  maxIterations: 5,  // 防止无限循环
  timeout: 30000,     // 30 秒超时
});
```

### 模式：结构化输出

```typescript
const result = await agent.run({
  message: 'Calculate 15 * 23',
  outputSchema: z.object({
    result: z.number(),
    steps: z.array(z.string()),
  }),
});

console.log(result.data);
// { result: 345, steps: ['Multiplied 15 by 23'] }
```

## 故障排除

**智能体不使用工具：**
- 确保你的工具 `description` 清楚地解释了它的作用
- LLM 根据描述决定何时使用工具

**"API key not found" 错误：**
- 设置你的环境变量：`export OPENAI_API_KEY='sk-...'`
- 或直接传递：`apiKey: 'sk-...'`

**TypeScript 错误：**
- 确保你使用的是 TypeScript 5.7+
- 检查你的 `tsconfig.json` 是否包含 `"moduleResolution": "bundler"`

如需更多帮助，请参见[故障排除](../troubleshooting/common-issues.md)。
