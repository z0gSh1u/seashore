/**
 * Evaluation package tests
 */

import { describe, it, expect, vi } from 'vitest';
import {
  createEvaluator,
  evaluate,
  evaluateBatch,
  relevanceMetric,
  coherenceMetric,
  harmfulnessMetric,
  customMetric,
  createDataset,
  generateReport,
  type TextAdapter,
} from '../src/index.js';

// Mock LLM adapter
function mockAdapter(response: string): TextAdapter {
  return {
    generate: vi.fn().mockResolvedValue(response),
  };
}

describe('@seashore/evaluation', () => {
  describe('createEvaluator', () => {
    it('should create an evaluator with metrics', () => {
      const evaluator = createEvaluator({
        llmAdapter: mockAdapter('{"score": 0.8, "reason": "good"}'),
        metrics: [relevanceMetric()],
      });

      expect(evaluator).toBeDefined();
      expect(evaluator.evaluate).toBeInstanceOf(Function);
      expect(evaluator.evaluateBatch).toBeInstanceOf(Function);
    });

    it('should throw error if no metrics provided', () => {
      expect(() => {
        createEvaluator({
          metrics: [],
        });
      }).toThrow('At least one metric is required');
    });
  });

  describe('evaluate', () => {
    it('should evaluate a single test case', async () => {
      const adapter = mockAdapter('{"score": 0.85, "reason": "relevant response"}');
      const evaluator = createEvaluator({
        llmAdapter: adapter,
        metrics: [relevanceMetric({ threshold: 0.7 })],
      });

      const result = await evaluate({
        evaluator,
        input: 'What is TypeScript?',
        output: 'TypeScript is a typed superset of JavaScript.',
      });

      expect(result.passed).toBe(true);
      expect(result.scores.relevance).toBeCloseTo(0.85);
      expect(result.overallScore).toBeCloseTo(0.85);
      expect(result.details).toHaveLength(1);
    });

    it('should fail when score below threshold', async () => {
      const adapter = mockAdapter('{"score": 0.3, "reason": "not relevant"}');
      const evaluator = createEvaluator({
        llmAdapter: adapter,
        metrics: [relevanceMetric({ threshold: 0.7 })],
      });

      const result = await evaluate({
        evaluator,
        input: 'What is TypeScript?',
        output: 'The weather is nice today.',
      });

      expect(result.passed).toBe(false);
      expect(result.scores.relevance).toBeCloseTo(0.3);
    });
  });

  describe('evaluateBatch', () => {
    it('should evaluate multiple test cases', async () => {
      const adapter = mockAdapter('{"score": 0.8, "reason": "good"}');
      const evaluator = createEvaluator({
        llmAdapter: adapter,
        metrics: [relevanceMetric({ threshold: 0.7 })],
      });

      const results = await evaluateBatch({
        evaluator,
        testCases: [
          { input: 'Q1', output: 'A1' },
          { input: 'Q2', output: 'A2' },
          { input: 'Q3', output: 'A3' },
        ],
      });

      expect(results.results).toHaveLength(3);
      expect(results.passedCount).toBe(3);
      expect(results.passRate).toBe(1);
      expect(results.averageScores.relevance).toBeCloseTo(0.8);
    });

    it('should call progress callback', async () => {
      const adapter = mockAdapter('{"score": 0.8}');
      const evaluator = createEvaluator({
        llmAdapter: adapter,
        metrics: [relevanceMetric()],
        concurrency: 1,
      });

      const progress: Array<[number, number]> = [];

      await evaluateBatch({
        evaluator,
        testCases: [
          { input: 'Q1', output: 'A1' },
          { input: 'Q2', output: 'A2' },
        ],
        onProgress: (done, total) => progress.push([done, total]),
      });

      expect(progress).toEqual([
        [1, 2],
        [2, 2],
      ]);
    });
  });

  describe('metrics', () => {
    describe('relevanceMetric', () => {
      it('should evaluate relevance', async () => {
        const adapter = mockAdapter('{"score": 0.9, "reason": "highly relevant"}');
        const metric = relevanceMetric({ threshold: 0.7 });

        const result = await metric.evaluate(
          'What is React?',
          'React is a JavaScript library for building UIs.',
          { llmAdapter: adapter }
        );

        expect(result.score).toBeCloseTo(0.9);
        expect(result.passed).toBe(true);
      });
    });

    describe('coherenceMetric', () => {
      it('should evaluate coherence', async () => {
        const adapter = mockAdapter('{"score": 0.85, "reason": "well structured"}');
        const metric = coherenceMetric({ threshold: 0.7 });

        const result = await metric.evaluate('input', 'A well-written, coherent response.', {
          llmAdapter: adapter,
        });

        expect(result.score).toBeCloseTo(0.85);
        expect(result.passed).toBe(true);
      });
    });

    describe('harmfulnessMetric', () => {
      it('should pass for non-harmful content', async () => {
        const adapter = mockAdapter('{"score": 0.05, "reason": "no harmful content"}');
        const metric = harmfulnessMetric({ threshold: 0.1 });

        const result = await metric.evaluate('input', 'A friendly, helpful response.', {
          llmAdapter: adapter,
        });

        expect(result.score).toBeCloseTo(0.05);
        expect(result.passed).toBe(true); // Low harmfulness = pass
      });

      it('should fail for harmful content', async () => {
        const adapter = mockAdapter('{"score": 0.8, "reason": "contains harmful content"}');
        const metric = harmfulnessMetric({ threshold: 0.1 });

        const result = await metric.evaluate('input', 'Harmful response.', { llmAdapter: adapter });

        expect(result.score).toBeCloseTo(0.8);
        expect(result.passed).toBe(false); // High harmfulness = fail
      });
    });

    describe('customMetric', () => {
      it('should create rule-based custom metric', async () => {
        const lengthMetric = customMetric({
          name: 'length',
          description: 'Check response length',
          type: 'rule',
          threshold: 1.0,
          evaluate: (_input, output) => {
            const words = output.split(/\s+/).length;
            return {
              score: words >= 5 ? 1.0 : 0.0,
              reason: `Word count: ${words}`,
            };
          },
        });

        const result1 = await lengthMetric.evaluate('input', 'This is a long enough response.', {});
        expect(result1.passed).toBe(true);

        const result2 = await lengthMetric.evaluate('input', 'Short.', {});
        expect(result2.passed).toBe(false);
      });

      it('should create LLM-based custom metric', async () => {
        const adapter = mockAdapter('{"score": 0.9, "reason": "accurate"}');
        const accuracyMetric = customMetric({
          name: 'accuracy',
          description: 'Check technical accuracy',
          type: 'llm',
          threshold: 0.8,
          prompt: 'Evaluate accuracy: {input} {output}',
        });

        const result = await accuracyMetric.evaluate('input', 'output', { llmAdapter: adapter });

        expect(result.score).toBeCloseTo(0.9);
        expect(result.passed).toBe(true);
      });
    });
  });

  describe('createDataset', () => {
    it('should create a dataset', () => {
      const dataset = createDataset({
        name: 'test-dataset',
        testCases: [
          { input: 'Q1', reference: 'A1' },
          { input: 'Q2', reference: 'A2' },
        ],
      });

      expect(dataset.name).toBe('test-dataset');
      expect(dataset.testCases).toHaveLength(2);
    });

    it('should filter test cases', () => {
      const dataset = createDataset({
        name: 'test',
        testCases: [
          { input: 'Q1', metadata: { difficulty: 'easy' } },
          { input: 'Q2', metadata: { difficulty: 'hard' } },
          { input: 'Q3', metadata: { difficulty: 'easy' } },
        ],
      });

      const filtered = dataset.filter((tc) => tc.metadata?.difficulty === 'easy');
      expect(filtered.testCases).toHaveLength(2);
    });

    it('should sample test cases', () => {
      const dataset = createDataset({
        name: 'test',
        testCases: Array.from({ length: 10 }, (_, i) => ({ input: `Q${i}` })),
      });

      const sample = dataset.sample(3);
      expect(sample.testCases).toHaveLength(3);
    });

    it('should split dataset', () => {
      const dataset = createDataset({
        name: 'test',
        testCases: Array.from({ length: 10 }, (_, i) => ({ input: `Q${i}` })),
      });

      const [train, test] = dataset.split(0.8);
      expect(train.testCases.length).toBe(8);
      expect(test.testCases.length).toBe(2);
    });

    it('should support iteration', () => {
      const dataset = createDataset({
        name: 'test',
        testCases: [{ input: 'Q1' }, { input: 'Q2' }],
      });

      const inputs: string[] = [];
      for (const tc of dataset) {
        inputs.push(tc.input);
      }

      expect(inputs).toEqual(['Q1', 'Q2']);
    });
  });

  describe('generateReport', () => {
    const mockResults = {
      results: [
        {
          input: 'Q1',
          output: 'A1',
          scores: { relevance: 0.8 },
          overallScore: 0.8,
          passed: true,
          details: [{ metric: 'relevance', score: 0.8, passed: true, threshold: 0.7 }],
          evaluatedAt: new Date(),
          durationMs: 100,
        },
        {
          input: 'Q2',
          output: 'A2',
          scores: { relevance: 0.5 },
          overallScore: 0.5,
          passed: false,
          details: [{ metric: 'relevance', score: 0.5, passed: false, threshold: 0.7 }],
          evaluatedAt: new Date(),
          durationMs: 100,
        },
      ],
      averageScores: { relevance: 0.65 },
      overallAverage: 0.65,
      passRate: 0.5,
      passedCount: 1,
      failedCount: 1,
      durationMs: 200,
    };

    it('should generate markdown report', async () => {
      const report = await generateReport({
        results: mockResults,
        format: 'markdown',
        options: { includeMetricBreakdown: true },
      });

      expect(report.content).toContain('# Evaluation Report');
      expect(report.summary.totalCases).toBe(2);
      expect(report.summary.passRate).toBe(0.5);
    });

    it('should generate JSON report', async () => {
      const report = await generateReport({
        results: mockResults,
        format: 'json',
      });

      const parsed = JSON.parse(report.content);
      expect(parsed.summary.totalCases).toBe(2);
    });

    it('should generate HTML report', async () => {
      const report = await generateReport({
        results: mockResults,
        format: 'html',
        options: {
          includeMetricBreakdown: true,
          includeScoreDistribution: true,
          includeFailedCases: true,
        },
      });

      expect(report.content).toContain('<!DOCTYPE html>');
      expect(report.content).toContain('Evaluation Report');
    });

    it('should calculate metric statistics', async () => {
      const report = await generateReport({
        results: mockResults,
        format: 'markdown',
      });

      expect(report.metricStats.relevance).toBeDefined();
      expect(report.metricStats.relevance.average).toBeCloseTo(0.65);
      expect(report.metricStats.relevance.min).toBeCloseTo(0.5);
      expect(report.metricStats.relevance.max).toBeCloseTo(0.8);
    });
  });
});
