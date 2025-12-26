/**
 * Observability middleware
 * @module @seashore/observability
 */

import type { Tracer, TokenCounter, Logger, SpanType } from './types.js';

/**
 * Observability context
 */
export interface ObservabilityContext {
  tracer: Tracer;
  tokenCounter?: TokenCounter;
  logger?: Logger;
}

/**
 * Create observability middleware for functions
 * Wraps functions with automatic tracing, logging, and token counting
 * @param context - Observability context with tracer, counter, and logger
 * @returns Middleware function
 * @example
 * ```typescript
 * const tracer = createTracer({ serviceName: 'my-service' })
 * const logger = createLogger({ name: 'my-service' })
 *
 * const observe = observabilityMiddleware({ tracer, logger })
 *
 * const tracedFn = observe(
 *   async (input: string) => {
 *     // your function logic
 *     return result
 *   },
 *   { name: 'processInput', type: 'custom' }
 * )
 * ```
 */
export function observabilityMiddleware(context: ObservabilityContext) {
  const { tracer, tokenCounter, logger } = context;

  return function observe<T extends unknown[], R>(
    fn: (...args: T) => Promise<R>,
    options: { name: string; type?: SpanType }
  ): (...args: T) => Promise<R> {
    const { name, type = 'custom' } = options;

    return async (...args: T): Promise<R> => {
      return tracer.withSpan(
        name,
        async (span) => {
          // Set span type
          span.setAttributes({ 'operation.type': type });

          // Log start
          logger?.debug(`Starting ${name}`, { type, args: args.length });

          try {
            const result = await fn(...args);

            // If result contains token usage, record it
            if (result && typeof result === 'object' && 'usage' in result) {
              const usage = (
                result as { usage?: { promptTokens?: number; completionTokens?: number } }
              ).usage;
              if (usage) {
                span.setAttributes({
                  'llm.prompt_tokens': usage.promptTokens ?? 0,
                  'llm.completion_tokens': usage.completionTokens ?? 0,
                  'llm.total_tokens': (usage.promptTokens ?? 0) + (usage.completionTokens ?? 0),
                });
              }
            }

            logger?.debug(`Completed ${name}`);
            return result;
          } catch (error) {
            logger?.error(`Failed ${name}`, { error: (error as Error).message });
            throw error;
          }
        },
        { type }
      );
    };
  };
}

/**
 * Create agent observability wrapper
 * Specifically designed for wrapping agent run functions
 */
export function createAgentObserver(context: ObservabilityContext) {
  const { tracer, tokenCounter, logger } = context;

  return {
    /**
     * Wrap an agent run function
     */
    wrapRun<T extends { input: string | { messages: unknown[] } }, R>(
      runFn: (input: T) => Promise<R>,
      agentName: string
    ): (input: T) => Promise<R> {
      return async (input: T): Promise<R> => {
        return tracer.withSpan(
          `agent.${agentName}.run`,
          async (span) => {
            span.setAttributes({
              'agent.name': agentName,
              'agent.input_type': typeof input.input === 'string' ? 'text' : 'messages',
            });

            // Count input tokens
            if (tokenCounter) {
              const inputText =
                typeof input.input === 'string' ? input.input : JSON.stringify(input.input);
              span.setAttributes({
                'agent.input_tokens': tokenCounter.count(inputText),
              });
            }

            logger?.info(`Agent ${agentName} starting`);

            const startTime = Date.now();
            const result = await runFn(input);
            const duration = Date.now() - startTime;

            span.setAttributes({
              'agent.duration_ms': duration,
            });

            logger?.info(`Agent ${agentName} completed`, { duration });

            return result;
          },
          { type: 'agent' }
        );
      };
    },

    /**
     * Wrap a tool execution function
     */
    wrapTool<T, R>(
      executeFn: (input: T) => Promise<R>,
      toolName: string
    ): (input: T) => Promise<R> {
      return async (input: T): Promise<R> => {
        return tracer.withSpan(
          `tool.${toolName}`,
          async (span) => {
            span.setAttributes({
              'tool.name': toolName,
            });

            logger?.debug(`Tool ${toolName} executing`);

            const result = await executeFn(input);

            logger?.debug(`Tool ${toolName} completed`);

            return result;
          },
          { type: 'tool' }
        );
      };
    },

    /**
     * Wrap an LLM call function
     */
    wrapLLMCall<T, R>(
      callFn: (input: T) => Promise<R>,
      modelName: string
    ): (input: T) => Promise<R> {
      return async (input: T): Promise<R> => {
        return tracer.withSpan(
          `llm.${modelName}`,
          async (span) => {
            span.setAttributes({
              'llm.model': modelName,
            });

            logger?.debug(`LLM ${modelName} calling`);

            const result = await callFn(input);

            // Try to extract usage from result
            if (result && typeof result === 'object') {
              const r = result as Record<string, unknown>;
              if ('usage' in r && typeof r.usage === 'object' && r.usage) {
                const usage = r.usage as {
                  promptTokens?: number;
                  completionTokens?: number;
                  totalTokens?: number;
                };
                span.setAttributes({
                  'llm.prompt_tokens': usage.promptTokens ?? 0,
                  'llm.completion_tokens': usage.completionTokens ?? 0,
                  'llm.total_tokens': usage.totalTokens ?? 0,
                });
              }
            }

            logger?.debug(`LLM ${modelName} completed`);

            return result;
          },
          { type: 'llm' }
        );
      };
    },
  };
}
