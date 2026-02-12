# LLM Adapters

**LLM Adapters** provide a unified interface to multiple Large Language Model providers. They abstract away provider-specific details, making it easy to switch between OpenAI, Anthropic, and Google Gemini.

## Overview

Seashore's adapter layer sits on top of **TanStack AI**, providing:

- **Provider abstraction** - Single API for OpenAI, Anthropic, Gemini
- **Type safety** - Full TypeScript support
- **Configuration simplicity** - Minimal setup required
- **Easy switching** - Change providers with one line
- **Custom endpoints** - Support for proxies and custom deployments

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

## Creating Adapters

### Basic Usage

```typescript
import { createLLMAdapter } from '@seashore/core'

// Create adapter factory
const llm = createLLMAdapter({
  provider: 'openai',
  apiKey: process.env.OPENAI_API_KEY!,
})

// Get model instance
const model = llm('gpt-4o')
```

### Adapter Configuration

```typescript
interface LLMAdapterConfig {
  provider: 'openai' | 'anthropic' | 'gemini'
  apiKey: string
  baseURL?: string
}
```

---

## Supported Providers

### OpenAI

**Models:**
- `gpt-4o` - Latest flagship model (Oct 2024)
- `gpt-4o-mini` - Fast, cost-effective model
- `gpt-4-turbo` - Previous generation flagship
- `gpt-3.5-turbo` - Legacy model

```typescript
const llm = createLLMAdapter({
  provider: 'openai',
  apiKey: process.env.OPENAI_API_KEY!,
})

// Use specific models
const gpt4o = llm('gpt-4o')
const gpt4oMini = llm('gpt-4o-mini')
```

**Custom endpoint (OpenAI-compatible):**
```typescript
const llm = createLLMAdapter({
  provider: 'openai',
  apiKey: process.env.API_KEY!,
  baseURL: 'https://api.your-proxy.com/v1',
})
```

### Anthropic (Claude)

**Models:**
- `claude-3-7-sonnet` - Latest Claude (Feb 2025)
- `claude-3-5-sonnet` - Previous flagship
- `claude-3-opus` - Most capable model
- `claude-3-haiku` - Fastest model

```typescript
const llm = createLLMAdapter({
  provider: 'anthropic',
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

// Use specific models
const sonnet = llm('claude-3-7-sonnet')
const opus = llm('claude-3-opus')
const haiku = llm('claude-3-haiku')
```

**Custom endpoint:**
```typescript
const llm = createLLMAdapter({
  provider: 'anthropic',
  apiKey: process.env.API_KEY!,
  baseURL: 'https://anthropic-proxy.example.com',
})
```

### Google Gemini

**Models:**
- `gemini-2.0-flash-exp` - Latest experimental (Feb 2025)
- `gemini-1.5-pro` - Flagship model with 2M context
- `gemini-1.5-flash` - Fast, cost-effective

```typescript
const llm = createLLMAdapter({
  provider: 'gemini',
  apiKey: process.env.GOOGLE_AI_API_KEY!,
})

// Use specific models
const flash = llm('gemini-2.0-flash-exp')
const pro = llm('gemini-1.5-pro')
```

---

## Using Adapters with Agents

### Basic Agent

```typescript
import { createReActAgent } from '@seashore/agent'
import { createLLMAdapter } from '@seashore/core'

const llm = createLLMAdapter({
  provider: 'openai',
  apiKey: process.env.OPENAI_API_KEY!,
})

const agent = createReActAgent({
  model: () => llm('gpt-4o'),  // Factory function
  systemPrompt: 'You are a helpful assistant.',
  tools: [searchTool],
})

const response = await agent.run([
  { role: 'user', content: 'Hello!' }
])
```

### Why Factory Functions?

The `model` parameter takes a **factory function** (`() => model`) instead of the model directly. This enables:

1. **Lazy initialization** - Model created only when needed
2. **Multiple calls** - Fresh instance for each agent call
3. **Testing** - Easy to mock

```typescript
// ✅ CORRECT: Factory function
model: () => llm('gpt-4o')

// ❌ WRONG: Direct model instance
model: llm('gpt-4o')
```

---

## Switching Providers

### Environment-Based Selection

