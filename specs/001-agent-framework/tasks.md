# Tasks: Agent 研发框架

**Input**: Design documents from `/specs/001-agent-framework/`  
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

Based on plan.md, this is a Monorepo with `packages/` structure:

```text
packages/
├── agent/src/
├── tool/src/
├── llm/src/
├── workflow/src/
├── vectordb/src/
├── rag/src/
├── storage/src/
├── memory/src/
├── mcp/src/
├── genui/src/
├── observability/src/
├── evaluation/src/
├── security/src/
└── deploy/src/
```

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Monorepo initialization and toolchain configuration

- [X] T001 Initialize Nx monorepo with pnpm at repository root
- [X] T002 Configure root tsconfig.json with strict mode and ESM settings
- [X] T003 [P] Configure ESLint with TypeScript rules in .eslintrc.cjs
- [X] T004 [P] Configure Prettier in .prettierrc
- [X] T005 [P] Configure Vitest in vitest.config.ts with workspace support
- [X] T006 [P] Configure Rollup base config in rollup.config.base.js for library builds
- [X] T007 Create shared package template with package.json, tsconfig.json, rollup.config.js
- [X] T008 Setup GitHub Actions CI workflow in .github/workflows/ci.yml

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core packages that ALL user stories depend on - MUST complete before any story implementation

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

### @seashore/llm Package (Foundation)

- [X] T009 Create packages/llm/package.json with @tanstack/ai-\* dependencies
- [X] T010 [P] Define LLM types in packages/llm/src/types.ts (TextAdapter, Message, TokenUsage)
- [X] T011 [P] Create adapters re-export in packages/llm/src/adapters.ts (openaiText, anthropicText, geminiText)
- [X] T012 [P] Create embedding adapters in packages/llm/src/embedding.ts (openaiEmbed, geminiEmbed)
- [X] T013 Create multimodal exports in packages/llm/src/multimodal.ts (generateImage, generateSpeech, etc.)
- [X] T014 Create main export in packages/llm/src/index.ts
- [X] T015 Add unit tests in packages/llm/\_\_tests\_\_/adapters.test.ts

### @seashore/tool Package (Foundation)

- [X] T016 Create packages/tool/package.json with zod dependency
- [X] T017 [P] Define tool types in packages/tool/src/types.ts (ToolConfig, ToolResult, ToolContext)
- [X] T018 Implement defineTool function in packages/tool/src/define-tool.ts
- [X] T019 [P] Implement serperTool preset in packages/tool/src/presets/serper.ts
- [X] T020 [P] Implement firecrawlTool preset in packages/tool/src/presets/firecrawl.ts
- [X] T021 Create main export in packages/tool/src/index.ts
- [X] T022 Add unit tests in packages/tool/\_\_tests\_\_/define-tool.test.ts

### @seashore/storage Package (Foundation)

- [X] T023 Create packages/storage/package.json with drizzle-orm, pg dependencies
- [X] T024 [P] Define storage types in packages/storage/src/types.ts (Thread, Message, Trace, Session)
- [X] T025 Create database connection in packages/storage/src/database.ts (createDatabase)
- [X] T026 Define threads schema in packages/storage/src/schema/threads.ts
- [X] T027 [P] Define messages schema in packages/storage/src/schema/messages.ts
- [X] T028 [P] Define traces schema in packages/storage/src/schema/traces.ts
- [X] T029 [P] Define sessions schema in packages/storage/src/schema/sessions.ts
- [X] T030 Create schema index in packages/storage/src/schema/index.ts
- [X] T031 Implement ThreadRepository in packages/storage/src/repositories/thread.ts
- [X] T032 [P] Implement MessageRepository in packages/storage/src/repositories/message.ts
- [X] T033 [P] Implement TraceRepository in packages/storage/src/repositories/trace.ts
- [X] T034 Create main export in packages/storage/src/index.ts
- [X] T035 Add migration scripts in packages/storage/drizzle/
- [X] T036 Add integration tests in packages/storage/\_\_tests\_\_/repositories.test.ts

**Checkpoint**: Foundation packages (llm, tool, storage) ready - user story implementation can now begin ✅

---

## Phase 3: User Story 1 - 创建简单 ReAct Agent (Priority: P1) 🎯 MVP

