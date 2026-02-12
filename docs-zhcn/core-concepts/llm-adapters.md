# LLM Adapters

**LLM Adapters** 提供了一个统一的接口来访问多个大型语言模型提供商。它们抽象掉提供商特定的细节,使得在 OpenAI、Anthropic 和 Google Gemini 之间切换变得容易。

## 概览

Seashore 的适配器层构建在 **TanStack AI** 之上,提供:

- **提供商抽象** - OpenAI、Anthropic、Gemini 的单一 API
- **类型安全** - 完整的 TypeScript 支持
- **配置简单** - 最少的设置
- **轻松切换** - 一行代码更改提供商
- **自定义端点** - 支持代理和自定义部署

```
┌─────────────────────────────────────────────┐
│        Your Application Code               │
└─────────────────┬───────────────────────────┘
                  │
┌─────────────────▼───────────────────────────┐
│      Seashore LLM Adapter (Unified API)    │
└─────────────────┬───────────────────────────┘
                  │
      ┌───────────┼───────────┐
      │           │           │
┌─────▼─────┐ ┌──▼───┐ ┌─────▼──────┐
│ TanStack  │ │TS AI │ │ TanStack   │
│ AI-OpenAI │ │Anthro│ │ AI-Gemini  │
└─────┬─────┘ └──┬───┘ └─────┬──────┘
      │          │            │
┌─────▼─────┐ ┌──▼───┐ ┌─────▼──────┐
│  OpenAI   │ │Claude│ │   Google   │
│    API    │ │ API  │ │ Gemini API │
└───────────┘ └──────┘ └────────────┘
```

---

## 创建适配器

### 基本用法

```typescript
import { createLLMAdapter } from '@seashore/core'

// 创建适配器工厂
const llm = createLLMAdapter({
  provider: 'openai',
  apiKey: process.env.OPENAI_API_KEY!,
})

// 获取模型实例
const model = llm('gpt-4o')
```

### 适配器配置

```typescript
interface LLMAdapterConfig {
  provider: 'openai' | 'anthropic' | 'gemini'
  apiKey: string
  baseURL?: string
}
```

---

## 支持的提供商

### OpenAI

**模型:**
- `gpt-4o` - 最新旗舰模型 (2024年10月)
- `gpt-4o-mini` - 快速、经济实惠的模型
- `gpt-4-turbo` - 上一代旗舰
- `gpt-3.5-turbo` - 传统模型

```typescript
const llm = createLLMAdapter({
  provider: 'openai',
  apiKey: process.env.OPENAI_API_KEY!,
})

// 使用特定模型
const gpt4o = llm('gpt-4o')
const gpt4oMini = llm('gpt-4o-mini')
```

**自定义端点 (OpenAI 兼容):**
```typescript
const llm = createLLMAdapter({
  provider: 'openai',
  apiKey: process.env.API_KEY!,
  baseURL: 'https://api.your-proxy.com/v1',
})
```

### Anthropic (Claude)

**模型:**
- `claude-3-7-sonnet` - 最新 Claude (2025年2月)
- `claude-3-5-sonnet` - 上一代旗舰
- `claude-3-opus` - 最强大的模型
- `claude-3-haiku` - 最快的模型

```typescript
const llm = createLLMAdapter({
  provider: 'anthropic',
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

// 使用特定模型
const sonnet = llm('claude-3-7-sonnet')
const opus = llm('claude-3-opus')
const haiku = llm('claude-3-haiku')
```

**自定义端点:**
```typescript
const llm = createLLMAdapter({
  provider: 'anthropic',
  apiKey: process.env.API_KEY!,
  baseURL: 'https://anthropic-proxy.example.com',
})
```

### Google Gemini

**模型:**
- `gemini-2.0-flash-exp` - 最新实验版 (2025年2月)
- `gemini-1.5-pro` - 旗舰模型,2M 上下文
- `gemini-1.5-flash` - 快速、经济实惠

