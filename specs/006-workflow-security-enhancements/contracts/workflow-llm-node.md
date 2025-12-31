# API Contracts: Workflow LLM Node

**Date**: 2026-01-01  
**Package**: `@seashore/workflow`

## createLLMNode

### 函数签名

```typescript
import type { WorkflowNode, WorkflowContext } from '@seashore/workflow';
import type { TextAdapter, TextAdapterConfig } from '@seashore/llm';
import type { ZodSchema } from 'zod';

/**
 * LLM 适配器类型联合
 */
export type LLMAdapter = TextAdapter | TextAdapterConfig;

/**
 * LLM 节点配置
 */
export interface LLMNodeConfig {
  /** 节点名称（工作流内唯一） */
  readonly name: string;

  /** 
   * LLM 适配器
   * 
   * @example 使用完整适配器
   * adapter: openaiText('gpt-4o', { baseURL: 'https://api.example.com/v1' })
   * 
   * @example 使用配置对象
   * adapter: { provider: 'openai', model: 'gpt-4o' }
   */
  readonly adapter: LLMAdapter;

  /** 静态或动态 prompt */
  readonly prompt?: string | ((input: unknown, ctx: WorkflowContext) => string | Promise<string>);

  /** 消息构建器（与 prompt 二选一） */
  readonly messages?: (
    input: unknown,
    ctx: WorkflowContext
  ) => Array<{ role: string; content: string }> | Promise<Array<{ role: string; content: string }>>;

  /** 系统提示 */
  readonly systemPrompt?: string;

  /** 可用工具 */
  readonly tools?: readonly Tool[];

  /** 输出 schema（用于结构化输出） */
  readonly outputSchema?: ZodSchema;

  /** 温度参数 */
  readonly temperature?: number;

  /** 最大 token 数 */
  readonly maxTokens?: number;
}

/**
 * LLM 节点输出
 */
export interface LLMNodeOutput {
  /** 响应内容 */
  readonly content: string;

  /** 结构化输出 */
  readonly structured?: unknown;

  /** Token 使用量 */
  readonly usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };

  /** 工具调用 */
  readonly toolCalls?: Array<{
    id: string;
    name: string;
    arguments: unknown;
    result?: unknown;
  }>;
}

/**
 * 创建 LLM 工作流节点
 */
export function createLLMNode(config: LLMNodeConfig): WorkflowNode<unknown, LLMNodeOutput>;
```

### 使用示例

```typescript
import { createLLMNode, createWorkflow } from '@seashore/workflow';
import { openaiText } from '@seashore/llm';

// 示例 1: 使用完整适配器配置
const analyzeNode = createLLMNode({
  name: 'analyze',
  adapter: openaiText('gpt-4o', {
    baseURL: process.env.OPENAI_API_BASE_URL,
    apiKey: process.env.OPENAI_API_KEY,
  }),
  systemPrompt: 'You are an analyzer.',
  prompt: (input) => `Analyze: ${JSON.stringify(input)}`,
});

// 示例 2: 使用简单配置对象（向后兼容）
const summarizeNode = createLLMNode({
  name: 'summarize',
  adapter: { provider: 'openai', model: 'gpt-4o' },
  prompt: 'Summarize the previous analysis.',
});

// 示例 3: 为不同节点使用不同的 API 密钥
const nodeA = createLLMNode({
  name: 'node-a',
  adapter: openaiText('gpt-4o', { apiKey: process.env.TEAM_A_API_KEY }),
  prompt: 'Process for Team A',
});

const nodeB = createLLMNode({
  name: 'node-b',
  adapter: openaiText('gpt-4o', { apiKey: process.env.TEAM_B_API_KEY }),
  prompt: 'Process for Team B',
});
```

### 错误处理

| 错误场景 | 错误类型 | 消息 |
|---------|---------|------|
| adapter 配置无效 | `WorkflowConfigError` | "Invalid adapter configuration" |
| API 调用失败 | `NodeExecutionError` | "LLM request failed: {原因}" |
| API 密钥缺失 | `NodeExecutionError` | "API key not provided for {provider}" |
| 超时 | `NodeExecutionError` | "LLM request timed out" |