**Goal**: 开发者能够快速创建一个使用工具完成任务的 ReAct 型智能体

**Independent Test**: 创建天气查询 Agent，输入 "北京今天天气如何"，Agent 调用 weather 工具后返回天气信息

### Implementation for User Story 1

- [X] T037 [US1] Define agent types in packages/agent/src/types.ts (AgentConfig, AgentRunResult, AgentStreamChunk)
- [X] T038 [US1] Implement ReAct agent core in packages/agent/src/react-agent.ts (Thought-Action-Observation loop)
- [X] T039 [US1] Implement createAgent factory in packages/agent/src/create-agent.ts
- [X] T040 [US1] Implement streaming support in packages/agent/src/stream.ts
- [X] T041 [US1] Add tool execution handler in packages/agent/src/tool-executor.ts
- [X] T042 [US1] Add error handling and retry logic in packages/agent/src/error-handler.ts
- [X] T043 [US1] Create main export in packages/agent/src/index.ts
- [X] T044 [US1] Add unit tests in packages/agent/\_\_tests\_\_/react-agent.test.ts
- [X] T045 [US1] Add integration test with mock LLM in packages/agent/\_\_tests\_\_/integration.test.ts

**Checkpoint**: User Story 1 complete - developers can create and run ReAct Agents ✅

---

## Phase 4: User Story 2 - 定义和使用工具 (Priority: P1)

**Goal**: 开发者能够为 Agent 创建类型安全的自定义工具

**Independent Test**: 定义计算器工具，接受两个数字和操作符，验证 schema 验证和执行逻辑

### Implementation for User Story 2

> Note: Core tool infrastructure was created in Phase 2 (T016-T022). This phase adds advanced features.

- [X] T046 [US2] Add tool validation middleware in packages/tool/src/validation.ts
- [X] T047 [US2] Add client-side tool support in packages/tool/src/client-tool.ts
- [X] T048 [US2] Add tool approval flag handling in packages/tool/src/approval.ts
- [X] T049 [US2] Add comprehensive tool tests in packages/tool/\_\_tests\_\_/presets.test.ts
- [X] T050 [US2] Add tool schema inference tests in packages/tool/\_\_tests\_\_/schema.test.ts

**Checkpoint**: User Story 2 complete - developers can define type-safe tools with validation ✅

---

## Phase 5: User Story 3 - 接入 LLM 模型 (Priority: P1)

**Goal**: 开发者能够使用 OpenAI、Gemini、Anthropic 驱动 Agent

**Independent Test**: 使用 OpenAI 适配器发送 chat 消息，验证流式响应正常

### Implementation for User Story 3

> Note: Core LLM infrastructure was created in Phase 2 (T009-T015). This phase adds advanced features.

- [X] T051 [US3] Add streaming utilities in packages/llm/src/stream-utils.ts (toStreamResponse, toSSE)
- [X] T052 [US3] Add structured output support in packages/llm/src/structured.ts
- [X] T053 [US3] Add provider-specific options handling in packages/llm/src/options.ts
- [X] T054 [US3] Add rate limit retry wrapper in packages/llm/src/retry.ts
- [X] T055 [US3] Add LLM integration tests in packages/llm/\_\_tests\_\_/integration.test.ts

**Checkpoint**: User Story 3 complete - developers can seamlessly switch between LLM providers ✅

---

## Phase 6: User Story 4 - 构建工作流 (Priority: P2)

**Goal**: 开发者能够构建多步骤工作流，编排多个 Agent 或任务

**Independent Test**: 创建两步工作流（生成大纲 → 生成正文），验证数据在节点间正确传递

### Implementation for User Story 4

