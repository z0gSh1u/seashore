# Feature Specification: LLM Adapter Configuration Refactor

**Feature Branch**: `007-adapter-config-refactor`  
**Created**: 2026-01-10  
**Status**: Draft  
**Input**: User description: "重构 seashore 中 embedding 和其他多模态 adapter 的配置，支持 BASE_URL 和 API_KEY 传入，参考 OpenAIAdapterConfig 的设计模式"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 使用自定义 API 端点生成 Embeddings (Priority: P1)

作为开发者，我希望能够为 OpenAI embedding adapter 配置自定义的 BASE_URL，以便连接到本地代理服务器、企业内部部署的 OpenAI 兼容服务，或者第三方兼容 API（如 Azure OpenAI）。

**Why this priority**: 这是核心痛点，许多企业环境需要通过代理或使用兼容 API 服务，没有此功能将阻止这些用户使用 seashore。

**Independent Test**: 通过创建一个指向自定义端点的 embedding adapter 并成功生成 embeddings 来验证。

**Acceptance Scenarios**:

1. **Given** 开发者有一个自定义的 OpenAI 兼容端点, **When** 使用 `openaiEmbed` 配置 `baseURL` 和 `apiKey`, **Then** embedding 请求发送到自定义端点并返回正确结果
2. **Given** 开发者没有配置 `apiKey`, **When** 环境变量 `OPENAI_API_KEY` 已设置, **Then** adapter 自动从环境变量获取 API key
3. **Given** 开发者配置了代码中的 `apiKey`, **When** 环境变量也设置了 `OPENAI_API_KEY`, **Then** 代码中的配置优先于环境变量

---

### User Story 2 - 使用自定义端点生成图像 (Priority: P2)

作为开发者，我希望能够为图像生成 adapter（OpenAI DALL-E、Gemini Imagen）配置自定义 BASE_URL 和 API_KEY，以便使用企业部署的图像生成服务。

**Why this priority**: 图像生成是常用的多模态功能，企业用户同样需要自定义端点支持。

**Independent Test**: 创建一个带有自定义配置的 image adapter 并成功生成图像。

**Acceptance Scenarios**:

1. **Given** 开发者有自定义的图像生成端点, **When** 使用 `openaiImage` 配置 `baseURL` 和 `apiKey`, **Then** 图像生成请求发送到自定义端点
2. **Given** 未配置 `baseURL`, **When** 调用图像生成, **Then** 使用默认的官方 API 端点

---

### User Story 3 - 使用自定义端点进行语音转文字 (Priority: P2)

作为开发者，我希望能够为转录 adapter（OpenAI Whisper）配置自定义 BASE_URL 和 API_KEY，以便使用本地或企业部署的转录服务。

**Why this priority**: 语音转录在许多应用中是重要功能，需要支持自定义部署。

**Independent Test**: 创建带有自定义配置的 transcription adapter 并成功转录音频。

**Acceptance Scenarios**:

1. **Given** 开发者有自定义的转录服务端点, **When** 使用 `openaiTranscription` 配置 `baseURL` 和 `apiKey`, **Then** 转录请求发送到自定义端点

---

### User Story 4 - 使用自定义端点进行 TTS (Priority: P2)

作为开发者，我希望能够为 TTS adapter（OpenAI、Gemini）配置自定义 BASE_URL 和 API_KEY，以便使用自定义的语音合成服务。

**Why this priority**: TTS 功能同样需要支持企业自定义部署场景。

**Independent Test**: 创建带有自定义配置的 TTS adapter 并成功生成语音。

**Acceptance Scenarios**:

1. **Given** 开发者有自定义的 TTS 服务端点, **When** 使用 `openaiTTS` 配置 `baseURL` 和 `apiKey`, **Then** TTS 请求发送到自定义端点

---

### User Story 5 - 使用自定义端点进行视频生成 (Priority: P3)

作为开发者，我希望能够为视频生成 adapter（OpenAI Sora）配置自定义 BASE_URL 和 API_KEY。

