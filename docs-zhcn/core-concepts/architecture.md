# 架构

Seashore 是一个**模块化、类型安全的 AI Agent 框架**,构建于 TanStack AI 之上。它提供了一整套工具,用于构建生产级 AI 应用程序,从简单的聊天机器人到复杂的多 Agent 工作流。

## 概览

Seashore 遵循**分层架构**,清晰地分离关注点:

```
┌─────────────────────────────────────────────────────────────┐
│                      Application Layer                      │
│              (Your AI application code)                     │
└─────────────────────────────────────────────────────────────┘
                             │
┌─────────────────────────────────────────────────────────────┐
│                  @seashore/platform                         │
│    MCP Integration · Guardrails · Evaluation · Deploy      │
└─────────────────────────────────────────────────────────────┘
                             │
┌─────────────────────────────────────────────────────────────┐
│                   @seashore/react                           │
│              React Hooks for Streaming UI                   │
└─────────────────────────────────────────────────────────────┘
                             │
┌──────────────────────────┬──────────────────────────────────┐
│    @seashore/agent       │       @seashore/data             │
│  ReAct Agents · DAG      │  Storage · VectorDB · RAG        │
│  Workflows · Orchestration│  pgvector · Hybrid Search       │
└──────────────────────────┴──────────────────────────────────┘
                             │
┌─────────────────────────────────────────────────────────────┐
│                    @seashore/core                           │
│     LLM Adapters · Embeddings · Tools · Context            │
│             (TanStack AI Foundation)                        │
└─────────────────────────────────────────────────────────────┘
                             │
┌─────────────────────────────────────────────────────────────┐
│                     External Services                       │
│  OpenAI · Anthropic · Gemini · PostgreSQL · MCP Servers    │
└─────────────────────────────────────────────────────────────┘
```

## 核心包

### @seashore/core

**基础层**,提供统一的 LLM 提供商接口和实用工具。

**职责:**
- OpenAI、Anthropic 和 Gemini 的 LLM 适配器工厂
- 向量生成的 Embedding 适配器
- 工具定义和工具包实用程序
- 上下文工程(系统提示词、Few-shot 学习)

**关键导出:**
```typescript
import {
  createLLMAdapter,      // LLM provider abstraction
  createEmbeddingAdapter, // Embedding generation
  createToolkit,         // Tool management
  systemPrompt,          // Prompt builder
  fewShotMessages,       // Few-shot examples
} from '@seashore/core'
```

**依赖:**
- `@tanstack/ai` - 核心 AI 抽象
- `@tanstack/ai-openai` - OpenAI 模型
- `@tanstack/ai-anthropic` - Claude 模型
- `@tanstack/ai-gemini` - Google Gemini 模型
- `zod` - 类型安全的 schema 验证

**设计原则:**
1. **提供商无关** - 所有 LLM 提供商统一 API
2. **类型安全** - 完整的 TypeScript 支持和 Zod schema
3. **零配置** - 合理的默认值,需要时可自定义
4. **纯 ESM** - 现代模块系统,使用 `.js` 导入

---

### @seashore/agent

**Agent 层**,提供能够推理和行动的智能角色。

**职责:**
- ReAct (推理 + 行动) Agent 实现
- 基于 DAG 的工作流编排
- 工具调用和迭代管理
- 护栏集成以确保安全

**关键导出:**
```typescript
import {
  createReActAgent,   // Agentic reasoning with tools
  createWorkflow,     // DAG workflow builder
  createStep,         // Workflow step definition
  DAG,               // Graph data structure
} from '@seashore/agent'
```

**依赖:**
- `@seashore/core` - LLM 适配器和工具
- `@tanstack/ai` - 聊天和流式 API
- `zod` - Schema 验证

**设计原则:**
1. **自主性** - Agent 迭代直到任务完成
2. **可观察** - 完整的 Agent 决策可见性
3. **可组合** - 将 Agent 链接成复杂工作流
4. **可控制** - 最大迭代次数、超时、中止信号

---

### @seashore/data

**持久化层**,用于存储、向量搜索和 RAG。

