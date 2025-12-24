# Feature Specification: Agent 研发框架

**Feature Branch**: `001-agent-framework`  
**Created**: 2025-12-25  
**Status**: Draft  
**Input**: User description: "用 TypeScript 写一个 Agent 研发框架，类似于 Mastra、Agno、Google ADK，包含 workflow、vectordb、tool、storage、rag、observability、memory、mcp、llm、genui、evaluation、deploy、agent、security 等模块"

## User Scenarios & Testing _(mandatory)_

### User Story 1 - 创建简单 ReAct Agent (Priority: P1)

开发者想要快速创建一个能够使用工具完成任务的 ReAct 型智能体。开发者定义 Agent 的系统提示词、可用工具列表，然后运行 Agent 处理用户输入，Agent 能够自主选择工具、执行、观察结果并最终给出答复。

**Why this priority**: 这是 Agent 框架最核心的能力，没有 Agent 创建能力，其他模块都没有意义。

**Independent Test**: 可以创建一个简单的天气查询 Agent，给定 "北京今天天气如何" 的输入，Agent 调用 weather 工具后返回格式化的天气信息。

**Acceptance Scenarios**:

1. **Given** 开发者已安装 `@seashore/agent` 包, **When** 开发者使用 `createAgent()` 定义 Agent 配置（系统提示词、工具列表、LLM 模型）, **Then** 返回一个可运行的 Agent 实例
2. **Given** Agent 实例已创建, **When** 调用 `agent.run("查询北京天气")`, **Then** Agent 自动识别需要调用 weather 工具，执行后返回包含天气信息的结构化响应
3. **Given** Agent 运行过程中, **When** 工具执行失败, **Then** Agent 能够捕获错误并尝试替代方案或返回友好的错误提示

---

### User Story 2 - 定义和使用工具 (Priority: P1)

开发者想要为 Agent 创建自定义工具。开发者使用类型安全的方式定义工具的名称、描述、输入参数 schema 和执行逻辑，然后将工具注册给 Agent 使用。

**Why this priority**: 工具是 Agent 与外部世界交互的桥梁，是 Agent 能力的核心扩展点。

**Independent Test**: 定义一个计算器工具，接受两个数字和操作符，返回计算结果。工具定义后可独立测试其 schema 验证和执行逻辑。

**Acceptance Scenarios**:

1. **Given** 开发者想创建自定义工具, **When** 使用 `defineTool()` 配合 Zod schema 定义输入参数, **Then** 获得一个类型安全的工具定义对象
2. **Given** 工具已定义, **When** 传入符合 schema 的参数调用工具, **Then** 工具正确执行并返回类型化的结果
3. **Given** 工具已定义, **When** 传入不符合 schema 的参数, **Then** 抛出明确的验证错误

---

### User Story 3 - 接入 LLM 模型 (Priority: P1)

开发者想要使用不同的 LLM 提供商（OpenAI、Gemini、Anthropic）来驱动 Agent。开发者通过统一的适配器接口配置 LLM，无需关心底层 API 差异。

**Why this priority**: LLM 是 Agent 的"大脑"，必须支持才能运行 Agent。

**Independent Test**: 使用 OpenAI 适配器发送一条简单的 chat 消息，验证流式响应正常工作。

**Acceptance Scenarios**:

1. **Given** 开发者已配置 OpenAI API Key, **When** 使用 `openaiText('gpt-4o')` 创建适配器, **Then** 可以直接用于 Agent 或独立的 chat 调用
2. **Given** LLM 适配器已创建, **When** 发送消息进行对话, **Then** 支持流式和非流式两种响应模式
3. **Given** 需要切换 LLM 提供商, **When** 将 `openaiText` 替换为 `anthropicText` 或 `geminiText`, **Then** Agent 代码无需其他修改即可正常运行

---

### User Story 4 - 构建工作流 (Priority: P2)

开发者想要构建多步骤的工作流，将多个 Agent 或任务节点串联起来。开发者定义工作流的节点、边和执行顺序，工作流引擎负责调度执行。

