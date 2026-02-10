import { createOpenaiChat } from '@tanstack/ai-openai'
import { createAnthropicChat } from '@tanstack/ai-anthropic'
import { createGeminiChat } from '@tanstack/ai-gemini'
import type { LLMAdapterConfig, LLMAdapterFactory } from './types.js'

export function createLLMAdapter(config: LLMAdapterConfig): LLMAdapterFactory {
  switch (config.provider) {
    case 'openai':
      return (model: string) =>
        createOpenaiChat(model as any, config.apiKey, {
          baseURL: config.baseURL,
        })
    case 'anthropic':
      return (model: string) =>
        createAnthropicChat(model as any, config.apiKey, {
          baseURL: config.baseURL,
        })
    case 'gemini':
      return (model: string) =>
        createGeminiChat(model as any, config.apiKey, {
          baseURL: config.baseURL,
        })
    default: {
      const _exhaustive: never = config.provider
      throw new Error(`Unsupported provider: ${String(_exhaustive)}`)
    }
  }
}
