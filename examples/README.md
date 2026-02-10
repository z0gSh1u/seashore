# Seashore Examples

This directory contains example applications demonstrating various features of the Seashore framework.

## Available Examples

### 1. [Basic Agent](./basic-agent)
Simple ReAct agent with custom tools.

**Demonstrates:**
- LLM adapter setup
- Custom tool creation
- Agent configuration
- Streaming responses

**Run:**
```bash
cd basic-agent
pnpm install
export OPENAI_API_KEY='your-key'
pnpm start
```

### 2. [Workflow](./workflow)
DAG-based workflow orchestration.

**Demonstrates:**
- Linear workflows
- Parallel execution
- Multi-stage pipelines
- Dependency resolution

**Run:**
```bash
cd workflow
pnpm install
pnpm start
```

## Coming Soon

### 3. RAG Chatbot
Full RAG pipeline with pgvector and hybrid search.

**Will demonstrate:**
- Document indexing
- Vector embeddings
- Hybrid search (semantic + BM25)
- RAG-powered chat

### 4. Full-Stack App
Complete application with Hono backend and React frontend.

**Will demonstrate:**
- Hono deployment middleware
- SSE streaming
- React hooks (`useSeashorChat`)
- Thread management
- Production deployment

## Requirements

All examples require:
- Node.js 18+
- pnpm 9+
- TypeScript 5.7+

Individual examples may have additional requirements (e.g., PostgreSQL for RAG examples).

## Development

Examples use workspace dependencies, so changes to packages are immediately reflected:

```bash
# From repo root
pnpm install
pnpm nx run-many -t build

# Then run any example
cd examples/basic-agent
pnpm start
```

## Structure

Each example follows this structure:
```
example-name/
├── package.json      # Dependencies
├── index.ts          # Main implementation
├── README.md         # Documentation
└── tsconfig.json     # TypeScript config (if needed)
```

## Contributing

Have an idea for a new example? Please open an issue or submit a PR!
