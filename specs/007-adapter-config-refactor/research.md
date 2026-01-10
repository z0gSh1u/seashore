# Research: LLM Adapter Configuration Refactor

**Created**: 2026-01-10  
**Feature**: 007-adapter-config-refactor

## Research Tasks

### 1. @tanstack/ai 对多模态功能的支持状态

**问题**: @tanstack/ai 是否提供 embedding、image、video、transcription、TTS 功能的适配器？

**发现**: 
- **Embedding**: @tanstack/ai 已移除直接的 embedding 支持，建议使用 provider SDK 直接调用
- **Image Generation**: 支持，提供 `openaiImage()`, `geminiImage()`, `createOpenaiImage(apiKey)`, `createGeminiImage(apiKey)`
- **TTS**: 支持，提供 `openaiTTS()`, `openaiSpeech()`, `geminiSpeech()`
- **Transcription**: 支持，提供 `openaiTranscription()`
- **Video**: 支持，提供 `openaiVideo()`

**决策**: Seashore 当前的多模态实现使用自定义 fetch 调用，不依赖 @tanstack/ai 的多模态功能。这是正确的做法，因为：
1. @tanstack/ai 已明确移除 embedding 功能
2. 自定义实现提供更精细的控制
3. 可以统一所有 adapter 的配置模式

**替代方案考虑**: 可以迁移到 @tanstack/ai 的多模态适配器，但会引入额外依赖且可能失去部分灵活性。保持当前自定义实现。

---

### 2. OpenAI API 的 baseURL 配置

**问题**: OpenAI 兼容 API 如何处理 baseURL？

**发现**:
- OpenAI 官方端点: `https://api.openai.com/v1`
- Azure OpenAI: 使用自定义 baseURL `https://{resource}.openai.azure.com/openai/deployments/{deployment}`
- 本地代理/兼容服务: 使用自定义 baseURL 如 `http://localhost:8000/v1`

**决策**: 
- `baseURL` 应完整替换 API 端点的基础部分
- 当前硬编码的 URL 如 `https://api.openai.com/v1/embeddings` 应改为 `${baseURL}/embeddings`
- 默认值: `https://api.openai.com/v1`

---

### 3. Gemini API 的 baseURL 配置

**问题**: Gemini API 是否支持自定义 baseURL？

**发现**:
- Gemini 官方端点: `https://generativelanguage.googleapis.com/v1beta`
- @tanstack/ai 的 `createGeminiChat` 支持 `baseURL` 配置选项
- 企业用户可能使用 Vertex AI 端点

**决策**:
- Gemini adapter 也应支持 `baseURL` 配置
- 默认值: `https://generativelanguage.googleapis.com/v1beta`
- 类型定义中标记为可选

---

### 4. API 密钥优先级

**问题**: 当代码配置和环境变量同时存在时，如何确定优先级？

**发现**:
- @tanstack/ai 的适配器优先使用构造函数传入的 apiKey
- 业界标准: 显式配置 > 环境变量

**决策**:
- 代码传入的 `apiKey` 优先于环境变量
- 实现逻辑: `const key = adapter.apiKey ?? getEnvVar('OPENAI_API_KEY')`
- 当两者都不存在时抛出错误

---

### 5. 向后兼容性策略

**问题**: 如何确保现有代码无需修改即可继续工作？

**发现**:
- 当前函数签名: `openaiEmbed(model?: string, dimensions?: number)`
- 需要保持这种调用方式有效

**决策**: 
- 使用可选的 options 对象作为最后一个参数
- 新签名: `openaiEmbed(model?: string, dimensions?: number, options?: { apiKey?: string; baseURL?: string })`
- 或者使用重载/联合类型支持两种调用模式

**替代方案考虑**: 
- 方案 A: 添加 options 作为第三个参数 ✅ 选择
- 方案 B: 创建新函数如 `createOpenaiEmbed(config)` - 增加 API 表面积
- 方案 C: 使用单一 config 对象 - 破坏向后兼容

---

### 6. 类型设计模式

**问题**: 如何设计类型以清晰反映不同 provider 的能力差异？

**发现**:
- 参考现有 `OpenAIAdapterConfig` 设计：使用联合类型区分 provider
- OpenAI 支持 `baseURL`，Gemini 也支持

**决策**:
- 使用条件类型或联合类型区分 provider 特定选项
- 类型示例:
  ```typescript
  interface OpenAIEmbeddingAdapter {
    provider: 'openai';
    model: string;
    dimensions?: number;
    apiKey?: string;
    baseURL?: string;
  }
  
  interface GeminiEmbeddingAdapter {
    provider: 'gemini';
    model: string;
    dimensions?: number;
    apiKey?: string;
    baseURL?: string;
  }
  
  type EmbeddingAdapter = OpenAIEmbeddingAdapter | GeminiEmbeddingAdapter;
  ```

---

## Summary

| 研究项 | 决策 | 理由 |
|-------|------|------|
| 多模态实现方式 | 保持自定义 fetch 实现 | @tanstack/ai 已移除 embedding，自定义实现更灵活 |
| baseURL 支持 | OpenAI 和 Gemini 都支持 | 企业用户需求，API 层面都可行 |
| API 密钥优先级 | 代码配置 > 环境变量 | 业界标准，显式优于隐式 |
| 向后兼容 | 添加可选 options 参数 | 最小侵入性变更 |
| 类型设计 | 使用联合类型区分 provider | 保持类型安全，明确能力差异 |
