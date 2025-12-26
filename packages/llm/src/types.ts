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
 * Token usage statistics
 */
export interface TokenUsage {
  readonly promptTokens: number;
  readonly completionTokens: number;
  readonly totalTokens: number;
}

/**
 * Stream chunk types
 */
export type StreamChunkType =
  | 'content'
  | 'tool-call-start'
  | 'tool-call-delta'
  | 'tool-call-end'
  | 'finish'
  | 'error';

/**
 * Stream chunk emitted during generation
 */
export interface StreamChunk {
  readonly type: StreamChunkType;
  readonly delta?: string;
  readonly toolCall?: Partial<ToolCall>;
  readonly finishReason?: 'stop' | 'tool_calls' | 'length' | 'content_filter';
  readonly usage?: TokenUsage;
  readonly error?: Error;
}

/**
 * Text generation adapter interface
 */
export interface TextAdapter {
  readonly provider: 'openai' | 'anthropic' | 'gemini';
  readonly model: string;
}

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
  readonly adapter: TextAdapter;
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