- [X] T056 [US4] Define workflow types in packages/workflow/src/types.ts (WorkflowConfig, WorkflowNode, Edge)
- [X] T057 [US4] Implement createWorkflow factory in packages/workflow/src/workflow.ts
- [X] T058 [US4] Implement createLLMNode in packages/workflow/src/nodes/llm-node.ts
- [X] T059 [P] [US4] Implement createToolNode in packages/workflow/src/nodes/tool-node.ts
- [X] T060 [P] [US4] Implement createConditionNode in packages/workflow/src/nodes/condition-node.ts
- [X] T061 [P] [US4] Implement createParallelNode in packages/workflow/src/nodes/parallel-node.ts
- [X] T062 [US4] Implement createNode (custom) in packages/workflow/src/nodes/custom-node.ts
- [X] T063 [US4] Implement workflow execution engine in packages/workflow/src/execution.ts
- [X] T064 [US4] Implement loop control in packages/workflow/src/loops.ts
- [X] T065 [US4] Add workflow context management in packages/workflow/src/context.ts
- [X] T066 [US4] Add error handling and retry in packages/workflow/src/error-handler.ts
- [X] T067 [US4] Create main export in packages/workflow/src/index.ts
- [X] T068 [US4] Add unit tests in packages/workflow/__tests__/workflow.test.ts
- [X] T069 [US4] Integrate workflow agent in packages/agent/src/workflow-agent.ts
- [X] T070 [US4] Update agent exports in packages/agent/src/index.ts

**Checkpoint**: User Story 4 complete - developers can create and execute multi-step workflows ✅

---

## Phase 7: User Story 5 - 实现 RAG 检索增强 (Priority: P2)

**Goal**: 开发者能够让 Agent 从知识库检索相关信息增强回答

**Independent Test**: 导入几篇文档，查询 "项目截止日期"，返回最相关的文档片段

### @seashore/vectordb Package

- [ ] T071 [US5] Create packages/vectordb/package.json with pgvector dependency
- [ ] T072 [US5] Define vectordb types in packages/vectordb/src/types.ts (Document, Collection, SearchResult)
- [ ] T073 [US5] Define collections schema in packages/vectordb/src/schema/collections.ts
- [ ] T074 [US5] Define documents schema with vector and tsvector in packages/vectordb/src/schema/documents.ts
- [ ] T075 [US5] Implement createVectorStore in packages/vectordb/src/store.ts
- [ ] T076 [US5] Implement HNSW vector search in packages/vectordb/src/search/vector-search.ts
- [ ] T077 [P] [US5] Implement tsvector text search in packages/vectordb/src/search/text-search.ts
- [ ] T078 [US5] Implement hybrid search with RRF fusion in packages/vectordb/src/search/hybrid-search.ts
- [ ] T079 [US5] Create main export in packages/vectordb/src/index.ts
- [ ] T080 [US5] Add integration tests in packages/vectordb/\_\_tests\_\_/search.test.ts

### @seashore/rag Package

- [ ] T081 [US5] Create packages/rag/package.json
- [ ] T082 [US5] Define RAG types in packages/rag/src/types.ts (LoadedDocument, DocumentChunk, Retriever)
- [ ] T083 [US5] Implement createTextLoader in packages/rag/src/loaders/text-loader.ts
- [ ] T084 [P] [US5] Implement createMarkdownLoader in packages/rag/src/loaders/markdown-loader.ts
- [ ] T085 [P] [US5] Implement createPDFLoader in packages/rag/src/loaders/pdf-loader.ts
- [ ] T086 [P] [US5] Implement createWebLoader in packages/rag/src/loaders/web-loader.ts
- [ ] T087 [US5] Implement createRecursiveSplitter in packages/rag/src/splitters/recursive-splitter.ts
- [ ] T088 [P] [US5] Implement createTokenSplitter in packages/rag/src/splitters/token-splitter.ts
- [ ] T089 [P] [US5] Implement createMarkdownSplitter in packages/rag/src/splitters/markdown-splitter.ts
- [ ] T090 [US5] Implement createVectorRetriever in packages/rag/src/retrievers/vector-retriever.ts
- [ ] T091 [US5] Implement createHybridRetriever in packages/rag/src/retrievers/hybrid-retriever.ts
- [ ] T092 [US5] Implement createRAG pipeline in packages/rag/src/rag.ts
- [ ] T093 [US5] Create main export in packages/rag/src/index.ts
- [ ] T094 [US5] Add unit tests in packages/rag/\_\_tests\_\_/rag.test.ts

**Checkpoint**: User Story 5 complete - developers can implement RAG with hybrid search

---

## Phase 8: User Story 6 - 管理对话记忆 (Priority: P2)

**Goal**: Agent 能够记住对话历史和关键信息（短期/中期/长期记忆）

**Independent Test**: 告诉 Agent "我叫张三"，后续询问 "我叫什么"，验证正确回忆

### Implementation for User Story 6

