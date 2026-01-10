# @seashore/llm

LLM adapters and multimodal capabilities for the Seashore Agent Framework.

## Installation

```bash
pnpm add @seashore/llm
```

## Features

- **Text Adapters**: OpenAI, Anthropic, Gemini chat completion
- **Embedding Adapters**: OpenAI and Gemini embeddings
- **Image Generation**: DALL-E and Imagen
- **Video Generation**: Sora
- **Transcription**: Whisper speech-to-text
- **Text-to-Speech**: OpenAI TTS and Gemini TTS

## Usage

### Text Adapters

```typescript
import { openaiText, chat } from '@seashore/llm';

const adapter = openaiText('gpt-4o');
const response = await chat({
  adapter,
  messages: [{ role: 'user', content: 'Hello!' }],
});
```

### Embedding Adapters

Embedding adapters support optional `apiKey` and `baseURL` configuration:

```typescript
import { openaiEmbed, geminiEmbed, generateEmbedding } from '@seashore/llm';

// Default: Uses OPENAI_API_KEY env var and default OpenAI endpoint
const defaultAdapter = openaiEmbed();

// With custom API key
const withApiKey = openaiEmbed('text-embedding-3-small', 256, {
  apiKey: 'sk-my-custom-key',
});

// With custom base URL (for proxies or compatible APIs)
const withBaseUrl = openaiEmbed('text-embedding-3-small', 256, {
  baseURL: 'https://my-proxy.example.com/v1',
});

// With both
const customAdapter = openaiEmbed('text-embedding-3-small', 256, {
  apiKey: 'sk-my-custom-key',
  baseURL: 'https://my-proxy.example.com/v1',
});

// Gemini embeddings work the same way
const geminiAdapter = geminiEmbed('text-embedding-004', undefined, {
  apiKey: 'my-google-api-key',
  baseURL: 'https://custom-gemini-endpoint.example.com/v1beta',
});

// Generate embeddings
const result = await generateEmbedding({
  adapter: customAdapter,
  text: 'Hello, world!',
});
```

### Image Generation

Image adapters also support optional `apiKey` and `baseURL`:

```typescript
import { openaiImage, geminiImage, generateImage } from '@seashore/llm';

// Default configuration
const imageAdapter = openaiImage('dall-e-3');

// With custom endpoint
const customImageAdapter = openaiImage('dall-e-3', {
  apiKey: 'sk-my-key',
  baseURL: 'https://my-proxy.example.com/v1',
});

const result = await generateImage({
  adapter: customImageAdapter,
  prompt: 'A beautiful sunset over the ocean',
  size: '1024x1024',
});
```

### Video Generation

```typescript
import { openaiVideo, generateVideo, checkVideoStatus } from '@seashore/llm';

const videoAdapter = openaiVideo('sora-2', {
  apiKey: 'sk-my-key',
  baseURL: 'https://my-proxy.example.com/v1',
});

const job = await generateVideo({
  adapter: videoAdapter,
  prompt: 'A cat playing piano',
  duration: 5,
});

// Poll for completion
const status = await checkVideoStatus(job.jobId, videoAdapter);
```

### Transcription

```typescript
import { openaiTranscription, generateTranscription } from '@seashore/llm';

const transcriptionAdapter = openaiTranscription('whisper-1', {
  apiKey: 'sk-my-key',
  baseURL: 'https://my-proxy.example.com/v1',
});

const result = await generateTranscription({
  adapter: transcriptionAdapter,
  audio: audioFile,
  language: 'en',
});
```

### Text-to-Speech

```typescript
import { openaiTTS, geminiTTS, generateSpeech } from '@seashore/llm';

const ttsAdapter = openaiTTS('tts-1', {
  apiKey: 'sk-my-key',
  baseURL: 'https://my-proxy.example.com/v1',
});

const speech = await generateSpeech({
  adapter: ttsAdapter,
  text: 'Hello, world!',
  voice: 'alloy',
});
```

## Configuration Options

All multimodal adapters (embedding, image, video, transcription, TTS) support the following optional configuration:

| Option | Type | Description |
|--------|------|-------------|
| `apiKey` | `string` | API key for the provider. Falls back to environment variable if not specified. |
| `baseURL` | `string` | Base URL for the API endpoint. Use for proxies, enterprise deployments, or compatible third-party APIs. |

### Environment Variables

If `apiKey` is not provided, the adapters will read from:

- **OpenAI adapters**: `OPENAI_API_KEY`
- **Gemini adapters**: `GOOGLE_API_KEY`

### Default Base URLs

- **OpenAI**: `https://api.openai.com/v1`
- **Gemini**: `https://generativelanguage.googleapis.com/v1beta`

These can be overridden using the `baseURL` option.

## License

MIT
