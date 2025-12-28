/**
 * @seashore/llm - Text Adapters
 *
 * Re-exports text generation adapters from @tanstack/ai-*
 */

import { openaiText } from '@tanstack/ai-openai';
import { anthropicText } from '@tanstack/ai-anthropic';
import { geminiText } from '@tanstack/ai-gemini';

// Re-export text adapters from @tanstack/ai-* packages
// These are thin wrappers that configure the provider and model
export { openaiText, anthropicText, geminiText };

// Re-export core chat functions
export { chat, toStreamResponse } from '@tanstack/ai';

// Type-safe adapter factory functions for internal use
import type { TextAdapter, TextAdapterConfig } from './types';

/**
 * Create a text adapter from configuration
 */
export function createTextAdapter(config: TextAdapterConfig): TextAdapter {
  switch (config.provider) {
    case 'openai':
      return openaiText(
        {
          apiKey: config.apiKey,
          organization: config.organization,
          baseURL: config.baseURL,
        },
        config.model
      );
    case 'anthropic':
      return anthropicText(
        {
          apiKey: config.apiKey,
        },
        config.model
      );
    case 'gemini':
      return geminiText(
        {
          apiKey: config.apiKey,
        },
        config.model
      );
  }
}

/**
 * Create an OpenAI text adapter config
 */
export function createOpenAIAdapter(
  model: string,
  options?: { apiKey?: string; organization?: string; baseURL?: string }
): TextAdapterConfig {
  return {
    provider: 'openai',
    model,
    ...options,
  };
}

/**
 * Create an Anthropic text adapter config
 */
export function createAnthropicAdapter(
  model: string,
  options?: { apiKey?: string }
): TextAdapterConfig {
  return {
    provider: 'anthropic',
    model,
    ...options,
  };
}

/**
 * Create a Gemini text adapter config
 */
export function createGeminiAdapter(
  model: string,
  options?: { apiKey?: string }
): TextAdapterConfig {
  return {
    provider: 'gemini',
    model,
    ...options,
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
