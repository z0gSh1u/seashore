# Seashore Framework Design

TypeScript Agent 研发框架，基于 @tanstack/ai，提供 LLM 适配、Agent 编排、RAG、MCP、部署等完整能力。

## 技术栈

| 层面 | 选择 |
|---|---|
| 包管理器 | pnpm |
| Monorepo | Nx |
| 打包 | Rollup (ESM Only) |
| 测试 | Vitest |
| LLM SDK | @tanstack/ai + @tanstack/ai-openai / anthropic / gemini |
| ORM | Drizzle ORM |
| 数据库 | PostgreSQL + pgvector |
| MCP | @modelcontextprotocol/sdk (Client only) |
| 前端 | React 18 (hooks only) |
| 服务端 | Hono |
| Schema Validation | Zod |
| 部署目标 | Cloudflare Workers + 传统 Node.js |

## 约束条件

- ESM Only，不考虑 CommonJS
- 最小化 any / unknown / as / ! 的使用，继承 @tanstack/ai 的类型安全
- 不从环境变量自动读取 API Key / BaseURL，用户在代码中显式配置
- LLM 只支持 OpenAI、Gemini、Anthropic 三家，但必须支持自定义 BaseURL 和 ApiKey
- 数据库只考虑 PostgreSQL
- 能复用 @tanstack/ai 已有能力的，积极复用，不造轮子
- 有一定复杂度的功能，能调库实现的，积极调库

## 包结构

分组式 Monorepo，5 个包：

```
seashore/
├── packages/
│   ├── core/            # @seashore/core
│   │   ├── llm/         #   LLM 适配层
│   │   ├── embedding/   #   Embedding 适配层（自建，@tanstack/ai 已移除）
│   │   ├── tool/        #   工具定义 + 预置工具
│   │   └── context/     #   Context Engineering 提示词构造
│   │
│   ├── agent/           # @seashore/agent
│   │   ├── react/       #   ReAct 型智能体
│   │   └── workflow/    #   DAG Workflow 引擎 + Workflow 型智能体
│   │
│   ├── data/            # @seashore/data
│   │   ├── storage/     #   Drizzle ORM + PostgreSQL（thread/message）
│   │   ├── vectordb/    #   pgvector 向量存储（HNSW 索引）
│   │   └── rag/         #   RAG 管线（向量 + BM25 混合检索）
│   │
│   ├── platform/        # @seashore/platform
│   │   ├── mcp/         #   MCP 协议支持（Client only）
│   │   ├── security/    #   Guardrail 内容审查
│   │   ├── eval/        #   Agent 评测
│   │   └── deploy/      #   Hono 部署
│   │
│   └── react/           # @seashore/react
│       └── hooks/       #   React 18 hooks（chat 状态管理）
│
├── tools/               # 构建脚本、Rollup 配置
├── nx.json
├── pnpm-workspace.yaml
└── tsconfig.base.json
```

### 依赖方向（单向，无循环）

```
core → (无内部依赖, 仅依赖 @tanstack/ai)
agent → core
data → core (embedding adapter)
platform → core, agent, data
react → core, agent
```

---

## @seashore/core

### LLM 适配层 (core/llm)

不造轮子，封装 @tanstack/ai 的 adapter 系统，提供统一配置入口。

```typescript
interface LLMConfig {
  provider: 'openai' | 'anthropic' | 'gemini'
  model: string
  apiKey: string
  baseURL?: string
}

function createLLMAdapter(config: LLMConfig) {
  switch (config.provider) {
    case 'openai':
      return createOpenaiChat(config.apiKey, { baseURL: config.baseURL })
    case 'anthropic':
      return createAnthropicChat(config.apiKey, { baseURL: config.baseURL })
    case 'gemini':
      return createGeminiChat(config.apiKey, { baseURL: config.baseURL })
  }
}
```

`createLLMAdapter` 是全框架唯一的 LLM 配置入口。Agent、Eval、Guardrail 等所有需要 LLM 的地方都复用同一个 adapter 实例。

### Embedding 适配层 (core/embedding)

@tanstack/ai 已移除 embedding 支持，此处自建极薄的 adapter，直接调各家 REST API（不引入完整 SDK）。

```typescript
interface EmbeddingConfig {
  provider: 'openai' | 'gemini' | 'anthropic'
  model: string
  apiKey: string
  baseURL?: string
  dimensions?: number
}

interface EmbeddingAdapter {
  embed(input: string | string[]): Promise<number[][]>
}

function createEmbeddingAdapter(config: EmbeddingConfig): EmbeddingAdapter
```

