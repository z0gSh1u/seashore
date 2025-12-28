# Tasks: Add Examples

**Input**: Design documents from `/specs/005-add-examples/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: The examples below include test tasks. Tests are OPTIONAL - only include them if explicitly requested in the feature specification.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [x] T001 Create examples directory at `examples/`
- [x] T002 Add `tsx` and `dotenv` to root `devDependencies` in `package.json`
- [x] T003 Create `examples/.env.example` with `OPENAI_API_KEY` placeholder
- [x] T004 Create `examples/README.md` with setup instructions

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

*No blocking foundational tasks identified beyond setup.*

---

## Phase 3: User Story 1 - Basic Chat Interaction (Priority: P1) 🎯 MVP

**Goal**: Demonstrate simple text generation using `openaiText`.

**Independent Test**: Run `pnpm tsx examples/basic-chat.ts` and verify output.

### Implementation for User Story 1

- [x] T005 [US1] Implement basic chat example in `examples/basic-chat.ts` using `@seashore/llm`

**Checkpoint**: User Story 1 functional.

---

## Phase 4: User Story 2 - Agent with Tools (Priority: P1)

**Goal**: Demonstrate ReAct agent with custom tools.

**Independent Test**: Run `pnpm tsx examples/agent-with-tools.ts` and verify tool usage.

### Implementation for User Story 2

- [x] T006 [US2] Implement agent with tools example in `examples/agent-with-tools.ts` using `@seashore/agent` and `@seashore/tool`

**Checkpoint**: User Story 2 functional.

---

## Phase 5: User Story 3 - Streaming Response (Priority: P2)

**Goal**: Demonstrate streaming text generation.

**Independent Test**: Run `pnpm tsx examples/streaming-response.ts` and verify incremental output.

### Implementation for User Story 3

- [x] T007 [US3] Implement streaming response example in `examples/streaming-response.ts` using `@seashore/agent`

**Checkpoint**: User Story 3 functional.

---

## Phase 6: User Story 4 - RAG Knowledge Base (Priority: P2)

**Goal**: Demonstrate document ingestion and retrieval.

**Independent Test**: Run `pnpm tsx examples/rag-knowledge-base.ts` and verify retrieval.

### Implementation for User Story 4

- [x] T008 [US4] Implement RAG example in `examples/rag-knowledge-base.ts` using `@seashore/rag` and mock vector store

**Checkpoint**: User Story 4 functional.

---

## Phase 7: User Story 5 - Workflow Chain (Priority: P3)

**Goal**: Demonstrate multi-step workflow orchestration.

**Independent Test**: Run `pnpm tsx examples/workflow-chain.ts` and verify workflow execution.

### Implementation for User Story 5

- [x] T009 [US5] Implement workflow chain example in `examples/workflow-chain.ts` using `@seashore/workflow`

**Checkpoint**: User Story 5 functional.

---

## Phase 8: User Story 6 - Memory Persistence (Priority: P3)

**Goal**: Demonstrate conversation history management.

**Independent Test**: Run `pnpm tsx examples/memory-persistence.ts` and verify context retention.

### Implementation for User Story 6

- [x] T010 [US6] Implement memory persistence example in `examples/memory-persistence.ts` using `@seashore/memory`

**Checkpoint**: User Story 6 functional.

---

## Final Phase: Polish & Cross-Cutting Concerns

- [x] T011 Verify all examples run successfully with valid API key
- [x] T012 Ensure all examples handle missing API key gracefully

## Dependencies

1.  **Setup** (T001-T004) must be done first.
2.  **User Stories** (T005-T010) can be implemented in parallel or sequentially.
3.  **Polish** (T011-T012) runs last.

## Parallel Execution Examples

- **Developer A**: Implement US1 (T005) and US2 (T006)
- **Developer B**: Implement US3 (T007) and US4 (T008)
- **Developer C**: Implement US5 (T009) and US6 (T010)

## Implementation Strategy

1.  **MVP**: Complete Setup and US1 (Basic Chat).
2.  **Core Features**: Complete US2 (Tools) and US3 (Streaming).
3.  **Advanced Features**: Complete US4 (RAG), US5 (Workflow), US6 (Memory).
