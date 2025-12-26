/**
 * Evaluation types
 * @module @seashore/evaluation
 */

/**
 * Text adapter interface for LLM-based evaluation
 */
export interface TextAdapter {
  generate(prompt: string): Promise<string>;
}

/**
 * Metric result
 */
export interface MetricResult {
  /** Score between 0 and 1 */
  score: number;
  /** Whether the metric passed */
  passed: boolean;
  /** Optional reason/explanation */
  reason?: string;
}

/**
 * Metric interface
 */
export interface Metric {
  /** Metric name */
  name: string;
  /** Metric description */
  description: string;
  /** Metric type: LLM-based or rule-based */
  type: 'llm' | 'rule';
  /** Pass threshold */
  threshold: number;
  /** Weight for overall score calculation */
  weight: number;

  /**
   * Evaluate the metric
   */
  evaluate(
    input: string,
    output: string,
    options: {
      reference?: string;
      context?: string[];
      llmAdapter?: TextAdapter;
    }
  ): Promise<MetricResult>;
}

/**
 * Metric configuration
 */
export interface MetricConfig {
  /** Pass threshold (0-1) */
  threshold?: number;
  /** Weight for overall score */
  weight?: number;
}

/**
 * Test case
 */
export interface TestCase {
  /** Unique identifier */
  id?: string;
  /** Input prompt/question */
  input: string;
  /** Agent output (if already generated) */
  output?: string;
  /** Reference answer */
  reference?: string;
  /** Context documents for faithfulness evaluation */
  context?: string[];
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Evaluation result for a single test case
 */
export interface EvaluationResult {
  /** Scores for each metric */
  scores: Record<string, number>;
  /** Overall weighted score */
  overallScore: number;
  /** Whether all metrics passed */
  passed: boolean;
  /** Detailed results for each metric */
  details: Array<{
    metric: string;
    score: number;
    passed: boolean;
    reason?: string;
    threshold: number;
  }>;
  /** Original input */
  input: string;
  /** Agent output */
  output: string;
  /** Reference answer if provided */
  reference?: string;
  /** Evaluation timestamp */
  evaluatedAt: Date;
  /** Evaluation duration in milliseconds */
  durationMs: number;
}

/**
 * Batch evaluation result
 */
export interface BatchEvaluationResult {
  /** Individual results */
  results: EvaluationResult[];
  /** Average scores per metric */
  averageScores: Record<string, number>;
  /** Overall average score */
  overallAverage: number;
  /** Pass rate (0-1) */
  passRate: number;
  /** Number of passed cases */
  passedCount: number;
  /** Number of failed cases */
  failedCount: number;
  /** Total duration in milliseconds */
  durationMs: number;
}

/**
 * Evaluator configuration
 */
export interface EvaluatorConfig {
  /** LLM adapter for LLM-based metrics */
  llmAdapter?: TextAdapter;
  /** Metrics to evaluate */
  metrics: Metric[];
  /** Concurrent evaluation limit */
  concurrency?: number;
  /** Number of retries for failed evaluations */
  retries?: number;
  /** Timeout per evaluation in milliseconds */
  timeout?: number;
}

/**
 * Evaluator interface
 */
export interface Evaluator {
  /** Evaluate a single test case */
  evaluate(testCase: TestCase): Promise<EvaluationResult>;
  /** Evaluate multiple test cases */
  evaluateBatch(
    testCases: TestCase[],
    options?: { onProgress?: (completed: number, total: number) => void }
  ): Promise<BatchEvaluationResult>;
}

/**
 * Dataset interface
 */
export interface Dataset {
  /** Dataset name */
  name: string;
  /** Dataset description */
  description?: string;
  /** Test cases */
  testCases: TestCase[];

  /** Filter test cases */
  filter(predicate: (tc: TestCase) => boolean): Dataset;
  /** Sample random test cases */
  sample(n: number): Dataset;
  /** Split into train/test sets */
  split(ratio: number): [Dataset, Dataset];
  /** Save dataset to file */
  save(path: string): Promise<void>;

  /** Iterator support */
  [Symbol.iterator](): Iterator<TestCase>;
}

/**
 * Dataset configuration
 */
export interface DatasetConfig {
  /** Dataset name */
  name: string;
  /** Dataset description */
  description?: string;
  /** Test cases */
  testCases: TestCase[];
}

/**
 * Report format
 */
export type ReportFormat = 'html' | 'json' | 'markdown';

/**
 * Report configuration
 */
export interface ReportConfig {
  /** Evaluation results */
  results: BatchEvaluationResult;
  /** Output format */
  format: ReportFormat;
  /** Output file path */
  outputPath?: string;
  /** Report options */
  options?: {
    /** Include failed cases detail */
    includeFailedCases?: boolean;
    /** Include score distribution */
    includeScoreDistribution?: boolean;
    /** Include metric breakdown */
    includeMetricBreakdown?: boolean;
  };
}

/**
 * Generated report
 */
export interface EvaluationReport {
  /** Report content */
  content: string;
  /** Output path if saved */
  path?: string;
  /** Report summary */
  summary: {
    totalCases: number;
    passedCases: number;
    failedCases: number;
    passRate: number;
    averageScore: number;
    evaluatedAt: Date;
    durationMs: number;
  };
  /** Metric statistics */
  metricStats: Record<
    string,
    {
      average: number;
      min: number;
      max: number;
      stdDev: number;
      passRate: number;
    }
  >;
}
