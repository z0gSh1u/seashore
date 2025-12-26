/**
 * Security middleware for agent integration
 * @module @seashore/security
 */

import type { Guardrails, SecurityCheckResult, Violation } from './types.js';

/**
 * Input violation handler result
 */
export interface InputViolationResult {
  /** Action to take */
  action: 'reject' | 'continue';
  /** Message to return if rejected */
  message?: string;
}

/**
 * Output violation handler result
 */
export interface OutputViolationResult {
  /** Action to take */
  action: 'reject' | 'transform' | 'continue';
  /** Message to return if rejected */
  message?: string;
}

/**
 * Security middleware configuration
 */
export interface SecurityMiddlewareConfig {
  /** Guardrails instance */
  guardrails: Guardrails;

  /** Handle input violations */
  onInputViolation?: (violations: Violation[]) => InputViolationResult;

  /** Handle output violations */
  onOutputViolation?: (violations: Violation[], output: string) => OutputViolationResult;

  /** Log violations */
  logViolations?: boolean;
}

/**
 * Middleware context
 */
export interface MiddlewareContext {
  input: string;
  output?: string;
}

/**
 * Middleware result
 */
export interface MiddlewareResult {
  /** Whether to continue */
  continue: boolean;
  /** Input to use (possibly transformed) */
  input?: string;
  /** Output to use (possibly transformed) */
  output?: string;
  /** Error message if blocked */
  error?: string;
  /** Violations found */
  violations: Violation[];
}

/**
 * Security middleware type
 */
export type SecurityMiddlewareFn = {
  /** Process input before agent */
  beforeRun: (input: string) => Promise<MiddlewareResult>;
  /** Process output after agent */
  afterRun: (output: string) => Promise<MiddlewareResult>;
};

/**
 * Create security middleware for agent integration
 * @param config - Middleware configuration
 * @returns Middleware object with before/after hooks
 * @example
 * ```typescript
 * const middleware = securityMiddleware({
 *   guardrails,
 *   onInputViolation: (violations) => ({
 *     action: 'reject',
 *     message: 'Invalid input',
 *   }),
 *   onOutputViolation: (violations, output) => ({
 *     action: 'transform',
 *   }),
 *   logViolations: true,
 * })
 *
 * // In agent:
 * const inputResult = await middleware.beforeRun(userInput)
 * if (!inputResult.continue) {
 *   return inputResult.error
 * }
 *
 * const agentOutput = await agent.run(inputResult.input)
 *
 * const outputResult = await middleware.afterRun(agentOutput)
 * return outputResult.output
 * ```
 */
export function securityMiddleware(config: SecurityMiddlewareConfig): SecurityMiddlewareFn {
  const {
    guardrails,
    onInputViolation = () => ({ action: 'reject' as const }),
    onOutputViolation = () => ({ action: 'transform' as const }),
    logViolations = false,
  } = config;

  const logViolation = (type: 'input' | 'output', violations: Violation[]) => {
    if (logViolations && violations.length > 0) {
      console.warn(`[Security] ${type} violations:`, violations);
    }
  };

  return {
    async beforeRun(input: string): Promise<MiddlewareResult> {
      const result = await guardrails.checkInput(input);

      logViolation('input', result.violations);

      if (!result.passed) {
        const handler = onInputViolation(result.violations);

        if (handler.action === 'reject') {
          return {
            continue: false,
            error: handler.message || 'Input blocked by security rules',
            violations: result.violations,
          };
        }
      }

      return {
        continue: true,
        input: result.transformed ? result.output : input,
        violations: result.violations,
      };
    },

    async afterRun(output: string): Promise<MiddlewareResult> {
      const result = await guardrails.checkOutput(output);

      logViolation('output', result.violations);

      if (!result.passed || result.transformed) {
        const handler = onOutputViolation(result.violations, output);

        if (handler.action === 'reject') {
          return {
            continue: false,
            error: handler.message || 'Output blocked by security rules',
            violations: result.violations,
          };
        }

        if (handler.action === 'transform' && result.transformed) {
          return {
            continue: true,
            output: result.output,
            violations: result.violations,
          };
        }
      }

      return {
        continue: true,
        output,
        violations: result.violations,
      };
    },
  };
}
