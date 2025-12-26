/**
 * @seashore/workflow - Error Handling
 *
 * Error handling, retry logic, and fallback mechanisms for workflows
 */

import type { WorkflowNode, WorkflowContext } from './types.js';

/**
 * Base workflow error class
 */
export class WorkflowError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'WorkflowError';
  }
}

/**
 * Node execution error
 */
export class NodeExecutionError extends WorkflowError {
  constructor(
    message: string,
    public readonly nodeName: string,
    public readonly cause?: Error,
    details?: Record<string, unknown>
  ) {
    super(message, 'NODE_EXECUTION_ERROR', { nodeName, ...details });
    this.name = 'NodeExecutionError';
  }
}

/**
 * Validation error
 */
export class ValidationError extends WorkflowError {
  constructor(
    message: string,
    public readonly nodeName: string,
    public readonly validationType: 'input' | 'output',
    details?: Record<string, unknown>
  ) {
    super(message, 'VALIDATION_ERROR', { nodeName, validationType, ...details });
    this.name = 'ValidationError';
  }
}

/**
 * Retry options for error handling
 */
export interface RetryOptions {
  /**
   * Maximum number of retry attempts
   */
  maxRetries: number;

  /**
   * Base delay between retries in milliseconds
   */
  baseDelay?: number;

  /**
   * Maximum delay between retries in milliseconds
   */
  maxDelay?: number;

  /**
   * Backoff multiplier for exponential backoff
   */
  backoffMultiplier?: number;

  /**
   * Whether to add jitter to delays
   */
  jitter?: boolean;

  /**
   * Function to determine if an error is retryable
   */
  isRetryable?: (error: Error) => boolean;

  /**
   * Callback for retry events
   */
  onRetry?: (attempt: number, error: Error, delay: number) => void;
}

/**
 * Default retry options
 */
const DEFAULT_RETRY_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 30000,
  backoffMultiplier: 2,
  jitter: true,
  isRetryable: () => true,
  onRetry: () => {},
};

/**
 * Calculate delay with exponential backoff and optional jitter
 */
function calculateDelay(
  attempt: number,
  baseDelay: number,
  maxDelay: number,
  multiplier: number,
  jitter: boolean
): number {
  const delay = Math.min(baseDelay * Math.pow(multiplier, attempt - 1), maxDelay);

  if (jitter) {
    // Add random jitter up to 25% of delay
    const jitterAmount = delay * 0.25 * Math.random();
    return Math.floor(delay + jitterAmount);
  }

  return delay;
}

/**
 * Wrap a node with retry logic
 *
 * @example
 * ```typescript
 * import { withRetry, createNode } from '@seashore/workflow';
 *
 * const unreliableNode = createNode({
 *   name: 'api-call',
 *   execute: async (input) => {
 *     // May fail intermittently
 *     return await fetchData(input);
 *   },
 * });
 *
 * const reliableNode = withRetry(unreliableNode, {
 *   maxRetries: 3,
 *   baseDelay: 1000,
 *   backoffMultiplier: 2,
 * });
 * ```
 */
export function withRetry<TInput = unknown, TOutput = unknown>(
  node: WorkflowNode<TInput, TOutput>,
  options: RetryOptions
): WorkflowNode<TInput, TOutput> {
  const opts = { ...DEFAULT_RETRY_OPTIONS, ...options };

  return {
    ...node,
    name: node.name,

    async execute(input: TInput, ctx: WorkflowContext): Promise<TOutput> {
      let lastError: Error | undefined;
      let attempt = 0;

      while (attempt <= opts.maxRetries) {
        try {
          return await node.execute(input, ctx);
        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error));

          // Check if we've exhausted retries
          if (attempt >= opts.maxRetries) {
            break;
          }

          // Check if error is retryable
          if (!opts.isRetryable(lastError)) {
            break;
          }

          // Check for abort signal
          if (ctx.signal?.aborted) {
            break;
          }

          // Calculate delay
          const delay = calculateDelay(
            attempt + 1,
            opts.baseDelay,
            opts.maxDelay,
            opts.backoffMultiplier,
            opts.jitter
          );

          // Notify retry callback
          opts.onRetry(attempt + 1, lastError, delay);

          // Wait before retry
          await new Promise<void>((resolve, reject) => {
            const timer = setTimeout(resolve, delay);

            if (ctx.signal) {
              ctx.signal.addEventListener(
                'abort',
                () => {
                  clearTimeout(timer);
                  reject(new Error('Retry aborted'));
                },
                { once: true }
              );
            }
          });

          attempt++;
        }
      }

      throw new NodeExecutionError(
        `Node "${node.name}" failed after ${attempt} attempts: ${lastError?.message}`,
        node.name,
        lastError
      );
    },
  };
}

/**
 * Wrap a node with a fallback node
 *
 * @example
 * ```typescript
 * import { withFallback, createNode } from '@seashore/workflow';
 *
 * const primaryNode = createNode({
 *   name: 'primary-api',
 *   execute: async (input) => fetchFromPrimaryApi(input),
 * });
 *
 * const fallbackNode = createNode({
 *   name: 'fallback-api',
 *   execute: async (input) => fetchFromFallbackApi(input),
 * });
 *
 * const resilientNode = withFallback(primaryNode, fallbackNode);
 * ```
 */