**职责:**
- 使用 Drizzle ORM 的 PostgreSQL 存储
- pgvector 集成用于语义搜索
- 混合搜索(向量 + 全文)
- 带有分块策略的 RAG 管道

**关键导出:**
```typescript
import {
  createStorageService,  // Thread and message persistence
  createVectorDBService, // pgvector hybrid search
  createRAG,            // RAG pipeline builder
  createChunker,        // Document chunking
} from '@seashore/data'
```

**依赖:**
- `@seashore/core` - Embedding 适配器
- `drizzle-orm` - 类型安全的 SQL ORM
- `zod` - Schema 验证

**设计原则:**
1. **类型安全的 SQL** - Drizzle ORM 提供编译时安全
2. **混合搜索** - 结合语义和关键词搜索
3. **灵活的分块** - 固定或递归策略
4. **可扩展** - 为生产工作负载优化

---

### @seashore/platform

**平台层**,用于生产部署和集成。

**职责:**
- Model Context Protocol (MCP) 服务器集成
- 输入/输出过滤的护栏
- 评估指标和测试套件
- 用于部署的 Hono 中间件

**关键导出:**
```typescript
import {
  connectMCP,             // MCP server connection
  createGuardrail,        // Custom guardrails
  createLLMGuardrail,     // LLM-based filtering
  createEvalSuite,        // Evaluation framework
  seashoreMiddleware,     // Production deployment
} from '@seashore/platform'
```

**依赖:**
- `@seashore/agent` - Agent 接口
- `@seashore/core` - LLM 适配器
- `@modelcontextprotocol/sdk` - MCP 客户端
- `hono` - Web 框架

**设计原则:**
1. **生产就绪** - 为真实世界部署构建
2. **默认安全** - 护栏防止有害输出
3. **可观察** - 内置指标和评估
4. **基于标准** - 使用 MCP 实现工具互操作性

---

### @seashore/react

**UI 层**,提供用于流式聊天界面的 React hooks。

**职责:**
- Agent 流式处理的 React hooks
- 消息历史管理
- 加载状态和错误处理
- TypeScript 优先的 API

**关键导出:**
```typescript
import {
  useChat,        // Chat with streaming
  useCompletion,  // Single completion
} from '@seashore/react'
```

**依赖:**
- `@seashore/agent` - Agent 接口
- `react` - React 18+

**设计原则:**
1. **流式优先** - 实时 token 流式处理
2. **声明式** - React 原生 API 模式
3. **类型安全** - 完整的 TypeScript 支持
4. **框架无关** - 核心逻辑是纯 JS

---

## 包依赖图

```mermaid
graph TD
    A[@seashore/core] --> TanStack[TanStack AI]
    B[@seashore/agent] --> A
    B --> TanStack
    C[@seashore/data] --> A
    D[@seashore/platform] --> A
    D --> B
    E[@seashore/react] --> B
    
    style A fill:#4CAF50
    style B fill:#2196F3
    style C fill:#FF9800
    style D fill:#9C27B0
    style E fill:#F44336
    style TanStack fill:#E0E0E0
```

**依赖规则:**
1. **无循环依赖** - 干净的单向流
2. **Core 是基础** - 所有包都依赖 `@seashore/core`
3. **Agent 是核心** - Platform 和 React 基于 agents 构建
4. **Data 是独立的** - 仅依赖 core

---

## 模块系统: 纯 ESM

Seashore 是**仅 ESM**(不支持 CommonJS)。

### 导入约定

**所有相对导入必须使用 `.js` 扩展名:**

```typescript
// ✅ 正确
import { createLLMAdapter } from './adapter.js'
import type { LLMProvider } from './types.js'

// ❌ 错误
import { createLLMAdapter } from './adapter'     // Missing .js
import { createLLMAdapter } from './adapter.ts'  // Don't use .ts
```

**导入顺序:**
1. 第三方导入(框架、库)
2. 内部导入(其他 @seashore 包)
3. 相对导入(同一包)
4. 仅类型导入(使用 `import type`)

```typescript
// ✅ 正确顺序
import { chat } from '@tanstack/ai'
import { createLLMAdapter } from '@seashore/core'
import { applyGuardrails } from './guardrails.js'
import type { AgentConfig } from './types.js'
```