- [ ] T095 [US6] Create packages/memory/package.json
- [ ] T096 [US6] Define memory types in packages/memory/src/types.ts (MemoryEntry, MemoryType, MemoryConfig)
- [ ] T097 [US6] Define memories schema in packages/memory/src/schema.ts
- [ ] T098 [US6] Implement short-term memory in packages/memory/src/short-term.ts
- [ ] T099 [US6] Implement mid-term memory in packages/memory/src/mid-term.ts
- [ ] T100 [US6] Implement long-term memory with vector search in packages/memory/src/long-term.ts
- [ ] T101 [US6] Implement createMemoryManager in packages/memory/src/manager.ts
- [ ] T102 [US6] Implement memory consolidation in packages/memory/src/consolidation.ts
- [ ] T103 [US6] Implement importance evaluator in packages/memory/src/importance.ts
- [ ] T104 [US6] Add withMemory agent wrapper in packages/memory/src/agent-integration.ts
- [ ] T105 [US6] Create main export in packages/memory/src/index.ts
- [ ] T106 [US6] Add unit tests in packages/memory/\_\_tests\_\_/memory.test.ts

**Checkpoint**: User Story 6 complete - Agents can maintain short/mid/long term memory

---

## Phase 9: User Story 7 - 持久化存储实体 (Priority: P2)

**Goal**: 持久化 Agent 运行数据（对话线程、消息、会话状态）

**Independent Test**: 创建 Thread，添加 Messages，重启后加载完整对话历史

### Implementation for User Story 7

> Note: Core storage infrastructure was created in Phase 2 (T023-T036). This phase adds integration.

- [ ] T107 [US7] Add automatic persistence middleware in packages/storage/src/middleware.ts
- [ ] T108 [US7] Add query builder utilities in packages/storage/src/query-builder.ts
- [ ] T109 [US7] Add storage integration with agent in packages/agent/src/with-storage.ts
- [ ] T110 [US7] Add thread continuation support in packages/agent/src/thread.ts
- [ ] T111 [US7] Add storage integration tests in packages/storage/\_\_tests\_\_/integration.test.ts

**Checkpoint**: User Story 7 complete - Agent data is automatically persisted

---

## Phase 10: User Story 8 - 支持 MCP 协议 (Priority: P3)

**Goal**: Agent 支持 Model Context Protocol，连接 MCP 服务器

**Independent Test**: 连接 MCP 文件系统服务器，通过 Agent 列出目录内容

### Implementation for User Story 8

- [ ] T112 [US8] Create packages/mcp/package.json
- [ ] T113 [US8] Define MCP types in packages/mcp/src/types.ts (MCPTool, MCPResource, MCPClient)
- [ ] T114 [US8] Implement stdio transport in packages/mcp/src/transports/stdio.ts
- [ ] T115 [P] [US8] Implement SSE transport in packages/mcp/src/transports/sse.ts
- [ ] T116 [P] [US8] Implement WebSocket transport in packages/mcp/src/transports/websocket.ts
- [ ] T117 [US8] Implement createMCPClient in packages/mcp/src/client.ts
- [ ] T118 [US8] Implement createMCPToolBridge in packages/mcp/src/bridge.ts
- [ ] T119 [US8] Implement discoverMCPServers in packages/mcp/src/discovery.ts
- [ ] T120 [US8] Create main export in packages/mcp/src/index.ts
- [ ] T121 [US8] Add unit tests in packages/mcp/\_\_tests\_\_/client.test.ts

**Checkpoint**: User Story 8 complete - Agents can connect to MCP servers

---

## Phase 11: User Story 9 - 构建聊天 UI (Priority: P3)

**Goal**: 快速构建 Agent 聊天界面，支持流式输出和工具调用展示

**Independent Test**: 使用 `<Chat />` 组件配置后端，验证完整对话交互

### Implementation for User Story 9