export function withFallback<TInput = unknown, TOutput = unknown>(
  primary: WorkflowNode<TInput, TOutput>,
  fallback: WorkflowNode<TInput, TOutput>,
  options: {
    shouldFallback?: (error: Error) => boolean;
    onFallback?: (error: Error) => void;
  } = {}
): WorkflowNode<TInput, TOutput> {
  const { shouldFallback = () => true, onFallback } = options;

  return {
    name: `${primary.name}_with_fallback`,
    type: 'custom',

    async execute(input: TInput, ctx: WorkflowContext): Promise<TOutput> {
      try {
        return await primary.execute(input, ctx);
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));

        if (!shouldFallback(err)) {
          throw error;
        }

        onFallback?.(err);
        return fallback.execute(input, ctx);
      }
    },
  };
}

/**
 * Wrap a node with error transformation
 *
 * @example
 * ```typescript
 * import { withErrorTransform, createNode } from '@seashore/workflow';
 *
 * const node = createNode({
 *   name: 'api-call',
 *   execute: async (input) => fetchData(input),
 * });
 *
 * const transformedNode = withErrorTransform(node, (error) => {
 *   return new CustomApiError(error.message);
 * });
 * ```
 */
export function withErrorTransform<TInput = unknown, TOutput = unknown>(
  node: WorkflowNode<TInput, TOutput>,
  transform: (error: Error, ctx: WorkflowContext) => Error
): WorkflowNode<TInput, TOutput> {
  return {
    ...node,
    name: node.name,

    async execute(input: TInput, ctx: WorkflowContext): Promise<TOutput> {
      try {
        return await node.execute(input, ctx);
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        throw transform(err, ctx);
      }
    },
  };
}

/**
 * Wrap a node with a timeout
 *
 * @example
 * ```typescript
 * import { withTimeout, createNode } from '@seashore/workflow';
 *
 * const slowNode = createNode({
 *   name: 'slow-operation',
 *   execute: async (input) => performSlowOperation(input),
 * });
 *
 * const timedNode = withTimeout(slowNode, 5000);
 * ```
 */
export function withTimeout<TInput = unknown, TOutput = unknown>(
  node: WorkflowNode<TInput, TOutput>,
  timeoutMs: number
): WorkflowNode<TInput, TOutput> {
  return {
    ...node,
    name: node.name,

    async execute(input: TInput, ctx: WorkflowContext): Promise<TOutput> {
      return Promise.race([
        node.execute(input, ctx),
        new Promise<never>((_, reject) =>
          setTimeout(
            () =>
              reject(
                new NodeExecutionError(
                  `Node "${node.name}" timed out after ${timeoutMs}ms`,
                  node.name
                )
              ),
            timeoutMs
          )
        ),
      ]);
    },
  };
}

/**
 * Create a circuit breaker for a node
 *
 * @example
 * ```typescript
 * import { createCircuitBreaker, createNode } from '@seashore/workflow';
 *
 * const apiNode = createNode({
 *   name: 'api-call',
 *   execute: async (input) => fetchData(input),
 * });
 *
 * const protectedNode = createCircuitBreaker(apiNode, {
 *   failureThreshold: 5,
 *   resetTimeout: 30000,
 * });
 * ```
 */
export function createCircuitBreaker<TInput = unknown, TOutput = unknown>(
  node: WorkflowNode<TInput, TOutput>,
  options: {
    failureThreshold: number;
    resetTimeout: number;
    halfOpenMax?: number;
    onStateChange?: (state: 'closed' | 'open' | 'half-open') => void;
  }
): WorkflowNode<TInput, TOutput> {
  const { failureThreshold, resetTimeout, halfOpenMax = 1, onStateChange } = options;

  let state: 'closed' | 'open' | 'half-open' = 'closed';
  let failures = 0;
  let halfOpenAttempts = 0;
  let lastFailureTime = 0;

  function changeState(newState: typeof state) {
    if (state !== newState) {
      state = newState;
      onStateChange?.(newState);
    }
  }

  return {
    ...node,
    name: `${node.name}_circuit_breaker`,

    async execute(input: TInput, ctx: WorkflowContext): Promise<TOutput> {
      // Check if circuit should transition from open to half-open
      if (state === 'open' && Date.now() - lastFailureTime >= resetTimeout) {
        changeState('half-open');
        halfOpenAttempts = 0;
      }

      // If circuit is open, fail fast
      if (state === 'open') {
        throw new NodeExecutionError(
          `Circuit breaker is open for node "${node.name}"`,
          node.name,
          undefined,
          { circuitState: 'open' }
        );
      }

      // If half-open and max attempts reached, fail
      if (state === 'half-open' && halfOpenAttempts >= halfOpenMax) {
        throw new NodeExecutionError(
          `Circuit breaker half-open limit reached for node "${node.name}"`,
          node.name,
          undefined,
          { circuitState: 'half-open' }
        );
      }

      try {
        const result = await node.execute(input, ctx);

        // Success - reset circuit
        if (state === 'half-open') {
          changeState('closed');
        }
        failures = 0;

        return result;
      } catch (error) {
        failures++;
        lastFailureTime = Date.now();

        if (state === 'half-open') {
          halfOpenAttempts++;
          changeState('open');
        } else if (failures >= failureThreshold) {
          changeState('open');
        }

        throw error;
      }
    },
  };
}

/**
 * Catch and handle errors from a node
 */
export function catchError<TInput = unknown, TOutput = unknown>(
  node: WorkflowNode<TInput, TOutput>,
  handler: (error: Error, input: TInput, ctx: WorkflowContext) => TOutput | Promise<TOutput>
): WorkflowNode<TInput, TOutput> {
  return {
    ...node,
    name: node.name,

    async execute(input: TInput, ctx: WorkflowContext): Promise<TOutput> {
      try {
        return await node.execute(input, ctx);
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        return handler(err, input, ctx);
      }
    },
  };
}
