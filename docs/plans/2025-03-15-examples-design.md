# Seashore Examples Design

## Overview

A progressive examples suite for the Seashore AI agent framework. Each example demonstrates specific features in an isolated, runnable TypeScript file.

## Goals

- **Progressive Learning**: From single concepts to complex scenarios
- **Runnable Verification**: Each example validates corresponding functionality
- **Minimal Setup**: Single command to run any example
- **Clear Documentation**: Self-contained files with inline explanations

## Architecture

### Directory Structure

```
examples/
├── package.json           # Dependencies and scripts
├── .env.example           # Environment variables template
├── README.md              # Usage guide
├── 01-basic/              # Single concept examples
│   ├── 01-hello-llm.ts
│   ├── 02-simple-tool.ts
│   ├── 03-workflow-chain.ts
│   ├── 04-embedding.ts
│   └── 05-storage.ts
├── 02-intermediate/       # Feature combinations
│   ├── 01-react-agent.ts
│   ├── 02-rag-search.ts
│   ├── 03-guardrails.ts
│   └── 04-mcp-tools.ts
└── 03-advanced/           # Complete scenarios
    ├── 01-doc-chatbot.ts
    ├── 02-multi-agent.ts
    └── 03-deploy-api.ts
```

### Running Examples

```bash
# Basic examples
pnpm example 01-basic/01-hello-llm.ts

# Intermediate examples
pnpm example 02-intermediate/01-react-agent.ts

# Advanced examples
pnpm example 03-advanced/01-doc-chatbot.ts
```

## Example Categories

### 01-basic: Core Concepts

Each example introduces one fundamental concept:

| File                   | Package           | Concept                    |
| ---------------------- | ----------------- | -------------------------- |
| `01-hello-llm.ts`      | `@seashore/core`  | LLM adapter basics         |
| `02-simple-tool.ts`    | `@seashore/core`  | Creating and using tools   |
| `03-workflow-chain.ts` | `@seashore/agent` | DAG workflow creation      |
| `04-embedding.ts`      | `@seashore/core`  | Text embeddings            |
| `05-storage.ts`        | `@seashore/data`  | Message/thread persistence |

### 02-intermediate: Feature Combinations

Combines multiple packages and features:

| File                | Packages     | Concepts                        |
| ------------------- | ------------ | ------------------------------- |
| `01-react-agent.ts` | core + agent | Agent with tools                |
| `02-rag-search.ts`  | core + data  | Embedding + vector search + RAG |
| `03-guardrails.ts`  | platform     | Input/output filtering          |
| `04-mcp-tools.ts`   | platform     | MCP server integration          |

### 03-advanced: Real-World Scenarios

Complete applications demonstrating production patterns:

| File                | Packages            | Scenario                               |
| ------------------- | ------------------- | -------------------------------------- |
| `01-doc-chatbot.ts` | core + agent + data | Document Q&A with persistence          |
| `02-multi-agent.ts` | agent               | Workflow orchestrating multiple agents |
| `03-deploy-api.ts`  | platform            | Hono-based API deployment              |

## Environment Configuration

### Required Variables

```bash
# LLM Providers
OPENAI_API_KEY=your_key_here
OPENAI_BASE_URL=https://api.openai.com/v1  # Optional: custom endpoint

ANTHROPIC_API_KEY=your_key_here
ANTHROPIC_BASE_URL=https://api.anthropic.com  # Optional

# Database (for data examples)
DATABASE_URL=postgresql://user:pass@localhost:5432/db

# Vector DB (if separate from main DB)
VECTOR_DB_URL=postgresql://user:pass@localhost:5432/vectordb
```

### Usage in Examples

```typescript
// Environment validation
const apiKey = process.env.OPENAI_API_KEY;
const baseURL = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';

if (!apiKey) {
  console.error('Error: OPENAI_API_KEY is required');
  console.error('Please copy .env.example to .env and fill in your keys');
  process.exit(1);
}

// Configure adapter with custom base URL
const llm = createLLMAdapter({
  provider: 'openai',
  apiKey,
  baseURL, // Support custom endpoints (e.g., proxy, local models)
});
```

## Code Standards

### File Template

````typescript
/**
 * Example: [Title]
 *
 * Purpose: Brief description of what this example demonstrates
 *
 * Prerequisites:
 * - Required API keys in .env file
 * - Any database or service setup
 *
 * Learning Objectives:
 * 1. First concept to learn
 * 2. Second concept to learn
 *
 * Expected Output:
 * ```
 * Example output here
 * ```
 */

import { createLLMAdapter } from '@seashore/core';
import type { Message } from '@seashore/agent';

// Configuration
const config = {
  apiKey: process.env.OPENAI_API_KEY!,
  baseURL: process.env.OPENAI_BASE_URL,
};

// Main logic
async function main(): Promise<void> {
  // Example implementation
}

// Error handling
main().catch((error: Error) => {
  console.error('Fatal error:', error.message);
  process.exit(1);
});
````

### Error Handling Patterns

All examples implement consistent error handling:

1. **Environment Validation**: Check required variables before running
2. **API Error Handling**: Catch and explain common API errors (rate limits, auth)
3. **Graceful Degradation**: Provide helpful error messages with next steps

## Testing Strategy

### Verification Approach

- Each example serves as an integration test for demonstrated features
- Running successfully = feature is working
- Failures indicate regressions or configuration issues

### CI Integration

Examples can be categorized for CI:

- **No API Key Required**: Can run in CI with mocks
- **API Key Required**: Run locally or with secrets in CI
- **Database Required**: Require PostgreSQL/pgvector setup

### Pre-Commit Verification

Before submitting PRs affecting specific packages:

```bash
# Test core package changes
pnpm example 01-basic/01-hello-llm.ts
pnpm example 01-basic/02-simple-tool.ts

# Test agent package changes
pnpm example 02-intermediate/01-react-agent.ts

# Test data package changes
pnpm example 02-intermediate/02-rag-search.ts
```

## Dependencies

### Shared Dependencies

All examples share dependencies defined in `examples/package.json`:

```json
{
  "dependencies": {
    "@seashore/agent": "workspace:*",
    "@seashore/core": "workspace:*",
    "@seashore/data": "workspace:*",
    "@seashore/platform": "workspace:*",
    "@seashore/react": "workspace:*"
  },
  "devDependencies": {
    "tsx": "^4.19.0",
    "typescript": "catalog:"
  }
}
```

### No Per-Example Dependencies

- Keep all dependencies at the `examples/` level
- Avoid adding dependencies to individual examples
- Use workspace protocol for internal packages

## Future Enhancements

Potential additions after initial implementation:

1. **Interactive Examples**: Add CLI prompts for user input
2. **Output Comparison**: Expected vs actual output validation
3. **Benchmark Examples**: Performance testing templates
4. **Custom Provider Examples**: Ollama, local model integration
5. **React Examples**: Frontend integration demonstrations

## Implementation Checklist

- [ ] Set up `examples/package.json` with dependencies
- [ ] Create `.env.example` with all required variables
- [ ] Write `examples/README.md` usage guide
- [ ] Implement 01-basic examples (5 files)
- [ ] Implement 02-intermediate examples (4 files)
- [ ] Implement 03-advanced examples (3 files)
- [ ] Add inline comments and documentation
- [ ] Test each example locally
- [ ] Update main README.md examples section

## References

- [Seashore README](../README.md)
- [AGENTS.md](../AGENTS.md) - Code conventions and standards
- Package documentation in `/packages/*/README.md`