**Why this priority**: 复杂场景需要编排多个 Agent 或任务协作，工作流是实现复杂业务逻辑的关键。

**Independent Test**: 创建一个两步工作流：第一步生成文章大纲，第二步根据大纲生成正文。验证数据正确在节点间传递。

**Acceptance Scenarios**:

1. **Given** 开发者需要编排多步任务, **When** 使用 `createWorkflow()` 定义节点和连接关系, **Then** 返回可执行的工作流实例
2. **Given** 工作流已定义, **When** 调用 `workflow.run(input)`, **Then** 按定义顺序执行各节点，前一节点输出作为后一节点输入
3. **Given** 工作流执行中, **When** 某节点失败, **Then** 工作流暂停并提供重试或跳过的选项

---

### User Story 5 - 实现 RAG 检索增强 (Priority: P2)

开发者想要让 Agent 能够从知识库中检索相关信息来增强回答。开发者将文档导入向量数据库，Agent 在回答问题时自动检索相关片段作为上下文。

**Why this priority**: RAG 是提升 Agent 知识准确性的关键能力，适用于知识问答、文档助手等场景。

**Independent Test**: 将几篇文档导入向量库，查询 "项目截止日期是什么"，验证返回最相关的文档片段。

**Acceptance Scenarios**:

1. **Given** 开发者有一批文档, **When** 使用 `vectorStore.addDocuments(docs)` 导入, **Then** 文档被切分、向量化并存储
2. **Given** 向量库已有数据, **When** 调用 `vectorStore.search(query, k)`, **Then** 返回 top-k 最相关的文档片段及相似度分数
3. **Given** Agent 配置了 RAG 能力, **When** 用户提问, **Then** Agent 自动检索相关上下文并在回答中引用

---

### User Story 6 - 管理对话记忆 (Priority: P2)

开发者想要 Agent 能够记住对话历史和关键信息。系统支持短期记忆（当前对话）、中期记忆（会话级别）和长期记忆（跨会话持久化）。

**Why this priority**: 记忆是实现连贯对话和个性化体验的基础。

**Independent Test**: 在对话中告诉 Agent "我叫张三"，后续对话中询问 "我叫什么"，验证 Agent 正确回忆。

**Acceptance Scenarios**:

1. **Given** Agent 配置了记忆模块, **When** 进行多轮对话, **Then** Agent 能够引用之前对话中提到的信息
2. **Given** 需要跨会话记忆, **When** 配置长期记忆存储, **Then** 用户下次对话时 Agent 能回忆之前的关键信息
3. **Given** 对话进行中, **When** 调用 `memory.getSummary()`, **Then** 返回当前对话的摘要信息

---

### User Story 7 - 持久化存储实体 (Priority: P2)

开发者想要持久化存储 Agent 的运行数据，包括对话线程、消息、会话状态等。系统提供关系型存储抽象层，支持不同的数据库后端。

**Why this priority**: 生产环境需要持久化对话历史，便于审计、分析和恢复会话。

**Independent Test**: 创建一个 Thread，添加几条 Message，重启应用后能够加载回完整的对话历史。

**Acceptance Scenarios**:

1. **Given** 开发者配置了存储后端, **When** Agent 进行对话, **Then** Thread 和 Message 自动持久化
2. **Given** 存储中有历史数据, **When** 调用 `storage.getThread(threadId)`, **Then** 返回完整的对话历史
3. **Given** 需要查询历史对话, **When** 使用 `storage.queryMessages(filter)`, **Then** 返回符合条件的消息列表

---

### User Story 8 - 支持 MCP 协议 (Priority: P3)

开发者想要让 Agent 支持 Model Context Protocol (MCP)，能够连接符合 MCP 规范的工具服务器和资源服务器。

**Why this priority**: MCP 是新兴的 Agent 互操作标准，支持它能够复用生态中的工具和资源。

**Independent Test**: 连接一个 MCP 文件系统服务器，通过 Agent 列出目录内容。

**Acceptance Scenarios**:

