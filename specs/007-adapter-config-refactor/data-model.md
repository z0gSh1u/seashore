# Data Model: LLM Adapter Configuration Refactor

**Created**: 2026-01-10  
**Feature**: 007-adapter-config-refactor

## Entities

### 1. EmbeddingAdapter

表示 embedding 生成的配置。

| 字段 | 类型 | 必填 | 说明 |
|-----|------|-----|------|
| provider | `'openai' \| 'gemini'` | ✅ | 服务提供商 |
| model | `string` | ✅ | 模型标识符 |
| dimensions | `number` | ❌ | 嵌入向量维度 |
| apiKey | `string` | ❌ | API 密钥（优先于环境变量） |
| baseURL | `string` | ❌ | 自定义 API 端点 |

**默认值**:
- OpenAI model: `text-embedding-3-small`
- Gemini model: `text-embedding-004`
- OpenAI baseURL: `https://api.openai.com/v1`
- Gemini baseURL: `https://generativelanguage.googleapis.com/v1beta`

---

### 2. ImageAdapter

表示图像生成的配置。

| 字段 | 类型 | 必填 | 说明 |
|-----|------|-----|------|
| provider | `'openai' \| 'gemini'` | ✅ | 服务提供商 |
| model | `string` | ✅ | 模型标识符 |
| apiKey | `string` | ❌ | API 密钥 |
| baseURL | `string` | ❌ | 自定义 API 端点 |

**默认值**:
- OpenAI model: `dall-e-3`
- Gemini model: `imagen-3.0-generate-002`

---

### 3. VideoAdapter

表示视频生成的配置。

| 字段 | 类型 | 必填 | 说明 |
|-----|------|-----|------|
| provider | `'openai'` | ✅ | 服务提供商（仅 OpenAI） |
| model | `string` | ✅ | 模型标识符 |
| apiKey | `string` | ❌ | API 密钥 |
| baseURL | `string` | ❌ | 自定义 API 端点 |

**默认值**:
- model: `sora-2`

---

### 4. TranscriptionAdapter

表示语音转录的配置。

| 字段 | 类型 | 必填 | 说明 |
|-----|------|-----|------|
| provider | `'openai'` | ✅ | 服务提供商（仅 OpenAI） |
| model | `string` | ✅ | 模型标识符 |
| apiKey | `string` | ❌ | API 密钥 |
| baseURL | `string` | ❌ | 自定义 API 端点 |

**默认值**:
- model: `whisper-1`

---

### 5. TTSAdapter

表示语音合成的配置。

| 字段 | 类型 | 必填 | 说明 |
|-----|------|-----|------|
| provider | `'openai' \| 'gemini'` | ✅ | 服务提供商 |
| model | `string` | ✅ | 模型标识符 |
| apiKey | `string` | ❌ | API 密钥 |
| baseURL | `string` | ❌ | 自定义 API 端点 |

**默认值**:
- OpenAI model: `tts-1`
- Gemini model: `gemini-2.0-flash`

---

## State Transitions

N/A - 这些是配置对象，没有状态转换。

---

## Validation Rules

1. **apiKey**: 如果提供，必须是非空字符串
2. **baseURL**: 如果提供，必须是有效的 URL 格式（以 `http://` 或 `https://` 开头）
3. **model**: 必须是非空字符串
4. **dimensions** (仅 EmbeddingAdapter): 如果提供，必须是正整数

---

## Relationships

```
EmbeddingAdapter ──uses──> generateEmbedding()
                 ──uses──> generateBatchEmbeddings()

ImageAdapter     ──uses──> generateImage()

VideoAdapter     ──uses──> generateVideo()
                 ──uses──> checkVideoStatus()

TranscriptionAdapter ──uses──> generateTranscription()

TTSAdapter       ──uses──> generateSpeech()
```

---

## Environment Variable Fallbacks

| Adapter Provider | 环境变量名 |
|-----------------|-----------|
| OpenAI | `OPENAI_API_KEY` |
| Gemini | `GOOGLE_API_KEY` |

优先级: `adapter.apiKey` > 环境变量 > 抛出错误