```typescript
const provider = (process.env.LLM_PROVIDER || 'openai') as 'openai' | 'anthropic' | 'gemini'

const llm = createLLMAdapter({
  provider,
  apiKey: process.env[`${provider.toUpperCase()}_API_KEY`]!,
})

// Use the same agent code regardless of provider
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

### Configuration Object

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

// Switch providers easily
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

## Provider Comparison

### OpenAI

**Strengths:**
- Best-in-class tool calling
- Excellent JSON mode
- Fast response times
- Strong structured output support

**Use cases:**
- Agents with complex tool usage
- Structured data extraction
- Real-time applications

**Pricing (as of Feb 2025):**
- GPT-4o: $2.50/1M input, $10/1M output
- GPT-4o-mini: $0.15/1M input, $0.60/1M output

### Anthropic (Claude)

**Strengths:**
- Best reasoning capabilities
- Excellent long context (200K tokens)
- Strong safety and refusal behavior
- Great at following complex instructions

**Use cases:**
- Complex reasoning tasks
- Long document analysis
- Safety-critical applications

**Pricing (as of Feb 2025):**
- Claude 3.7 Sonnet: $3/1M input, $15/1M output
- Claude 3 Haiku: $0.25/1M input, $1.25/1M output

### Google Gemini

**Strengths:**
- Massive context window (2M tokens)
- Cost-effective
- Fast inference
- Multimodal capabilities

**Use cases:**
- Large document processing
- Cost-sensitive applications
- High-throughput workloads

**Pricing (as of Feb 2025):**
- Gemini 1.5 Pro: $1.25/1M input, $5/1M output
- Gemini 1.5 Flash: $0.075/1M input, $0.30/1M output

---

## Model Selection Guide

### By Task Type

**Simple Q&A:**
- OpenAI: `gpt-4o-mini`
- Anthropic: `claude-3-haiku`
- Gemini: `gemini-1.5-flash`

**Complex Reasoning:**
- OpenAI: `gpt-4o`
- Anthropic: `claude-3-7-sonnet` (best)
- Gemini: `gemini-1.5-pro`

**Tool-Heavy Agents:**
- OpenAI: `gpt-4o` (best)
- Anthropic: `claude-3-7-sonnet`
- Gemini: `gemini-2.0-flash-exp`

**Long Context (>100K tokens):**
- Anthropic: `claude-3-7-sonnet` (200K)
- Gemini: `gemini-1.5-pro` (2M) (best)
- OpenAI: `gpt-4o` (128K)

**Cost-Effective:**
- Gemini: `gemini-1.5-flash` (best)
- OpenAI: `gpt-4o-mini`
- Anthropic: `claude-3-haiku`

### By Budget

**Premium ($3-10/1M tokens):**
```typescript
const llm = createLLMAdapter({
  provider: 'anthropic',
  apiKey: process.env.ANTHROPIC_API_KEY!,
})
const model = llm('claude-3-7-sonnet')
```

**Balanced ($1-3/1M tokens):**
```typescript
const llm = createLLMAdapter({
  provider: 'openai',
  apiKey: process.env.OPENAI_API_KEY!,
})
const model = llm('gpt-4o')
```

**Budget (<$1/1M tokens):**
```typescript
const llm = createLLMAdapter({
  provider: 'gemini',
  apiKey: process.env.GOOGLE_AI_API_KEY!,
})
const model = llm('gemini-1.5-flash')
```

---

## Advanced Patterns

### Multi-Provider Fallback

```typescript
async function createResilientAgent() {
  const providers = [
    { provider: 'openai' as const, model: 'gpt-4o', apiKey: process.env.OPENAI_API_KEY! },
    { provider: 'anthropic' as const, model: 'claude-3-7-sonnet', apiKey: process.env.ANTHROPIC_API_KEY! },
    { provider: 'gemini' as const, model: 'gemini-1.5-pro', apiKey: process.env.GOOGLE_AI_API_KEY! },
  ]

  for (const config of providers) {
    try {
      const llm = createLLMAdapter({
        provider: config.provider,
        apiKey: config.apiKey,
      })

      const agent = createReActAgent({
        model: () => llm(config.model),
        systemPrompt: 'You are helpful.',
        tools: [searchTool],
      })

      // Test the agent
      await agent.run([{ role: 'user', content: 'test' }])
      
      console.log(`Using provider: ${config.provider}`)
      return agent
    } catch (error) {
      console.error(`Provider ${config.provider} failed:`, error)
      continue
    }
  }

  throw new Error('All providers failed')
}
```

### Provider-Specific Agents

Use different models for different tasks:

```typescript
// Fast model for simple queries
const quickAgent = createReActAgent({
  model: () => createLLMAdapter({
    provider: 'openai',
    apiKey: process.env.OPENAI_API_KEY!,
  })('gpt-4o-mini'),
  systemPrompt: 'Answer quickly and concisely.',
  tools: [],
})

// Powerful model for complex reasoning
const reasoningAgent = createReActAgent({
  model: () => createLLMAdapter({
    provider: 'anthropic',
    apiKey: process.env.ANTHROPIC_API_KEY!,
  })('claude-3-7-sonnet'),
  systemPrompt: 'Think through this step-by-step.',
  tools: [calculatorTool, searchTool],
})

// Route based on query complexity
async function routeQuery(query: string) {
  if (query.length < 50) {
    return quickAgent.run([{ role: 'user', content: query }])
  } else {
    return reasoningAgent.run([{ role: 'user', content: query }])
  }
}
```

### A/B Testing Models

```typescript
import { createMetric, createEvalSuite } from '@seashore/platform'

const models = [
  { provider: 'openai' as const, model: 'gpt-4o' },
  { provider: 'anthropic' as const, model: 'claude-3-7-sonnet' },
]

