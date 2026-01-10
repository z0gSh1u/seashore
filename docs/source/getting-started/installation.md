# Installation

Seashore is a modular framework, so you only install what you need. This section covers the installation options and requirements.

## Requirements

- **Node.js** >= 20
- **pnpm** >= 8 (recommended) or npm/yarn

## Installation Options

### Option 1: Install Core Packages

For most agent applications, you'll need the core packages:

```bash
pnpm add @seashore/agent @seashore/llm @seashore/tool
```

This gives you:
- `@seashore/agent` — Agent creation and execution
- `@seashore/llm` — LLM adapters (OpenAI, Anthropic, Gemini)
- `@seashore/tool` — Tool definition and validation

### Option 2: Install Individual Packages

Seashore is modular. Install only what you need:

```bash
# Core
pnpm add @seashore/agent
pnpm add @seashore/llm
pnpm add @seashore/tool

# Features
pnpm add @seashore/workflow      # Multi-step workflows
pnpm add @seashore/rag           # Retrieval-augmented generation
pnpm add @seashore/memory        # Memory management
pnpm add @seashore/storage       # Database storage
pnpm add @seashore/vectordb      # Vector database

# Integrations
pnpm add @seashore/mcp           # Model Context Protocol client
pnpm add @seashore/deploy        # Deployment utilities
pnpm add @seashore/genui         # React components for generative UI
pnpm add @seashore/observability # Tracing and logging
pnpm add @seashore/evaluation    # Evaluation metrics
pnpm add @seashore/security      # Guardrails and filtering
```

## Setting Up API Keys

Seashore supports multiple LLM providers. Set up the API keys for the providers you want to use:

```bash
# OpenAI
export OPENAI_API_KEY="sk-..."

# Anthropic
export ANTHROPIC_API_KEY="sk-ant-..."

# Google (for Gemini)
export GOOGLE_API_KEY="..."
```

You can also pass API keys directly when creating an adapter:

```typescript
import { openaiText } from '@seashore/llm'

const model = openaiText('gpt-4o', {
  apiKey: 'your-api-key',
})
```

## Using a Custom Base URL

If you're using a proxy, custom endpoint, or compatible API:

```typescript
import { openaiText } from '@seashore/llm'

const model = openaiText('gpt-4o', {
  baseURL: 'https://your-proxy.com/v1',
  apiKey: 'your-api-key',
})
```

## TypeScript Configuration

Seashore works great with TypeScript. Ensure your `tsconfig.json` has:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  }
}
```

## Next Steps

With Seashore installed, let's [create your first agent](./quickstart.md).
