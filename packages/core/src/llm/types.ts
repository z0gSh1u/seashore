import type { AnthropicTextAdapter } from '@tanstack/ai-anthropic';
import type { GeminiTextAdapter } from '@tanstack/ai-gemini';
import type { OpenAITextAdapter } from '@tanstack/ai-openai';

export type LLMProvider = 'openai' | 'anthropic' | 'gemini';

export interface LLMProviderConfig {
  provider: LLMProvider;
  apiKey: string;
  baseURL?: string;
}

export type LLMAdapter =
  | OpenAITextAdapter<any>
  | AnthropicTextAdapter<any>
  | GeminiTextAdapter<any>;
