# Quickstart: LLM Configuration

**Feature**: `004-llm-config-baseurl`

## Configuring a Custom Base URL (OpenAI)

You can now configure a custom `baseURL` for OpenAI-compatible providers (like Ollama, LM Studio, or corporate proxies).

```typescript
import { createTextAdapter } from '@seashore/llm';

// Connect to a local Ollama instance
const localAdapter = createTextAdapter({
  provider: 'openai',
  model: 'llama3',
  baseURL: 'http://localhost:11434/v1',
  apiKey: 'ollama', // Required by some clients even if unused
});

const response = await localAdapter.generate('Why is the sky blue?');
console.log(response.text);
```

## Explicit API Key Configuration

You can pass the API key directly instead of using environment variables.

```typescript
import { createTextAdapter } from '@seashore/llm';

const adapter = createTextAdapter({
  provider: 'anthropic',
  model: 'claude-3-opus-20240229',
  apiKey: 'sk-ant-...' // Your API key here
});
```

## Using Organization ID (OpenAI)

```typescript
import { createTextAdapter } from '@seashore/llm';

const adapter = createTextAdapter({
  provider: 'openai',
  model: 'gpt-4',
  organization: 'org-123456'
});
```
