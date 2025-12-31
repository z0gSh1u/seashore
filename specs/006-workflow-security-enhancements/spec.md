# Feature Specification: Workflow LLM Node 模型灵活配置与 Security 外部 API 规则支持

**Feature Branch**: `006-workflow-security-enhancements`  
**Created**: 2026-01-01  
**Status**: Draft  
**Input**: 用户描述: "工作流中的 LLM Node 不能灵活地自定义模型参数（baseURL、apiKey 等），需要达到 createAgent 的 model 参数的自定义程度；为 Security 模块添加支持用户调用外部 API 实现 SecurityRule 的示例，支持自建内容安全系统。"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 工作流 LLM Node 使用自定义模型配置 (Priority: P1)

作为一名开发者，我希望在创建工作流的 LLM Node 时能够灵活配置模型参数（包括 baseURL、apiKey、organization 等），就像在 `createAgent` 中使用 `openaiText()` 一样，从而可以连接到自建的 OpenAI 兼容 API 或使用不同的 API 密钥。

**Why this priority**: 这是核心功能增强，直接影响工作流的可用性。许多企业用户需要连接到内部代理或使用特定的 API 端点，没有此功能工作流模块无法满足企业使用场景。

**Independent Test**: 可以通过创建一个使用自定义 baseURL 的工作流 LLM Node，验证请求是否发送到正确的端点来独立测试。

**Acceptance Scenarios**:

1. **Given** 开发者拥有自建的 OpenAI 兼容 API 端点, **When** 在 `createLLMNode` 中传入包含 `baseURL` 的适配器配置, **Then** LLM 请求应发送到指定的 baseURL
2. **Given** 开发者需要为不同节点使用不同的 API 密钥, **When** 为每个 LLM Node 配置不同的 `apiKey`, **Then** 每个节点应使用其指定的 API 密钥
3. **Given** 开发者使用 `openaiText()` 创建适配器, **When** 将此适配器传给 `createLLMNode`, **Then** 节点应使用该适配器执行 LLM 调用

---

### User Story 2 - 使用外部 API 创建自定义 SecurityRule (Priority: P1)

作为一名开发者，我希望能够创建调用外部内容安全 API 的 SecurityRule，从而可以集成公司自建的内容审核系统或第三方安全服务。

**Why this priority**: 企业用户通常有自己的内容安全基础设施，需要与现有系统集成。此功能是企业级安全合规的关键需求。

**Independent Test**: 可以通过创建一个调用 mock 外部 API 的 SecurityRule，验证检查结果正确传递来独立测试。

**Acceptance Scenarios**:

1. **Given** 公司有自建的内容安全 API, **When** 使用 `createSecurityRule` 创建调用该 API 的规则, **Then** 规则应能正确调用 API 并返回检查结果
2. **Given** 外部 API 返回违规检测结果, **When** 规则处理该响应, **Then** 应正确转换为 `SecurityCheckResult` 格式
3. **Given** 外部 API 调用失败或超时, **When** 规则执行检查, **Then** 应提供合理的错误处理和降级策略

---

### User Story 3 - 更新工作流示例代码 (Priority: P2)

作为一名开发者，我希望示例代码 `05-workflow-basic.ts` 能展示如何使用完整的模型配置，从而学习正确的使用方式。

**Why this priority**: 示例代码是开发者学习 API 的主要途径，更新示例可以帮助用户快速上手新功能。

**Independent Test**: 可以运行更新后的示例代码，验证其能成功执行并连接到配置的 API 端点。

**Acceptance Scenarios**:

1. **Given** 示例代码使用了新的模型配置 API, **When** 开发者运行示例, **Then** 示例应成功执行并展示完整的模型配置用法

---

### User Story 4 - 添加外部 API 安全规则示例 (Priority: P2)

作为一名开发者，我希望 `09-security-guardrails.ts` 示例能包含调用外部 API 的 SecurityRule 示例，从而学习如何集成自建内容安全系统。

**Why this priority**: 示例代码可以帮助开发者快速理解如何实现自定义外部 API 规则。

**Independent Test**: 可以运行更新后的示例代码，验证外部 API 规则的创建和使用方式是否清晰易懂。

**Acceptance Scenarios**:

1. **Given** 示例代码包含外部 API 规则示例, **When** 开发者阅读示例, **Then** 应能理解如何创建和使用外部 API 规则

---

### Edge Cases

- 当外部安全 API 响应超时时，规则应提供明确的错误信息或使用降级策略
- 当外部 API 返回非预期格式的响应时，规则应安全地处理解析错误
- 当工作流 LLM Node 的适配器配置不完整（如缺少 apiKey）时，应在执行前提供清晰的错误提示
- 当工作流执行过程中 API 密钥失效时，应返回可理解的错误信息

## Requirements *(mandatory)*

### Functional Requirements

#### Workflow LLM Node 模型配置

- **FR-001**: `createLLMNode` 必须支持接收完整的 TextAdapter 对象（如 `openaiText()` 返回的对象）作为 `adapter` 参数
- **FR-002**: 工作流的 `LLMNodeConfig.adapter` 类型必须支持 `TextAdapter` 类型，不仅限于简单的 provider/model 配置对象
- **FR-003**: LLM Node 执行时必须使用传入的 adapter 进行实际的 LLM 调用，而非当前的占位实现
- **FR-004**: 支持的适配器配置参数必须包括：`baseURL`、`apiKey`、`organization`（针对 OpenAI）、`model`

#### Security 外部 API 规则

- **FR-005**: 必须提供创建自定义 SecurityRule 的方式，允许用户定义调用外部 API 的检查逻辑
- **FR-006**: `createSecurityRule` 必须支持异步的 `check` 函数，可以在其中执行 HTTP 请求
- **FR-007**: 外部 API 规则示例必须展示完整的错误处理模式，包括超时处理和错误降级
- **FR-008**: 自定义规则必须能够正确返回 `SecurityCheckResult`，包括 `passed`、`violations`、`output` 等字段

#### 示例代码

- **FR-009**: `05-workflow-basic.ts` 示例必须更新为使用 `openaiText()` 创建适配器，展示完整的模型配置
- **FR-010**: `09-security-guardrails.ts` 示例必须添加外部 API SecurityRule 的使用示例

### Key Entities

- **TextAdapter**: LLM 文本生成适配器，封装了模型配置（provider、model、baseURL、apiKey 等）和调用逻辑
- **LLMNodeConfig**: 工作流 LLM 节点配置，包含节点名称、适配器、提示词等
- **SecurityRule**: 安全规则接口，定义了规则名称、类型和检查函数
- **SecurityCheckResult**: 安全检查结果，包含通过状态、违规列表和可选的转换后输出

## Assumptions

- 假设用户有权访问外部 API 端点，框架不负责验证 API 可达性
- 假设外部安全 API 返回 JSON 格式的响应，用户负责解析特定格式
- 假设 @tanstack/ai 的适配器 API 保持稳定，框架直接使用其类型定义
- 假设默认超时时间为合理值（如 30 秒），用户可根据需要在自定义规则中配置

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 开发者能够在 5 分钟内配置一个使用自定义 baseURL 的工作流 LLM Node
- **SC-002**: 开发者能够在 10 分钟内创建一个调用外部安全 API 的自定义 SecurityRule
- **SC-003**: 更新后的示例代码能够成功运行，无需额外说明即可理解新 API 的使用方式
- **SC-004**: 新 API 与现有代码保持向后兼容，现有的简单配置（provider/model 对象）仍然有效
- **SC-005**: 100% 的新功能代码有对应的类型定义，开发者在 IDE 中能获得完整的类型提示