1. **Given** 有可用的 MCP 服务器, **When** 使用 `connectMcp(serverUrl)` 连接, **Then** 自动发现服务器提供的工具和资源
2. **Given** MCP 连接已建立, **When** Agent 需要使用 MCP 工具, **Then** 透明地调用远程工具并获取结果
3. **Given** MCP 服务器提供资源, **When** Agent 需要读取资源, **Then** 能够获取资源内容作为上下文

---

### User Story 9 - 构建聊天 UI (Priority: P3)

开发者想要快速构建 Agent 的聊天界面。系统提供 React 组件库，支持消息渲染、流式输出、工具调用展示等功能。

**Why this priority**: 可视化交互界面是 Agent 应用落地的重要组成部分。

**Independent Test**: 使用 `<Chat />` 组件，配置 Agent 后端地址，验证能够进行完整的对话交互。

**Acceptance Scenarios**:

1. **Given** 开发者使用 React 构建前端, **When** 导入 `@seashore/genui` 组件, **Then** 获得开箱即用的聊天 UI 组件
2. **Given** 聊天 UI 已渲染, **When** Agent 流式返回响应, **Then** UI 实时显示打字机效果
3. **Given** Agent 调用了工具, **When** 工具执行中, **Then** UI 显示工具调用状态和结果

---

### User Story 10 - 监控可观测性 (Priority: P3)

开发者想要监控 Agent 的运行状态，包括调用链路追踪、Token 消耗统计、延迟监控等。

**Why this priority**: 生产环境需要可观测性来诊断问题和优化性能。

**Independent Test**: 启用 observability 模块后，运行一次 Agent 对话，在控制台或指定 endpoint 查看 trace 信息。

**Acceptance Scenarios**:

1. **Given** 开发者配置了 observability, **When** Agent 执行任务, **Then** 自动记录完整的调用链路
2. **Given** 需要统计 Token 消耗, **When** 查看 observability 数据, **Then** 显示各模型的 Token 用量和费用估算
3. **Given** 需要性能分析, **When** 查看 trace, **Then** 能看到各步骤的耗时分布

---

### User Story 11 - 评测 Agent 性能 (Priority: P3)

开发者想要评估 Agent 的回答质量和任务完成能力。系统提供评测框架，支持自定义评估指标和测试数据集。

**Why this priority**: 持续评测是优化 Agent 性能的基础，但不影响核心功能。

**Independent Test**: 准备一组问答数据集，运行评测后获得准确率、延迟等指标报告。

**Acceptance Scenarios**:

1. **Given** 开发者准备了评测数据集, **When** 调用 `evaluate(agent, dataset)`, **Then** 自动运行评测并生成报告
2. **Given** 需要自定义评估指标, **When** 定义 `customMetric` 函数, **Then** 评测框架使用该指标进行评分
3. **Given** 评测完成, **When** 查看报告, **Then** 包含各指标的统计值和样例分析

---

### User Story 12 - 内容安全审查 (Priority: P3)

开发者想要对 Agent 的输入输出进行安全审查，防止有害内容生成或敏感信息泄露。

**Why this priority**: 安全合规是生产部署的必要条件，但可以后期集成。

**Independent Test**: 配置内容过滤规则后，发送包含敏感词的输入，验证被正确拦截。

**Acceptance Scenarios**:

1. **Given** 开发者配置了 Guardrail, **When** 用户输入包含有害内容, **Then** 请求被拦截并返回友好提示
2. **Given** Agent 生成了敏感内容, **When** 经过 Guardrail 检查, **Then** 敏感部分被过滤或替换
3. **Given** 需要自定义审查规则, **When** 配置 `customGuardrail` 函数, **Then** 按自定义逻辑进行审查

---

### User Story 13 - 部署 Agent 服务 (Priority: P4)

开发者想要将 Agent 部署为生产服务。系统提供部署工具，支持本地开发服务器和生产环境部署。

**Why this priority**: 部署是最终交付环节，依赖其他所有模块完成。

