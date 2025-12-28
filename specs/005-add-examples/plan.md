# Implementation Plan: Add Examples

**Branch**: `005-add-examples` | **Date**: 2025-12-28 | **Spec**: [specs/005-add-examples/spec.md](specs/005-add-examples/spec.md)
**Input**: Feature specification from `/specs/005-add-examples/spec.md`

## Summary

Create a comprehensive set of runnable examples in the `examples/` directory to demonstrate the core capabilities of the Seashore framework, including Agents, Tools, LLM integration, Workflows, RAG, and Memory.

## Technical Context

**Language/Version**: TypeScript 5.x (Node >= 20.0.0)
**Primary Dependencies**: `@seashore/*` packages, `zod`, `dotenv`, `tsx`
**Storage**: In-memory mocks for examples to avoid DB requirements
**Testing**: Manual verification by running scripts
**Target Platform**: Node.js CLI
**Project Type**: Monorepo (pnpm)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **TanStack AI Priority**: Examples will use `@seashore/llm` which wraps `@tanstack/ai`.
- **Test as Gate**: Examples serve as integration tests/demos.
- **Documentation First**: Examples are documentation.
- **React 18**: N/A (CLI examples).
- **Hono**: N/A (CLI examples).

## Project Structure

### Documentation (this feature)

```text
specs/005-add-examples/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
└── tasks.md             # Phase 2 output
```

### Source Code (repository root)

```text
examples/
├── .env.example
├── basic-chat.ts
├── agent-with-tools.ts
├── streaming-response.ts
├── rag-knowledge-base.ts
├── workflow-chain.ts
├── memory-persistence.ts
└── README.md
```

## Phases

### Phase 0: Outline & Research

1.  **Research**: Analyze package exports and dependencies. (Done)
2.  **Dependencies**: Identify need for `tsx` and `dotenv`. (Done)

### Phase 1: Design & Contracts

1.  **Data Model**: Define the list of examples and their purpose.
2.  **Quickstart**: Create a guide on how to run the examples.
3.  **Agent Context**: Update agent context with new example patterns.

### Phase 2: Implementation

1.  **Setup**: Add `tsx` and `dotenv` to root `devDependencies`.
2.  **Create Examples**: Implement each TypeScript file.
3.  **Documentation**: Create `examples/README.md`.
4.  **Verification**: Run each example to ensure correctness.

## Complexity Tracking

N/A