- [ ] T122 [US9] Create packages/genui/package.json with React 18, @tanstack/ai-react
- [ ] T123 [US9] Define GenUI types in packages/genui/src/types.ts (ChatMessage, ToolCallUI, ComponentRenderer)
- [ ] T124 [US9] Implement useChat hook in packages/genui/src/hooks/useChat.ts
- [ ] T125 [US9] Implement useChatStream hook in packages/genui/src/hooks/useChatStream.ts
- [ ] T126 [US9] Implement ChatMessages component in packages/genui/src/components/ChatMessages.tsx
- [ ] T127 [P] [US9] Implement ChatInput component in packages/genui/src/components/ChatInput.tsx
- [ ] T128 [P] [US9] Implement ChatMessage component in packages/genui/src/components/ChatMessage.tsx
- [ ] T129 [US9] Implement Chat composite component in packages/genui/src/components/Chat.tsx
- [ ] T130 [US9] Implement createGenUIRegistry in packages/genui/src/registry.ts
- [ ] T131 [US9] Implement renderToolCall in packages/genui/src/renderer.ts
- [ ] T132 [US9] Add ChatToolResult component in packages/genui/src/components/ChatToolResult.tsx
- [ ] T133 [US9] Add CSS variables and theming in packages/genui/src/styles.css
- [ ] T134 [US9] Create main export in packages/genui/src/index.ts
- [ ] T135 [US9] Add component tests in packages/genui/\_\_tests\_\_/components.test.tsx

**Checkpoint**: User Story 9 complete - developers can build chat UIs with GenUI components

---

## Phase 12: User Story 10 - 监控可观测性 (Priority: P3)

**Goal**: 监控 Agent 运行状态，包括调用追踪、Token 统计、延迟监控

**Independent Test**: 启用 observability 后运行 Agent，在控制台查看 trace 信息

### Implementation for User Story 10

- [ ] T136 [US10] Create packages/observability/package.json
- [ ] T137 [US10] Define observability types in packages/observability/src/types.ts (Span, SpanContext, TokenUsage)
- [ ] T138 [US10] Implement createTracer in packages/observability/src/tracer.ts
- [ ] T139 [US10] Implement createTokenCounter in packages/observability/src/tokens.ts
- [ ] T140 [US10] Implement createLogger in packages/observability/src/logger.ts
- [ ] T141 [US10] Implement observabilityMiddleware in packages/observability/src/middleware.ts
- [ ] T142 [US10] Add OpenTelemetry exporter in packages/observability/src/exporters/otlp.ts
- [ ] T143 [P] [US10] Add console exporter in packages/observability/src/exporters/console.ts
- [ ] T144 [US10] Create main export in packages/observability/src/index.ts
- [ ] T145 [US10] Add unit tests in packages/observability/\_\_tests\_\_/tracer.test.ts

**Checkpoint**: User Story 10 complete - Agent operations are fully traceable

---

## Phase 13: User Story 11 - 评测 Agent 性能 (Priority: P3)

**Goal**: 评估 Agent 回答质量和任务完成能力

**Independent Test**: 准备问答数据集，运行评测获得准确率、延迟等指标报告

### Implementation for User Story 11

- [ ] T146 [US11] Create packages/evaluation/package.json
- [ ] T147 [US11] Define evaluation types in packages/evaluation/src/types.ts (Metric, TestCase, EvaluationResult)
- [ ] T148 [US11] Implement createEvaluator in packages/evaluation/src/evaluator.ts
- [ ] T149 [US11] Implement evaluate and evaluateBatch in packages/evaluation/src/evaluate.ts
- [ ] T150 [US11] Implement relevanceMetric in packages/evaluation/src/metrics/relevance.ts
- [ ] T151 [P] [US11] Implement faithfulnessMetric in packages/evaluation/src/metrics/faithfulness.ts
- [ ] T152 [P] [US11] Implement coherenceMetric in packages/evaluation/src/metrics/coherence.ts
- [ ] T153 [P] [US11] Implement harmfulnessMetric in packages/evaluation/src/metrics/harmfulness.ts
- [ ] T154 [US11] Implement customMetric in packages/evaluation/src/metrics/custom.ts
- [ ] T155 [US11] Implement createDataset and loadDataset in packages/evaluation/src/dataset.ts
- [ ] T156 [US11] Implement generateReport in packages/evaluation/src/report.ts
- [ ] T157 [US11] Create main export in packages/evaluation/src/index.ts
- [ ] T158 [US11] Add unit tests in packages/evaluation/\_\_tests\_\_/evaluation.test.ts

**Checkpoint**: User Story 11 complete - Agents can be evaluated systematically

---

## Phase 14: User Story 12 - 内容安全审查 (Priority: P3)