**Why this priority**: 视频生成是较新的功能，使用场景相对较少，但仍需保持 API 一致性。

**Independent Test**: 创建带有自定义配置的 video adapter 并成功发起视频生成任务。

**Acceptance Scenarios**:

1. **Given** 开发者有自定义的视频生成服务端点, **When** 使用 `openaiVideo` 配置 `baseURL` 和 `apiKey`, **Then** 视频生成请求发送到自定义端点

---

### Edge Cases

- 当提供无效的 `baseURL` 时，系统如何处理？（应在请求时报告网络/连接错误）
- 当提供无效的 `apiKey` 时，系统如何处理？（应返回认证错误）
- 当 `@tanstack/ai` 底层不支持某些 provider 的自定义配置时如何处理？（应在类型定义中明确标记为可选，运行时忽略）

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 系统 MUST 为 `EmbeddingAdapter` 支持可选的 `apiKey` 配置
- **FR-002**: 系统 MUST 为 `EmbeddingAdapter`（OpenAI provider）支持可选的 `baseURL` 配置
- **FR-003**: 系统 MUST 为 `ImageAdapter` 支持可选的 `apiKey` 和 `baseURL` 配置（OpenAI provider）
- **FR-004**: 系统 MUST 为 `VideoAdapter` 支持可选的 `apiKey` 和 `baseURL` 配置
- **FR-005**: 系统 MUST 为 `TranscriptionAdapter` 支持可选的 `apiKey` 和 `baseURL` 配置
- **FR-006**: 系统 MUST 为 `TTSAdapter` 支持可选的 `apiKey` 和 `baseURL` 配置（OpenAI provider）
- **FR-007**: 当代码中提供 `apiKey` 时，系统 MUST 优先使用代码配置而非环境变量
- **FR-008**: 当代码中未提供 `apiKey` 时，系统 MUST 回退到从环境变量获取
- **FR-009**: 对于 Gemini provider，如果 `@tanstack/ai` 不支持 `baseURL` 配置，系统 SHOULD 在类型定义中标记该字段为可选且仅对支持的 provider 生效
- **FR-010**: 系统 MUST 保持与现有 API 的向后兼容性（现有调用方式应继续工作）

### Key Entities

- **EmbeddingAdapter**: 表示 embedding 生成的配置，包含 provider、model、dimensions、apiKey（可选）、baseURL（可选，仅 OpenAI）
- **ImageAdapter**: 表示图像生成的配置，包含 provider、model、apiKey（可选）、baseURL（可选，仅 OpenAI）
- **VideoAdapter**: 表示视频生成的配置，包含 provider、model、apiKey（可选）、baseURL（可选）
- **TranscriptionAdapter**: 表示语音转录的配置，包含 provider、model、apiKey（可选）、baseURL（可选）
- **TTSAdapter**: 表示语音合成的配置，包含 provider、model、apiKey（可选）、baseURL（可选，仅 OpenAI）

## Assumptions

- 遵循现有 `OpenAIAdapterConfig` 的设计模式，保持 API 一致性
- Gemini provider 的 `baseURL` 支持取决于 `@tanstack/ai` 的底层实现，如果不支持则仅在类型层面标记为可选但实际不生效
- 环境变量名称保持现有约定：`OPENAI_API_KEY`、`GOOGLE_API_KEY`
- 向后兼容：现有不传入 `apiKey` 和 `baseURL` 的调用方式应继续正常工作

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 开发者能够通过代码配置 `apiKey` 而无需设置环境变量，并成功完成 API 调用
- **SC-002**: 开发者能够配置自定义 `baseURL` 连接到本地或第三方兼容服务
- **SC-003**: 所有 5 种 adapter 类型（Embedding、Image、Video、Transcription、TTS）的 OpenAI provider 都支持 `baseURL` 和 `apiKey` 配置
- **SC-004**: 现有使用环境变量方式的代码无需修改即可继续工作（100% 向后兼容）
- **SC-005**: TypeScript 类型定义清晰反映各 provider 支持的配置选项
