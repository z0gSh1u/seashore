/**
 * Evaluation functions
 * @module @seashore/evaluation
 */

import type { Evaluator, TestCase, EvaluationResult, BatchEvaluationResult } from './types.js';

/**
 * Evaluate options
 */
export interface EvaluateOptions {
  /** Evaluator to use */
  evaluator: Evaluator;
  /** Input prompt/question */
  input: string;
  /** Agent output */
  output: string;
  /** Reference answer */
  reference?: string;
  /** Context documents */
  context?: string[];
}

/**
 * Evaluate a single input/output pair
 * @param options - Evaluation options
 * @returns Evaluation result
 * @example
 * ```typescript
 * const result = await evaluate({
 *   evaluator,
 *   input: 'What is TypeScript?',
 *   output: 'TypeScript is a typed superset of JavaScript...',
 *   reference: 'TypeScript is a programming language...',
 * })
 * ```
 */
export async function evaluate(options: EvaluateOptions): Promise<EvaluationResult> {
  const { evaluator, input, output, reference, context } = options;

  const testCase: TestCase = {
    input,
    output,
    reference,
    context,
  };

  return evaluator.evaluate(testCase);
}

/**
 * Batch evaluation options
 */
export interface EvaluateBatchOptions {
  /** Evaluator to use */
  evaluator: Evaluator;
  /** Test cases to evaluate */
  testCases: TestCase[];
  /** Progress callback */
  onProgress?: (completed: number, total: number) => void;
}

/**
 * Evaluate multiple test cases
 * @param options - Batch evaluation options
 * @returns Batch evaluation result
 * @example
 * ```typescript
 * const results = await evaluateBatch({
 *   evaluator,
 *   testCases: [
 *     { input: 'Q1', output: 'A1' },
 *     { input: 'Q2', output: 'A2' },
 *   ],
 *   onProgress: (done, total) => console.log(`${done}/${total}`),
 * })
 * ```
 */
export async function evaluateBatch(options: EvaluateBatchOptions): Promise<BatchEvaluationResult> {
  const { evaluator, testCases, onProgress } = options;

  return evaluator.evaluateBatch(testCases, { onProgress });
}
