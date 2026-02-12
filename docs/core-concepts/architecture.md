# Architecture

Seashore is a **modular, type-safe AI agent framework** built on top of TanStack AI. It provides a complete toolkit for building production-ready AI applications with LLMs, from simple chatbots to complex multi-agent workflows.

## Overview

Seashore follows a **layered architecture** with clear separation of concerns:

```
┌─────────────────────────────────────────────────────────────┐
│                      Application Layer                      │
│              (Your AI application code)                     │
└─────────────────────────────────────────────────────────────┘
                             │
┌─────────────────────────────────────────────────────────────┐
│                  @seashore/platform                         │
│    MCP Integration · Guardrails · Evaluation · Deploy      │
└─────────────────────────────────────────────────────────────┘
                             │
┌─────────────────────────────────────────────────────────────┐
│                   @seashore/react                           │
│              React Hooks for Streaming UI                   │
└─────────────────────────────────────────────────────────────┘
                             │
┌──────────────────────────┬──────────────────────────────────┐
│    @seashore/agent       │       @seashore/data             │
│  ReAct Agents · DAG      │  Storage · VectorDB · RAG        │
│  Workflows · Orchestration│  pgvector · Hybrid Search       │
└──────────────────────────┴──────────────────────────────────┘
                             │
┌─────────────────────────────────────────────────────────────┐
│                    @seashore/core                           │
│     LLM Adapters · Embeddings · Tools · Context            │
│             (TanStack AI Foundation)                        │
└─────────────────────────────────────────────────────────────┘
                             │
┌─────────────────────────────────────────────────────────────┐
│                     External Services                       │
│  OpenAI · Anthropic · Gemini · PostgreSQL · MCP Servers    │
└─────────────────────────────────────────────────────────────┘
```

## Core Packages

### @seashore/core

The **foundation layer** that provides unified interfaces to LLM providers and utilities.

**Responsibilities:**
- LLM adapter factories for OpenAI, Anthropic, and Gemini
- Embedding adapters for vector generation
- Tool definitions and toolkit utilities
- Context engineering (system prompts, few-shot learning)

**Key Exports:**
```typescript
import {
  createLLMAdapter,      // LLM provider abstraction
  createEmbeddingAdapter, // Embedding generation
  createToolkit,         // Tool management
  systemPrompt,          // Prompt builder
  fewShotMessages,       // Few-shot examples
} from '@seashore/core'
```

**Dependencies:**
- `@tanstack/ai` - Core AI abstractions
- `@tanstack/ai-openai` - OpenAI models
- `@tanstack/ai-anthropic` - Claude models
- `@tanstack/ai-gemini` - Google Gemini models
- `zod` - Type-safe schema validation

**Design Principles:**
1. **Provider agnostic** - Unified API across all LLM providers
2. **Type-safe** - Full TypeScript support with Zod schemas
3. **Zero configuration** - Sensible defaults, customize when needed
4. **Pure ESM** - Modern module system with `.js` imports

---

### @seashore/agent

The **agent layer** that provides intelligent actors capable of reasoning and acting.

**Responsibilities:**
- ReAct (Reasoning + Acting) agent implementation
- DAG-based workflow orchestration
- Tool calling and iteration management
- Guardrail integration for safety

**Key Exports:**
```typescript
import {
  createReActAgent,   // Agentic reasoning with tools
  createWorkflow,     // DAG workflow builder
  createStep,         // Workflow step definition
  DAG,               // Graph data structure
} from '@seashore/agent'
```

**Dependencies:**
- `@seashore/core` - LLM adapters and tools
- `@tanstack/ai` - Chat and streaming APIs
- `zod` - Schema validation

**Design Principles:**
1. **Autonomous** - Agents iterate until task completion
2. **Observable** - Full visibility into agent decisions
3. **Composable** - Chain agents into complex workflows
4. **Controllable** - Max iterations, timeouts, abort signals

---

### @seashore/data

The **persistence layer** for storage, vector search, and RAG.