**Independent Test**: 使用 `seashore dev` 命令，将 Agent 部署到本地开发服务器，通过 HTTP API 访问。

**Acceptance Scenarios**:

1. **Given** Agent 开发完成, **When** 运行 `seashore dev`, **Then** 启动本地开发服务器，提供 HTTP/SSE 接口
2. **Given** 需要生产部署, **When** 配置部署目标（Cloudflare Workers/Docker 等）, **Then** 生成对应的部署配置和产物
3. **Given** 服务已部署, **When** 客户端发送请求, **Then** Agent 正确处理并返回响应

---

### Edge Cases

- 当 LLM API 返回速率限制错误时，系统自动进行指数退避重试
- 当工具执行超时时，Agent 能够优雅降级或尝试替代方案
- 当向量数据库连接失败时，RAG 查询返回空结果而非崩溃
- 当对话历史过长超出模型上下文窗口时，自动进行摘要压缩
- 当 MCP 服务器断开连接时，相关工具自动标记为不可用

## Requirements _(mandatory)_

### Functional Requirements

**Core - Agent**

- **FR-001**: 系统 MUST 支持创建 ReAct 型 Agent，能够自主进行 Thought-Action-Observation 循环
- **FR-002**: 系统 MUST 支持创建 Workflow 型 Agent，按预定义流程执行任务
- **FR-003**: Agent MUST 支持配置系统提示词、工具列表、LLM 模型
- **FR-004**: Agent MUST 支持同步和流式两种执行模式

**Core - Tool**

- **FR-005**: 系统 MUST 提供类型安全的工具定义 API，使用 Zod schema 定义参数
- **FR-006**: 系统 MUST 支持服务端工具（后端执行）和客户端工具（前端执行）
- **FR-007**: 工具 MUST 支持设置需要用户审批的标记
- **FR-008**: 系统 MUST 提供预置工具：Serper（搜索引擎）和 Firecrawl（网页抓取）

**Core - LLM**

- **FR-009**: 系统 MUST 提供统一的 LLM 适配器接口，屏蔽不同提供商的 API 差异
- **FR-010**: 系统 MUST 支持 OpenAI、Gemini、Anthropic 三种 LLM 提供商
- **FR-011**: LLM 适配器 MUST 支持流式响应
- **FR-012**: LLM 适配器 SHOULD 支持结构化输出（JSON Schema / Zod Schema）

**Workflow**

- **FR-013**: 系统 MUST 支持定义有向无环图（DAG）形式的工作流
- **FR-014**: 工作流 MUST 支持条件分支和并行执行
- **FR-015**: 工作流 MUST 支持节点间数据传递
- **FR-016**: 工作流 SHOULD 支持暂停和恢复执行

**Vector Database**

- **FR-017**: 系统 MUST 提供基于 PostgreSQL pgvector 的向量数据库实现
- **FR-018**: 系统 MUST 支持 OpenAI Embeddings 嵌入模型
- **FR-019**: 向量库 MUST 支持文档添加、删除、相似度搜索操作
- **FR-020**: 系统 MUST 实现 HNSW 索引算法以提升检索性能

**RAG**

- **FR-021**: 系统 MUST 提供文档加载和切分能力
- **FR-022**: 系统 MUST 支持将检索结果注入 Agent 上下文
- **FR-023**: 系统 MUST 支持混合检索（向量检索 + 基于 PostgreSQL tsvector 的全文检索）

**Storage**

- **FR-024**: 系统 MUST 定义 Thread、Message、Session 等核心实体
- **FR-025**: 系统 MUST 使用 PostgreSQL 作为持久化存储，ORM 使用 Drizzle
- **FR-026**: 存储 MUST 支持 CRUD 操作和基础查询

**Memory**

- **FR-027**: 系统 MUST 支持短期记忆（当前对话消息列表）
- **FR-028**: 系统 SHOULD 支持中期记忆（会话级摘要）
- **FR-029**: 系统 SHOULD 支持长期记忆（跨会话持久化关键信息）

**MCP**