### 工具定义 (core/tool)

完全复用 @tanstack/ai 的 `toolDefinition()` 系统。

预置工具：
- `serperSearch` — Serper API 网络搜索
- `firecrawlScrape` — Firecrawl 网页拉取

```typescript
const serperSearch = toolDefinition({
  name: 'web_search',
  description: 'Search the web using Serper API',
  inputSchema: z.object({
    query: z.string(),
    numResults: z.number().optional().default(10),
  }),
})

// 用户使用时提供 API Key 创建 server 实现
const search = serperSearch.server(async (input) => {
  // 调用 Serper API
}, { apiKey: 'xxx' })
```

工具组合 helper：

```typescript
function createToolkit(tools: Tool[]): Tool[]
```

### Context Engineering (core/context)

提供构造 prompt 的 helper：

```typescript
const prompt = systemPrompt()
  .role('You are a data analyst')
  .instruction('Always respond in JSON format')
  .constraint('Do not make up data')
  .example({ input: '...', output: '...' })
  .outputFormat('code', { language: 'typescript' })
  .build()

const fewShot = fewShotMessages([
  { user: 'What is 2+2?', assistant: '4' },
])
```

---

## @seashore/agent

### DAG Workflow 引擎 (agent/workflow)

核心概念：Step → DAG → Workflow。

```typescript
interface StepConfig<TInput, TOutput> {
  name: string
  execute: (input: TInput, ctx: WorkflowContext) => Promise<TOutput>
  outputSchema?: ZodSchema<TOutput>   // 可选，约束 step 输出结构
  retryPolicy?: RetryPolicy
}

interface WorkflowContext {
  state: Map<string, unknown>
  llm: (config: LLMConfig) => ChatFn
  abortSignal: AbortSignal
}
```

链式 API 构建 DAG：

```typescript
const workflow = createWorkflow({ name: 'research-pipeline' })
  .step(fetchData)
  .step(analyzeData, { after: fetchData })
  .step(generateReport, { after: analyzeData })
  .step(reviewReport, { after: analyzeData })           // 与 generateReport 并行
  .step(finalOutput, { after: [generateReport, reviewReport] })
```

条件分支：

```typescript
.step(handleSuccess, { after: analyzeData, when: (ctx) => ctx.state.get('score') > 0.8 })
.step(handleFailure, { after: analyzeData, when: (ctx) => ctx.state.get('score') <= 0.8 })
```

DAG 执行引擎：拓扑排序 → 循环依赖检测 → 并行执行无依赖节点 → 错误传播 → 重试。

### Human-in-the-Loop

**Workflow Human Gate**

```typescript
.step(humanReview, {
  after: generateProposal,
  type: 'human',
  prompt: (ctx) => `请审核方案: ${ctx.state.get('proposal')}`,
  timeout: 60 * 60 * 1000,
})
```

执行到 human step 时返回 `PendingWorkflow` 对象（含 workflowId + 展示信息），通过 `workflow.resume(workflowId, humanInput)` 恢复。挂起状态序列化存入 PostgreSQL。

**ReAct Agent Tool Confirmation**

```typescript
const agent = createReActAgent({
  tools: [serperSearch, dangerousTool],
  requireConfirmation: ['dangerousTool'],
  onConfirmationRequired: async (toolCall) => {
    return await askUser(toolCall) // 由集成方实现
  },
})
```

**统一 HumanInput 接口**

```typescript
interface HumanInputRequest {
  id: string
  type: 'approval' | 'input' | 'selection'
  prompt: string
  options?: string[]
  metadata: Record<string, unknown>
}

interface HumanInputResponse {
  requestId: string
  approved?: boolean
  value?: string
  selectedOption?: string
}
```

### ReAct 型智能体 (agent/react)

对 @tanstack/ai 的 `chat()` + `agentLoopStrategy` 的高层封装：

```typescript
const agent = createReActAgent({
  name: 'research-assistant',
  llm: { provider: 'openai', model: 'gpt-4o', apiKey: '...' },
  systemPrompt: 'You are a research assistant...',
  tools: [serperSearch, firecrawlScrape],
  maxIterations: 15,
  outputSchema: DefaultSchema,        // 可选，默认结构化输出
  onToolCall?: (call) => void,
  onThinking?: (text) => void,
})
```

底层映射到：

```typescript
chat({
  adapter: createLLMAdapter(config)(model),
  tools: [...],
  systemPrompts: [...],
  messages,
  agentLoopStrategy: maxIterations(config.maxIterations),
  outputSchema,
})
```

