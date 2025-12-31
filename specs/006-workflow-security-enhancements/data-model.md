# Data Model: Workflow LLM Node 模型配置与 Security 外部 API 规则

**Date**: 2026-01-01  
**Feature**: 006-workflow-security-enhancements

## 概述

本功能主要涉及类型定义的扩展，不涉及持久化数据模型。以下记录需要修改或新增的类型定义。

---

## 类型定义

### 1. LLMNodeConfig（修改）

**文件**: `packages/workflow/src/types.ts`

**当前定义**:
```typescript
export interface LLMNodeConfig {
  readonly name: string;
  readonly adapter: TextAdapter;  // 仅支持 TextAdapter
  // ...
}
```

**修改后**:
```typescript
/**
 * LLM 适配器类型：支持完整的 TextAdapter 或配置对象
 */
export type LLMAdapter = TextAdapter | TextAdapterConfig;

export interface LLMNodeConfig {
  readonly name: string;
  
  /**
   * LLM 适配器
   * 
   * 支持两种形式：
   * 1. TextAdapter 对象（如 openaiText('gpt-4o', { baseURL, apiKey })）
   * 2. 简单配置对象（如 { provider: 'openai', model: 'gpt-4o' }）
   */
  readonly adapter: LLMAdapter;
  
  // 其他字段保持不变...
}
```

**验证规则**:
- `name`: 非空字符串，工作流内唯一
- `adapter`: 必须是有效的 `TextAdapter` 或 `TextAdapterConfig`

---

### 2. TextAdapterConfig（从 @seashore/llm 引用）

**文件**: `packages/llm/src/types.ts`（已存在）

```typescript
interface BaseAdapterConfig {
  readonly model: string;
  readonly apiKey?: string;
}

export interface OpenAIAdapterConfig extends BaseAdapterConfig {
  readonly provider: 'openai';
  readonly organization?: string;
  readonly baseURL?: string;
}

export interface AnthropicAdapterConfig extends BaseAdapterConfig {
  readonly provider: 'anthropic';
}

export interface GeminiAdapterConfig extends BaseAdapterConfig {
  readonly provider: 'gemini';
}

export type TextAdapterConfig = 
  | OpenAIAdapterConfig 
  | AnthropicAdapterConfig 
  | GeminiAdapterConfig;
```

---

### 3. LLMNodeOutput（现有，无需修改）

**文件**: `packages/workflow/src/nodes/llm-node.ts`

```typescript
export interface LLMNodeOutput {
  /** 响应内容 */
  readonly content: string;

  /** 结构化输出（如果提供了 schema） */
  readonly structured?: unknown;

  /** Token 使用量 */
  readonly usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };

  /** 工具调用（如果有） */
  readonly toolCalls?: Array<{
    id: string;
    name: string;
    arguments: unknown;
    result?: unknown;
  }>;
}
```

---

### 4. SecurityCheckResult（现有，无需修改）

**文件**: `packages/security/src/types.ts`

```typescript
export interface SecurityCheckResult {
  /** 检查是否通过 */
  passed: boolean;
  
  /** 转换后的输出（如果有） */
  output?: string;
  
  /** 内容是否被转换 */
  transformed?: boolean;
  
  /** 违规列表 */
  violations: Violation[];
}

export interface Violation {
  /** 触发违规的规则名称 */
  rule: string;
  
  /** 严重程度 */
  severity: ViolationSeverity;
  
  /** 人类可读的消息 */
  message: string;
  
  /** 附加详情 */
  details?: Record<string, unknown>;
  
  /** 内容中的位置 */
  position?: { start: number; end: number };
}

export type ViolationSeverity = 'low' | 'medium' | 'high' | 'critical';
```

---

### 5. RuleBasedSecurityRuleConfig（现有，无需修改）

**文件**: `packages/security/src/types.ts`

```typescript
export interface RuleBasedSecurityRuleConfig {
  /** 规则名称 */
  name: string;
  
  /** 规则描述 */
  description: string;
  
  /** 规则类型 */
  type: 'input' | 'output' | 'both';
  
  /** 检查函数（支持异步，可调用外部 API） */
  check: (content: string) => Promise<SecurityCheckResult>;
}
```

---

## 类型关系图

```
┌─────────────────────────────────────────────────────────────┐
│                     @seashore/llm                           │
│                                                             │
│  TextAdapter ◄────── re-export from @tanstack/ai            │
│       ▲                                                     │
│       │                                                     │
│  TextAdapterConfig ─── OpenAIAdapterConfig (baseURL, etc.)  │
│                    ├── AnthropicAdapterConfig               │
│                    └── GeminiAdapterConfig                  │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   @seashore/workflow                        │
│                                                             │
│  LLMAdapter = TextAdapter | TextAdapterConfig               │
│       │                                                     │
│       ▼                                                     │
│  LLMNodeConfig                                              │
│       │                                                     │
│       ▼                                                     │
│  createLLMNode() ───► WorkflowNode<unknown, LLMNodeOutput>  │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                   @seashore/security                        │
│                                                             │
│  RuleBasedSecurityRuleConfig                                │
│       │ check: (content) => Promise<SecurityCheckResult>    │
│       ▼                                                     │
│  createSecurityRule() ───► SecurityRule                     │
│       │                                                     │
│       ▼                                                     │
│  Guardrails.checkInput() / checkOutput()                    │
└─────────────────────────────────────────────────────────────┘
```

---

## 迁移说明

### 向后兼容性

现有代码使用简单配置对象仍然有效：

```typescript
// 旧写法（仍然支持）
const node = createLLMNode({
  name: 'my-node',
  adapter: { provider: 'openai', model: 'gpt-4o' },
  // ...
});

// 新写法（推荐）
import { openaiText } from '@seashore/llm';

const node = createLLMNode({
  name: 'my-node',
  adapter: openaiText('gpt-4o', { 
    baseURL: 'https://custom-api.com/v1',
    apiKey: process.env.OPENAI_API_KEY 
  }),
  // ...
});
```

### 类型判断逻辑

在 `createLLMNode` 内部区分两种 adapter 类型：

```typescript
function isTextAdapterConfig(adapter: LLMAdapter): adapter is TextAdapterConfig {
  return 'provider' in adapter && 'model' in adapter;
}

function resolveAdapter(adapter: LLMAdapter): TextAdapter {
  if (isTextAdapterConfig(adapter)) {
    return createTextAdapter(adapter);
  }
  return adapter;
}
```
