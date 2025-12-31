# Quick Start: Workflow LLM Node 模型配置与 Security 外部 API 规则

**Date**: 2026-01-01  
**Feature**: 006-workflow-security-enhancements

## 功能 1: 工作流 LLM Node 自定义模型配置

### 场景

你需要在工作流中使用自建的 OpenAI 兼容 API，或为不同节点使用不同的 API 密钥。

### 快速开始

```typescript
import { createWorkflow, createLLMNode } from '@seashore/workflow';
import { openaiText } from '@seashore/llm';

// 创建使用自定义配置的 LLM 节点
const analyzeNode = createLLMNode({
  name: 'analyze',
  adapter: openaiText('gpt-4o', {
    baseURL: process.env.OPENAI_API_BASE_URL || 'https://api.openai.com/v1',
    apiKey: process.env.OPENAI_API_KEY,
  }),
  systemPrompt: '你是一个分析专家。',
  prompt: (input) => `分析以下内容：${JSON.stringify(input)}`,
});

// 创建工作流
const workflow = createWorkflow({
  name: 'analysis-workflow',
  nodes: [analyzeNode],
  edges: [],
  startNode: 'analyze',
});

// 执行
const result = await workflow.execute({ data: '需要分析的数据' });
console.log(result.nodeOutputs['analyze']);
```

### 关键点

1. **使用 `openaiText()` 创建适配器**：可传入 `baseURL`、`apiKey`、`organization` 等参数
2. **向后兼容**：仍然可以使用简单的 `{ provider, model }` 配置对象
3. **多密钥支持**：每个节点可以有独立的 API 配置

---

## 功能 2: 使用外部 API 创建 SecurityRule

### 场景

你的公司有自建的内容安全审核系统，需要在 Seashore 中集成该系统。

### 快速开始

```typescript
import { createSecurityRule, createGuardrails } from '@seashore/security';

// 创建调用外部 API 的安全规则
const companyModerationRule = createSecurityRule({
  name: 'company_moderation',
  description: 'Check content using company moderation API',
  type: 'input',

  check: async (content) => {
    try {
      // 设置 5 秒超时
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(process.env.MODERATION_API_URL!, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': process.env.MODERATION_API_KEY!,
        },
        body: JSON.stringify({ content }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        // API 失败时降级放行
        return { passed: true, violations: [] };
      }

      const result = await response.json();

      // 根据你的 API 响应格式转换
      if (result.is_harmful) {
        return {
          passed: false,
          violations: [{
            rule: 'company_moderation',
            severity: 'high',
            message: result.reason || 'Content flagged by company moderation',
            details: result,
          }],
        };
      }

      return { passed: true, violations: [] };

    } catch (error) {
      // 超时或网络错误时降级放行
      console.warn('Moderation API error:', error);
      return { passed: true, violations: [] };
    }
  },
});

// 创建 Guardrails
const guardrails = createGuardrails({
  inputRules: [companyModerationRule],
  outputRules: [],
});

// 使用
const checkResult = await guardrails.checkInput('用户输入内容');
if (!checkResult.passed) {
  console.log('Content blocked:', checkResult.violations);
}
```

### 关键点

1. **异步 check 函数**：`createSecurityRule` 的 `check` 函数是异步的，可以调用任何外部 API
2. **超时处理**：使用 `AbortController` 设置合理的超时时间
3. **降级策略**：API 失败时建议放行，避免阻塞正常业务
4. **响应转换**：根据你的 API 响应格式转换为 `SecurityCheckResult`

---

## 环境变量配置

```bash
# LLM 配置
OPENAI_API_KEY=sk-xxx
OPENAI_API_BASE_URL=https://api.openai.com/v1  # 可选，默认 OpenAI 官方

# 外部安全 API 配置
MODERATION_API_URL=https://api.your-company.com/v1/moderate
MODERATION_API_KEY=your-api-key
```

---

## 常见问题

### Q: 如何在不同节点使用不同的 API 密钥？

```typescript
const nodeA = createLLMNode({
  name: 'node-a',
  adapter: openaiText('gpt-4o', { apiKey: process.env.TEAM_A_KEY }),
  // ...
});

const nodeB = createLLMNode({
  name: 'node-b',
  adapter: openaiText('gpt-4o', { apiKey: process.env.TEAM_B_KEY }),
  // ...
});
```

### Q: 外部安全 API 返回格式不同怎么办？

在 `check` 函数中根据你的 API 格式进行转换。关键是最终返回 `SecurityCheckResult`:

```typescript
{
  passed: boolean;          // 是否通过
  violations: Violation[];  // 违规列表
  output?: string;          // 可选：转换后的内容
}
```

### Q: 如果外部 API 总是失败怎么办？

1. 检查网络连接和 API 配置
2. 考虑添加重试逻辑
3. 考虑使用本地规则作为 fallback
