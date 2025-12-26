/**
 * @seashore/llm - Provider Options
 *
 * Provider-specific options handling for different LLM providers
 */

import type { TextAdapter, Message } from './types.js';

/**
 * Base chat options shared across all providers
 */
export interface BaseChatOptions {
  /** Messages to send */
  readonly messages: readonly Message[];

  /** Temperature (0-2) */
  readonly temperature?: number;

  /** Max tokens to generate */
  readonly maxTokens?: number;

  /** Stop sequences */
  readonly stop?: readonly string[];

  /** Top-p (nucleus sampling) */
  readonly topP?: number;

  /** Presence penalty (-2 to 2) */
  readonly presencePenalty?: number;

  /** Frequency penalty (-2 to 2) */
  readonly frequencyPenalty?: number;

  /** User identifier for tracking */
  readonly user?: string;

  /** Abort signal */
  readonly signal?: AbortSignal;

  /** Seed for deterministic outputs (if supported) */
  readonly seed?: number;
}

/**
 * OpenAI-specific options
 */
export interface OpenAIChatOptions extends BaseChatOptions {
  /** Model name */
  readonly model: string;

  /** Response format */
  readonly responseFormat?: 'text' | 'json_object' | 'json_schema';

  /** JSON schema for structured output */
  readonly jsonSchema?: Record<string, unknown>;

  /** Logit bias */
  readonly logitBias?: Record<string, number>;

  /** Number of completions */
  readonly n?: number;

  /** Log probabilities */
  readonly logprobs?: boolean;

  /** Top log probs to return */
  readonly topLogprobs?: number;

  /** Parallel tool calls */
  readonly parallelToolCalls?: boolean;
}

/**
 * Anthropic-specific options
 */
export interface AnthropicChatOptions extends BaseChatOptions {
  /** Model name */
  readonly model: string;

  /** System prompt (separate from messages) */
  readonly system?: string;

  /** Metadata */
  readonly metadata?: {
    readonly userId?: string;
  };
}

/**
 * Gemini-specific options
 */
export interface GeminiChatOptions extends BaseChatOptions {
  /** Model name */
  readonly model: string;

  /** Safety settings */
  readonly safetySettings?: ReadonlyArray<{
    readonly category: string;
    readonly threshold: string;
  }>;

  /** Generation config */
  readonly generationConfig?: {
    readonly candidateCount?: number;
    readonly stopSequences?: readonly string[];
    readonly maxOutputTokens?: number;
    readonly temperature?: number;
    readonly topP?: number;
    readonly topK?: number;
  };
}

/**
 * Provider options union type
 */
export type ProviderChatOptions =
  | ({ provider: 'openai' } & OpenAIChatOptions)
  | ({ provider: 'anthropic' } & AnthropicChatOptions)
  | ({ provider: 'gemini' } & GeminiChatOptions);

/**
 * Normalize provider options to a common format
 */
export function normalizeOptions(
  adapter: TextAdapter,
  options: Partial<BaseChatOptions>
): ProviderChatOptions {
  const base = {
    messages: options.messages ?? [],
    temperature: options.temperature,
    maxTokens: options.maxTokens,
    stop: options.stop,
    topP: options.topP,
    presencePenalty: options.presencePenalty,
    frequencyPenalty: options.frequencyPenalty,
    user: options.user,
    signal: options.signal,
  };

  switch (adapter.provider) {
    case 'openai':
      return {
        provider: 'openai',
        model: adapter.model,
        ...base,
      };

    case 'anthropic':
      return {
        provider: 'anthropic',
        model: adapter.model,
        ...base,
        // Anthropic doesn't support these
        presencePenalty: undefined,
        frequencyPenalty: undefined,
      };

    case 'gemini':
      return {
        provider: 'gemini',
        model: adapter.model,
        ...base,
        generationConfig: {
          temperature: options.temperature,
          maxOutputTokens: options.maxTokens,
          topP: options.topP,
          stopSequences: options.stop as string[] | undefined,
        },
      };
  }
}

/**
 * Get default options for a provider
 */
export function getDefaultOptions(provider: TextAdapter['provider']): Partial<BaseChatOptions> {
  switch (provider) {
    case 'openai':
      return {
        temperature: 0.7,
        maxTokens: 4096,
      };

    case 'anthropic':
      return {
        temperature: 0.7,
        maxTokens: 4096,
      };

    case 'gemini':
      return {
        temperature: 0.7,
        maxTokens: 8192,
      };
  }
}

/**
 * Merge options with defaults
 */