- **FR-030**: 系统 MUST 支持作为 MCP 客户端连接 MCP 服务器
- **FR-031**: 系统 MUST 支持发现和调用 MCP 工具
- **FR-032**: 系统 SHOULD 支持读取 MCP 资源

**GenUI**

- **FR-033**: 系统 MUST 提供 React 聊天组件套件（对话历史、对话区、对话框）
- **FR-034**: 聊天组件 MUST 支持流式消息渲染
- **FR-035**: 聊天组件 MUST 支持工具调用状态展示
- **FR-036**: 系统 MUST 支持基于 Tool Call 的生成式 UI（禁止使用 XML 标签方式）
- **FR-036a**: 系统 MUST 支持自定义组件渲染（开发者可注册自定义渲染器）

**Observability**

- **FR-037**: 系统 MUST 支持调用链路追踪（Trace）
- **FR-038**: 系统 MUST 记录 LLM 调用的 Token 消耗
- **FR-039**: 系统 SHOULD 支持导出到标准可观测性后端（OpenTelemetry）

**Evaluation**

- **FR-040**: 系统 MUST 支持定义评测数据集
- **FR-041**: 系统 MUST 支持批量运行评测
- **FR-042**: 系统 SHOULD 提供常用评估指标（准确率、延迟、相关性等）

**Security**

- **FR-043**: 系统 MUST 支持配置输入过滤规则
- **FR-044**: 系统 MUST 支持配置输出过滤规则
- **FR-045**: 系统 SHOULD 支持自定义 Guardrail 函数

**Multimodal**

- **FR-048**: 系统 SHOULD 支持图片生成（依赖 @tanstack/ai 支持情况）
- **FR-049**: 系统 SHOULD 支持视频生成（依赖 @tanstack/ai 支持情况）
- **FR-050**: 系统 SHOULD 支持语音转文字（Transcription，依赖 @tanstack/ai 支持情况）
- **FR-051**: 系统 SHOULD 支持文字转语音（TTS，依赖 @tanstack/ai 支持情况）

**Deploy**

- **FR-046**: 系统 MUST 提供基于 Hono 的本地开发服务器
- **FR-047**: 系统 MUST 支持 Cloudflare Workers 部署
- **FR-047a**: 系统 MUST 兼容非 Serverless 环境（传统 Node.js 服务器）

### Key Entities

- **Agent**: 智能体实例，包含配置、状态和执行能力
- **Tool**: 工具定义，包含名称、描述、参数 schema、执行函数
- **Workflow**: 工作流定义，包含节点集合和连接关系
- **Thread**: 对话线程，包含消息列表和元数据
- **Message**: 对话消息，包含角色、内容、工具调用等
- **Document**: 知识文档，用于 RAG 检索
- **Trace**: 调用链路记录，用于可观测性

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: 开发者能够在 10 分钟内创建一个可运行的简单 Agent（从安装到首次对话成功）
- **SC-002**: 框架支持 3 种 LLM 提供商（OpenAI、Gemini、Anthropic）的无缝切换
- **SC-003**: 工具定义 100% 类型安全，参数校验错误在编译时或运行前被捕获
- **SC-004**: 流式响应延迟（首 Token 返回）不超过底层 LLM API 延迟的 1.2 倍
- **SC-005**: 所有核心模块单元测试覆盖率达到 80%+
- **SC-006**: 文档覆盖所有公开 API，包含至少 3 个完整示例
- **SC-007**: Agent 对话 99% 的情况下能正确处理工具调用链（最多 5 次工具调用循环）
- **SC-008**: 向量检索在 10000 条文档规模下，p95 延迟低于 200ms

## Assumptions

- 开发者熟悉 TypeScript 和 Node.js 生态
- 开发者有基本的 AI/LLM 概念了解
- 目标用户是需要快速构建 Agent 应用的开发者，而非需要深度定制底层的研究人员
- 初期版本优先支持 Node.js 运行时，后续可扩展到边缘运行时
- LLM API 调用由用户自行提供 API Key，框架不托管密钥