**Responsibilities:**
- PostgreSQL storage with Drizzle ORM
- pgvector integration for semantic search
- Hybrid search (vector + full-text)
- RAG pipelines with chunking strategies

**Key Exports:**
```typescript
import {
  createStorageService,  // Thread and message persistence
  createVectorDBService, // pgvector hybrid search
  createRAG,            // RAG pipeline builder
  createChunker,        // Document chunking
} from '@seashore/data'
```

**Dependencies:**
- `@seashore/core` - Embedding adapters
- `drizzle-orm` - Type-safe SQL ORM
- `zod` - Schema validation

**Design Principles:**
1. **Type-safe SQL** - Drizzle ORM for compile-time safety
2. **Hybrid search** - Combine semantic and keyword search
3. **Flexible chunking** - Fixed or recursive strategies
4. **Scalable** - Optimized for production workloads

---

### @seashore/platform

The **platform layer** for production deployment and integrations.

**Responsibilities:**
- Model Context Protocol (MCP) server integration
- Guardrails for input/output filtering
- Evaluation metrics and test suites
- Hono middleware for deployment

**Key Exports:**
```typescript
import {
  connectMCP,             // MCP server connection
  createGuardrail,        // Custom guardrails
  createLLMGuardrail,     // LLM-based filtering
  createEvalSuite,        // Evaluation framework
  seashoreMiddleware,     // Production deployment
} from '@seashore/platform'
```

**Dependencies:**
- `@seashore/agent` - Agent interfaces
- `@seashore/core` - LLM adapters
- `@modelcontextprotocol/sdk` - MCP client
- `hono` - Web framework

**Design Principles:**
1. **Production-ready** - Built for real-world deployments
2. **Secure by default** - Guardrails prevent harmful outputs
3. **Observable** - Metrics and evaluation built-in
4. **Standards-based** - MCP for tool interoperability

---

### @seashore/react

The **UI layer** providing React hooks for streaming chat interfaces.

**Responsibilities:**
- React hooks for agent streaming
- Message history management
- Loading states and error handling
- TypeScript-first API

**Key Exports:**
```typescript
import {
  useChat,        // Chat with streaming
  useCompletion,  // Single completion
} from '@seashore/react'
```

**Dependencies:**
- `@seashore/agent` - Agent interfaces
- `react` - React 18+

**Design Principles:**
1. **Streaming-first** - Real-time token streaming
2. **Declarative** - React-native API patterns
3. **Type-safe** - Full TypeScript support
4. **Framework-agnostic** - Core logic is pure JS

---

## Package Dependency Graph

```mermaid
graph TD
    A[@seashore/core] --> TanStack[TanStack AI]
    B[@seashore/agent] --> A
    B --> TanStack
    C[@seashore/data] --> A
    D[@seashore/platform] --> A
    D --> B
    E[@seashore/react] --> B
    
    style A fill:#4CAF50
    style B fill:#2196F3
    style C fill:#FF9800
    style D fill:#9C27B0
    style E fill:#F44336
    style TanStack fill:#E0E0E0
```

**Dependency Rules:**
1. **No circular dependencies** - Clean unidirectional flow
2. **Core is foundation** - All packages depend on `@seashore/core`
3. **Agent is central** - Platform and React build on agents
4. **Data is independent** - Only depends on core

---

## Module System: Pure ESM

Seashore is **ESM-only** (no CommonJS support).

### Import Conventions

**All relative imports MUST use `.js` extensions:**

```typescript
// ✅ CORRECT
import { createLLMAdapter } from './adapter.js'
import type { LLMProvider } from './types.js'

// ❌ WRONG
import { createLLMAdapter } from './adapter'     // Missing .js
import { createLLMAdapter } from './adapter.ts'  // Don't use .ts
```

**Import order:**
1. Third-party imports (frameworks, libraries)
2. Internal imports (other @seashore packages)
3. Relative imports (same package)
4. Type-only imports (using `import type`)

