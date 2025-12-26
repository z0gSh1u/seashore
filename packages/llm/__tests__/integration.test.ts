/**
 * @seashore/llm - Integration Tests
 *
 * Tests for LLM adapters and utilities
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { z } from 'zod';

// Mock the @tanstack/ai modules
vi.mock('@tanstack/ai', () => ({
  chat: vi.fn(),
  generate: vi.fn(),
}));

vi.mock('@tanstack/ai-openai', () => ({
  openaiText: vi.fn((model: string) => ({ provider: 'openai', model })),
  openaiImage: vi.fn((model: string) => ({ provider: 'openai', model })),
}));

vi.mock('@tanstack/ai-anthropic', () => ({
  anthropicText: vi.fn((model: string) => ({ provider: 'anthropic', model })),
}));

vi.mock('@tanstack/ai-gemini', () => ({
  geminiText: vi.fn((model: string) => ({ provider: 'gemini', model })),
}));

import { openaiText, anthropicText, geminiText } from '../src/adapters.js';
import type { TextAdapter, StreamChunk, TokenUsage } from '../src/types.js';
import {
  toReadableStream,
  toSSEStream,
  formatSSE,
  parseSSE,
  collectContent,
  transformStream,
  filterStream,
} from '../src/stream-utils.js';
import {
  withRetry,
  isRetryableError,
  calculateDelay,
  parseRetryAfter,
  RateLimiter,
} from '../src/retry.js';
import {
  normalizeOptions,
  getDefaultOptions,
  mergeWithDefaults,
  validateOptions,
  getModelCapabilities,
} from '../src/options.js';

describe('LLM Adapters', () => {
  it('should create OpenAI adapter', () => {
    const adapter = openaiText('gpt-4o');
    expect(adapter.provider).toBe('openai');
    expect(adapter.model).toBe('gpt-4o');
  });

  it('should create Anthropic adapter', () => {
    const adapter = anthropicText('claude-3-opus-20240229');
    expect(adapter.provider).toBe('anthropic');
    expect(adapter.model).toBe('claude-3-opus-20240229');
  });

  it('should create Gemini adapter', () => {
    const adapter = geminiText('gemini-1.5-pro');
    expect(adapter.provider).toBe('gemini');
    expect(adapter.model).toBe('gemini-1.5-pro');
  });
});

describe('Stream Utilities', () => {
  const createMockChunks = (): StreamChunk[] => [
    { type: 'content', delta: 'Hello' },
    { type: 'content', delta: ' world' },
    { type: 'content', delta: '!' },
    {
      type: 'finish',
      finishReason: 'stop',
      usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
    },
  ];

  async function* asyncFromArray<T>(arr: T[]): AsyncIterable<T> {
    for (const item of arr) {
      yield item;
    }
  }

  describe('formatSSE', () => {
    it('should format chunk as SSE', () => {
      const chunk: StreamChunk = { type: 'content', delta: 'Hello' };
      const sse = formatSSE(chunk);

      expect(sse).toBe('data: {"type":"content","delta":"Hello"}\n\n');
    });
  });

  describe('toSSEStream', () => {
    it('should convert chunks to SSE format', async () => {
      const chunks = createMockChunks();
      const sseStream = toSSEStream(asyncFromArray(chunks));

      const results: string[] = [];
      for await (const sse of sseStream) {
        results.push(sse);
      }

      expect(results).toHaveLength(4);
      expect(results[0]).toContain('data:');
      expect(results[0]).toContain('Hello');
    });
  });

  describe('collectContent', () => {
    it('should collect all content from stream', async () => {
      const chunks = createMockChunks();
      const result = await collectContent(asyncFromArray(chunks));

      expect(result.content).toBe('Hello world!');
      expect(result.usage).toEqual({ promptTokens: 10, completionTokens: 5, totalTokens: 15 });
    });
  });

  describe('transformStream', () => {
    it('should transform chunks', async () => {
      const chunks = createMockChunks();
      const transformed = transformStream(asyncFromArray(chunks), (c) => c.delta ?? '');

      const results: string[] = [];
      for await (const item of transformed) {
        results.push(item);
      }

      expect(results).toEqual(['Hello', ' world', '!', '']);
    });
  });

  describe('filterStream', () => {
    it('should filter chunks by type', async () => {
      const chunks = createMockChunks();
      const filtered = filterStream(asyncFromArray(chunks), ['content']);

      const results: StreamChunk[] = [];
      for await (const chunk of filtered) {
        results.push(chunk);
      }

      expect(results).toHaveLength(3);
      expect(results.every((c) => c.type === 'content')).toBe(true);
    });
  });

  describe('toReadableStream', () => {
    it('should create a ReadableStream', async () => {
      const chunks = createMockChunks();
      const stream = toReadableStream(asyncFromArray(chunks));

      expect(stream).toBeInstanceOf(ReadableStream);

      const reader = stream.getReader();
      const { value, done } = await reader.read();

      expect(done).toBe(false);
      expect(value).toBeInstanceOf(Uint8Array);
    });
  });
});

describe('Retry Logic', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('isRetryableError', () => {
    it('should identify rate limit errors', () => {
      expect(isRetryableError(new Error('Rate limit exceeded'))).toBe(true);
      expect(isRetryableError(new Error('429 Too Many Requests'))).toBe(true);
    });

    it('should identify timeout errors', () => {
      expect(isRetryableError(new Error('Request timeout'))).toBe(true);
      expect(isRetryableError(new Error('ETIMEDOUT'))).toBe(true);
    });

    it('should identify network errors', () => {
      expect(isRetryableError(new Error('Network error'))).toBe(true);
      expect(isRetryableError(new Error('ECONNRESET'))).toBe(true);
    });

    it('should identify server errors', () => {
      expect(isRetryableError(new Error('500 Internal Server Error'))).toBe(true);
      expect(isRetryableError(new Error('503 Service Unavailable'))).toBe(true);
    });

    it('should not retry validation errors', () => {
      expect(isRetryableError(new Error('Invalid input'))).toBe(false);
      expect(isRetryableError(new Error('400 Bad Request'))).toBe(false);
    });
  });

  describe('calculateDelay', () => {
    it('should calculate exponential backoff', () => {
      const config = {
        initialDelay: 1000,
        maxDelay: 60000,
        backoffMultiplier: 2,
        jitter: 0, // Disable jitter for predictable testing
      };

      expect(calculateDelay(1, config)).toBe(1000);
      expect(calculateDelay(2, config)).toBe(2000);
      expect(calculateDelay(3, config)).toBe(4000);
    });

    it('should cap at maxDelay', () => {
      const config = {
        initialDelay: 1000,
        maxDelay: 5000,
        backoffMultiplier: 2,
        jitter: 0,
      };

      expect(calculateDelay(10, config)).toBe(5000);
    });
  });

  describe('parseRetryAfter', () => {
    it('should parse number of seconds', () => {
      expect(parseRetryAfter('30')).toBe(30000);
      expect(parseRetryAfter(60)).toBe(60000);
    });

    it('should return null for invalid values', () => {
      expect(parseRetryAfter(undefined)).toBe(null);
      expect(parseRetryAfter('invalid')).toBe(null);
    });
  });

  describe('withRetry', () => {
    it('should succeed on first attempt', async () => {
      const fn = vi.fn().mockResolvedValue('success');

      const result = await withRetry(fn, { maxRetries: 3 });

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should retry on transient errors', async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error('Rate limit'))
        .mockRejectedValueOnce(new Error('Rate limit'))
        .mockResolvedValue('success');

      const resultPromise = withRetry(fn, { maxRetries: 3, initialDelay: 100 });

      // Fast-forward through delays
      await vi.advanceTimersByTimeAsync(100);
      await vi.advanceTimersByTimeAsync(200);

      const result = await resultPromise;

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('should throw after max retries', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('Rate limit'));

      const resultPromise = withRetry(fn, { maxRetries: 2, initialDelay: 100 });

      await vi.advanceTimersByTimeAsync(100);
      await vi.advanceTimersByTimeAsync(200);

      await expect(resultPromise).rejects.toThrow('Rate limit');
      expect(fn).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });

    it('should not retry non-retryable errors', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('Invalid input'));

      await expect(withRetry(fn, { maxRetries: 3 })).rejects.toThrow('Invalid input');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should call onRetry callback', async () => {
      const onRetry = vi.fn();
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error('Rate limit'))
        .mockResolvedValue('success');

      const resultPromise = withRetry(fn, {
        maxRetries: 3,
        initialDelay: 100,
        onRetry,
      });

      await vi.advanceTimersByTimeAsync(100);
      await resultPromise;

      expect(onRetry).toHaveBeenCalledTimes(1);
      expect(onRetry).toHaveBeenCalledWith(expect.any(Error), 1, expect.any(Number));
    });
  });

  describe('RateLimiter', () => {
    it('should allow requests within limit', async () => {
      const limiter = new RateLimiter({ maxRequests: 10, windowMs: 1000 });

      for (let i = 0; i < 10; i++) {
        await limiter.acquire();
      }

      expect(limiter.currentCount).toBe(10);
    });

    it('should report when limit would be exceeded', () => {
      const limiter = new RateLimiter({ maxRequests: 2, windowMs: 1000 });

      expect(limiter.wouldExceed()).toBe(false);

      // Manually add timestamps to simulate requests
      limiter['timestamps'] = [Date.now(), Date.now()];

      expect(limiter.wouldExceed()).toBe(true);
    });

    it('should reset correctly', () => {
      const limiter = new RateLimiter({ maxRequests: 10, windowMs: 1000 });

      limiter['timestamps'] = [Date.now(), Date.now()];
      expect(limiter.currentCount).toBe(2);

      limiter.reset();
      expect(limiter.currentCount).toBe(0);
    });
  });
});

describe('Provider Options', () => {
  describe('normalizeOptions', () => {
    it('should normalize OpenAI options', () => {
      const adapter: TextAdapter = { provider: 'openai', model: 'gpt-4o' };
      const options = normalizeOptions(adapter, {
        messages: [],
        temperature: 0.8,
      });

      expect(options.provider).toBe('openai');
      expect(options.model).toBe('gpt-4o');
      expect(options.temperature).toBe(0.8);
    });

    it('should normalize Anthropic options', () => {
      const adapter: TextAdapter = { provider: 'anthropic', model: 'claude-3-opus' };
      const options = normalizeOptions(adapter, {
        messages: [],
        presencePenalty: 0.5,
      });

      expect(options.provider).toBe('anthropic');
      // Anthropic doesn't support presencePenalty
      expect(options.presencePenalty).toBeUndefined();
    });

    it('should normalize Gemini options', () => {
      const adapter: TextAdapter = { provider: 'gemini', model: 'gemini-1.5-pro' };
      const options = normalizeOptions(adapter, {
        messages: [],
        temperature: 0.7,
        maxTokens: 1000,
      });

      expect(options.provider).toBe('gemini');
      expect((options as any).generationConfig?.temperature).toBe(0.7);
      expect((options as any).generationConfig?.maxOutputTokens).toBe(1000);
    });
  });

  describe('getDefaultOptions', () => {
    it('should return defaults for each provider', () => {
      const openaiDefaults = getDefaultOptions('openai');
      const anthropicDefaults = getDefaultOptions('anthropic');
      const geminiDefaults = getDefaultOptions('gemini');

      expect(openaiDefaults.temperature).toBe(0.7);
      expect(anthropicDefaults.temperature).toBe(0.7);
      expect(geminiDefaults.temperature).toBe(0.7);
    });
  });

  describe('validateOptions', () => {
    it('should validate temperature range', () => {
      const errors = validateOptions({
        provider: 'openai',
        model: 'gpt-4o',
        messages: [],
        temperature: 3,
      });

      expect(errors).toContain('Temperature must be between 0 and 2');
    });

    it('should validate maxTokens', () => {
      const errors = validateOptions({
        provider: 'openai',
        model: 'gpt-4o',
        messages: [],
        maxTokens: 0,
      });

      expect(errors).toContain('Max tokens must be at least 1');
    });

    it('should pass valid options', () => {
      const errors = validateOptions({
        provider: 'openai',
        model: 'gpt-4o',
        messages: [],
        temperature: 0.7,
        maxTokens: 1000,
      });

      expect(errors).toHaveLength(0);
    });
  });

  describe('getModelCapabilities', () => {
    it('should return GPT-4o capabilities', () => {
      const caps = getModelCapabilities({ provider: 'openai', model: 'gpt-4o' });

      expect(caps.supportsVision).toBe(true);
      expect(caps.supportsTools).toBe(true);
      expect(caps.supportsJsonMode).toBe(true);
      expect(caps.maxContextTokens).toBe(128000);
    });

    it('should return Claude-3 capabilities', () => {
      const caps = getModelCapabilities({ provider: 'anthropic', model: 'claude-3-opus' });

      expect(caps.supportsVision).toBe(true);
      expect(caps.supportsTools).toBe(true);
      expect(caps.maxContextTokens).toBe(200000);
    });

    it('should return Gemini-1.5 capabilities', () => {
      const caps = getModelCapabilities({ provider: 'gemini', model: 'gemini-1.5-pro' });

      expect(caps.supportsVision).toBe(true);
      expect(caps.maxContextTokens).toBe(1000000);
    });

    it('should return defaults for unknown models', () => {
      const caps = getModelCapabilities({ provider: 'openai', model: 'unknown-model' });

      expect(caps.supportsVision).toBe(false);
      expect(caps.maxContextTokens).toBe(4096);
    });
  });
});
