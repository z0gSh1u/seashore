# Text Generation

Text models are the foundation of most AI applications. Seashore supports OpenAI, Anthropic, and Gemini with a unified interface.

## Creating Adapters

### OpenAI

```typescript
import { openaiText } from '@seashore/llm'

// Default (uses OPENAI_API_KEY env var)
const gpt4o = openaiText('gpt-4o')

// With explicit config
const gpt4oConfigured = openaiText('gpt-4o', {
  apiKey: 'sk-...',
  baseURL: 'https://your-proxy.com/v1',
})
```

### Anthropic

```typescript
import { anthropicText } from '@seashore/llm'

const claude = anthropicText('claude-sonnet-3-5', {
  apiKey: 'sk-ant-...',
})
```

### Gemini

```typescript
import { geminiText } from '@seashore/llm'

const gemini = geminiText('gemini-2.0-flash-exp', {
  apiKey: '...',
})
```

## Chat Completion

Send messages and get responses:

```typescript
import { openaiText } from '@seashore/llm'

const model = openaiText('gpt-4o')

const result = await model.chat({
  messages: [
    { role: 'system', content: 'You are a helpful assistant.' },
    { role: 'user', content: 'What is TypeScript?' },
  ],
})

console.log(result.content)
```

### Message Format

```typescript
type Message = {
  role: 'system' | 'user' | 'assistant'
  content: string
}
```

### Streaming Responses

```typescript
const stream = await model.chat({
  messages: [{ role: 'user', content: 'Tell me a story' }],
  stream: true,
})

for await (const chunk of stream) {
  if (chunk.type === 'text-delta') {
    process.stdout.write(chunk.content)
  }
}
```

## Using with Agents

Pass adapters when creating agents:

```typescript
import { createAgent } from '@seashore/agent'
import { openaiText, anthropicText } from '@seashore/llm'

// Use OpenAI
const openaiAgent = createAgent({
  name: 'openai-agent',
  model: openaiText('gpt-4o'),
  systemPrompt: 'You are helpful.',
})

// Use Anthropic
const claudeAgent = createAgent({
  name: 'claude-agent',
  model: anthropicText('claude-sonnet-3-5'),
  systemPrompt: 'You are helpful.',
})
```

## Model Selection

Choose the right model for your needs:

| Model | Provider | Best For | Cost |
|-------|----------|----------|------|
| GPT-4o | OpenAI | General purpose, reasoning | $$ |
| GPT-4o-mini | OpenAI | Fast, simple tasks | $ |
| Claude 3.5 Sonnet | Anthropic | Coding, analysis | $$ |
| Gemini Flash | Google | Fast, cost-effective | $ |

```typescript
// Fast, cheap for simple tasks
const fastModel = openaiText('gpt-4o-mini')

// Powerful for complex reasoning
const smartModel = openaiText('gpt-4o')

// Great for code
const codeModel = anthropicText('claude-sonnet-3-5')
```

## Temperature and Sampling

Control response randomness:

```typescript
const result = await model.chat({
  messages: [{ role: 'user', content: 'Write a story' }],
  temperature: 0.7,    // 0-2, higher = more creative
  topP: 0.9,          // 0-1, nucleus sampling
  maxTokens: 500,     // Maximum response length
})
```

- **temperature: 0** — Deterministic, consistent
- **temperature: 0.7** — Balanced (default)
- **temperature: 1.5** — Creative, varied

## Custom Base URL

Use proxies, custom endpoints, or compatible APIs:

```typescript
const model = openaiText('gpt-4o', {
  baseURL: 'https://your-proxy.com/v1',
  apiKey: 'your-api-key',
})

// Works with any OpenAI-compatible API
const localModel = openaiText('local-model', {
  baseURL: 'http://localhost:1234/v1',
  apiKey: 'not-needed',
})
```

## Retry and Error Handling

Seashore includes automatic retry logic:

```typescript
import { chatWithRetry } from '@seashore/llm'

const result = await chatWithRetry(model, {
  messages: [{ role: 'user', content: 'Hello' }],
  maxRetries: 3,
  initialDelay: 1000,
})
```

## Best Practices

1. **Match Model to Task** — Use cheaper models for simple tasks
2. **Set Appropriate Temperature** — Lower for factual, higher for creative
3. **Handle Rate Limits** — Implement backoff for production
4. **Monitor Costs** — Track token usage across your app
5. **Use Streaming** — Better UX for long responses

## Next Steps

- [Embeddings](./embeddings.md) — Vector search and RAG
- [Structured Output](./structured.md) — Type-safe responses
- [Workflows](../workflows/index.md) — Multi-step pipelines
