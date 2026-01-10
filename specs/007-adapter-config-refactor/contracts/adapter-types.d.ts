/**
 * Adapter Configuration Contracts
 *
 * TypeScript interface definitions for the refactored adapter configuration.
 * These represent the target API after implementation.
 */

// =============================================================================
// Base Configuration
// =============================================================================

/**
 * Common configuration options for all adapters
 */
interface BaseAdapterOptions {
  /**
   * API Key for the provider.
   * If not provided, the adapter will attempt to load it from environment variables.
   * Priority: code config > environment variable
   */
  readonly apiKey?: string;

  /**
   * Base URL for the API endpoint.
   * Use this for local proxies, enterprise deployments, or compatible third-party APIs.
   */
  readonly baseURL?: string;
}

// =============================================================================
// Embedding Adapters
// =============================================================================

/**
 * OpenAI Embedding Adapter configuration
 */
export interface OpenAIEmbeddingAdapter {
  readonly provider: 'openai';
  readonly model: string;
  readonly dimensions?: number;
  readonly apiKey?: string;
  readonly baseURL?: string;
}

/**
 * Gemini Embedding Adapter configuration
 */
export interface GeminiEmbeddingAdapter {
  readonly provider: 'gemini';
  readonly model: string;
  readonly dimensions?: number;
  readonly apiKey?: string;
  readonly baseURL?: string;
}

/**
 * Union type for all embedding adapters
 */
export type EmbeddingAdapter = OpenAIEmbeddingAdapter | GeminiEmbeddingAdapter;

/**
 * Factory function signature for OpenAI embedding adapter
 */
export declare function openaiEmbed(
  model?: string,
  dimensions?: number,
  options?: { apiKey?: string; baseURL?: string }
): OpenAIEmbeddingAdapter;

/**
 * Factory function signature for Gemini embedding adapter
 */
export declare function geminiEmbed(
  model?: string,
  dimensions?: number,
  options?: { apiKey?: string; baseURL?: string }
): GeminiEmbeddingAdapter;

// =============================================================================
// Image Adapters
// =============================================================================

/**
 * OpenAI Image Adapter configuration
 */
export interface OpenAIImageAdapter {
  readonly provider: 'openai';
  readonly model: string;
  readonly apiKey?: string;
  readonly baseURL?: string;
}

/**
 * Gemini Image Adapter configuration
 */
export interface GeminiImageAdapter {
  readonly provider: 'gemini';
  readonly model: string;
  readonly apiKey?: string;
  readonly baseURL?: string;
}

/**
 * Union type for all image adapters
 */
export type ImageAdapter = OpenAIImageAdapter | GeminiImageAdapter;

/**
 * Factory function signature for OpenAI image adapter
 */
export declare function openaiImage(
  model?: string,
  options?: { apiKey?: string; baseURL?: string }
): OpenAIImageAdapter;

/**
 * Factory function signature for Gemini image adapter
 */
export declare function geminiImage(
  model?: string,
  options?: { apiKey?: string; baseURL?: string }
): GeminiImageAdapter;

// =============================================================================
// Video Adapter
// =============================================================================

/**
 * OpenAI Video Adapter configuration
 */
export interface VideoAdapter {
  readonly provider: 'openai';
  readonly model: string;
  readonly apiKey?: string;
  readonly baseURL?: string;
}

/**
 * Factory function signature for OpenAI video adapter
 */
export declare function openaiVideo(
  model?: string,
  options?: { apiKey?: string; baseURL?: string }
): VideoAdapter;

// =============================================================================
// Transcription Adapter
// =============================================================================

/**
 * OpenAI Transcription Adapter configuration
 */
export interface TranscriptionAdapter {
  readonly provider: 'openai';
  readonly model: string;
  readonly apiKey?: string;
  readonly baseURL?: string;
}

/**
 * Factory function signature for OpenAI transcription adapter
 */
export declare function openaiTranscription(
  model?: string,
  options?: { apiKey?: string; baseURL?: string }
): TranscriptionAdapter;

// =============================================================================
// TTS Adapters
// =============================================================================

/**
 * OpenAI TTS Adapter configuration
 */
export interface OpenAITTSAdapter {
  readonly provider: 'openai';
  readonly model: string;
  readonly apiKey?: string;
  readonly baseURL?: string;
}

/**
 * Gemini TTS Adapter configuration
 */
export interface GeminiTTSAdapter {
  readonly provider: 'gemini';
  readonly model: string;
  readonly apiKey?: string;
  readonly baseURL?: string;
}

/**
 * Union type for all TTS adapters
 */
export type TTSAdapter = OpenAITTSAdapter | GeminiTTSAdapter;

/**
 * Factory function signature for OpenAI TTS adapter
 */
export declare function openaiTTS(
  model?: string,
  options?: { apiKey?: string; baseURL?: string }
): OpenAITTSAdapter;

/**
 * Factory function signature for Gemini TTS adapter
 */
export declare function geminiTTS(
  model?: string,
  options?: { apiKey?: string; baseURL?: string }
): GeminiTTSAdapter;

// =============================================================================
// Default Values
// =============================================================================

export const OPENAI_DEFAULT_BASE_URL = 'https://api.openai.com/v1';
export const GEMINI_DEFAULT_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';