```typescript
const llm = createLLMAdapter({
  provider: 'gemini',
  apiKey: process.env.GOOGLE_AI_API_KEY!,
})

// 使用特定模型
const flash = llm('gemini-2.0-flash-exp')
const pro = llm('gemini-1.5-pro')
```

---

## 在 Agents 中使用适配器

### 基础 Agent

```typescript
import { createReActAgent } from '@seashore/agent'
import { createLLMAdapter } from '@seashore/core'

const llm = createLLMAdapter({
  provider: 'openai',
  apiKey: process.env.OPENAI_API_KEY!,
})

const agent = createReActAgent({
  model: () => llm('gpt-4o'),  // 工厂函数
  systemPrompt: 'You are a helpful assistant.',
  tools: [searchTool],
})

const response = await agent.run([
  { role: 'user', content: 'Hello!' }
])
```

### 为什么使用工厂函数?

`model` 参数接受**工厂函数** (`() => model`) 而不是直接的模型。这实现了:

1. **延迟初始化** - 仅在需要时创建模型
2. **多次调用** - 每次 agent 调用都使用新实例
3. **测试** - 易于 mock

```typescript
// ✅ 正确: 工厂函数
model: () => llm('gpt-4o')

// ❌ 错误: 直接模型实例
model: llm('gpt-4o')
```

---

## 切换提供商

### 基于环境的选择

```typescript
const provider = (process.env.LLM_PROVIDER || 'openai') as 'openai' | 'anthropic' | 'gemini'

const llm = createLLMAdapter({
  provider,
  apiKey: process.env[`${provider.toUpperCase()}_API_KEY`]!,
})

// 无论提供商如何,使用相同的 agent 代码
const agent = createReActAgent({
  model: () => llm(getModelForProvider(provider)),
  systemPrompt: 'You are helpful.',
  tools: [searchTool],
})

function getModelForProvider(provider: string): string {
  switch (provider) {
    case 'openai': return 'gpt-4o'
    case 'anthropic': return 'claude-3-7-sonnet'
    case 'gemini': return 'gemini-2.0-flash-exp'
    default: return 'gpt-4o'
  }
}
```

### 配置对象

```typescript
interface ModelConfig {
  provider: 'openai' | 'anthropic' | 'gemini'
  model: string
  apiKey: string
}

function createAgentWithConfig(config: ModelConfig) {
  const llm = createLLMAdapter({
    provider: config.provider,
    apiKey: config.apiKey,
  })

  return createReActAgent({
    model: () => llm(config.model),
    systemPrompt: 'You are helpful.',
    tools: [searchTool],
  })
}

// 轻松切换提供商
const openaiAgent = createAgentWithConfig({
  provider: 'openai',
  model: 'gpt-4o',
  apiKey: process.env.OPENAI_API_KEY!,
})

const claudeAgent = createAgentWithConfig({
  provider: 'anthropic',
  model: 'claude-3-7-sonnet',
  apiKey: process.env.ANTHROPIC_API_KEY!,
})
```

---

## 提供商比较

### OpenAI

**优势:**
- 一流的工具调用
- 优秀的 JSON 模式
- 快速响应时间
- 强大的结构化输出支持

**用例:**
- 具有复杂工具使用的 Agents
- 结构化数据提取
- 实时应用

**定价 (截至 2025年2月):**
- GPT-4o: $2.50/1M 输入, $10/1M 输出
- GPT-4o-mini: $0.15/1M 输入, $0.60/1M 输出

### Anthropic (Claude)

**优势:**
- 最佳推理能力
- 优秀的长上下文 (200K tokens)
- 强大的安全和拒绝行为
- 善于遵循复杂指令

**用例:**
- 复杂推理任务
- 长文档分析
- 安全关键应用

**定价 (截至 2025年2月):**
- Claude 3.7 Sonnet: $3/1M 输入, $15/1M 输出
- Claude 3 Haiku: $0.25/1M 输入, $1.25/1M 输出

