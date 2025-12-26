# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2024-01-XX

### Added

#### Core Packages

- **@seashore/agent** - ReAct agent implementation
  - `createAgent` - Create a ReAct agent with LLM and tools
  - Support for streaming responses
  - Thread management for conversation history
  - Workflow agent for complex multi-step tasks

- **@seashore/llm** - LLM adapters and utilities
  - OpenAI adapter (`openaiText`, `openaiEmbedding`)
  - Anthropic adapter (`anthropicText`)
  - Streaming support for all adapters
  - Retry logic with exponential backoff
  - Structured output with JSON schema

- **@seashore/tool** - Tool definition and execution
  - `defineTool` - Type-safe tool definition with Zod
  - `createToolkit` - Group related tools
  - Automatic parameter validation

#### Feature Packages

- **@seashore/workflow** - Visual workflow builder
  - `createWorkflow` - Build agent pipelines
  - Node types: start, end, agent, conditional, parallel
  - State management across workflow execution
  - Checkpoint and resume support

- **@seashore/rag** - Retrieval-augmented generation
  - `createRAG` - Full RAG pipeline
  - Document loaders: text, JSON, PDF, web
  - Text splitters: character, recursive, semantic
  - Query with context injection

- **@seashore/memory** - Memory management
  - Short-term memory (recent context)
  - Mid-term memory (session summaries)
  - Long-term memory (vector-based retrieval)
  - Memory consolidation strategies

- **@seashore/storage** - Storage adapters
  - Drizzle ORM integration
  - SQLite, PostgreSQL, Turso support
  - Thread and message persistence

- **@seashore/vectordb** - Vector database
  - In-memory vector store
  - pgvector integration
  - Similarity search with filtering

#### Integration Packages

- **@seashore/mcp** - Model Context Protocol client
  - `createMCPClient` - Connect to MCP servers
  - Transport: stdio, SSE, WebSocket
  - `createMCPToolBridge` - Use MCP tools in agents
  - `discoverMCPServers` - Auto-discover servers

- **@seashore/genui** - Generative UI components
  - `Chat` - Complete chat interface
  - `useChat` - React hook for chat state
  - `useChatStream` - Streaming chat hook
  - Tool result rendering
  - Custom component registry

- **@seashore/deploy** - Deployment utilities
  - `createServer` - Hono-based API server
  - Cloudflare Workers adapter
  - Node.js adapter
  - SSE streaming support
  - Rate limiting and authentication

#### Platform Packages

- **@seashore/observability** - Tracing and logging
  - `createTracer` - Distributed tracing
  - `createLogger` - Structured logging
  - `createTokenCounter` - Token usage tracking
  - OTLP and console exporters

- **@seashore/evaluation** - Evaluation metrics
  - `createEvaluator` - Evaluate agent outputs
  - Built-in metrics: relevance, faithfulness, coherence, harmfulness
  - Custom metric support
  - Dataset management
  - HTML/Markdown/JSON reports

- **@seashore/security** - Security guardrails
  - `createGuardrails` - Input/output validation
  - Prompt injection detection
  - PII detection and redaction
  - Toxicity detection
  - Topic blocking
  - Security middleware for agents

### Technical Details

- ESM-only package distribution
- Full TypeScript support with type declarations
- Nx monorepo with pnpm workspaces
- Vitest for testing
- Rollup for bundling
- Cloudflare Workers compatible

### Known Limitations

- Memory package requires external vector database for long-term memory
- MCP WebSocket transport requires browser or Node.js with `ws` package
- Evaluation LLM-based metrics require an LLM adapter

---

## Future Releases

### Planned for 0.2.0

- Additional LLM adapters (Google Gemini, Mistral, Ollama)
- Enhanced workflow visualization
- Memory compression strategies
- Batch evaluation improvements
- More document loaders (Markdown, HTML, CSV)

### Planned for 0.3.0

- Multi-agent collaboration
- Agent registry and marketplace
- Real-time collaboration features
- Advanced security features
