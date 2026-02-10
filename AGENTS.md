# Agent Development Guide for Seashore

This guide is for AI coding agents working in the Seashore codebase. Follow these conventions strictly.

## Project Structure

Seashore is a **pnpm monorepo** managed by **Nx** with 5 packages:
- `@seashore/core` - LLM adapters, embeddings, tools, context utilities
- `@seashore/agent` - ReAct agents, workflow orchestration (DAG)
- `@seashore/data` - PostgreSQL storage, pgvector, RAG pipelines
- `@seashore/platform` - MCP integration, guardrails, evaluation, deployment
- `@seashore/react` - React hooks for streaming chat

All packages are **ESM-only** (no CommonJS), TypeScript 5.7+, Node.js 20+.

## Build, Lint, and Test Commands

### Run All Packages
```bash
# Build all packages
pnpm nx run-many -t build

# Test all packages
pnpm nx run-many -t test

# Typecheck all packages
pnpm nx run-many -t typecheck
```

### Run Single Package
```bash
# Build single package
pnpm --filter @seashore/core build

# Test single package
pnpm --filter @seashore/agent test

# Typecheck single package
pnpm --filter @seashore/data typecheck
```

### Run Single Test File
```bash
# Run specific test file
pnpm --filter @seashore/core test -- src/llm/adapter.test.ts

# Run with watch mode
pnpm --filter @seashore/agent test:watch

# Run from package directory
cd packages/core
pnpm test -- src/tool/toolkit.test.ts
```

### Nx Cache Control
```bash
# Disable Nx daemon for consistent builds
NX_DAEMON=false pnpm nx run-many -t build

# Clear Nx cache if needed
pnpm nx reset
```

## Code Style Guidelines

### Module System: Pure ESM
- **All imports MUST use `.js` extensions** (even for `.ts` files)
- Use `type: "module"` in all package.json
- No CommonJS (`require`, `module.exports`)

```typescript
// ✅ CORRECT
import { createLLMAdapter } from './adapter.js'
import type { LLMProvider } from './types.js'

// ❌ WRONG
import { createLLMAdapter } from './adapter'     // Missing .js
import { createLLMAdapter } from './adapter.ts'  // Don't use .ts
```

### Imports Order
1. Third-party imports (framework, libraries)
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

### TypeScript Conventions

#### Strict Type Safety
- Use `strict: true` (already configured)
- Enable `noUncheckedIndexedAccess: true`
- No `any` types (use `unknown` or proper types)
- Use exhaustive switch checks with `never`

```typescript
// ✅ CORRECT: Exhaustive check
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

#### Type Exports
- Export types using `export type` for type-only exports
- Use `import type` when importing only types

```typescript
// ✅ CORRECT
export type { LLMAdapterConfig, LLMProvider }
import type { Message } from './types.js'

// ❌ WRONG
export { LLMAdapterConfig }  // Not type-only
import { Message } from './types.js'  // Runtime import for type
```

### Naming Conventions
- **Functions**: camelCase, start with verb (`createTool`, `applyGuardrails`)
- **Types/Interfaces**: PascalCase, descriptive (`ReActAgentConfig`, `AgentResult`)
- **Constants**: SCREAMING_SNAKE_CASE or camelCase for exported values
- **Files**: kebab-case for implementation, match export name for main files

```typescript
// ✅ CORRECT naming
export function createReActAgent(config: ReActAgentConfig): ReActAgent
export type AgentResponse = { messages: Message[]; result: AgentResult }
export const DEFAULT_MAX_ITERATIONS = 10

// File names
src/react-agent/agent.ts        // Implementation
src/react-agent/types.ts        // Types
src/react-agent/agent.test.ts   // Tests
```

### Error Handling
- Throw descriptive errors with context
- Use `Error` class or custom error types
- Document errors in JSDoc `@throws` tags

```typescript
// ✅ CORRECT
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

### Async/Await
- Always use `async/await`, not raw Promises
- Handle errors at appropriate boundaries
- Use `Promise.all()` for parallel operations

```typescript
// ✅ CORRECT
async function processSteps(steps: Step[]) {
  // Parallel execution
  const results = await Promise.all(
    independentSteps.map(step => step.execute())
  )
  // Sequential execution
  for (const step of dependentSteps) {
    await step.execute()
  }
}
```

## Testing with Vitest

### Test Structure
- Co-locate tests: `foo.ts` → `foo.test.ts` in same directory
- Use `describe` blocks for grouping
- Use descriptive test names with `should`

```typescript
import { describe, it, expect } from 'vitest'
import { createTool } from './toolkit.js'

describe('createTool', () => {
  it('should create a tool with required fields', () => {
    const tool = createTool({ name: 'test', execute: async () => 'result' })
    expect(tool.name).toBe('test')
  })

  it('should throw when name is missing', () => {
    expect(() => createTool({} as any)).toThrow('name is required')
  })
})
```

### Test Patterns
- Use factories/builders for complex setup
- Mock external dependencies (LLMs, databases)
- Test happy path AND error cases

## Barrel Exports
Each package has `src/index.ts` that re-exports public API:

```typescript
// src/index.ts - Barrel export pattern
export { createReActAgent, createWorkflow } from './react-agent/index.js'
export type { ReActAgentConfig, AgentResponse } from './react-agent/index.js'
```

**When adding new features**: Always update barrel exports in `src/index.ts`

## Dependencies
- Use `workspace:*` for internal packages in package.json
- Use `catalog:` for shared dev dependencies (TypeScript, Vitest, Rollup)
- TanStack AI (NOT Vercel AI SDK)

## Documentation
- Add JSDoc comments to all exported functions/types
- Include `@example` blocks for complex APIs
- Document parameters with `@param` and return values with `@returns`

```typescript
/**
 * Creates a ReAct agent that can use tools and iterate through steps.
 *
 * @param config - Agent configuration
 * @returns ReAct agent instance
 *
 * @example
 * ```typescript
 * const agent = createReActAgent({
 *   llm: createLLMAdapter({ provider: 'openai', apiKey: '...' }),
 *   tools: [searchTool],
 *   maxIterations: 5
 * })
 * ```
 */
export function createReActAgent(config: ReActAgentConfig): ReActAgent {
  // ...
}
```

## Common Pitfalls
1. **Missing .js extensions** - Always add `.js` to relative imports
2. **Using .ts extensions** - Never import with `.ts`, use `.js`
3. **Forgetting barrel exports** - Update `src/index.ts` when adding exports
4. **Any types** - Use proper types or `unknown`
5. **Non-exhaustive switches** - Always add `default` with `never` check
