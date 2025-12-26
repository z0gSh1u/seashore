/**
 * @seashore/evaluation
 * Agent evaluation and metrics package
 * @module @seashore/evaluation
 */

// Types
export type {
  Metric,
  MetricConfig,
  MetricResult,
  TestCase,
  EvaluationResult,
  BatchEvaluationResult,
  Evaluator,
  EvaluatorConfig,
  Dataset,
  DatasetConfig,
  ReportFormat,
  ReportConfig,
  EvaluationReport,
  TextAdapter,
} from './types.js';

// Evaluator
export { createEvaluator } from './evaluator.js';

// Evaluate functions
export {
  evaluate,
  evaluateBatch,
  type EvaluateOptions,
  type EvaluateBatchOptions,
} from './evaluate.js';

// Metrics
export {
  relevanceMetric,
  faithfulnessMetric,
  coherenceMetric,
  harmfulnessMetric,
  customMetric,
  type RelevanceMetricConfig,
  type FaithfulnessMetricConfig,
  type CoherenceMetricConfig,
  type HarmfulnessMetricConfig,
  type CustomLLMMetricConfig,
  type CustomRuleMetricConfig,
} from './metrics.js';

// Dataset
export { createDataset, loadDataset } from './dataset.js';

// Report
export { generateReport } from './report.js';
