# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Seashore is a TypeScript agent framework built as an NX-based monorepo with pnpm workspaces. It provides modular packages for building AI-powered applications with ReAct agents, workflows, RAG, memory systems, and deployment utilities.

## Development Commands

### Build & Test
```bash
# Install dependencies
pnpm install

# Build all packages (uses NX for dependency graph builds)
pnpm build

# Build a specific package
cd packages/<name> && pnpm build

# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run tests for a specific package
pnpm test packages/agent/__tests__/integration.test.ts

# Type check all packages
pnpm typecheck

# Lint all packages
pnpm lint

# Fix linting issues
pnpm lint:fix

# Format code
pnpm format
```

### Test Organization
Tests are located in `packages/**/__tests__/**/*.test.ts`. Use vitest patterns to run specific tests:

```bash
# Run a specific test file
pnpm test packages/agent/__tests__/integration.test.ts

# Run tests matching a pattern
pnpm test --agent

# Run tests with coverage
pnpm test --coverage
```

## Architecture

### Monorepo Structure
- **Package Manager**: pnpm with workspace support (see `pnpm-workspace.yaml`)
- **Build System**: NX for task orchestration with caching, Rollup for bundling
- **TypeScript**: Path mappings in `tsconfig.json` for clean imports between packages
- **Test Runner**: Vitest with global test setup (database containers via testcontainers)

### Package Dependency Layers (Bottom to Top)

```
Foundation Layer:
  @seashore/storage       (PostgreSQL + Drizzle, no deps)
  @seashore/tool          (Type-safe tools, no internal deps)

LLM Layer:
  @seashore/llm           (TanStack AI adapters: OpenAI, Anthropic, Gemini)
  @seashore/vectordb      (Vector DB, depends on storage)

Agent Layer:
  @seashore/workflow      (Node-based workflows, depends on llm, tool)
  @seashore/agent         (ReAct/workflow agents, depends on workflow, llm, tool)

Specialized Layer:
  @seashore/rag           (RAG pipeline, depends on vectordb, llm)
  @seashore/memory        (Memory systems, depends on storage, vectordb, llm)
  @seashore/security      (Guardrails, depends on llm)
  @seashore/mcp           (MCP client)
  @seashore/genui         (Generative UI)
  @seashore/observability (Tracing, logging)
  @seashore/evaluation    (Evaluation metrics)
  @seashore/deploy        (Hono-based deployment)
```

### Key Architectural Patterns

#### 1. Tool Definition Pattern
Tools are defined with Zod schemas for type-safe input validation:

```typescript
import { defineTool } from '@seashore/tool'
import { z } from 'zod'

const tool = defineTool({
  name: 'get_weather',
  description: 'Get weather for a location',
  inputSchema: z.object({
    city: z.string().describe('The city name'),
  }),
  execute: async ({ city }) => {
    return { temperature: 72, condition: 'sunny' }
  },
})
```

#### 2. LLM Abstraction
The `@seashore/llm` package wraps TanStack AI adapters with unified interfaces for:
- `openaiText()`, `anthropicText()`, `geminiText()` for text generation
- `openaiEmbedding()` for embeddings
- Structured output, streaming, and multimodal support

#### 3. Agent Creation
ReAct agents combine tools and LLMs:

```typescript
import { createAgent } from '@seashore/agent'
import { openaiText } from '@seashore/llm'

const agent = createAgent({
  name: 'assistant',
  model: openaiText('gpt-4o', { apiKey: '...' }),
  tools: [weatherTool],
  systemPrompt: 'You are helpful...',
})

const result = await agent.run({
  messages: [{ role: 'user', content: 'Weather in Tokyo?' }],
})
```

#### 4. Workflow Composition
Workflows use a node-based composition pattern with LLM nodes, tool nodes, condition nodes, and parallel execution. See `packages/workflow/src/` for node types.

#### 5. Storage & Vector DB
- `@seashore/storage` uses Drizzle ORM with PostgreSQL
- `@seashore/vectordb` provides vector collections with similarity search
- Both require `DATABASE_URL` for integration tests (testcontainers used in CI)

## Package Scripts

Each package has its own `package.json` with:
- `build`: Rollup build to `dist/`
- `test`: Run vitest for that package
- `typecheck`: TypeScript no-emit check

Use NX to run targets across packages:
```bash
# Run build for all packages (with dependency order)
nx run-many -t build

# Run build for specific package
nx run agent:build
```

## Import Paths

Use path mappings defined in `tsconfig.json`:
```typescript
import { createAgent } from '@seashore/agent'
import { openaiText } from '@seashore/llm'
import { defineTool } from '@seashore/tool'
```

## Environment Variables

Tests requiring external services use:
- `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` for LLM tests
- `DATABASE_URL` for storage/vectordb tests (testcontainers auto-setup)
- `SERPER_API_KEY` / `FIRECRAWL_API_KEY` for preset tool tests

## Examples

The `examples/` directory contains runnable examples demonstrating:
- Basic agent creation and chat
- Tool integration
- Streaming responses
- Multi-tool agents
- Workflows, RAG, memory, and security patterns
