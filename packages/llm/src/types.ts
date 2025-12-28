/**
 * @seashore/llm - Types
 *
 * Core type definitions for LLM adapters and operations
 */

/**
 * Message role types
 */
export type MessageRole = 'user' | 'assistant' | 'system' | 'tool';

/**
 * Tool call within a message
 */
export interface ToolCall {
  readonly id: string;
  readonly type: 'function';
  readonly function: {
    readonly name: string;
    readonly arguments: string;
  };
}

/**
 * Chat message structure
 */
export interface Message {
  readonly role: MessageRole;
  readonly content?: string | null;
  readonly toolCalls?: readonly ToolCall[];
  readonly toolCallId?: string;
  readonly name?: string;
}

/**
 * Non-system message role (compatible with @tanstack/ai)
 */
export type ChatMessageRole = 'user' | 'assistant' | 'tool';

/**
 * Chat message (excludes system role, compatible with @tanstack/ai)
 * Note: toolCalls is mutable for @tanstack/ai compatibility
 * Note: content cannot be undefined (only string | null) for @tanstack/ai compatibility
 */
export interface ChatMessage {
  role: ChatMessageRole;
  content: string | null;
  toolCalls?: ToolCall[];
  toolCallId?: string;
  name?: string;
}

/**
 * Type guard to check if a message is a chat message (not system)
 */
export function isChatMessage(message: Message): message is Message & { role: ChatMessageRole } {
  return message.role !== 'system';
}

/**
 * Filter messages to only include chat messages (non-system)
 * Returns mutable copies for @tanstack/ai compatibility
 */
export function filterChatMessages(messages: readonly Message[]): ChatMessage[] {
  return messages.filter(isChatMessage).map((msg) => ({
    role: msg.role as ChatMessageRole,
    content: msg.content ?? null, // Convert undefined to null for @tanstack/ai
    toolCalls: msg.toolCalls ? [...msg.toolCalls] : undefined,
    toolCallId: msg.toolCallId,
    name: msg.name,
  }));
}

/**
 * Token usage statistics
 */
export interface TokenUsage {
  readonly promptTokens: number;
  readonly completionTokens: number;
  readonly totalTokens: number;
}

/**
 * Stream chunk types - aligned with @tanstack/ai
 */
export type StreamChunkType =
  | 'content'
  | 'tool_call'
  | 'tool_result'
  | 'done'
  | 'error'
  | 'approval-requested'
  | 'tool-input-available'
  | 'thinking';

/**
 * Stream chunk error (compatible with @tanstack/ai)
 */
export interface StreamChunkError {
  readonly message: string;
  readonly name?: string;
  readonly code?: string;
}

/**
 * Stream chunk emitted during generation
 */
export interface StreamChunk {
  readonly type: StreamChunkType;
  readonly delta?: string;
  readonly toolCall?: Partial<ToolCall>;
  readonly finishReason?: 'stop' | 'tool_calls' | 'length' | 'content_filter' | null;
  readonly usage?: TokenUsage;
  readonly error?: StreamChunkError;
}

/**
 * Text generation adapter interface
 * Re-exported from @tanstack/ai for type compatibility
 */
import type {
  TextAdapter as TanstackTextAdapter,
  AnyTextAdapter as TanstackAnyTextAdapter,
  Tool as TanstackTool,
} from '@tanstack/ai';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type TextAdapter = TanstackTextAdapter<any, any, any, any>;
export type AnyTextAdapter = TanstackAnyTextAdapter;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Tool = TanstackTool<any, any, any>;

/**
 * Base configuration shared by all providers
 */
interface BaseAdapterConfig {
  /**
   * The model ID to use (e.g., 'gpt-4', 'claude-3-opus')
   */
  readonly model: string;

  /**
   * API Key for the provider.
   * If not provided, the adapter will attempt to load it from environment variables.
   */
  readonly apiKey?: string;
}

/**
 * Configuration for OpenAI provider
 */
export interface OpenAIAdapterConfig extends BaseAdapterConfig {
  readonly provider: 'openai';

  /**
   * Organization ID (optional)
   */
  readonly organization?: string;

  /**
   * Base URL for the API (e.g., for local proxies or compatible endpoints)
   */
  readonly baseURL?: string;
}

/**
 * Configuration for Anthropic provider
 */
