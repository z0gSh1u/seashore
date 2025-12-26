/**
 * @seashore/llm - Retry Logic
 *
 * Rate limit handling and retry logic for LLM API calls
 */

import type { TextAdapter, Message, StreamChunk } from './types.js';
import { chat } from './adapters.js';

/**
 * Retry configuration
 */
export interface RetryConfig {
  /** Maximum number of retry attempts (default: 3) */
  readonly maxRetries?: number;

  /** Initial delay in milliseconds (default: 1000) */
  readonly initialDelay?: number;

  /** Maximum delay in milliseconds (default: 60000) */
  readonly maxDelay?: number;

  /** Backoff multiplier (default: 2) */
  readonly backoffMultiplier?: number;

  /** Jitter factor 0-1 (default: 0.1) */
  readonly jitter?: number;

  /** Custom retry condition */
  readonly shouldRetry?: (error: Error, attempt: number) => boolean;

  /** Callback when retrying */
  readonly onRetry?: (error: Error, attempt: number, delay: number) => void;
}

/**
 * Default retry configuration
 */
const DEFAULT_RETRY_CONFIG: Required<Omit<RetryConfig, 'shouldRetry' | 'onRetry'>> = {
  maxRetries: 3,
  initialDelay: 1000,
  maxDelay: 60000,
  backoffMultiplier: 2,
  jitter: 0.1,
};

/**
 * Errors that should trigger a retry
 */
const RETRYABLE_ERROR_CODES = [
  'RATE_LIMIT_EXCEEDED',
  'TIMEOUT',
  'NETWORK_ERROR',
  'SERVICE_UNAVAILABLE',
  'INTERNAL_ERROR',
  'ECONNRESET',
  'ETIMEDOUT',
  'ENOTFOUND',
];

const RETRYABLE_STATUS_CODES = [429, 500, 502, 503, 504];

/**
 * Check if an error is retryable
 */
export function isRetryableError(error: Error): boolean {
  const errorMessage = error.message.toLowerCase();
  const errorName = error.name.toLowerCase();

  // Check error codes
  for (const code of RETRYABLE_ERROR_CODES) {
    if (errorMessage.includes(code.toLowerCase()) || errorName.includes(code.toLowerCase())) {
      return true;
    }
  }

  // Check for rate limit
  if (errorMessage.includes('rate limit') || errorMessage.includes('too many requests')) {
    return true;
  }

  // Check for status codes in error message
  for (const status of RETRYABLE_STATUS_CODES) {
    if (errorMessage.includes(status.toString())) {
      return true;
    }
  }

  // Check for network errors
  if (
    errorMessage.includes('network') ||
    errorMessage.includes('timeout') ||
    errorMessage.includes('connection')
  ) {
    return true;
  }

  return false;
}

/**
 * Calculate delay with exponential backoff and jitter
 */
export function calculateDelay(
  attempt: number,
  config: Required<Omit<RetryConfig, 'shouldRetry' | 'onRetry'>>
): number {
  // Exponential backoff
  let delay = config.initialDelay * Math.pow(config.backoffMultiplier, attempt - 1);

  // Apply max delay cap
  delay = Math.min(delay, config.maxDelay);

  // Add jitter
  const jitterRange = delay * config.jitter;
  const jitterOffset = (Math.random() - 0.5) * 2 * jitterRange;
  delay += jitterOffset;

  return Math.max(0, Math.round(delay));
}

/**
 * Parse retry-after header value
 */
export function parseRetryAfter(value: string | number | undefined): number | null {
  if (value === undefined) return null;

  if (typeof value === 'number') {
    return value * 1000; // Convert seconds to ms
  }

  // Try parsing as number (seconds)
  const seconds = parseInt(value, 10);
  if (!isNaN(seconds)) {
    return seconds * 1000;
  }

  // Try parsing as HTTP date
  const date = Date.parse(value);
  if (!isNaN(date)) {
    return Math.max(0, date - Date.now());
  }

  return null;
}

/**
 * Sleep for a given duration
 */
function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);

    if (signal) {
      const abortHandler = () => {
        clearTimeout(timer);
        reject(new Error('Aborted'));
      };

      if (signal.aborted) {
        abortHandler();
      } else {
        signal.addEventListener('abort', abortHandler, { once: true });
      }
    }
  });
}

/**
 * Wrap a function with retry logic
 *
 * @example
 * ```typescript
 * import { withRetry } from '@seashore/llm';
 *
 * const result = await withRetry(
 *   () => fetchData(),
 *   { maxRetries: 5, initialDelay: 1000 }
 * );
 * ```
 */
