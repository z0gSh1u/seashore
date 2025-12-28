# Seashore Examples

This directory contains runnable examples demonstrating the core capabilities of the Seashore framework.

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
    Copy `.env.example` to `.env` in this directory and add your API key.
    ```bash
    cp .env.example .env
    # Edit .env to add your OPENAI_API_KEY
    ```

## Running Examples

Since this is a standalone package, you can run examples using `pnpm` scripts from within the `examples` directory.

First, ensure you are in the `examples` directory:

```bash
cd examples
pnpm install
```

### Basic Chat

```bash
pnpm basic-chat
# or
pnpm tsx basic-chat.ts
```

### Agent with Tools

```bash
pnpm agent-with-tools
# or
pnpm tsx agent-with-tools.ts
```

### Streaming Response

```bash
pnpm streaming-response
# or
pnpm tsx streaming-response.ts
```

### RAG Knowledge Base

```bash
pnpm rag-knowledge-base
# or
pnpm tsx rag-knowledge-base.ts
```

### Workflow Chain

```bash
pnpm workflow-chain
# or
pnpm tsx workflow-chain.ts
```

### Memory Persistence

```bash
pnpm memory-persistence
# or
pnpm tsx memory-persistence.ts
```
