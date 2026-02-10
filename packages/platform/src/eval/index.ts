/**
 * Evaluation system for agent quality measurement
 *
 * Provides custom metrics, LLM-judge metrics, and eval suites
 * for testing agent performance against datasets.
 */

export { createMetric, createLLMJudgeMetric } from './metric.js'
export { createEvalSuite } from './suite.js'
export type {
  EvalMetric,
  DatasetEntry,
  EvalSuiteConfig,
  EvalResults,
  RunnableAgent,
} from './types.js'
export type { MetricConfig, LLMJudgeMetricConfig } from './metric.js'
