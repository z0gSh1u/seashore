# API Contracts: Security External API Rule

**Date**: 2026-01-01  
**Package**: `@seashore/security`

## createSecurityRule (外部 API 模式)

### 函数签名

```typescript
import type { SecurityRule, SecurityCheckResult, Violation } from '@seashore/security';

/**
 * 基于规则的安全规则配置
 */
export interface RuleBasedSecurityRuleConfig {
  /** 规则名称 */
  name: string;

  /** 规则描述 */
  description: string;

  /** 规则类型 */
  type: 'input' | 'output' | 'both';

  /**
   * 检查函数
   * 
   * @param content - 要检查的内容
   * @returns 检查结果 Promise
   * 
   * @remarks
   * 此函数是异步的，可以在其中：
   * - 调用外部 API
   * - 访问数据库
   * - 执行复杂的异步逻辑
   */
  check: (content: string) => Promise<SecurityCheckResult>;
}

/**
 * 安全检查结果
 */
export interface SecurityCheckResult {
  /** 检查是否通过 */
  passed: boolean;

  /** 转换后的内容（如脱敏） */
  output?: string;

  /** 是否进行了转换 */
  transformed?: boolean;

  /** 违规列表 */
  violations: Violation[];
}

/**
 * 违规详情
 */
export interface Violation {
  /** 规则名称 */
  rule: string;

  /** 严重程度 */
  severity: 'low' | 'medium' | 'high' | 'critical';

  /** 消息 */
  message: string;

  /** 附加详情 */
  details?: Record<string, unknown>;
}

/**
 * 创建自定义安全规则
 */
export function createSecurityRule(config: RuleBasedSecurityRuleConfig): SecurityRule;
```

### 外部 API 规则示例

```typescript
import { createSecurityRule, createGuardrails } from '@seashore/security';

/**
 * 创建调用外部内容安全 API 的规则
 */
const externalContentModerationRule = createSecurityRule({
  name: 'external_content_moderation',
  description: 'Check content using external moderation API',
  type: 'input',

  check: async (content) => {
    const API_URL = process.env.CONTENT_MODERATION_API_URL;
    const API_KEY = process.env.CONTENT_MODERATION_API_KEY;

    if (!API_URL || !API_KEY) {
      console.warn('External moderation API not configured, skipping check');
      return { passed: true, violations: [] };
    }

    try {
      // 设置超时
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${API_KEY}`,
        },
        body: JSON.stringify({ text: content }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        console.warn(`Moderation API returned ${response.status}, allowing content`);
        return { passed: true, violations: [] };
      }

      const result = await response.json();
      
      // 转换 API 响应为 SecurityCheckResult
      // 假设 API 返回格式: { flagged: boolean, categories: string[], score: number }
      if (result.flagged) {
        return {
          passed: false,
          violations: [{
            rule: 'external_content_moderation',
            severity: result.score > 0.9 ? 'critical' : 'high',
            message: `Content flagged by external API: ${result.categories.join(', ')}`,
            details: {
              categories: result.categories,
              score: result.score,
            },
          }],
        };
      }

      return { passed: true, violations: [] };

    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.warn('External moderation API timeout, allowing content');
      } else {
        console.warn('External moderation API error:', error);
      }
      // 降级策略：API 失败时放行
      return { passed: true, violations: [] };
    }
  },
});

// 使用规则
const guardrails = createGuardrails({
  inputRules: [externalContentModerationRule],
  outputRules: [],
});

const result = await guardrails.checkInput('Some user input');
```

### 错误处理策略

| 错误场景 | 推荐处理方式 | 理由 |
|---------|-------------|------|
| API 未配置 | 跳过检查，记录警告 | 允许开发环境正常运行 |
| API 超时 | 放行内容，记录警告 | 避免阻塞用户请求 |
| API 返回 4xx/5xx | 放行内容，记录警告 | API 问题不应阻塞业务 |
| 响应格式错误 | 放行内容，记录错误 | 降级处理 |
| 网络错误 | 放行内容，记录错误 | 降级处理 |

### 配置最佳实践

```typescript
// 环境变量
CONTENT_MODERATION_API_URL=https://api.your-company.com/v1/moderate
CONTENT_MODERATION_API_KEY=your-api-key

// 可选：自定义超时时间
CONTENT_MODERATION_TIMEOUT_MS=5000
```
