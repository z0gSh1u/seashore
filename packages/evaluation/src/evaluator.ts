/**
 * Evaluator creation
 * @module @seashore/evaluation
 */

import type {
  Evaluator,
  EvaluatorConfig,
  TestCase,
  EvaluationResult,
  BatchEvaluationResult,
  Metric,
  TextAdapter,
} from './types.js';

/**
 * Retry helper
 */
async function withRetry<T>(fn: () => Promise<T>, retries: number, timeout?: number): Promise<T> {
  let lastError: Error | undefined;

  for (let i = 0; i <= retries; i++) {
    try {
      if (timeout) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        try {
          return await fn();
        } finally {
          clearTimeout(timeoutId);
        }
      } else {
        return await fn();
      }
    } catch (error) {
      lastError = error as Error;
      if (i < retries) {
        // Exponential backoff
        await new Promise((resolve) => setTimeout(resolve, Math.pow(2, i) * 100));
      }
    }
  }

  throw lastError;
}

/**
 * Parallel execution with concurrency limit
 */
async function parallelLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
  onProgress?: (completed: number, total: number) => void
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let currentIndex = 0;
  let completed = 0;

  const executeNext = async (): Promise<void> => {
    while (currentIndex < items.length) {
      const index = currentIndex++;
      const item = items[index];

      results[index] = await fn(item, index);
      completed++;
      onProgress?.(completed, items.length);
    }
  };

  const workers = Array.from({ length: Math.min(limit, items.length) }, () => executeNext());

  await Promise.all(workers);
  return results;
}

/**
 * Create evaluator
 * @param config - Evaluator configuration
 * @returns Evaluator instance
 * @example
 * ```typescript
 * const evaluator = createEvaluator({
 *   llmAdapter: openaiText('gpt-4o'),
 *   metrics: [relevanceMetric(), coherenceMetric()],
 * })
 * ```
 */
export function createEvaluator(config: EvaluatorConfig): Evaluator {
  const { llmAdapter, metrics, concurrency = 5, retries = 2, timeout } = config;

  if (metrics.length === 0) {
    throw new Error('At least one metric is required');
  }

  const evaluateSingleMetric = async (
    metric: Metric,
    testCase: TestCase,
    adapter?: TextAdapter
  ) => {
    return metric.evaluate(testCase.input, testCase.output!, {
      reference: testCase.reference,
      context: testCase.context,
      llmAdapter: adapter,
    });
  };

  const evaluateTestCase = async (testCase: TestCase): Promise<EvaluationResult> => {
    if (!testCase.output) {
      throw new Error('Test case must have an output to evaluate');
    }

    const startTime = Date.now();
    const scores: Record<string, number> = {};
    const details: EvaluationResult['details'] = [];

    let totalWeight = 0;
    let weightedSum = 0;

    for (const metric of metrics) {
      const result = await withRetry(
        () => evaluateSingleMetric(metric, testCase, llmAdapter),
        retries,
        timeout
      );

      scores[metric.name] = result.score;
      details.push({
        metric: metric.name,
        score: result.score,
        passed: result.passed,
        reason: result.reason,
        threshold: metric.threshold,
      });

      totalWeight += metric.weight;
      weightedSum += result.score * metric.weight;
    }

    const overallScore = totalWeight > 0 ? weightedSum / totalWeight : 0;
    const passed = details.every((d) => d.passed);

    return {
      scores,
      overallScore,
      passed,
      details,
      input: testCase.input,
      output: testCase.output,
      reference: testCase.reference,
      evaluatedAt: new Date(),
      durationMs: Date.now() - startTime,
    };
  };

  return {
    async evaluate(testCase: TestCase): Promise<EvaluationResult> {
      return evaluateTestCase(testCase);
    },

    async evaluateBatch(
      testCases: TestCase[],
      options?: { onProgress?: (completed: number, total: number) => void }
    ): Promise<BatchEvaluationResult> {
      const startTime = Date.now();

      const results = await parallelLimit(
        testCases,
        concurrency,
        (tc) => evaluateTestCase(tc),
        options?.onProgress
      );

      // Calculate aggregate statistics
      const averageScores: Record<string, number> = {};
      const metricSums: Record<string, number> = {};
      const metricCounts: Record<string, number> = {};

      for (const result of results) {
        for (const [metric, score] of Object.entries(result.scores)) {
          metricSums[metric] = (metricSums[metric] || 0) + score;
          metricCounts[metric] = (metricCounts[metric] || 0) + 1;
        }
      }

      for (const metric of Object.keys(metricSums)) {
        averageScores[metric] = metricSums[metric] / metricCounts[metric];
      }

      const overallAverage = results.reduce((sum, r) => sum + r.overallScore, 0) / results.length;

      const passedCount = results.filter((r) => r.passed).length;
      const failedCount = results.length - passedCount;
      const passRate = passedCount / results.length;

      return {
        results,
        averageScores,
        overallAverage,
        passRate,
        passedCount,
        failedCount,
        durationMs: Date.now() - startTime,
      };
    },
  };
}
