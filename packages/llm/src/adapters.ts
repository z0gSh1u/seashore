/**
 * @seashore/llm - Text Adapters
 *
 * Re-exports text generation adapters from @tanstack/ai-*
 */

// Re-export text adapters from @tanstack/ai-* packages
// These are thin wrappers that configure the provider and model
export { openaiText } from '@tanstack/ai-openai';
export { anthropicText } from '@tanstack/ai-anthropic';
export { geminiText } from '@tanstack/ai-gemini';

// Re-export core chat functions
export { chat, toStreamResponse } from '@tanstack/ai';

// Type-safe adapter factory functions for internal use
import type { TextAdapter } from './types.js';

/**
 * Create an OpenAI text adapter
 */
export function createOpenAIAdapter(model: string): TextAdapter {
  return {
    provider: 'openai',
    model,
  };
}

/**
 * Create an Anthropic text adapter
 */
export function createAnthropicAdapter(model: string): TextAdapter {
  return {
    provider: 'anthropic',
    model,
  };
}

/**
 * Create a Gemini text adapter
 */
export function createGeminiAdapter(model: string): TextAdapter {
  return {
    provider: 'gemini',
    model,
  };
}

/**
 * Default model configurations
 */
export const DEFAULT_MODELS = {
  openai: 'gpt-4o',
  anthropic: 'claude-3-5-sonnet-20241022',
  gemini: 'gemini-2.0-flash',
} as const;