### Google Gemini

**优势:**
- 巨大的上下文窗口 (2M tokens)
- 经济实惠
- 快速推理
- 多模态能力

**用例:**
- 大文档处理
- 成本敏感应用
- 高吞吐量工作负载

**定价 (截至 2025年2月):**
- Gemini 1.5 Pro: $1.25/1M 输入, $5/1M 输出
- Gemini 1.5 Flash: $0.075/1M 输入, $0.30/1M 输出

---

## 模型选择指南

### 按任务类型

**简单问答:**
- OpenAI: `gpt-4o-mini`
- Anthropic: `claude-3-haiku`
- Gemini: `gemini-1.5-flash`

**复杂推理:**
- OpenAI: `gpt-4o`
- Anthropic: `claude-3-7-sonnet` (最佳)
- Gemini: `gemini-1.5-pro`

**工具密集型 Agents:**
- OpenAI: `gpt-4o` (最佳)
- Anthropic: `claude-3-7-sonnet`
- Gemini: `gemini-2.0-flash-exp`

**长上下文 (>100K tokens):**
- Anthropic: `claude-3-7-sonnet` (200K)
- Gemini: `gemini-1.5-pro` (2M) (最佳)
- OpenAI: `gpt-4o` (128K)

**经济实惠:**
- Gemini: `gemini-1.5-flash` (最佳)
- OpenAI: `gpt-4o-mini`
- Anthropic: `claude-3-haiku`

### 按预算

**高级 ($3-10/1M tokens):**
```typescript
const llm = createLLMAdapter({
  provider: 'anthropic',
  apiKey: process.env.ANTHROPIC_API_KEY!,
})
const model = llm('claude-3-7-sonnet')
```

**平衡 ($1-3/1M tokens):**
```typescript
const llm = createLLMAdapter({
  provider: 'openai',
  apiKey: process.env.OPENAI_API_KEY!,
})
const model = llm('gpt-4o')
```

**预算 (<$1/1M tokens):**
```typescript
const llm = createLLMAdapter({
  provider: 'gemini',
  apiKey: process.env.GOOGLE_AI_API_KEY!,
})
const model = llm('gemini-1.5-flash')
```

---

## 最佳实践

### 1. 环境变量

在环境变量中存储 API 密钥:

```bash
# .env
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_AI_API_KEY=AI...
```

```typescript
const llm = createLLMAdapter({
  provider: 'openai',
  apiKey: process.env.OPENAI_API_KEY!,
})
```

### 2. 优雅降级

```typescript
function createLLMWithFallback() {
  if (process.env.OPENAI_API_KEY) {
    return createLLMAdapter({
      provider: 'openai',
      apiKey: process.env.OPENAI_API_KEY,
    })
  }
  
  if (process.env.ANTHROPIC_API_KEY) {
    return createLLMAdapter({
      provider: 'anthropic',
      apiKey: process.env.ANTHROPIC_API_KEY,
    })
  }
  
  throw new Error('No LLM API keys found')
}
```

### 3. 成本监控

```typescript
let tokenUsage = { input: 0, output: 0 }

const agent = createReActAgent({
  model: () => llm('gpt-4o'),
  systemPrompt: 'You are helpful.',
  tools: [searchTool],
})

const response = await agent.run(messages)

// 跟踪使用情况(实现取决于提供商)
tokenUsage.input += estimateTokens(messages)
tokenUsage.output += estimateTokens(response.result.content)

console.log('Estimated cost:', calculateCost(tokenUsage))
```

---

## 相关概念

- **[Agents](./agents.md)** - 在 ReAct agents 中使用适配器
- **[Context](./context.md)** - 为不同模型优化提示词
- **[Architecture](./architecture.md)** - 适配器如何适配系统

---

## 下一步

- **[入门指南](../getting-started/installation.md)**
- **[模型比较指南](../guides/model-selection.md)**
- **[成本优化](../guides/cost-optimization.md)**