### Package.json 要求

每个包必须指定:
```json
{
  "type": "module",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  }
}
```

---

## Monorepo 结构

Seashore 使用 **pnpm workspaces** 和 **Nx** 进行任务编排。

```
seashore/
├── packages/
│   ├── core/           # @seashore/core
│   ├── agent/          # @seashore/agent
│   ├── data/           # @seashore/data
│   ├── platform/       # @seashore/platform
│   └── react/          # @seashore/react
├── examples/           # Usage examples
├── docs/              # Documentation
├── tools/             # Build tools
├── pnpm-workspace.yaml
├── nx.json
└── package.json
```

### Workspace 依赖

包之间使用 `workspace:*` 相互引用:

```json
{
  "dependencies": {
    "@seashore/core": "workspace:*"
  }
}
```

### 构建系统

**构建所有包:**
```bash
pnpm nx run-many -t build
```

**构建单个包:**
```bash
pnpm --filter @seashore/core build
```

**Nx 缓存:**
- 缓存未更改包的构建输出
- 加速增量构建
- 可以使用 `NX_DAEMON=false` 禁用

---

## 类型安全

Seashore 使用**严格的 TypeScript** 配置构建。

### 严格模式设置

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true
  }
}
```

### 类型安全模式

**穷举性 switch 检查:**
```typescript
function handleProvider(provider: LLMProvider) {
  switch (provider) {
    case 'openai': return createOpenaiChat(...)
    case 'anthropic': return createAnthropicChat(...)
    case 'gemini': return createGeminiChat(...)
    default: {
      const _exhaustive: never = provider
      throw new Error(`Unsupported: ${String(_exhaustive)}`)
    }
  }
}
```

**仅类型导出:**
```typescript
// 分别导出类型
export type { LLMAdapterConfig, LLMProvider }

// 分别导入类型
import type { Message } from './types.js'
```

**Zod 用于运行时验证:**
```typescript
import { z } from 'zod'

const toolSchema = z.object({
  name: z.string(),
  parameters: z.record(z.unknown()),
})

// 从 schema 推断类型
type Tool = z.infer<typeof toolSchema>
```

---

## 测试策略

Seashore 使用 **Vitest** 进行快速的、TypeScript 原生测试。

### 测试结构

**同位置:**
```
src/
├── adapter.ts
├── adapter.test.ts    # 测试文件紧邻实现
├── types.ts
└── index.ts
```

**测试模式:**
```typescript
import { describe, it, expect } from 'vitest'
import { createTool } from './toolkit.js'

describe('createTool', () => {
  it('should create a tool with required fields', () => {
    const tool = createTool({
      name: 'test',
      execute: async () => 'result'
    })
    expect(tool.name).toBe('test')
  })

  it('should throw when name is missing', () => {
    expect(() => createTool({} as any)).toThrow('name is required')
  })
})
```

### 运行测试

**所有包:**
```bash
pnpm nx run-many -t test
```

**单个包:**
```bash
pnpm --filter @seashore/core test
```

**特定测试文件:**
```bash
pnpm --filter @seashore/core test -- src/llm/adapter.test.ts
```

**Watch 模式:**
```bash
pnpm --filter @seashore/agent test:watch
```

---

## 错误处理

Seashore 遵循**快速失败原则**,提供描述性错误。

### 错误模式

**抛出描述性错误:**
```typescript
export function createTool(config: ToolConfig) {
  if (!config.name) {
    throw new Error('Tool name is required')
  }
  if (!config.execute) {
    throw new Error('Tool execute function is required')
  }
  return { ...config }
}
```

**在 JSDoc 中记录错误:**
```typescript
/**
 * Creates an LLM adapter.
 *
 * @throws {Error} If provider is not supported
 * @throws {Error} If apiKey is missing
 */
