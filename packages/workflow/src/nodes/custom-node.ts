/**
 * @seashore/workflow - Custom Node
 *
 * Node type for custom logic
 */

import type { ZodSchema } from 'zod';
import type { WorkflowNode, CustomNodeConfig, WorkflowContext } from '../types.js';

/**
 * Create a custom node with arbitrary logic
 */
export function createNode<TInput = unknown, TOutput = unknown>(
  config: CustomNodeConfig<TInput, TOutput>
): WorkflowNode<TInput, TOutput> {
  const { name, execute, inputSchema, outputSchema } = config;

  return {
    name,
    type: 'custom',
    inputSchema,
    outputSchema,

    async execute(input: TInput, ctx: WorkflowContext): Promise<TOutput> {
      // Validate input if schema provided
      if (inputSchema) {
        const parseResult = inputSchema.safeParse(input);
        if (!parseResult.success) {
          throw new Error(`Node "${name}" input validation failed: ${parseResult.error.message}`);
        }
        input = parseResult.data as TInput;
      }

      // Execute the custom logic
      const output = await execute(input, ctx);

      // Validate output if schema provided
      if (outputSchema) {
        const parseResult = outputSchema.safeParse(output);
        if (!parseResult.success) {
          throw new Error(`Node "${name}" output validation failed: ${parseResult.error.message}`);
        }
        return parseResult.data as TOutput;
      }

      return output;
    },
  };
}

/**
 * Create a passthrough node that just forwards input to output
 */
export function createPassthroughNode(name: string): WorkflowNode<unknown, unknown> {
  return createNode({
    name,
    execute: async (input) => input,
  });
}

/**
 * Create a transform node that applies a synchronous transformation
 */
export function createTransformNode<TInput = unknown, TOutput = unknown>(config: {
  name: string;
  transform: (input: TInput, ctx: WorkflowContext) => TOutput;
  inputSchema?: ZodSchema;
  outputSchema?: ZodSchema;
}): WorkflowNode<TInput, TOutput> {
  const { name, transform, inputSchema, outputSchema } = config;

  return createNode({
    name,
    inputSchema,
    outputSchema,
    execute: async (input, ctx) => transform(input, ctx),
  });
}

/**
 * Create a delay node that waits for a specified duration
 */
export function createDelayNode(config: {
  name: string;
  delay: number | ((ctx: WorkflowContext) => number);
}): WorkflowNode<unknown, { delayed: boolean; durationMs: number }> {
  const { name, delay } = config;

  return createNode({
    name,
    execute: async (_input, ctx) => {
      const delayMs = typeof delay === 'function' ? delay(ctx) : delay;
      const startTime = Date.now();

      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(resolve, delayMs);

        if (ctx.signal) {
          const abortHandler = () => {
            clearTimeout(timer);
            reject(new Error('Delay aborted'));
          };

          if (ctx.signal.aborted) {
            abortHandler();
          } else {
            ctx.signal.addEventListener('abort', abortHandler, { once: true });
          }
        }
      });

      return {
        delayed: true,
        durationMs: Date.now() - startTime,
      };
    },
  });
}

/**
 * Create a logging node for debugging
 */
export function createLogNode(config: {
  name: string;
  message: string | ((ctx: WorkflowContext) => string);
  level?: 'debug' | 'info' | 'warn' | 'error';
}): WorkflowNode<unknown, { logged: true }> {
  const { name, message, level = 'info' } = config;

  return createNode({
    name,
    execute: async (_input, ctx) => {
      const msg = typeof message === 'function' ? message(ctx) : message;

      switch (level) {
        case 'debug':
          console.debug(`[${name}]`, msg);
          break;
        case 'info':
          console.info(`[${name}]`, msg);
          break;
        case 'warn':
          console.warn(`[${name}]`, msg);
          break;
        case 'error':
          console.error(`[${name}]`, msg);
          break;
      }

      return { logged: true };
    },
  });
}

/**
 * Create a validation node that checks data against a schema
 */
export function createValidationNode<T>(config: {
  name: string;
  schema: ZodSchema<T>;
  onInvalid?: 'throw' | 'return-error';
}): WorkflowNode<unknown, { valid: boolean; data?: T; error?: string }> {
  const { name, schema, onInvalid = 'throw' } = config;

  return createNode({
    name,
    execute: async (input) => {
      const result = schema.safeParse(input);

      if (result.success) {
        return {
          valid: true,
          data: result.data,
        };
      }

      if (onInvalid === 'throw') {
        throw new Error(`Validation failed: ${result.error.message}`);
      }

      return {
        valid: false,
        error: result.error.message,
      };
    },
  });
}