### 结构化输出

两层支持，Agent 定义时设默认 schema，运行时可覆盖：

```typescript
const agent = createReActAgent({
  outputSchema: DefaultSchema,   // 可选默认
})

// 使用默认 schema
const r1 = await agent.run('...')

// 运行时覆盖
const r2 = await agent.run('...', { outputSchema: SpecificSchema })

// 不要结构化输出
const r3 = await agent.run('...', { outputSchema: null })
```

多形态输出用 `z.discriminatedUnion`：

```typescript
const agent = createReActAgent({
  outputSchema: z.discriminatedUnion('type', [
    z.object({ type: z.literal('analysis'), sentiment: z.string(), score: z.number() }),
    z.object({ type: z.literal('code'), language: z.string(), code: z.string() }),
    z.object({ type: z.literal('summary'), title: z.string(), bullets: z.array(z.string()) }),
  ]),
})
```

### Workflow 型智能体 (agent/workflow-agent)

将 DAG Workflow 包装为 Agent 接口：

```typescript
const workflowAgent = createWorkflowAgent({
  name: 'multi-step-researcher',
  workflow: createWorkflow({ name: 'research' })
    .step(planStep)
    .step(searchStep, { after: planStep })
    .step(analyzeStep, { after: searchStep })
    .step(writeStep, { after: analyzeStep }),
})

const result = await workflowAgent.run('...')
```

---

## @seashore/data

### Storage (data/storage)

Drizzle ORM + PostgreSQL，核心 schema：

```typescript
export const threads = pgTable('seashore_threads', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: text('title'),
  metadata: jsonb('metadata').$type<Record<string, unknown>>(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
})

export const messages = pgTable('seashore_messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  threadId: uuid('thread_id').references(() => threads.id),
  role: text('role').$type<'user' | 'assistant' | 'system' | 'tool'>(),
  content: jsonb('content'),
  toolCalls: jsonb('tool_calls'),
  tokenUsage: jsonb('token_usage'),
  createdAt: timestamp('created_at').defaultNow(),
})

export const workflowRuns = pgTable('seashore_workflow_runs', {
  id: uuid('id').primaryKey().defaultRandom(),
  workflowName: text('workflow_name'),
  status: text('status').$type<'running' | 'pending' | 'completed' | 'failed'>(),
  state: jsonb('state'),
  currentStep: text('current_step'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
})
```

Storage Service API：

```typescript
interface StorageService {
  createThread(opts?: { title?: string; metadata?: Record<string, unknown> }): Promise<Thread>
  getThread(id: string): Promise<Thread | null>
  listThreads(opts?: PaginationOpts): Promise<Thread[]>
  addMessage(threadId: string, message: NewMessage): Promise<Message>
  getMessages(threadId: string, opts?: PaginationOpts): Promise<Message[]>
  saveWorkflowRun(run: WorkflowRunState): Promise<void>
  getWorkflowRun(id: string): Promise<WorkflowRunState | null>
}
```

### VectorDB (data/vectordb)

pgvector 向量存储，HNSW 索引 + tsvector 全文搜索：

```typescript
export const embeddings = pgTable('seashore_embeddings', {
  id: uuid('id').primaryKey().defaultRandom(),
  collection: text('collection').notNull(),
  content: text('content').notNull(),
  metadata: jsonb('metadata'),
  embedding: vector('embedding', { dimensions: 1536 }),
  contentTsv: tsvector('content_tsv'),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  embeddingIdx: index('embedding_hnsw_idx')
    .using('hnsw', table.embedding.op('vector_cosine_ops')),
  contentTsvIdx: index('content_tsv_idx')
    .using('gin', table.contentTsv),
}))
```

VectorDB Service：

```typescript
interface VectorDBService {
  upsert(collection: string, docs: DocumentInput[]): Promise<void>
  search(collection: string, query: SearchQuery): Promise<SearchResult[]>
  delete(collection: string, filter: Filter): Promise<void>
}

interface SearchQuery {
  vector?: number[]
  text?: string
  mode: 'vector' | 'text' | 'hybrid'
  topK: number
  filter?: Filter
  hybridWeights?: { vector: number; text: number } // 默认 0.7 / 0.3
}
```

混合检索结果用 Reciprocal Rank Fusion (RRF) 合并排序。

### RAG (data/rag)

RAG 管线是对 embedding + vectordb + LLM 的编排：

