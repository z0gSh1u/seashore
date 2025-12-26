/**
 * @seashore/tool - Validation Middleware
 *
 * Middleware for validating tool inputs before execution
 */

import type { ZodError } from 'zod';
import type { Tool, ToolContext, ToolResult } from './types.js';

/**
 * Validation error with detailed issue information
 */
export class ValidationError extends Error {
  readonly issues: readonly ValidationIssue[];

  constructor(message: string, issues: readonly ValidationIssue[]) {
    super(message);
    this.name = 'ValidationError';
    this.issues = issues;
  }

  /**
   * Create from Zod error
   */
  static fromZodError(error: ZodError): ValidationError {
    const issues: ValidationIssue[] = error.issues.map((issue) => ({
      path: issue.path.map(String),
      message: issue.message,
      code: issue.code,
    }));

    return new ValidationError(
      `Validation failed: ${issues.map((i) => i.message).join(', ')}`,
      issues
    );
  }
}

/**
 * Validation issue details
 */
export interface ValidationIssue {
  /** Path to the invalid field */
  readonly path: readonly string[];

  /** Error message */
  readonly message: string;

  /** Zod error code */
  readonly code: string;
}

/**
 * Validation middleware options
 */
export interface ValidationMiddlewareOptions {
  /** Whether to strip unknown keys from input */
  readonly stripUnknown?: boolean;

  /** Whether to coerce primitive types */
  readonly coerce?: boolean;

  /** Custom error formatter */
  readonly formatError?: (error: ZodError) => string;
}

/**
 * Create a validation middleware for a tool
 *
 * @example
 * ```typescript
 * import { defineTool, withValidation } from '@seashore/tool';
 *
 * const baseTool = defineTool({
 *   name: 'search',
 *   description: 'Search the web',
 *   inputSchema: z.object({ query: z.string().min(1) }),
 *   execute: async ({ query }) => ({ results: [] }),
 * });
 *
 * const validatedTool = withValidation(baseTool, {
 *   stripUnknown: true,
 * });
 * ```
 */
export function withValidation<TInput, TOutput>(
  tool: Tool<TInput, TOutput>,
  options: ValidationMiddlewareOptions = {}
): Tool<TInput, TOutput> {
  const { stripUnknown = true, formatError } = options;

  return {
    ...tool,

    validate(input: unknown): input is TInput {
      try {
        // Attempt stricter validation
        tool.parse(input);
        return true;
      } catch {
        return false;
      }
    },

    async execute(input: TInput, context?: Partial<ToolContext>): Promise<ToolResult<TOutput>> {
      const startTime = Date.now();

      try {
        // Parse and validate input
        const validInput = tool.parse(input);

        // Strip unknown keys if enabled
        const processedInput = stripUnknown ? (validInput as TInput) : input;

        // Execute underlying tool
        return tool.execute(processedInput, context);
      } catch (error) {
        // Handle Zod validation errors specially
        if (isZodError(error)) {
          const message = formatError
            ? formatError(error)
            : ValidationError.fromZodError(error).message;

          return {
            success: false,
            error: message,
            durationMs: Date.now() - startTime,
            metadata: {
              validationIssues: error.issues,
            },
          };
        }

        // Re-throw other errors
        throw error;
      }
    },
  };
}

/**
 * Compose multiple validation functions
 */
export function composeValidators<T>(
  ...validators: Array<(input: T) => T | Promise<T>>
): (input: T) => Promise<T> {
  return async (input: T): Promise<T> => {
    let result = input;
    for (const validator of validators) {
      result = await validator(result);
    }
    return result;
  };
}

/**
 * Create a custom validator function
 */
export function createValidator<T>(
  predicate: (input: T) => boolean | Promise<boolean>,
  errorMessage: string
): (input: T) => Promise<T> {
  return async (input: T): Promise<T> => {
    const isValid = await predicate(input);
    if (!isValid) {
      throw new ValidationError(errorMessage, [
        { path: [], message: errorMessage, code: 'custom' },
      ]);
    }
    return input;
  };
}

/**
 * Sanitize string input
 */
export function sanitizeString(input: string): string {
  return input
    .trim()
    .replace(/[\x00-\x1F\x7F]/g, '') // Remove control characters
    .slice(0, 10000); // Limit length
}

/**
 * Sanitize object input (remove undefined values)
 */
export function sanitizeObject<T extends Record<string, unknown>>(input: T): T {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) {
      result[key] = value;
    }
  }

  return result as T;
}

/**
 * Type guard for Zod errors
 */
function isZodError(error: unknown): error is ZodError {
  return (
    error !== null &&
    typeof error === 'object' &&
    'issues' in error &&
    Array.isArray((error as ZodError).issues)
  );
}
