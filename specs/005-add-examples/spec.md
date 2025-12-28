# Feature Specification: Add Examples

**Feature Branch**: `005-add-examples`  
**Created**: 2025-12-28  
**Status**: Draft  
**Input**: User description: "Create examples directory with concrete runnable cases based on project understanding."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Basic Chat Interaction (Priority: P1)

A developer wants to see the simplest possible usage of the library: sending a message to an LLM and getting a response. This serves as the "Hello World" of the framework.

**Why this priority**: Essential for verifying installation and configuration.

**Independent Test**: Execute the basic chat example script and verify it prints a response from the LLM.

**Acceptance Scenarios**:

1. **Given** valid credentials, **When** running the basic chat example, **Then** the script outputs a text response from the model.
2. **Given** invalid credentials, **When** running the example, **Then** the script fails with a clear error message.

---

### User Story 2 - Agent with Tools (Priority: P1)

A developer wants to understand how to create a ReAct agent that can use tools. This demonstrates the core value proposition of the framework.

**Why this priority**: Tools are the primary way agents interact with the world.

**Independent Test**: Execute the agent-with-tools example which includes a mock tool (e.g., weather or calculator), and verify the agent calls the tool and uses the result.

**Acceptance Scenarios**:

1. **Given** a user query requiring a tool (e.g., "What is the weather?"), **When** running the agent example, **Then** the agent executes the tool and incorporates the result into the final answer.
2. **Given** a custom tool definition, **When** the agent runs, **Then** it correctly validates inputs against the tool's schema.

---

### User Story 3 - Streaming Response (Priority: P2)

A developer wants to implement a chat interface with real-time feedback. They need to see how to consume the streaming API.

**Why this priority**: Streaming is standard for LLM UX to reduce perceived latency.

**Independent Test**: Execute the streaming response example and verify text is output chunk by chunk.

**Acceptance Scenarios**:

1. **Given** a streaming request, **When** running the example, **Then** the output appears incrementally in the console.

---

### User Story 4 - RAG Knowledge Base (Priority: P2)

A developer wants to build a bot that answers questions based on specific documents. They need an example of ingesting data and querying it.

**Why this priority**: RAG is a very common use case for enterprise applications.

**Independent Test**: Execute the RAG example which ingests a sample text and answers a question based on it.

**Acceptance Scenarios**:

1. **Given** a sample document, **When** the example runs, **Then** it indexes the document into a vector store.
2. **Given** a query about the document, **When** the agent answers, **Then** the response contains information found only in the document.

---

### User Story 5 - Workflow Chain (Priority: P3)

A developer wants to orchestrate a multi-step process where the output of one agent feeds into another.

**Why this priority**: Demonstrates the workflow capabilities for complex tasks.

**Independent Test**: Execute the workflow chain example (e.g., Generate Outline -> Write Article) and verify the final output follows the outline.

**Acceptance Scenarios**:

1. **Given** a defined workflow with two nodes, **When** running the example, **Then** the second node receives input from the first node.

---

### User Story 6 - Memory Persistence (Priority: P3)

A developer wants the agent to remember context across multiple turns of conversation.

**Why this priority**: Essential for chat applications that need to maintain state.

**Independent Test**: Execute the memory persistence example where the user states a fact in turn 1 and asks about it in turn 2.

**Acceptance Scenarios**:

1. **Given** a conversation history, **When** the user asks a follow-up question, **Then** the agent answers correctly based on previous context.

### Edge Cases

- **Missing Credentials**: Examples should handle missing environment variables gracefully.
- **Network Errors**: Basic error handling should be demonstrated.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST provide a dedicated directory for examples.
- **FR-002**: The system MUST include an example demonstrating simple LLM text generation (`basic-chat`).
- **FR-003**: The system MUST include an example demonstrating tool definition and ReAct loop (`agent-with-tools`).
- **FR-004**: The system MUST include an example demonstrating streaming responses (`streaming-response`).
- **FR-005**: The system MUST include an example demonstrating document ingestion and retrieval (`rag-knowledge-base`).
- **FR-006**: The system MUST include an example demonstrating connecting nodes in a workflow (`workflow-chain`).
- **FR-007**: The system MUST include an example demonstrating conversation history (`memory-persistence`).
- **FR-008**: All examples MUST use OpenAI as the default model provider.
- **FR-009**: All examples MUST be written in TypeScript and be directly runnable.
- **FR-10**: Examples MUST NOT require complex external setup (use in-memory stores or mocks where possible).

### Key Entities

- **Example Script**: A standalone TypeScript file demonstrating a specific feature.

## Assumptions

- Users have a valid OpenAI API key.
- Users have a Node.js environment capable of running TypeScript (e.g., via `ts-node` or `tsx`).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A developer can run any example script successfully after setting necessary credentials.
- **SC-002**: The examples cover at least 80% of the core modules defined in the project structure.
- **SC-003**: Code in examples is clean, commented, and serves as a copy-pasteable reference.