```typescript
const ragPipeline = createRAG({
  embedding: createEmbeddingAdapter({ provider: 'openai', model: 'text-embedding-3-small', apiKey: '...' }),
  vectordb: vectorDBService,
  collection: 'knowledge-base',
  searchMode: 'hybrid',
  topK: 5,
  hybridWeights: { vector: 0.7, text: 0.3 },
})

// 摄入
await ragPipeline.ingest([
  { content: '...', metadata: { source: 'doc1.pdf' } },
])

// 检索
const chunks = await ragPipeline.retrieve('What is HNSW?')

// Chunking 策略
const chunker = createChunker({
  strategy: 'recursive',   // 'fixed' | 'recursive' | 'semantic'
  chunkSize: 512,
  overlap: 50,
})
```

---

## @seashore/platform

### MCP (platform/mcp) — Client Only

基于 `@modelcontextprotocol/sdk`，将 MCP Server 的工具转为 @tanstack/ai 兼容格式：

```typescript
const mcpTools = await connectMCP({
  transport: 'stdio',
  command: 'npx',
  args: ['-y', '@some/mcp-server'],
})

const agent = createReActAgent({
  tools: [...localTools, ...mcpTools],
})
```

### Security / Guardrail (platform/security)

内容审查中间件：

```typescript
const contentFilter = createGuardrail({
  name: 'content-filter',
  beforeRequest: async (messages) => {
    if (containsPII(messages.at(-1))) {
      return { blocked: true, reason: 'PII detected' }
    }
    return { blocked: false }
  },
  afterResponse: async (response) => {
    if (containsHarmfulContent(response)) {
      return { blocked: true, reason: 'Harmful content' }
    }
    return { blocked: false }
  },
})

// LLM-as-Judge Guardrail，复用 core 的 adapter
const llmGuardrail = createLLMGuardrail({
  adapter,
  prompt: 'Evaluate if the following content is safe...',
  parseResult: (output) => ({ blocked: output.includes('UNSAFE') }),
})

const agent = createReActAgent({
  guardrails: [contentFilter, llmGuardrail],
})
```

### Evaluation (platform/eval)

框架提供 metric 接口定义和工厂函数，用户自定义 metric。

```typescript
interface EvalMetric<TInput = string, TOutput = string> {
  name: string
  evaluate(params: {
    input: TInput
    output: TOutput
    expected?: string
    context?: string[]
  }): Promise<number>  // 0-1
}

// 传统算法 metric
const bleuScore = createMetric({
  name: 'bleu',
  evaluate: async ({ output, expected }) => computeBLEU(output, expected),
})

// LLM-as-Judge metric，复用 core 的 adapter
const helpfulness = createLLMJudgeMetric({
  name: 'helpfulness',
  adapter,
  prompt: 'Rate the helpfulness from 0 to 10...',
  parseScore: (judgment) => parseFloat(judgment) / 10,
})

// 完全自定义
const customMetric: EvalMetric = {
  name: 'format-check',
  evaluate: async ({ output }) => {
    try { JSON.parse(output); return 1.0 } catch { return 0.0 }
  },
}

const suite = createEvalSuite({
  name: 'my-eval',
  dataset: [{ input: '...', expected: '...' }],
  metrics: [bleuScore, helpfulness, customMetric],
})

const results = await suite.run(agent)
```

### Deploy (platform/deploy)

基于 Hono，兼容 CF Workers + 传统 Node.js：

```typescript
import { Hono } from 'hono'
import { seashoreMiddleware } from '@seashore/platform'

const app = new Hono()

app.route('/api/agent', seashoreMiddleware({
  agent: researchAgent,
  storage: storageService,
  guardrails: [contentFilter],
  cors: true,
}))

// CF Workers: export default app
// Node.js: serve(app, { port: 3000 })
```

自动生成的 endpoints：
- `POST /chat` — 流式对话
- `GET /threads` — 列出对话线程
- `GET /threads/:id/messages` — 获取消息
- `POST /workflow/:name/resume` — 恢复挂起的 workflow

---

## @seashore/react

React 18 hooks，不提供 UI 组件，只提供状态管理：

```typescript
function useSeashoreChat(config: {
  endpoint: string
  threadId?: string
  onToolCall?: (call: ToolCall) => void
}): {
  messages: Message[]
  sendMessage: (content: string) => void
  isStreaming: boolean
  error: Error | null
  pendingConfirmation: HumanInputRequest | null
  confirmAction: (response: HumanInputResponse) => void
}

function useSSEStream(url: string): StreamState
```
