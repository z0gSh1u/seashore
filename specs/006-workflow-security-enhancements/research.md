# Research: Workflow LLM Node 模型配置与 Security 外部 API 规则

**Date**: 2026-01-01  
**Feature**: 006-workflow-security-enhancements

## Research Tasks

### 1. @tanstack/ai 适配器 API 使用模式

**问题**: 如何正确使用 `@tanstack/ai` 的适配器进行 LLM 调用？

**研究结果**:

通过查阅 @tanstack/ai 官方文档，发现以下关键模式：

```typescript
// 1. 创建适配器（支持自定义配置）
import { openaiText } from "@tanstack/ai-openai";
import { chat } from "@tanstack/ai";

// 使用环境变量
const adapter = openaiText("gpt-4o");

// 或使用显式配置
import { createOpenaiChat } from "@tanstack/ai-openai";
const adapter = createOpenaiChat(apiKey, {
  organization: "...",
  baseURL: "https://custom-endpoint.com/v1"
})("gpt-4o");

// 2. 调用 chat 函数
const stream = chat({
  adapter: adapter,
  messages: [{ role: "user", content: "Hello!" }],
  tools: [myTool],
  systemPrompts: ["You are a helpful assistant"],
});

// 3. 消费流
for await (const chunk of stream) {
  console.log(chunk);
}
```

**决策**: 
- 使用 `chat()` 函数而非自己实现 LLM 调用逻辑
- `LLMNodeConfig.adapter` 类型应直接使用 `TextAdapter`（从 `@tanstack/ai` 导出）
- 保持向后兼容：简单的 `{ provider, model }` 对象应转换为 `TextAdapter`

**理由**: 
- 遵循 Constitution 原则 I（TanStack AI 优先）和 XII（积极复用）
- `chat()` 函数已处理流式响应、工具调用、错误处理等复杂逻辑

**替代方案考虑**:
- ❌ 自己实现 HTTP 调用 → 违反 Constitution 原则 XII
- ❌ 只支持配置对象 → 无法支持 baseURL/apiKey 自定义

---

### 2. @seashore/llm 现有类型定义

**问题**: 现有的 `TextAdapter` 类型是什么？如何与 `@tanstack/ai` 集成？

**研究结果**:

查看 `packages/llm/src/types.ts`：

```typescript
// 从 @tanstack/ai 重新导出
import type {
  TextAdapter as TanstackTextAdapter,
  AnyTextAdapter as TanstackAnyTextAdapter,
} from '@tanstack/ai';

export type TextAdapter = TanstackTextAdapter<any, any, any, any>;
export type AnyTextAdapter = TanstackAnyTextAdapter;

// 配置类型（用于 createTextAdapter）
export type TextAdapterConfig = 
  | OpenAIAdapterConfig 
  | AnthropicAdapterConfig 
  | GeminiAdapterConfig;

export interface OpenAIAdapterConfig {
  provider: 'openai';
  model: string;
  apiKey?: string;
  organization?: string;
  baseURL?: string;
}
```

**决策**:
- `@seashore/workflow` 应导入 `TextAdapter` 类型从 `@seashore/llm`
- 同时支持 `TextAdapter` 和 `TextAdapterConfig` 作为 adapter 参数
- 内部使用 `createTextAdapter` 将配置对象转换为适配器

**理由**: 保持包之间的解耦，同时提供灵活的 API

---

### 3. Workflow LLM Node 当前实现分析

**问题**: 当前 `createLLMNode` 的实现状态如何？需要哪些修改？

**研究结果**:

查看 `packages/workflow/src/nodes/llm-node.ts`：

```typescript
export function createLLMNode(config: LLMNodeConfig): WorkflowNode<unknown, LLMNodeOutput> {
  const { name, adapter: _adapter, prompt, ... } = config;
  
  return {
    name,
    type: 'llm',
    async execute(input, ctx) {
      // 构建 messages...
      
      // ⚠️ 当前是占位实现，未调用真实 LLM
      const result: LLMNodeOutput = {
        content: `[LLM Response for ${name}]`,
        // ...
      };
      return result;
    },
  };
}
```

**决策**: 需要修改 `execute` 方法实现真实的 `chat()` 调用

**所需修改**:
1. 类型定义：扩展 `LLMNodeConfig.adapter` 支持 `TextAdapter | TextAdapterConfig`
2. 实现：在 `execute` 中调用 `chat()` 并收集结果
3. 流处理：收集所有 chunk 并合并为最终输出

---

### 4. Security createSecurityRule API

**问题**: `createSecurityRule` 是否已支持自定义外部 API 调用？

**研究结果**:

查看 `packages/security/src/rules.ts`：

```typescript
export function createSecurityRule(
  config: RuleBasedSecurityRuleConfig | LLMSecurityRuleConfig
): SecurityRule {
  if ('check' in config) {
    // ✅ 已支持自定义 check 函数
    return {
      name,
      description,
      type,
      check: config.check,  // 用户可以在这里调用任何 API
    };
  }
  // ...
}

export interface RuleBasedSecurityRuleConfig {
  name: string;
  description: string;
  type: 'input' | 'output' | 'both';
  check: (content: string) => Promise<SecurityCheckResult>;  // 异步函数
}
```

**决策**: API 已满足需求，只需添加示例代码展示用法

**理由**: `check` 函数是异步的，用户可以在其中使用 `fetch` 调用任何外部 API

---

### 5. 外部 API 调用最佳实践

**问题**: 在自定义 SecurityRule 中调用外部 API 的最佳实践是什么？

**研究结果**:

```typescript
// 推荐模式
const externalContentCheckRule = createSecurityRule({
  name: 'external_content_check',
  description: 'Check content with external API',
  type: 'input',
  check: async (content) => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s 超时
      
      const response = await fetch('https://api.example.com/check', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.CONTENT_CHECK_API_KEY}`
        },
        body: JSON.stringify({ content }),
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        // 降级策略：API 失败时放行
        console.warn('External API failed, allowing content');
        return { passed: true, violations: [] };
      }
      
      const result = await response.json();
      // 转换为 SecurityCheckResult...
      
    } catch (error) {
      if (error.name === 'AbortError') {
        console.warn('External API timeout, allowing content');
      }
      return { passed: true, violations: [] };  // 降级放行
    }
  },
});
```

**决策**: 示例应包含：
1. 超时处理（AbortController）
2. 错误处理和降级策略
3. 响应格式转换
4. 环境变量配置

---

## 技术决策总结

| 决策 | 选择 | 理由 |
|------|------|------|
| LLM 调用方式 | 使用 `@tanstack/ai` 的 `chat()` | Constitution 原则 I & XII |
| 类型兼容 | 支持 `TextAdapter \| TextAdapterConfig` | 向后兼容 + 灵活性 |
| 流处理 | 在 execute 中收集所有 chunk | 工作流节点需要完整输出 |
| Security 规则 | 使用现有 `createSecurityRule` | API 已满足需求 |
| 外部 API 调用 | 标准 fetch + AbortController | Constitution 原则 XIII |
| 降级策略 | API 失败时默认放行 | 避免阻塞正常业务 |