export function createLLMAdapter(config: LLMAdapterConfig) {
  // ...
}
```

**使用自定义错误类型:**
```typescript
export class WorkflowExecutionError extends Error {
  constructor(
    message: string,
    public readonly stepName: string,
    public readonly cause?: Error
  ) {
    super(message)
    this.name = 'WorkflowExecutionError'
  }
}
```

---

## 异步模式

Seashore 全面使用 **async/await**。

### 异步最佳实践

**始终使用 async/await:**
```typescript
// ✅ 正确
async function processSteps(steps: Step[]) {
  for (const step of steps) {
    await step.execute()
  }
}

// ❌ 错误
function processSteps(steps: Step[]) {
  return Promise.all(steps.map(step => step.execute()))
}
```

**并行执行:**
```typescript
// 并行执行独立步骤
const results = await Promise.all([
  fetchUserData(),
  fetchSettings(),
  fetchPreferences(),
])
```

**顺序执行:**
```typescript
// 顺序执行依赖步骤
for (const step of dependentSteps) {
  const result = await step.execute()
  context.state.set(step.name, result)
}
```

---

## 文档标准

所有导出的函数和类型必须有 **JSDoc 注释**。

### JSDoc 模板

```typescript
/**
 * 简要描述此函数的功能。
 *
 * 如果需要,可以更详细的解释。可以跨多行
 * 并包含重要的上下文或注意事项。
 *
 * @param config - 参数的描述
 * @returns 返回值的描述
 *
 * @throws {Error} 出错时
 *
 * @example
 * ```typescript
 * const agent = createReActAgent({
 *   model: () => createOpenaiChat('gpt-4'),
 *   systemPrompt: 'You are helpful',
 *   tools: [searchTool],
 * })
 *
 * const response = await agent.run([
 *   { role: 'user', content: 'Hello!' }
 * ])
 * ```
 */
export function createReActAgent(config: ReActAgentConfig): ReActAgent {
  // ...
}
```

---

## Barrel 导出

每个包使用 **barrel exports** 来控制公共 API。

### Index 文件模式

```typescript
// src/index.ts - 单一入口点
export { createReActAgent, createWorkflow } from './react-agent/index.js'
export type { ReActAgentConfig, AgentResponse } from './react-agent/index.js'

export { createStep, DAG } from './workflow/index.js'
export type { StepConfig, WorkflowResult } from './workflow/index.js'
```

**规则:**
1. 只导出应该是公共 API 的内容
2. 将相关导出分组在一起
3. 使用 `export type` 单独导出类型
4. 添加新功能时始终更新 `src/index.ts`

---

## 关键设计决策

### 为什么选择 TanStack AI?

- **统一 API** - 跨所有 LLM 提供商
- **流式优先** - 优秀的开发体验
- **类型安全** - 工具调用
- **框架无关** - 核心
- **社区驱动** - 开发

### 为什么选择纯 ESM?

- **现代标准** - 面向未来的模块系统
- **更好的 tree-shaking** - 更小的包大小
- **更简单的导入** - 没有 CJS/ESM 双模式复杂性
- **Node.js 原生** - 使用最新的 Node.js 特性

### 为什么选择 pnpm + Nx?

- **快速安装** - pnpm 的内容可寻址存储
- **高效缓存** - Nx 任务编排
- **Workspace protocol** - 简单的内部依赖
- **可扩展** - 处理大型 monorepos

### 为什么选择 Drizzle ORM?

- **类型安全的 SQL** - 编译时查询验证
- **零运行时开销** - SQL 的薄抽象层
- **pgvector 支持** - 原生向量扩展支持
- **迁移友好** - 内置 schema 演进

---

## 下一步

- **[Agents](./agents.md)** - 了解 ReAct agents 和工具调用
- **[Workflows](./workflows.md)** - 理解基于 DAG 的编排
- **[Tools](./tools.md)** - 为 agents 创建自定义工具
- **[LLM Adapters](./llm-adapters.md)** - 在提供商之间切换
- **[RAG](./rag.md)** - 构建检索增强生成管道
- **[Context](./context.md)** - 工程化有效的提示词

---

## 其他资源

- **[入门指南](../getting-started/installation.md)**
- **[API 参考](../api/README.md)**
- **[示例](../../examples/)**
- **[GitHub 仓库](https://github.com/seashore/seashore)**
