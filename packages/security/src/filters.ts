/**
 * Input and output filters
 * @module @seashore/security
 */

import type {
  InputFilter,
  OutputFilter,
  SecurityRule,
  SecurityCheckResult,
  Violation,
  TextAdapter,
} from './types.js';

/**
 * Filter configuration
 */
export interface FilterConfig {
  /** Security rules to apply */
  rules: SecurityRule[];
  /** LLM adapter for LLM-based rules */
  llmAdapter?: TextAdapter;
}

/**
 * Apply filters to content
 */
async function filterContent(
  content: string,
  rules: SecurityRule[],
  llmAdapter?: TextAdapter
): Promise<SecurityCheckResult> {
  if (rules.length === 0) {
    return { passed: true, violations: [] };
  }

  let currentContent = content;
  const allViolations: Violation[] = [];
  let transformed = false;
  let passed = true;

  for (const rule of rules) {
    const result = await rule.check(currentContent, { llmAdapter });

    allViolations.push(...result.violations);

    if (!result.passed) {
      passed = false;
    }

    if (result.transformed && result.output !== undefined) {
      currentContent = result.output;
      transformed = true;
    }
  }

  return {
    passed,
    output: transformed ? currentContent : content,
    transformed,
    violations: allViolations,
  };
}

/**
 * Create input filter
 * @param config - Filter configuration
 * @returns Input filter instance
 * @example
 * ```typescript
 * const inputFilter = createInputFilter({
 *   rules: [promptInjectionRule(), piiDetectionRule({ action: 'redact' })],
 * })
 *
 * const result = await inputFilter.filter(userInput)
 * if (!result.passed) {
 *   throw new Error('Invalid input')
 * }
 * ```
 */
export function createInputFilter(config: FilterConfig): InputFilter {
  const { rules, llmAdapter } = config;

  // Filter only input rules
  const inputRules = rules.filter((r) => r.type === 'input' || r.type === 'both');

  return {
    async filter(content: string): Promise<SecurityCheckResult> {
      return filterContent(content, inputRules, llmAdapter);
    },

    async filterBatch(contents: string[]): Promise<SecurityCheckResult[]> {
      return Promise.all(contents.map((c) => filterContent(c, inputRules, llmAdapter)));
    },
  };
}

/**
 * Create output filter
 * @param config - Filter configuration
 * @returns Output filter instance
 * @example
 * ```typescript
 * const outputFilter = createOutputFilter({
 *   rules: [toxicityRule(), piiDetectionRule({ action: 'redact' })],
 * })
 *
 * const result = await outputFilter.filter(agentOutput)
 * const safeOutput = result.output
 * ```
 */
export function createOutputFilter(config: FilterConfig): OutputFilter {
  const { rules, llmAdapter } = config;

  // Filter only output rules
  const outputRules = rules.filter((r) => r.type === 'output' || r.type === 'both');

  return {
    async filter(content: string): Promise<SecurityCheckResult> {
      return filterContent(content, outputRules, llmAdapter);
    },

    async filterBatch(contents: string[]): Promise<SecurityCheckResult[]> {
      return Promise.all(contents.map((c) => filterContent(c, outputRules, llmAdapter)));
    },
  };
}