export interface AnthropicAdapterConfig extends BaseAdapterConfig {
  readonly provider: 'anthropic';
}

/**
 * Configuration for Gemini provider
 */
export interface GeminiAdapterConfig extends BaseAdapterConfig {
  readonly provider: 'gemini';
}

/**
 * Union of all supported adapter configurations
 */
export type TextAdapterConfig = OpenAIAdapterConfig | AnthropicAdapterConfig | GeminiAdapterConfig;

/**
 * Image generation adapter interface
 */
export interface ImageAdapter {
  readonly provider: 'openai' | 'gemini';
  readonly model: string;
}

/**
 * Video generation adapter interface
 */
export interface VideoAdapter {
  readonly provider: 'openai';
  readonly model: string;
}

/**
 * Transcription adapter interface
 */
export interface TranscriptionAdapter {
  readonly provider: 'openai';
  readonly model: string;
}

/**
 * Text-to-speech adapter interface
 */
export interface TTSAdapter {
  readonly provider: 'openai' | 'gemini';
  readonly model: string;
}

/**
 * Embedding adapter interface
 */
export interface EmbeddingAdapter {
  readonly provider: 'openai' | 'gemini';
  readonly model: string;
  readonly dimensions?: number | undefined;
}

/**
 * Image generation result
 */
export interface ImageGenerationResult {
  readonly id: string;
  readonly model: string;
  readonly images: readonly ImageOutput[];
  readonly usage?: TokenUsage;
}

/**
 * Single image output
 */
export interface ImageOutput {
  readonly url?: string;
  readonly b64Json?: string;
  readonly revisedPrompt?: string;
}

/**
 * Video generation job
 */
export interface VideoGenerationJob {
  readonly jobId: string;
  readonly status: 'pending' | 'processing' | 'completed' | 'failed';
  readonly videoUrl?: string;
  readonly error?: string;
}

/**
 * Transcription result
 */
export interface TranscriptionResult {
  readonly text: string;
  readonly language?: string;
  readonly duration?: number;
  readonly segments?: readonly TranscriptionSegment[];
}

/**
 * Transcription segment
 */
export interface TranscriptionSegment {
  readonly id: number;
  readonly start: number;
  readonly end: number;
  readonly text: string;
}

/**
 * Text-to-speech result
 */
export interface SpeechResult {
  readonly audio: string; // Base64 encoded
  readonly format: 'mp3' | 'opus' | 'aac' | 'flac' | 'wav';
}

/**
 * Embedding result
 */
export interface EmbeddingResult {
  readonly embedding: readonly number[];
  readonly model: string;
  readonly usage?: TokenUsage;
}

/**
 * Batch embedding result
 */
export interface BatchEmbeddingResult {
  readonly embeddings: readonly (readonly number[])[];
  readonly model: string;
  readonly usage?: TokenUsage;
}

/**
 * Chat options
 */
export interface ChatOptions {
  readonly adapter: AnyTextAdapter;
  readonly messages: readonly Message[];
  readonly tools?: readonly unknown[];
  readonly temperature?: number;
  readonly maxTokens?: number;
  readonly stopSequences?: readonly string[];
  readonly signal?: AbortSignal;
}

/**
 * Image generation options
 */
export interface ImageGenerationOptions {
  readonly adapter: ImageAdapter;
  readonly prompt: string;
  readonly size?: '256x256' | '512x512' | '1024x1024' | '1792x1024' | '1024x1792';
  readonly quality?: 'standard' | 'hd';
  readonly style?: 'vivid' | 'natural';
  readonly n?: number;
  readonly modelOptions?: Record<string, unknown>;
}

/**
 * Transcription options
 */
export interface TranscriptionOptions {
  readonly adapter: TranscriptionAdapter;
  readonly audio: File | Blob;
  readonly language?: string;
  readonly prompt?: string;
  readonly modelOptions?: Record<string, unknown>;
}

/**
 * Text-to-speech options
 */
export interface SpeechOptions {
  readonly adapter: TTSAdapter;
  readonly text: string;
  readonly voice?: string;
  readonly speed?: number;
  readonly format?: 'mp3' | 'opus' | 'aac' | 'flac' | 'wav';
}

/**
 * Embedding options
 */
export interface EmbeddingOptions {
  readonly adapter: EmbeddingAdapter;
  readonly input: string | readonly string[];
}