**Goal**: 对 Agent 输入输出进行安全审查，防止有害内容

**Independent Test**: 配置过滤规则，发送敏感词输入，验证被正确拦截

### Implementation for User Story 12

- [ ] T159 [US12] Create packages/security/package.json
- [ ] T160 [US12] Define security types in packages/security/src/types.ts (SecurityRule, Violation, Guardrails)
- [ ] T161 [US12] Implement promptInjectionRule in packages/security/src/rules/prompt-injection.ts
- [ ] T162 [P] [US12] Implement piiDetectionRule in packages/security/src/rules/pii-detection.ts
- [ ] T163 [P] [US12] Implement toxicityRule in packages/security/src/rules/toxicity.ts
- [ ] T164 [P] [US12] Implement topicBlockRule in packages/security/src/rules/topic-block.ts
- [ ] T165 [P] [US12] Implement lengthLimitRule in packages/security/src/rules/length-limit.ts
- [ ] T166 [US12] Implement createInputFilter in packages/security/src/filters/input-filter.ts
- [ ] T167 [US12] Implement createOutputFilter in packages/security/src/filters/output-filter.ts
- [ ] T168 [US12] Implement createGuardrails in packages/security/src/guardrails.ts
- [ ] T169 [US12] Implement securityMiddleware in packages/security/src/middleware.ts
- [ ] T170 [US12] Add audit logging in packages/security/src/audit.ts
- [ ] T171 [US12] Create main export in packages/security/src/index.ts
- [ ] T172 [US12] Add unit tests in packages/security/\_\_tests\_\_/guardrails.test.ts

**Checkpoint**: User Story 12 complete - Agent I/O can be filtered for safety

---

## Phase 15: User Story 13 - 部署 Agent 服务 (Priority: P4)

**Goal**: 将 Agent 部署为生产服务（Cloudflare Workers / Node.js）

**Independent Test**: 运行 `seashore dev` 启动本地服务器，通过 HTTP API 访问 Agent

### Implementation for User Story 13

- [ ] T173 [US13] Create packages/deploy/package.json with hono, @hono/node-server
- [ ] T174 [US13] Define deploy types in packages/deploy/src/types.ts (ServerConfig, ChatRequest, ChatResponse)
- [ ] T175 [US13] Implement createServer in packages/deploy/src/server.ts
- [ ] T176 [US13] Implement createChatHandler in packages/deploy/src/handlers/chat.ts
- [ ] T177 [P] [US13] Implement createAgentHandler in packages/deploy/src/handlers/agent.ts
- [ ] T178 [US13] Implement createSSEStream in packages/deploy/src/sse.ts
- [ ] T179 [US13] Implement cloudflareAdapter in packages/deploy/src/adapters/cloudflare.ts
- [ ] T180 [P] [US13] Implement nodeAdapter in packages/deploy/src/adapters/node.ts
- [ ] T181 [US13] Add authentication middleware in packages/deploy/src/middleware/auth.ts
- [ ] T182 [P] [US13] Add rate limiting middleware in packages/deploy/src/middleware/rate-limit.ts
- [ ] T183 [P] [US13] Add CORS middleware in packages/deploy/src/middleware/cors.ts
- [ ] T184 [US13] Add error handling in packages/deploy/src/error-handler.ts
- [ ] T185 [US13] Create main export in packages/deploy/src/index.ts
- [ ] T186 [US13] Add integration tests in packages/deploy/\_\_tests\_\_/server.test.ts
- [ ] T187 [US13] Create example wrangler.toml for Cloudflare deployment
- [ ] T188 [US13] Create example Dockerfile for Node.js deployment

**Checkpoint**: User Story 13 complete - Agents can be deployed to production

---

## Phase 16: Polish & Cross-Cutting Concerns

**Purpose**: Documentation, optimization, and final validation

- [ ] T189 [P] Update root README.md with installation and quickstart guide
- [ ] T190 [P] Create API documentation site structure in docs/
- [ ] T191 [P] Add JSDoc comments to all public APIs
- [ ] T192 Run quickstart.md validation - verify all examples work
- [ ] T193 Performance optimization audit across all packages
- [ ] T194 [P] Add missing edge case tests
- [ ] T195 Security audit of all packages
- [ ] T196 Create CHANGELOG.md and prepare v0.1.0 release

