# Installation

## Requirements

- Node.js >= 20
- pnpm >= 8 (recommended) or npm/yarn

## Install All Packages

```bash
pnpm add @seashore/agent @seashore/llm @seashore/tool
```

## Install Individual Packages

Install only the packages you need:

```bash
# Core packages
pnpm add @seashore/agent      # Agent framework
pnpm add @seashore/llm        # LLM adapters
pnpm add @seashore/tool       # Tool definitions

# Feature packages
pnpm add @seashore/workflow   # Workflow builder
pnpm add @seashore/rag        # RAG pipeline
pnpm add @seashore/memory     # Memory management
pnpm add @seashore/storage    # Storage adapters
pnpm add @seashore/vectordb   # Vector database

# Integration packages
pnpm add @seashore/mcp        # MCP client
pnpm add @seashore/genui      # Generative UI
pnpm add @seashore/deploy     # Deployment

# Platform packages
pnpm add @seashore/observability  # Tracing/logging
pnpm add @seashore/evaluation     # Evaluation
pnpm add @seashore/security       # Security
```

## TypeScript Configuration

Seashore is written in TypeScript and ships with type definitions. Ensure your `tsconfig.json` includes:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true
  }
}
```

## Environment Variables

Set up your LLM provider API keys:

```bash
# OpenAI
export OPENAI_API_KEY=sk-...

# Anthropic
export ANTHROPIC_API_KEY=sk-ant-...
```
