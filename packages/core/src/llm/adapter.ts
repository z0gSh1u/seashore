import { createOpenaiChat } from '@tanstack/ai-openai';
import { createAnthropicChat } from '@tanstack/ai-anthropic';
import { createGeminiChat } from '@tanstack/ai-gemini';
import type { LLMProviderConfig, LLMAdapter } from './types';

/**
 * Creates an LLM adapter based on the provided configuration.
 *
 * `LLMAdapter`is a standard interface to interact with a language model provided by a specific provider.
 */
export function createLLMAdapter(model: string, config: LLMProviderConfig): LLMAdapter {
  switch (config.provider) {
    case 'openai':
      return createOpenaiChat(model as any, config.apiKey, {
        baseURL: config.baseURL,
      });
    case 'anthropic':
      return createAnthropicChat(model as any, config.apiKey, {
        baseURL: config.baseURL,
      });
    case 'gemini':
      return createGeminiChat(model as any, config.apiKey, {
        baseURL: config.baseURL,
      });
    default: {
      throw new Error(`Unsupported provider: ${String(config.provider)}`);
    }
  }
}
