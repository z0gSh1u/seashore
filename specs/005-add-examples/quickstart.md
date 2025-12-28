# Quickstart: Running Examples

**Feature**: Add Examples

## Prerequisites

- Node.js >= 20.0.0
- pnpm
- OpenAI API Key

## Setup

1.  **Install Dependencies**:
    ```bash
    pnpm install
    ```

2.  **Configure Environment**:
    Copy `.env.example` to `.env` in the `examples/` directory and add your API key.
    ```bash
    cp examples/.env.example examples/.env
    # Edit examples/.env
    ```

## Running Examples

We use `tsx` to run the TypeScript examples directly.

### Basic Chat

```bash
pnpm tsx examples/basic-chat.ts
```

### Agent with Tools

```bash
pnpm tsx examples/agent-with-tools.ts
```

### Streaming Response

```bash
pnpm tsx examples/streaming-response.ts
```

### RAG Knowledge Base

```bash
pnpm tsx examples/rag-knowledge-base.ts
```

### Workflow Chain

```bash
pnpm tsx examples/workflow-chain.ts
```

### Memory Persistence

```bash
pnpm tsx examples/memory-persistence.ts
```
