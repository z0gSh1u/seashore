# Data Model: Examples

**Feature**: Add Examples

## Entities

### Example Script

Represents a standalone runnable TypeScript file demonstrating a specific feature.

| Field | Type | Description |
|-------|------|-------------|
| `filename` | `string` | The name of the file (e.g., `basic-chat.ts`) |
| `description` | `string` | What the example demonstrates |
| `dependencies` | `string[]` | List of `@seashore/*` packages used |
| `envVars` | `string[]` | Required environment variables (e.g., `OPENAI_API_KEY`) |

## Example Definitions

### 1. Basic Chat
- **Filename**: `basic-chat.ts`
- **Description**: Simple text generation using `openaiText`.
- **Dependencies**: `@seashore/llm`
- **EnvVars**: `OPENAI_API_KEY`

### 2. Agent with Tools
- **Filename**: `agent-with-tools.ts`
- **Description**: ReAct agent using a custom tool.
- **Dependencies**: `@seashore/agent`, `@seashore/tool`, `@seashore/llm`
- **EnvVars**: `OPENAI_API_KEY`

### 3. Streaming Response
- **Filename**: `streaming-response.ts`
- **Description**: Streaming text generation.
- **Dependencies**: `@seashore/agent`, `@seashore/llm`
- **EnvVars**: `OPENAI_API_KEY`

### 4. RAG Knowledge Base
- **Filename**: `rag-knowledge-base.ts`
- **Description**: Document ingestion and retrieval (using mock store).
- **Dependencies**: `@seashore/rag`, `@seashore/vectordb`, `@seashore/llm`
- **EnvVars**: `OPENAI_API_KEY`

### 5. Workflow Chain
- **Filename**: `workflow-chain.ts`
- **Description**: Multi-step workflow.
- **Dependencies**: `@seashore/workflow`, `@seashore/agent`, `@seashore/llm`
- **EnvVars**: `OPENAI_API_KEY`

### 6. Memory Persistence
- **Filename**: `memory-persistence.ts`
- **Description**: Conversation history (using in-memory storage).
- **Dependencies**: `@seashore/memory`, `@seashore/agent`, `@seashore/llm`
- **EnvVars**: `OPENAI_API_KEY`