async function compareModels(testQueries: string[]) {
  const results = []

  for (const config of models) {
    const llm = createLLMAdapter({
      provider: config.provider,
      apiKey: process.env[`${config.provider.toUpperCase()}_API_KEY`]!,
    })

    const agent = createReActAgent({
      model: () => llm(config.model),
      systemPrompt: 'You are helpful.',
      tools: [searchTool],
    })

    const responses = await Promise.all(
      testQueries.map(q => agent.run([{ role: 'user', content: q }]))
    )

    results.push({
      provider: config.provider,
      model: config.model,
      responses,
    })
  }

  return results
}
```

---

## Custom Deployments

### OpenAI-Compatible APIs

Many providers offer OpenAI-compatible endpoints:

```typescript
// Azure OpenAI
const azureLLM = createLLMAdapter({
  provider: 'openai',
  apiKey: process.env.AZURE_OPENAI_API_KEY!,
  baseURL: 'https://your-resource.openai.azure.com/openai/deployments/your-deployment',
})

// Together AI
const togetherLLM = createLLMAdapter({
  provider: 'openai',
  apiKey: process.env.TOGETHER_API_KEY!,
  baseURL: 'https://api.together.xyz/v1',
})

// Groq
const groqLLM = createLLMAdapter({
  provider: 'openai',
  apiKey: process.env.GROQ_API_KEY!,
  baseURL: 'https://api.groq.com/openai/v1',
})
```

### Custom Proxy

Route through a proxy for logging/caching:

```typescript
const llm = createLLMAdapter({
  provider: 'openai',
  apiKey: process.env.OPENAI_API_KEY!,
  baseURL: 'https://your-proxy.com/v1',
})
```

---

## Best Practices

### 1. Environment Variables

Store API keys in environment variables:

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

### 2. Graceful Degradation

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

### 3. Cost Monitoring

```typescript
let tokenUsage = { input: 0, output: 0 }

const agent = createReActAgent({
  model: () => llm('gpt-4o'),
  systemPrompt: 'You are helpful.',
  tools: [searchTool],
})

const response = await agent.run(messages)

// Track usage (implementation depends on provider)
tokenUsage.input += estimateTokens(messages)
tokenUsage.output += estimateTokens(response.result.content)

console.log('Estimated cost:', calculateCost(tokenUsage))
```

### 4. Provider Abstraction

Hide provider details from application code:

```typescript
// config.ts
export const LLM_CONFIG = {
  provider: process.env.LLM_PROVIDER || 'openai',
  apiKey: process.env.LLM_API_KEY!,
  model: process.env.LLM_MODEL || 'gpt-4o',
} as const

// app.ts
import { LLM_CONFIG } from './config'

const llm = createLLMAdapter({
  provider: LLM_CONFIG.provider as any,
  apiKey: LLM_CONFIG.apiKey,
})

const agent = createReActAgent({
  model: () => llm(LLM_CONFIG.model),
  systemPrompt: 'You are helpful.',
  tools: [searchTool],
})
```

---

## Troubleshooting

### API Key Issues

```typescript
if (!process.env.OPENAI_API_KEY) {
  throw new Error('OPENAI_API_KEY environment variable is required')
}

const llm = createLLMAdapter({
  provider: 'openai',
  apiKey: process.env.OPENAI_API_KEY,
})
```

### Rate Limiting

Implement retry logic:

```typescript
import pRetry from 'p-retry'

async function runAgentWithRetry(agent: ReActAgent, messages: Message[]) {
  return pRetry(
    () => agent.run(messages),
    {
      retries: 3,
      onFailedAttempt: error => {
        console.log(`Attempt ${error.attemptNumber} failed. ${error.retriesLeft} retries left.`)
      }
    }
  )
}
```

### Model Not Found

```typescript
try {
  const model = llm('invalid-model-name')
} catch (error) {
  console.error('Model not found. Available models:')
  console.error('OpenAI: gpt-4o, gpt-4o-mini, gpt-4-turbo')
  console.error('Anthropic: claude-3-7-sonnet, claude-3-opus, claude-3-haiku')
  console.error('Gemini: gemini-2.0-flash-exp, gemini-1.5-pro, gemini-1.5-flash')
}
```

---

## Testing with Adapters

### Mocking in Tests

```typescript
import { vi } from 'vitest'

// Mock the adapter
const mockLLM = vi.fn().mockReturnValue({
  chat: vi.fn().mockResolvedValue({
    result: { content: 'Mocked response' }
  })
})

const agent = createReActAgent({
  model: () => mockLLM('gpt-4o'),
  systemPrompt: 'You are helpful.',
  tools: [],
})

// Test without making API calls
const response = await agent.run([
  { role: 'user', content: 'test' }
])

expect(response.result.content).toBe('Mocked response')
```

---

## Related Concepts

- **[Agents](./agents.md)** - Using adapters with ReAct agents
- **[Context](./context.md)** - Optimize prompts for different models
- **[Architecture](./architecture.md)** - How adapters fit in the system

---

## Next Steps

- **[Getting Started](../getting-started/installation.md)**
- **[Model Comparison Guide](../guides/model-selection.md)**
- **[Cost Optimization](../guides/cost-optimization.md)**