```typescript
// ✅ CORRECT order
import { chat } from '@tanstack/ai'
import { createLLMAdapter } from '@seashore/core'
import { applyGuardrails } from './guardrails.js'
import type { AgentConfig } from './types.js'
```

### Package.json Requirements

Every package must specify:
```json
{
  "type": "module",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  }
}
```

---

## Monorepo Structure

Seashore uses **pnpm workspaces** with **Nx** for task orchestration.

```
seashore/
├── packages/
│   ├── core/           # @seashore/core
│   ├── agent/          # @seashore/agent
│   ├── data/           # @seashore/data
│   ├── platform/       # @seashore/platform
│   └── react/          # @seashore/react
├── examples/           # Usage examples
├── docs/              # Documentation
├── tools/             # Build tools
├── pnpm-workspace.yaml
├── nx.json
└── package.json
```

### Workspace Dependencies

Packages reference each other using `workspace:*`:

```json
{
  "dependencies": {
    "@seashore/core": "workspace:*"
  }
}
```

### Build System

**Build all packages:**
```bash
pnpm nx run-many -t build
```

**Build single package:**
```bash
pnpm --filter @seashore/core build
```

**Nx caching:**
- Caches build outputs for unchanged packages
- Speeds up incremental builds
- Can be disabled with `NX_DAEMON=false`

---

## Type Safety

Seashore is built with **strict TypeScript** configuration.

### Strict Mode Settings

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true
  }
}
```

### Type-Safe Patterns

**Exhaustive switch checks:**
```typescript
function handleProvider(provider: LLMProvider) {
  switch (provider) {
    case 'openai': return createOpenaiChat(...)
    case 'anthropic': return createAnthropicChat(...)
    case 'gemini': return createGeminiChat(...)
    default: {
      const _exhaustive: never = provider
      throw new Error(`Unsupported: ${String(_exhaustive)}`)
    }
  }
}
```

**Type-only exports:**
```typescript
// Export types separately
export type { LLMAdapterConfig, LLMProvider }

// Import types separately
import type { Message } from './types.js'
```

**Zod for runtime validation:**
```typescript
import { z } from 'zod'

const toolSchema = z.object({
  name: z.string(),
  parameters: z.record(z.unknown()),
})

// Type inferred from schema
type Tool = z.infer<typeof toolSchema>
```

---

## Testing Strategy

Seashore uses **Vitest** for fast, TypeScript-native testing.

### Test Structure

**Co-location:**
```
src/
├── adapter.ts
├── adapter.test.ts    # Tests next to implementation
├── types.ts
└── index.ts
```

**Test patterns:**
```typescript
import { describe, it, expect } from 'vitest'
import { createTool } from './toolkit.js'

describe('createTool', () => {
  it('should create a tool with required fields', () => {
    const tool = createTool({
      name: 'test',
      execute: async () => 'result'
    })
    expect(tool.name).toBe('test')
  })

  it('should throw when name is missing', () => {
    expect(() => createTool({} as any)).toThrow('name is required')
  })
})
```

### Running Tests

**All packages:**
```bash
pnpm nx run-many -t test
```

**Single package:**
```bash
pnpm --filter @seashore/core test
```

**Specific test file:**
```bash
pnpm --filter @seashore/core test -- src/llm/adapter.test.ts
```

**Watch mode:**
```bash
pnpm --filter @seashore/agent test:watch
```

---

## Error Handling

Seashore follows **fail-fast principles** with descriptive errors.

### Error Patterns

**Throw descriptive errors:**
```typescript
export function createTool(config: ToolConfig) {
  if (!config.name) {
    throw new Error('Tool name is required')
  }
  if (!config.execute) {
    throw new Error('Tool execute function is required')
  }
  return { ...config }
}
```

**Document errors in JSDoc:**
```typescript
/**
 * Creates an LLM adapter.
 *
 * @throws {Error} If provider is not supported
 * @throws {Error} If apiKey is missing
 */
