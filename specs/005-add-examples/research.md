# Research: Add Examples

**Feature**: Add Examples
**Status**: Complete

## Technical Context

The project is a monorepo using `pnpm` workspaces. The core packages are:
- `@seashore/agent`: The main agent framework (ReAct, Workflow).
- `@seashore/llm`: LLM adapters wrapping `@tanstack/ai`.
- `@seashore/tool`: Tool definition and validation.
- `@seashore/workflow`: Workflow orchestration.
- `@seashore/rag`: RAG capabilities.
- `@seashore/memory`: Memory management.

## Execution Strategy

To run TypeScript examples directly without a build step, we will use `tsx`. It supports ESM and TypeScript out of the box and is fast.

**Decision**: Add `tsx` and `dotenv` to root `devDependencies`.

## Example Structure

We will create a flat `examples/` directory in the root. Each example will be a standalone file.

### 1. Basic Chat (`examples/basic-chat.ts`)
- **Goal**: Demonstrate `openaiText` and `chat` from `@seashore/llm`.
- **Key Imports**: `openaiText` from `@seashore/llm`.

### 2. Agent with Tools (`examples/agent-with-tools.ts`)
- **Goal**: Demonstrate `createAgent` and `defineTool`.
- **Key Imports**: `createAgent` from `@seashore/agent`, `defineTool` from `@seashore/tool`.

### 3. Streaming Response (`examples/streaming-response.ts`)
- **Goal**: Demonstrate streaming.
- **Key Imports**: `createAgent` from `@seashore/agent`.

### 4. RAG Knowledge Base (`examples/rag-knowledge-base.ts`)
- **Goal**: Demonstrate vector store usage.
- **Key Imports**: `@seashore/rag`, `@seashore/vectordb`.
- **Note**: Might need a mock vector store or an in-memory one if available, to avoid requiring a running DB. `pgvector` is used in `@seashore/vectordb`, so we might need to mock it or use a simple in-memory implementation for the example if possible. If not, we'll document the requirement.
- **Refinement**: `@seashore/vectordb` depends on `pgvector` and `drizzle-orm`. Setting up Postgres for a simple example is too heavy. I should check if there's an in-memory adapter or if I can mock it easily. If not, I might skip the actual DB part and just show the code structure, or use a mock implementation of the vector store interface.

### 5. Workflow Chain (`examples/workflow-chain.ts`)
- **Goal**: Demonstrate `createWorkflow`.
- **Key Imports**: `@seashore/workflow`.

### 6. Memory Persistence (`examples/memory-persistence.ts`)
- **Goal**: Demonstrate memory.
- **Key Imports**: `@seashore/memory`.

## Dependencies

- `zod`: Already in workspace.
- `dotenv`: Need to add.
- `tsx`: Need to add.

## Risks

- **Database Dependencies**: RAG and Memory examples might require a database. We should try to provide in-memory alternatives or mocks for the examples to be "runnable" without infrastructure.
- **API Keys**: Users need keys. We'll use `dotenv` and provide a `.env.example`.
