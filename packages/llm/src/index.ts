/**
 * @seashore/llm
 *
 * LLM adapters and multimodal support for Seashore Agent Framework
 */

// Types
export type {
  Message,
  MessageRole,
  ToolCall,
  TokenUsage,
  StreamChunk,
  StreamChunkType,
  TextAdapter,
  ImageAdapter,
  VideoAdapter,
  TranscriptionAdapter,
  TTSAdapter,
  EmbeddingAdapter,
  ImageGenerationResult,
  ImageOutput,
  VideoGenerationJob,
  TranscriptionResult,
  TranscriptionSegment,
  SpeechResult,
  EmbeddingResult,
  BatchEmbeddingResult,
  ChatOptions,
  ImageGenerationOptions,
  TranscriptionOptions,
  SpeechOptions,
  EmbeddingOptions,
} from './types.js';

// Text adapters (re-exports from @tanstack/ai-*)
export {
  openaiText,
  anthropicText,
  geminiText,
  chat,
  toStreamResponse,
  createOpenAIAdapter,
  createAnthropicAdapter,
  createGeminiAdapter,
  DEFAULT_MODELS,
} from './adapters.js';

// Embedding adapters
export {
  openaiEmbed,
  geminiEmbed,
  generateEmbedding,
  generateBatchEmbeddings,
} from './embedding.js';

// Multimodal adapters
export {
  // Image
  openaiImage,
  geminiImage,
  generateImage,
  // Video
  openaiVideo,
  generateVideo,
  checkVideoStatus,
  // Transcription
  openaiTranscription,
  generateTranscription,
  // TTS
  openaiTTS,
  geminiTTS,
  generateSpeech,
} from './multimodal.js';

// Stream utilities
export {
  toReadableStream,
  toSSEStream,
  formatSSE,
  parseSSE,
  collectContent,
  transformStream,
  filterStream,
  tapStream,
  bufferStream,
  teeStream,
  mergeStreams,
} from './stream-utils.js';

// Structured output
export {
  generateStructured,
  streamStructured,
  StructuredOutputError,
  type StructuredOutputOptions,
  type StructuredResult,
} from './structured.js';

// Provider options
export {
  normalizeOptions,
  getDefaultOptions,
  mergeWithDefaults,
  validateOptions,
  getModelCapabilities,
  type BaseChatOptions,
  type OpenAIChatOptions,
  type AnthropicChatOptions,
  type GeminiChatOptions,
  type ProviderChatOptions,
  type ModelCapabilities,
} from './options.js';

// Retry and rate limiting
export {
  withRetry,
  chatWithRetry,
  isRetryableError,
  calculateDelay,
  parseRetryAfter,
  RateLimiter,
  type RetryConfig,
  type ChatWithRetryOptions,
} from './retry.js';