export function createLLMAdapter(config: LLMAdapterConfig) {
  // ...
}
```

**Use custom error types:**
```typescript
export class WorkflowExecutionError extends Error {
  constructor(
    message: string,
    public readonly stepName: string,
    public readonly cause?: Error
  ) {
    super(message)
    this.name = 'WorkflowExecutionError'
  }
}
```

---

## Async Patterns

Seashore embraces **async/await** throughout.

### Async Best Practices

**Always use async/await:**
```typescript
// ✅ CORRECT
async function processSteps(steps: Step[]) {
  for (const step of steps) {
    await step.execute()
  }
}

// ❌ WRONG
function processSteps(steps: Step[]) {
  return Promise.all(steps.map(step => step.execute()))
}
```

**Parallel execution:**
```typescript
// Execute independent steps in parallel
const results = await Promise.all([
  fetchUserData(),
  fetchSettings(),
  fetchPreferences(),
])
```

**Sequential execution:**
```typescript
// Execute dependent steps sequentially
for (const step of dependentSteps) {
  const result = await step.execute()
  context.state.set(step.name, result)
}
```

---

## Documentation Standards

All exported functions and types must have **JSDoc comments**.

### JSDoc Template

```typescript
/**
 * Brief description of what this function does.
 *
 * More detailed explanation if needed. Can span multiple lines
 * and include important context or caveats.
 *
 * @param config - Description of the parameter
 * @returns Description of what is returned
 *
 * @throws {Error} When something goes wrong
 *
 * @example
 * ```typescript
 * const agent = createReActAgent({
 *   model: () => createOpenaiChat('gpt-4'),
 *   systemPrompt: 'You are helpful',
 *   tools: [searchTool],
 * })
 *
 * const response = await agent.run([
 *   { role: 'user', content: 'Hello!' }
 * ])
 * ```
 */
export function createReActAgent(config: ReActAgentConfig): ReActAgent {
  // ...
}
```

---

## Barrel Exports

Each package uses **barrel exports** to control public API.

### Index File Pattern

```typescript
// src/index.ts - Single entry point
export { createReActAgent, createWorkflow } from './react-agent/index.js'
export type { ReActAgentConfig, AgentResponse } from './react-agent/index.js'

export { createStep, DAG } from './workflow/index.js'
export type { StepConfig, WorkflowResult } from './workflow/index.js'
```

**Rules:**
1. Only export what should be public API
2. Group related exports together
3. Export types separately using `export type`
4. Always update `src/index.ts` when adding new features

---

## Key Design Decisions

### Why TanStack AI?

- **Unified API** across all LLM providers
- **Streaming-first** with excellent DX
- **Type-safe** tool calling
- **Framework-agnostic** core
- **Community-driven** development

### Why Pure ESM?

- **Modern standard** - Future-proof module system
- **Better tree-shaking** - Smaller bundle sizes
- **Simpler imports** - No CJS/ESM dual mode complexity
- **Node.js native** - Works with latest Node.js features

### Why pnpm + Nx?

- **Fast installs** - pnpm's content-addressable store
- **Efficient caching** - Nx task orchestration
- **Workspace protocol** - Simple internal dependencies
- **Scalable** - Handles large monorepos

### Why Drizzle ORM?

- **Type-safe SQL** - Compile-time query validation
- **Zero runtime overhead** - Thin abstraction over SQL
- **pgvector support** - Native vector extension support
- **Migration-friendly** - Schema evolution built-in

---

## Next Steps

- **[Agents](./agents.md)** - Learn about ReAct agents and tool calling
- **[Workflows](./workflows.md)** - Understand DAG-based orchestration
- **[Tools](./tools.md)** - Create custom tools for agents
- **[LLM Adapters](./llm-adapters.md)** - Switch between providers
- **[RAG](./rag.md)** - Build retrieval-augmented generation pipelines
- **[Context](./context.md)** - Engineer effective prompts

---

## Additional Resources

- **[Getting Started Guide](../getting-started/installation.md)**
- **[API Reference](../api/README.md)**
- **[Examples](../../examples/)**
- **[GitHub Repository](https://github.com/seashore/seashore)**