export async function withRetry<T>(fn: () => Promise<T>, config: RetryConfig = {}): Promise<T> {
  const fullConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
  const { maxRetries, shouldRetry, onRetry } = fullConfig;

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Check if we should retry
      const canRetry =
        attempt <= maxRetries &&
        (shouldRetry ? shouldRetry(lastError, attempt) : isRetryableError(lastError));

      if (!canRetry) {
        throw lastError;
      }

      // Calculate delay
      const delay = calculateDelay(attempt, fullConfig);

      // Notify callback
      if (onRetry) {
        onRetry(lastError, attempt, delay);
      }

      // Wait before retrying
      await sleep(delay);
    }
  }

  throw lastError ?? new Error('Retry failed with unknown error');
}

/**
 * Chat options with retry
 */
export interface ChatWithRetryOptions {
  /** LLM adapter */
  readonly adapter: TextAdapter;

  /** Messages to send */
  readonly messages: readonly Message[];

  /** Tools for function calling */
  readonly tools?: readonly unknown[];

  /** Temperature */
  readonly temperature?: number;

  /** Abort signal */
  readonly signal?: AbortSignal;

  /** Retry configuration */
  readonly retry?: RetryConfig;
}

/**
 * Chat with automatic retry on rate limits and transient errors
 *
 * @example
 * ```typescript
 * import { chatWithRetry, openaiText } from '@seashore/llm';
 *
 * const stream = chatWithRetry({
 *   adapter: openaiText('gpt-4o'),
 *   messages: [{ role: 'user', content: 'Hello' }],
 *   retry: {
 *     maxRetries: 5,
 *     onRetry: (error, attempt, delay) => {
 *       console.log(`Retry ${attempt} after ${delay}ms: ${error.message}`);
 *     },
 *   },
 * });
 *
 * for await (const chunk of stream) {
 *   // Process chunks
 * }
 * ```
 */
export async function* chatWithRetry(options: ChatWithRetryOptions): AsyncIterable<StreamChunk> {
  const { adapter, messages, tools, temperature, signal, retry } = options;

  const fullConfig = { ...DEFAULT_RETRY_CONFIG, ...retry };
  const { maxRetries, shouldRetry, onRetry } = fullConfig;

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      // Yield all chunks from the stream
      for await (const chunk of chat({
        adapter,
        messages,
        tools,
        temperature,
        signal,
      })) {
        yield chunk;
      }

      // Successful completion
      return;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Check if we should retry
      const canRetry =
        attempt <= maxRetries &&
        (shouldRetry ? shouldRetry(lastError, attempt) : isRetryableError(lastError));

      if (!canRetry) {
        throw lastError;
      }

      // Calculate delay
      const delay = calculateDelay(attempt, fullConfig);

      // Notify callback
      if (onRetry) {
        onRetry(lastError, attempt, delay);
      }

      // Wait before retrying
      await sleep(delay, signal);
    }
  }

  throw lastError ?? new Error('Chat retry failed with unknown error');
}

/**
 * Rate limiter for controlling request rate
 */
export class RateLimiter {
  private readonly maxRequests: number;
  private readonly windowMs: number;
  private timestamps: number[] = [];

  constructor(options: { maxRequests: number; windowMs: number }) {
    this.maxRequests = options.maxRequests;
    this.windowMs = options.windowMs;
  }

  /**
   * Wait until we can make a request
   */
  async acquire(signal?: AbortSignal): Promise<void> {
    while (true) {
      const now = Date.now();

      // Remove old timestamps
      this.timestamps = this.timestamps.filter((t) => now - t < this.windowMs);

      if (this.timestamps.length < this.maxRequests) {
        this.timestamps.push(now);
        return;
      }

      // Calculate wait time
      const oldestTimestamp = this.timestamps[0]!;
      const waitTime = this.windowMs - (now - oldestTimestamp) + 1;

      await sleep(waitTime, signal);
    }
  }

  /**
   * Current number of requests in window
   */
  get currentCount(): number {
    const now = Date.now();
    return this.timestamps.filter((t) => now - t < this.windowMs).length;
  }

  /**
   * Check if rate limit would be exceeded
   */
  wouldExceed(): boolean {
    const now = Date.now();
    const validCount = this.timestamps.filter((t) => now - t < this.windowMs).length;
    return validCount >= this.maxRequests;
  }

  /**
   * Reset the rate limiter
   */
  reset(): void {
    this.timestamps = [];
  }
}