---

## Dependencies & Execution Order

### Phase Dependencies

```text
Phase 1 (Setup) ──────────────────────────────────────────────────────────────┐
                                                                              │
Phase 2 (Foundation: llm, tool, storage) ─────────────────────────────────────┤
                                                                              │
    ┌─────────────────────────────────────────────────────────────────────────┘
    │
    ├── Phase 3 (US1: Agent) ──────────► MVP Ready
    │
    ├── Phase 4 (US2: Tool Advanced) ──► Can parallelize with US1
    │
    ├── Phase 5 (US3: LLM Advanced) ───► Can parallelize with US1
    │
    ├── Phase 6 (US4: Workflow) ───────► Depends on US1 (Agent)
    │
    ├── Phase 7 (US5: RAG) ────────────► Depends on storage foundation
    │
    ├── Phase 8 (US6: Memory) ─────────► Depends on storage, vectordb
    │
    ├── Phase 9 (US7: Storage Adv) ────► Depends on US1 (Agent)
    │
    ├── Phase 10 (US8: MCP) ───────────► Can parallelize from Foundation
    │
    ├── Phase 11 (US9: GenUI) ─────────► Depends on US1 (Agent)
    │
    ├── Phase 12 (US10: Observability) ► Can parallelize from Foundation
    │
    ├── Phase 13 (US11: Evaluation) ───► Depends on US1 (Agent)
    │
    ├── Phase 14 (US12: Security) ─────► Can parallelize from Foundation
    │
    ├── Phase 15 (US13: Deploy) ───────► Depends on US1 (Agent)
    │
    └── Phase 16 (Polish) ─────────────► Depends on all user stories
```

### User Story Independence

| Story | Dependencies            | Can Start After |
| ----- | ----------------------- | --------------- |
| US1   | Foundation only         | Phase 2         |
| US2   | Foundation only         | Phase 2         |
| US3   | Foundation only         | Phase 2         |
| US4   | US1 (Agent)             | Phase 3         |
| US5   | Foundation (storage)    | Phase 2         |
| US6   | US5 (vectordb for LTM)  | Phase 7         |
| US7   | US1 (Agent)             | Phase 3         |
| US8   | Foundation only         | Phase 2         |
| US9   | US1 (Agent for hooks)   | Phase 3         |
| US10  | Foundation only         | Phase 2         |
| US11  | US1 (Agent to evaluate) | Phase 3         |
| US12  | Foundation only         | Phase 2         |
| US13  | US1 (Agent to deploy)   | Phase 3         |

### Parallel Opportunities

**After Phase 2 (Foundation) completes, these can run in parallel:**

- US1, US2, US3, US5, US8, US10, US12

**After US1 (Agent) completes, these can run in parallel:**

- US4, US7, US9, US11, US13

**Within each phase, tasks marked [P] can run in parallel.**

---

## Task Summary

| Phase | User Story           | Priority | Task Count |
| ----- | -------------------- | -------- | ---------- |
| 1     | Setup                | -        | 8          |
| 2     | Foundation           | -        | 28         |
| 3     | US1 - ReAct Agent    | P1       | 9          |
| 4     | US2 - Tool           | P1       | 5          |
| 5     | US3 - LLM            | P1       | 5          |
| 6     | US4 - Workflow       | P2       | 15         |
| 7     | US5 - RAG            | P2       | 24         |
| 8     | US6 - Memory         | P2       | 12         |
| 9     | US7 - Storage        | P2       | 5          |
| 10    | US8 - MCP            | P3       | 10         |
| 11    | US9 - GenUI          | P3       | 14         |
| 12    | US10 - Observability | P3       | 10         |
| 13    | US11 - Evaluation    | P3       | 13         |
| 14    | US12 - Security      | P3       | 14         |
| 15    | US13 - Deploy        | P4       | 16         |
| 16    | Polish               | -        | 8          |
|       | **Total**            |          | **196**    |

### MVP Scope (Recommended)

For a minimal viable product, complete:

- Phase 1 (Setup): 8 tasks
- Phase 2 (Foundation): 28 tasks
- Phase 3 (US1 - Agent): 9 tasks

**MVP Total: 45 tasks** → Functional ReAct Agent with LLM and Tool support
