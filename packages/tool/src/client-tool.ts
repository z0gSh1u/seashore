/**
 * @seashore/tool - Client-Side Tool Support
 *
 * Tools that execute in the client (browser) rather than server-side
 */

import type { z, ZodSchema } from 'zod';
import { zodToJsonSchema } from './zod-to-json-schema.js';
import type { Tool, ToolConfig, ToolContext, ToolResult, JsonSchema } from './types.js';

/**
 * Client-side tool configuration
 */
export interface ClientToolConfig<TInput extends ZodSchema, TOutput> {
  /** Tool name (unique identifier) */
  readonly name: string;

  /** Tool description (LLM uses this to decide when to call) */
  readonly description: string;

  /** Input parameter schema (Zod) */
  readonly inputSchema: TInput;

  /**
   * Handler type for client execution
   * This is sent to the client for local execution
   */
  readonly handlerType: 'ui-action' | 'form-input' | 'confirmation' | 'file-upload' | 'custom';

  /**
   * UI component name to render (for genui integration)
   */
  readonly component?: string;

  /**
   * Default values for the form
   */
  readonly defaults?: Partial<z.infer<TInput>>;

  /**
   * Timeout for client response (default: 5 minutes)
   */
  readonly timeout?: number;
}

/**
 * Client tool instance
 */
export interface ClientTool<TInput, TOutput> extends Tool<TInput, TOutput> {
  /** Whether this tool runs on the client */
  readonly isClientSide: true;

  /** Handler type for client execution */
  readonly handlerType: string;

  /** UI component name */
  readonly component?: string;

  /** Default values */
  readonly defaults?: Partial<TInput>;

  /** Create a pending result to wait for client response */
  readonly createPending: (toolCallId: string) => ClientToolPending<TOutput>;
}

/**
 * Pending client tool result
 */
export interface ClientToolPending<TOutput> {
  readonly id: string;
  readonly status: 'pending';

  /** Resolve with client result */
  readonly resolve: (result: TOutput) => void;

  /** Reject with error */
  readonly reject: (error: Error) => void;

  /** Promise that resolves when client responds */
  readonly promise: Promise<ToolResult<TOutput>>;
}

/**
 * Define a client-side tool
 *
 * Client-side tools are special tools that must be executed in the browser.
 * They are used for UI interactions like:
 * - Confirmation dialogs
 * - Form inputs
 * - File uploads
 * - Custom UI actions
 *
 * @example
 * ```typescript
 * import { defineClientTool } from '@seashore/tool';
 *
 * const confirmTool = defineClientTool({
 *   name: 'confirm_action',
 *   description: 'Ask user to confirm an action',
 *   inputSchema: z.object({
 *     message: z.string(),
 *     confirmText: z.string().optional(),
 *     cancelText: z.string().optional(),
 *   }),
 *   handlerType: 'confirmation',
 *   component: 'ConfirmDialog',
 * });
 * ```
 */
export function defineClientTool<TInput extends ZodSchema, TOutput = boolean>(
  config: ClientToolConfig<TInput, TOutput>
): ClientTool<z.infer<TInput>, TOutput> {
  const {
    name,
    description,
    inputSchema,
    handlerType,
    component,
    defaults,
    timeout = 5 * 60 * 1000, // 5 minutes default
  } = config;

  // Convert Zod schema to JSON Schema for LLM
  const jsonSchema = zodToJsonSchema(inputSchema) as JsonSchema;

  // Store pending tool calls
  const pendingCalls = new Map<
    string,
    {
      resolve: (result: ToolResult<TOutput>) => void;
      reject: (error: Error) => void;
      timeout: ReturnType<typeof setTimeout>;
    }
  >();

  return {
    name,
    description,
    jsonSchema,
    needsApproval: true, // Client tools always need user interaction
    isClientSide: true,
    handlerType,
    component,
    defaults: defaults as Partial<z.infer<TInput>>,

    validate(input: unknown): input is z.infer<TInput> {
      const result = inputSchema.safeParse(input);
      return result.success;
    },

    parse(input: unknown): z.infer<TInput> {
      return inputSchema.parse(input) as z.infer<TInput>;
    },

    async execute(
      input: z.infer<TInput>,
      context?: Partial<ToolContext>
    ): Promise<ToolResult<TOutput>> {
      // Client tools cannot be executed server-side directly
      // They return a "pending" result that must be resolved by the client
      return {
        success: false,
        error: 'Client-side tool must be executed in the browser. Use createPending() instead.',
        durationMs: 0,
        metadata: {
          isClientSide: true,
          handlerType,
          component,
          input,
        },
      };
    },

    createPending(toolCallId: string): ClientToolPending<TOutput> {
      let resolvePromise: (result: ToolResult<TOutput>) => void;
      let rejectPromise: (error: Error) => void;

      const promise = new Promise<ToolResult<TOutput>>((resolve, reject) => {
        resolvePromise = resolve;
        rejectPromise = reject;
      });

      const timeoutHandle = setTimeout(() => {
        const pending = pendingCalls.get(toolCallId);
        if (pending) {
          pendingCalls.delete(toolCallId);
          pending.reject(new Error(`Client tool timed out after ${timeout}ms`));
        }
      }, timeout);

      const pendingCall = {
        resolve: resolvePromise!,
        reject: rejectPromise!,
        timeout: timeoutHandle,
      };

      pendingCalls.set(toolCallId, pendingCall);

      return {
        id: toolCallId,
        status: 'pending',

        resolve(result: TOutput) {
          const pending = pendingCalls.get(toolCallId);
          if (pending) {
            clearTimeout(pending.timeout);
            pendingCalls.delete(toolCallId);
            pending.resolve({
              success: true,
              data: result,
              durationMs: 0,
            });
          }
        },

        reject(error: Error) {
          const pending = pendingCalls.get(toolCallId);
          if (pending) {
            clearTimeout(pending.timeout);
            pendingCalls.delete(toolCallId);
            pending.reject(error);
          }
        },

        promise,
      };
    },
  };
}

/**
 * Type guard to check if a tool is client-side
 */
export function isClientTool<TInput, TOutput>(
  tool: Tool<TInput, TOutput>
): tool is ClientTool<TInput, TOutput> {
  return 'isClientSide' in tool && (tool as ClientTool<TInput, TOutput>).isClientSide === true;
}

/**
 * Predefined client tool for confirmation dialogs
 */
export const confirmationToolSchema = {
  message: 'z.string()',
  title: 'z.string().optional()',
  confirmText: 'z.string().optional()',
  cancelText: 'z.string().optional()',
  variant: 'z.enum(["info", "warning", "danger"]).optional()',
} as const;

/**
 * Predefined client tool for form inputs
 */
export const formInputToolSchema = {
  title: 'z.string()',
  fields:
    'z.array(z.object({ name: z.string(), label: z.string(), type: z.string(), required: z.boolean().optional() }))',
  submitText: 'z.string().optional()',
} as const;