export function mergeWithDefaults(
  adapter: TextAdapter,
  options: Partial<BaseChatOptions>
): BaseChatOptions {
  const defaults = getDefaultOptions(adapter.provider);

  return {
    messages: options.messages ?? [],
    temperature: options.temperature ?? defaults.temperature,
    maxTokens: options.maxTokens ?? defaults.maxTokens,
    stop: options.stop ?? defaults.stop,
    topP: options.topP ?? defaults.topP,
    presencePenalty: options.presencePenalty ?? defaults.presencePenalty,
    frequencyPenalty: options.frequencyPenalty ?? defaults.frequencyPenalty,
    user: options.user ?? defaults.user,
    signal: options.signal ?? defaults.signal,
    seed: options.seed ?? defaults.seed,
  };
}

/**
 * Validate options for a specific provider
 */
export function validateOptions(options: ProviderChatOptions): string[] {
  const errors: string[] = [];

  // Validate temperature
  if (options.temperature !== undefined) {
    if (options.temperature < 0 || options.temperature > 2) {
      errors.push('Temperature must be between 0 and 2');
    }
  }

  // Validate maxTokens
  if (options.maxTokens !== undefined) {
    if (options.maxTokens < 1) {
      errors.push('Max tokens must be at least 1');
    }

    // Provider-specific limits
    if (options.provider === 'openai' && options.maxTokens > 128000) {
      errors.push('Max tokens exceeds OpenAI limit (128000)');
    }
    if (options.provider === 'anthropic' && options.maxTokens > 200000) {
      errors.push('Max tokens exceeds Anthropic limit (200000)');
    }
    if (options.provider === 'gemini' && options.maxTokens > 1000000) {
      errors.push('Max tokens exceeds Gemini limit (1000000)');
    }
  }

  // Validate topP
  if (options.topP !== undefined) {
    if (options.topP < 0 || options.topP > 1) {
      errors.push('Top-p must be between 0 and 1');
    }
  }

  // Provider-specific validations
  if (options.provider === 'openai') {
    if (options.presencePenalty !== undefined) {
      if (options.presencePenalty < -2 || options.presencePenalty > 2) {
        errors.push('Presence penalty must be between -2 and 2');
      }
    }
    if (options.frequencyPenalty !== undefined) {
      if (options.frequencyPenalty < -2 || options.frequencyPenalty > 2) {
        errors.push('Frequency penalty must be between -2 and 2');
      }
    }
  }

  return errors;
}

/**
 * Model capability information
 */
export interface ModelCapabilities {
  readonly supportsVision: boolean;
  readonly supportsTools: boolean;
  readonly supportsStreaming: boolean;
  readonly supportsJsonMode: boolean;
  readonly maxContextTokens: number;
  readonly maxOutputTokens: number;
}

/**
 * Get capabilities for a model
 */
export function getModelCapabilities(adapter: TextAdapter): ModelCapabilities {
  // Default capabilities
  const defaults: ModelCapabilities = {
    supportsVision: false,
    supportsTools: true,
    supportsStreaming: true,
    supportsJsonMode: false,
    maxContextTokens: 4096,
    maxOutputTokens: 4096,
  };

  // OpenAI models
  if (adapter.provider === 'openai') {
    if (adapter.model.includes('gpt-4o')) {
      return {
        supportsVision: true,
        supportsTools: true,
        supportsStreaming: true,
        supportsJsonMode: true,
        maxContextTokens: 128000,
        maxOutputTokens: 16384,
      };
    }
    if (adapter.model.includes('gpt-4-turbo')) {
      return {
        supportsVision: true,
        supportsTools: true,
        supportsStreaming: true,
        supportsJsonMode: true,
        maxContextTokens: 128000,
        maxOutputTokens: 4096,
      };
    }
    if (adapter.model.includes('gpt-3.5-turbo')) {
      return {
        supportsVision: false,
        supportsTools: true,
        supportsStreaming: true,
        supportsJsonMode: true,
        maxContextTokens: 16385,
        maxOutputTokens: 4096,
      };
    }
  }

  // Anthropic models
  if (adapter.provider === 'anthropic') {
    if (adapter.model.includes('claude-3')) {
      return {
        supportsVision: true,
        supportsTools: true,
        supportsStreaming: true,
        supportsJsonMode: false,
        maxContextTokens: 200000,
        maxOutputTokens: 4096,
      };
    }
  }

  // Gemini models
  if (adapter.provider === 'gemini') {
    if (adapter.model.includes('gemini-1.5') || adapter.model.includes('gemini-2')) {
      return {
        supportsVision: true,
        supportsTools: true,
        supportsStreaming: true,
        supportsJsonMode: true,
        maxContextTokens: 1000000,
        maxOutputTokens: 8192,
      };
    }
  }

  return defaults;
}
