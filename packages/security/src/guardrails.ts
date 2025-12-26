/**
 * Guardrails implementation
 * @module @seashore/security
 */

import type {
  Guardrails,
  GuardrailsConfig,
  SecurityRule,
  SecurityCheckResult,
  Violation,
  TextAdapter,
} from './types.js';

/**
 * Merge security check results
 */
function mergeResults(results: SecurityCheckResult[]): SecurityCheckResult {
  const violations: Violation[] = [];
  let output: string | undefined;
  let transformed = false;
  let passed = true;

  for (const result of results) {
    violations.push(...result.violations);

    if (!result.passed) {
      passed = false;
    }

    if (result.transformed && result.output !== undefined) {
      // Use the last transformed output
      output = result.output;
      transformed = true;
    }
  }

  return {
    passed,
    output,
    transformed,
    violations,
  };
}

/**
 * Check content against rules
 */
async function checkContent(
  content: string,
  rules: SecurityRule[],
  llmAdapter?: TextAdapter
): Promise<SecurityCheckResult> {
  if (rules.length === 0) {
    return { passed: true, violations: [] };
  }

  let currentContent = content;
  const results: SecurityCheckResult[] = [];

  for (const rule of rules) {
    const result = await rule.check(currentContent, {
      llmAdapter,
    });

    results.push(result);

    // If content was transformed, use transformed version for next rule
    if (result.transformed && result.output !== undefined) {
      currentContent = result.output;
    }
  }

  const merged = mergeResults(results);

  // Ensure output reflects all transformations
  if (merged.transformed) {
    merged.output = currentContent;
  }

  return merged;
}

/**
 * Create guardrails instance
 * @param config - Guardrails configuration
 * @returns Guardrails instance
 * @example
 * ```typescript
 * const guardrails = createGuardrails({
 *   llmAdapter: openaiText('gpt-4o-mini'),
 *   inputRules: [promptInjectionRule(), piiDetectionRule()],
 *   outputRules: [toxicityRule(), piiDetectionRule({ action: 'redact' })],
 * })
 * ```
 */
export function createGuardrails(config: GuardrailsConfig): Guardrails {
  const { llmAdapter, inputRules, outputRules } = config;

  return {
    async checkInput(content: string): Promise<SecurityCheckResult> {
      return checkContent(content, inputRules, llmAdapter);
    },

    async checkOutput(content: string): Promise<SecurityCheckResult> {
      return checkContent(content, outputRules, llmAdapter);
    },

    async checkInputBatch(contents: string[]): Promise<SecurityCheckResult[]> {
      return Promise.all(contents.map((c) => checkContent(c, inputRules, llmAdapter)));
    },

    async checkOutputBatch(contents: string[]): Promise<SecurityCheckResult[]> {
      return Promise.all(contents.map((c) => checkContent(c, outputRules, llmAdapter)));
    },
  };
}
