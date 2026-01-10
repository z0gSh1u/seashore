/**
 * @seashore/llm
 *
 * LLM adapters and multimodal support for Seashore Agent Framework
 */

// Types
export type {
  Message,
  MessageRole,
  ChatMessage,
  ChatMessageRole,
  ToolCall,
  TokenUsage,
  StreamChunk,
  StreamChunkType,
  TextAdapter,
  AnyTextAdapter,
  TextAdapterConfig,
  OpenAIAdapterConfig,
  AnthropicAdapterConfig,
  GeminiAdapterConfig,
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
} from './types';

// Constants
export { OPENAI_DEFAULT_BASE_URL, GEMINI_DEFAULT_BASE_URL } from './types';

// Utility functions
export { isChatMessage, filterChatMessages } from './types';

// Text adapters (re-exports from @tanstack/ai-*)
export {
  openaiText,
  anthropicText,
  geminiText,
  chat,
  toStreamResponse,
  createTextAdapter,
  createOpenAIAdapter,
  createAnthropicAdapter,
  createGeminiAdapter,
  DEFAULT_MODELS,
} from './adapters';

// Embedding adapters
export {
  openaiEmbed,
  geminiEmbed,
  generateEmbedding,
  generateBatchEmbeddings,
  type EmbeddingAdapterOptions,
} from './embedding';

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
  // Types
  type MultimodalAdapterOptions,
} from './multimodal';

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
} from './stream-utils';

// Structured output
export {
  generateStructured,
  streamStructured,
  StructuredOutputError,
  type StructuredOutputOptions,
  type StructuredResult,
} from './structured';

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
} from './options';

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
} from './retry';
