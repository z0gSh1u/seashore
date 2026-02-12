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

### 3. [RAG Chatbot](./rag-chatbot)
Full RAG pipeline with pgvector and hybrid search.

**Demonstrates:**
- Document indexing
- Vector embeddings
- Hybrid search (semantic + BM25)
- RAG-powered chat
- PostgreSQL + pgvector integration

**Run:**
```bash
cd rag-chatbot
pnpm install
# Setup database (see rag-chatbot/README.md)
pnpm run setup
pnpm run index
pnpm start
```

### 4. [MCP Integration](./mcp-integration)
Connect to MCP (Model Context Protocol) servers and use external tools.

**Demonstrates:**
- MCP client connection (stdio and SSE)
- Converting MCP tools to Seashore format
- Creating standalone MCP servers
- Using MCP tools in agents
- Tool interoperability

**Run:**
```bash
cd mcp-integration
pnpm install
export OPENAI_API_KEY='your-key'
pnpm start
```

### 5. [Guardrails](./guardrails)
Security guardrails for input validation and output filtering.

**Demonstrates:**
- Rule-based guardrails (prompt injection, PII detection)
- LLM-based guardrails (content moderation)
- Combining multiple guardrails
- Rate limiting and abuse prevention
- Agent protection patterns

**Run:**
```bash
cd guardrails
pnpm install
export OPENAI_API_KEY='your-key'
pnpm start
```

### 6. [Full-Stack App](./fullstack-app)
Complete production-ready application with Hono backend and React frontend.

**Demonstrates:**
- Hono deployment with seashoreMiddleware
- SSE streaming for real-time responses
- React hooks (`useSeashoreChat`)
- Thread management with PostgreSQL
- Modern chat UI with sidebar
- Production deployment patterns
- Monorepo setup (backend + frontend)

**Run:**
```bash
cd fullstack-app
pnpm install
# Setup database (see fullstack-app/README.md)
cp .env.example .env
# Edit .env with your API key
pnpm dev
# Open http://localhost:5173
```

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
