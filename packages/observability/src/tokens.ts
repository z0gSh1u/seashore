/**
 * Token counter implementation
 * @module @seashore/observability
 */

import type { TokenCounter, TokenCounterConfig, TokenUsage } from './types.js';

/**
 * Token pricing per 1K tokens (in USD)
 * Based on approximate pricing as of late 2024
 */
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'gpt-4o': { input: 0.0025, output: 0.01 },
  'gpt-4o-mini': { input: 0.00015, output: 0.0006 },
  'gpt-4-turbo': { input: 0.01, output: 0.03 },
  'gpt-4': { input: 0.03, output: 0.06 },
  'gpt-3.5-turbo': { input: 0.0005, output: 0.0015 },
  'claude-3-opus': { input: 0.015, output: 0.075 },
  'claude-3-sonnet': { input: 0.003, output: 0.015 },
  'claude-3-haiku': { input: 0.00025, output: 0.00125 },
  'gemini-1.5-pro': { input: 0.00125, output: 0.005 },
  'gemini-1.5-flash': { input: 0.000075, output: 0.0003 },
};

/**
 * Simple token estimation based on character count
 * More accurate estimation would require a proper tokenizer
 */
function estimateTokens(text: string): number {
  // Average of ~4 characters per token for English
  // This is a rough estimate, actual count depends on the tokenizer
  const charCount = text.length;

  // Count word boundaries
  const words = text.split(/\s+/).filter(Boolean).length;

  // Estimate: use the higher of word count or char/4
  return Math.max(words, Math.ceil(charCount / 4));
}

/**
 * Estimate tokens for chat messages with message overhead
 */
function estimateMessageTokens(messages: { role: string; content: string }[]): number {
  let total = 0;

  for (const message of messages) {
    // Each message has ~4 tokens overhead for role/formatting
    total += 4;
    total += estimateTokens(message.content);
  }

  // Add ~2 tokens for the overall message structure
  total += 2;

  return total;
}

/**
 * Token counter implementation
 */
class TokenCounterImpl implements TokenCounter {
  private config: TokenCounterConfig;

  constructor(config: TokenCounterConfig = {}) {
    this.config = config;
  }

  count(text: string, options?: { model?: string }): number {
    return estimateTokens(text);
  }

  countMessages(
    messages: { role: string; content: string }[],
    options?: { model?: string }
  ): number {
    return estimateMessageTokens(messages);
  }

  countBatch(texts: string[], options?: { model?: string }): number[] {
    return texts.map((text) => estimateTokens(text));
  }

  countTotal(texts: string[], options?: { model?: string }): number {
    return texts.reduce((total, text) => total + estimateTokens(text), 0);
  }

  estimateCost(usage: TokenUsage & { model: string }): number {
    const pricing = MODEL_PRICING[usage.model];

    if (!pricing) {
      // Use GPT-4o pricing as default
      const defaultPricing = MODEL_PRICING['gpt-4o'];
      return (
        (usage.promptTokens / 1000) * defaultPricing.input +
        (usage.completionTokens / 1000) * defaultPricing.output
      );
    }

    return (
      (usage.promptTokens / 1000) * pricing.input + (usage.completionTokens / 1000) * pricing.output
    );
  }
}

/**
 * Create a token counter
 * @param config - Token counter configuration
 * @returns Token counter instance
 * @example
 * ```typescript
 * const counter = createTokenCounter()
 *
 * const count = counter.count('Hello, world!')
 * console.log('Tokens:', count)
 *
 * const cost = counter.estimateCost({
 *   promptTokens: 1000,
 *   completionTokens: 500,
 *   totalTokens: 1500,
 *   model: 'gpt-4o',
 * })
 * console.log('Estimated cost: $', cost.toFixed(4))
 * ```
 */
export function createTokenCounter(config?: TokenCounterConfig): TokenCounter {
  return new TokenCounterImpl(config);
}

export type { TokenCounter, TokenCounterConfig };
