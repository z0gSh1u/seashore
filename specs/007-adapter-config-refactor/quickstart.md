# Quickstart: LLM Adapter Configuration

**Feature**: 007-adapter-config-refactor

本指南展示如何使用重构后的 adapter 配置 API。

## 安装

```bash
pnpm add @seashore/llm
```

## 基本用法

### 1. Embedding - 使用环境变量（向后兼容）

```typescript
import { openaiEmbed, generateEmbedding } from '@seashore/llm';

// 现有方式仍然有效 - 从环境变量获取 API key
const adapter = openaiEmbed('text-embedding-3-large', 1024);

const result = await generateEmbedding({
  adapter,
  input: 'Hello, world!',
});

console.log(result.embedding); // number[]
```

### 2. Embedding - 使用代码配置

```typescript
import { openaiEmbed, generateEmbedding } from '@seashore/llm';

// 新方式 - 通过代码传入 apiKey 和 baseURL
const adapter = openaiEmbed('text-embedding-3-large', 1024, {
  apiKey: 'sk-your-api-key',
  baseURL: 'https://your-proxy.example.com/v1',
});

const result = await generateEmbedding({
  adapter,
  input: 'Hello, world!',
});
```

### 3. 图像生成 - 自定义端点

```typescript
import { openaiImage, generateImage } from '@seashore/llm';

const adapter = openaiImage('dall-e-3', {
  apiKey: process.env.CUSTOM_OPENAI_KEY,
  baseURL: 'https://enterprise-api.example.com/v1',
});

const result = await generateImage({
  adapter,
  prompt: 'A futuristic city at sunset',
  size: '1024x1024',
});

console.log(result.images[0].url);
```

### 4. 语音转录 - 自定义配置

```typescript
import { openaiTranscription, generateTranscription } from '@seashore/llm';

const adapter = openaiTranscription('whisper-1', {
  apiKey: 'sk-your-api-key',
});

const result = await generateTranscription({
  adapter,
  audio: audioFile,
  language: 'en',
});

console.log(result.text);
```

### 5. TTS - 使用 Gemini

```typescript
import { geminiTTS, generateSpeech } from '@seashore/llm';

const adapter = geminiTTS('gemini-2.0-flash', {
  apiKey: process.env.GOOGLE_API_KEY,
});

const result = await generateSpeech({
  adapter,
  text: 'Hello, welcome to Seashore!',
  voice: 'Aoede',
});

console.log(result.audio); // base64 encoded audio
```

## 配置优先级

1. **代码配置优先**: 如果通过 `options.apiKey` 传入 API 密钥，将优先使用
2. **环境变量回退**: 如果未配置，将从环境变量获取（`OPENAI_API_KEY` 或 `GOOGLE_API_KEY`）
3. **错误处理**: 如果两者都不存在，抛出明确的错误信息

## 支持的 Adapter

| Adapter | Provider | apiKey | baseURL |
|---------|----------|--------|---------|
| `openaiEmbed()` | OpenAI | ✅ | ✅ |
| `geminiEmbed()` | Gemini | ✅ | ✅ |
| `openaiImage()` | OpenAI | ✅ | ✅ |
| `geminiImage()` | Gemini | ✅ | ✅ |
| `openaiVideo()` | OpenAI | ✅ | ✅ |
| `openaiTranscription()` | OpenAI | ✅ | ✅ |
| `openaiTTS()` | OpenAI | ✅ | ✅ |
| `geminiTTS()` | Gemini | ✅ | ✅ |

## 迁移指南

### 无需迁移

现有代码完全向后兼容：

```typescript
// 这仍然有效！
const adapter = openaiEmbed();
const adapter = openaiEmbed('text-embedding-3-large');
const adapter = openaiEmbed('text-embedding-3-large', 1024);
```

### 可选升级

如果需要自定义配置，只需添加 options 参数：

```typescript
// 升级：添加自定义配置
const adapter = openaiEmbed('text-embedding-3-large', 1024, {
  apiKey: 'your-key',
  baseURL: 'your-url',
});
```
