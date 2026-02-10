# Seashore 🌊

**A TypeScript-first AI agent framework built on TanStack AI**

English | [简体中文](README.zh-CN.md)

Seashore provides a modular, type-safe foundation for building production AI agents with workflow orchestration, RAG capabilities, and deployment infrastructure.

[![Version](https://img.shields.io/npm/v/@seashore/core.svg)](https://www.npmjs.com/package/@seashore/core)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

## Features

- **🤖 Flexible Agents** - ReAct pattern with tool calling and structured outputs
- **🔄 Workflow Orchestration** - DAG-based parallel execution engine
- **🧠 RAG Integration** - PostgreSQL + pgvector with hybrid search (semantic + BM25)
- **🔌 MCP Support** - Model Context Protocol client integration
- **🛡️ Security** - Built-in guardrails (custom + LLM-based)
- **📊 Evaluation** - Custom metrics and LLM-judge evaluation suites
- **🚀 Deploy Ready** - Hono middleware with SSE streaming
- **⚛️ React Hooks** - First-class React integration

## Packages

| Package                                   | Description                              | Version                                                                                                         |
| ----------------------------------------- | ---------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| [@seashore/core](./packages/core)         | LLM adapters, embeddings, tools, context | [![npm](https://img.shields.io/npm/v/@seashore/core.svg)](https://www.npmjs.com/package/@seashore/core)         |
| [@seashore/agent](./packages/agent)       | ReAct agents and DAG workflows           | [![npm](https://img.shields.io/npm/v/@seashore/agent.svg)](https://www.npmjs.com/package/@seashore/agent)       |
| [@seashore/data](./packages/data)         | PostgreSQL storage, pgvector, RAG        | [![npm](https://img.shields.io/npm/v/@seashore/data.svg)](https://www.npmjs.com/package/@seashore/data)         |
| [@seashore/platform](./packages/platform) | MCP, guardrails, eval, deployment        | [![npm](https://img.shields.io/npm/v/@seashore/platform.svg)](https://www.npmjs.com/package/@seashore/platform) |
| [@seashore/react](./packages/react)       | React hooks for streaming chat           | [![npm](https://img.shields.io/npm/v/@seashore/react.svg)](https://www.npmjs.com/package/@seashore/react)       |

## Quick Start

### Installation

```bash
# Core agent functionality
npm install @seashore/core @seashore/agent

# Add RAG capabilities
npm install @seashore/data

# Add platform features (MCP, guardrails, deployment)
npm install @seashore/platform

# Add React hooks
npm install @seashore/react
```

### Basic ReAct Agent

```typescript
import { createLLMAdapter, createTool } from "@seashore/core";
import { createReActAgent } from "@seashore/agent";

// Setup LLM
const llm = createLLMAdapter({
  provider: "openai",
  model: "gpt-4o",
  apiKey: process.env.OPENAI_API_KEY,
});

// Create tools
const weatherTool = createTool({
  name: "get_weather",
  description: "Get current weather for a location",
  parameters: z.object({
    location: z.string(),
  }),
  execute: async ({ location }) => {
    return `Weather in ${location}: 72°F, sunny`;
  },
});

// Create agent
const agent = createReActAgent({
  llm,
  tools: [weatherTool],
  systemPrompt: "You are a helpful weather assistant.",
});

// Run
const result = await agent.run({
  message: "What is the weather in San Francisco?",
});

console.log(result.message);
```

### DAG Workflow

```typescript
import { createWorkflow, createStep } from "@seashore/agent";

const workflow = createWorkflow({
  name: "data-pipeline",
  steps: [
    createStep({
      id: "fetch",
      fn: async () => ({ data: [1, 2, 3] }),
    }),
    createStep({
      id: "process",
      fn: async ({ fetch }) => fetch.data.map((x) => x * 2),
      dependencies: ["fetch"],
    }),
    createStep({
      id: "save",
      fn: async ({ process }) => {
        console.log("Saved:", process);
      },
      dependencies: ["process"],
    }),
  ],
});

await workflow.execute();
```

### RAG Pipeline

```typescript
import { createEmbeddingAdapter } from "@seashore/core";
import { createVectorDB, createRAGPipeline } from "@seashore/data";

// Setup embedding model
const embedder = createEmbeddingAdapter({
  provider: "openai",
  model: "text-embedding-3-small",
  apiKey: process.env.OPENAI_API_KEY,
});

// Create vector database
const vectorDB = createVectorDB({
  connectionString: process.env.DATABASE_URL,
});

// Create RAG pipeline
const rag = createRAGPipeline({
  embedder,
  vectorDB,
  chunkSize: 512,
  chunkOverlap: 50,
});

// Index documents
await rag.indexDocuments([
  { id: "1", content: "TypeScript is a typed superset of JavaScript." },
  { id: "2", content: "React is a JavaScript library for UIs." },
]);

// Retrieve
const results = await rag.retrieve({
  query: "What is TypeScript?",
  topK: 3,
  hybridAlpha: 0.5, // 0.5 = balanced semantic + keyword search
});
```

### Deploy with Hono

```typescript
import { Hono } from "hono";
import { createAgentMiddleware } from "@seashore/platform";
import { createReActAgent } from "@seashore/agent";

const app = new Hono();

const agent = createReActAgent({
  llm: createLLMAdapter({ provider: "openai", model: "gpt-4o" }),
  tools: [weatherTool],
});

app.post("/chat", createAgentMiddleware({ agent }));

export default app;
```

### React Integration

```typescript
import { useSeashorChat } from '@seashore/react';

function ChatComponent() {
  const { messages, input, setInput, sendMessage, isLoading } = useSeashorChat({
    endpoint: '/api/chat',
  });

  return (
    <div>
      {messages.map((msg, i) => (
        <div key={i}>{msg.content}</div>
      ))}
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        disabled={isLoading}
      />
      <button onClick={sendMessage}>Send</button>
    </div>
  );
}
```

## Architecture

Seashore is built as a modular monorepo with clear separation of concerns:

```
@seashore/core       → Foundational utilities (LLM, embeddings, tools)
        ↓
@seashore/agent      → Agent implementations (ReAct, workflows)
        ↓
@seashore/data       → Data persistence and RAG
        ↓
@seashore/platform   → Platform services (MCP, guardrails, deployment)
        ↓
@seashore/react      → React integration
```

Each package can be used independently or composed together.

## Why Seashore?

### vs. LangChain

- **Type-safe**: Full TypeScript with inference
- **Modular**: Use only what you need
- **Modern**: Built on TanStack AI (not Vercel AI SDK)
- **Simpler**: Less abstraction overhead

### vs. Vercel AI SDK

- **Framework-agnostic**: Not tied to Vercel/Next.js
- **Production-ready**: Built-in guardrails, eval, MCP
- **Workflow engine**: DAG orchestration included
- **RAG built-in**: pgvector + hybrid search out of the box

### vs. LlamaIndex

- **TypeScript-first**: Not a Python port
- **Lighter weight**: Focused scope, clear APIs
- **TanStack AI**: Leverage the TanStack ecosystem

## Development

```bash
# Install dependencies
pnpm install

# Run tests
pnpm nx run-many -t test

# Build all packages
pnpm nx run-many -t build

# Run single package tests
pnpm --filter @seashore/core test
```

## Requirements

- Node.js 18+
- pnpm 9+
- TypeScript 5.7+
- PostgreSQL 15+ (for @seashore/data)
- pgvector extension (for vector search)

## Documentation

- [Design Philosophy](./docs/plans/2026-02-10-seashore-framework-design.md)
- [Implementation Plan](./docs/plans/2026-02-10-seashore-implementation-plan.md)
- [API Documentation](#) (Coming soon)

## Examples

See the [examples](./examples) directory for complete applications:

- [Simple ReAct Agent](./examples/basic-agent)
- [DAG Workflow](./examples/workflow)
- [RAG Chatbot](./examples/rag-chatbot)
- [Full-Stack App](./examples/fullstack-app)

## Contributing

Contributions are welcome! Please read our [Contributing Guide](./CONTRIBUTING.md) first.

## License

MIT © Seashore Contributors

## Acknowledgments

Built with:

- [TanStack AI](https://tanstack.com/ai) - Modern AI framework
- [Drizzle ORM](https://orm.drizzle.team/) - Type-safe SQL
- [Hono](https://hono.dev/) - Fast web framework
- [Vitest](https://vitest.dev/) - Fast test runner
- [Nx](https://nx.dev/) - Monorepo tooling
