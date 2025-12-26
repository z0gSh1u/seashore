/**
 * Observability package tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createTracer,
  createTokenCounter,
  createLogger,
  observabilityMiddleware,
  createAgentObserver,
  createConsoleExporter,
} from '../src/index.js';

describe('@seashore/observability', () => {
  describe('createTracer', () => {
    it('should create a tracer with service name', () => {
      const tracer = createTracer({ serviceName: 'test-service' });

      expect(tracer).toBeDefined();
      expect(tracer.startSpan).toBeInstanceOf(Function);
      expect(tracer.withSpan).toBeInstanceOf(Function);
      expect(tracer.getActiveSpan).toBeInstanceOf(Function);
    });

    it('should create and end spans', async () => {
      const tracer = createTracer({ serviceName: 'test-service' });

      const span = tracer.startSpan('test-span');
      expect(span.name).toBe('test-span');
      expect(span.startTime).toBeInstanceOf(Date);

      span.setAttributes({ key: 'value' });
      expect(span.attributes.key).toBe('value');

      span.addEvent('test-event', { data: 123 });
      expect(span.events).toHaveLength(1);
      expect(span.events[0].name).toBe('test-event');

      span.end();
      expect(span.endTime).toBeInstanceOf(Date);
    });

    it('should handle withSpan correctly', async () => {
      const tracer = createTracer({ serviceName: 'test-service' });

      const result = await tracer.withSpan('wrapped-operation', async (span) => {
        span.setAttributes({ operation: 'test' });
        return 'result';
      });

      expect(result).toBe('result');
    });

    it('should handle errors in withSpan', async () => {
      const tracer = createTracer({ serviceName: 'test-service' });

      await expect(
        tracer.withSpan('error-operation', async () => {
          throw new Error('Test error');
        })
      ).rejects.toThrow('Test error');
    });

    it('should export spans when exporter is configured', async () => {
      const exportFn = vi.fn().mockResolvedValue(undefined);
      const exporter = {
        export: exportFn,
        shutdown: vi.fn().mockResolvedValue(undefined),
      };

      const tracer = createTracer({
        serviceName: 'test-service',
        exporter,
      });

      await tracer.withSpan('exported-span', async (span) => {
        span.setAttributes({ test: true });
      });

      expect(exportFn).toHaveBeenCalled();
      const exportedSpans = exportFn.mock.calls[0][0];
      expect(exportedSpans[0].name).toBe('exported-span');
    });
  });

  describe('createTokenCounter', () => {
    it('should create a token counter with default model', () => {
      const counter = createTokenCounter();

      expect(counter).toBeDefined();
      expect(counter.count).toBeInstanceOf(Function);
      expect(counter.estimateCost).toBeInstanceOf(Function);
    });

    it('should estimate tokens from text', () => {
      const counter = createTokenCounter({ model: 'gpt-4' });

      const count = counter.count('Hello, world!');
      expect(count).toBeGreaterThan(0);
    });

    it('should estimate tokens from messages', () => {
      const counter = createTokenCounter();

      const messages = [
        { role: 'user' as const, content: 'Hello' },
        { role: 'assistant' as const, content: 'Hi there!' },
      ];

      const estimate = counter.estimate(messages);
      expect(estimate.promptTokens).toBeGreaterThan(0);
    });

    it('should calculate cost estimates', () => {
      const counter = createTokenCounter({ model: 'gpt-4' });

      const cost = counter.estimateCost(1000, 500);
      expect(cost.totalCost).toBeGreaterThan(0);
      expect(cost.inputCost).toBeGreaterThan(0);
      expect(cost.outputCost).toBeGreaterThan(0);
    });
  });

  describe('createLogger', () => {
    let consoleOutput: string[];
    let originalConsole: typeof console;

    beforeEach(() => {
      consoleOutput = [];
      originalConsole = { ...console };
      console.log = vi.fn((msg) => consoleOutput.push(msg));
      console.debug = vi.fn((msg) => consoleOutput.push(msg));
      console.info = vi.fn((msg) => consoleOutput.push(msg));
      console.warn = vi.fn((msg) => consoleOutput.push(msg));
      console.error = vi.fn((msg) => consoleOutput.push(msg));
    });

    afterEach(() => {
      Object.assign(console, originalConsole);
    });

    it('should create a logger with name', () => {
      const logger = createLogger({ name: 'test-logger' });

      expect(logger).toBeDefined();
      expect(logger.debug).toBeInstanceOf(Function);
      expect(logger.info).toBeInstanceOf(Function);
      expect(logger.warn).toBeInstanceOf(Function);
      expect(logger.error).toBeInstanceOf(Function);
    });

    it('should log at different levels', () => {
      const logger = createLogger({
        name: 'test-logger',
        level: 'debug',
        format: 'json',
      });

      logger.debug('Debug message');
      logger.info('Info message');
      logger.warn('Warning message');
      logger.error('Error message');

      expect(consoleOutput.length).toBe(4);
    });

    it('should respect log level filtering', () => {
      const logger = createLogger({
        name: 'test-logger',
        level: 'warn',
        format: 'json',
      });

      logger.debug('Debug message');
      logger.info('Info message');
      logger.warn('Warning message');
      logger.error('Error message');

      // Only warn and error should be logged
      expect(consoleOutput.length).toBe(2);
    });

    it('should create child loggers', () => {
      const logger = createLogger({
        name: 'parent',
        level: 'debug',
        format: 'json',
      });

      const childLogger = logger.child({ component: 'child' });
      childLogger.info('Child message');

      expect(consoleOutput.length).toBe(1);
      const entry = JSON.parse(consoleOutput[0]);
      expect(entry.component).toBe('child');
    });
  });

  describe('observabilityMiddleware', () => {
    it('should wrap functions with tracing', async () => {
      const tracer = createTracer({ serviceName: 'test-service' });

      const observe = observabilityMiddleware({ tracer });

      const tracedFn = observe(async (x: number) => x * 2, { name: 'double', type: 'custom' });

      const result = await tracedFn(5);
      expect(result).toBe(10);
    });

    it('should propagate errors', async () => {
      const tracer = createTracer({ serviceName: 'test-service' });

      const observe = observabilityMiddleware({ tracer });

      const tracedFn = observe(
        async () => {
          throw new Error('Test error');
        },
        { name: 'failing', type: 'custom' }
      );

      await expect(tracedFn()).rejects.toThrow('Test error');
    });
  });

  describe('createAgentObserver', () => {
    it('should wrap agent run functions', async () => {
      const tracer = createTracer({ serviceName: 'test-service' });
      const observer = createAgentObserver({ tracer });

      const mockRun = vi.fn().mockResolvedValue({ output: 'result' });
      const wrappedRun = observer.wrapRun(mockRun, 'test-agent');

      const result = await wrappedRun({ input: 'test' });

      expect(result).toEqual({ output: 'result' });
      expect(mockRun).toHaveBeenCalledWith({ input: 'test' });
    });

    it('should wrap tool functions', async () => {
      const tracer = createTracer({ serviceName: 'test-service' });
      const observer = createAgentObserver({ tracer });

      const mockTool = vi.fn().mockResolvedValue('tool result');
      const wrappedTool = observer.wrapTool(mockTool, 'test-tool');

      const result = await wrappedTool({ query: 'test' });

      expect(result).toBe('tool result');
      expect(mockTool).toHaveBeenCalledWith({ query: 'test' });
    });

    it('should wrap LLM calls', async () => {
      const tracer = createTracer({ serviceName: 'test-service' });
      const observer = createAgentObserver({ tracer });

      const mockLLM = vi.fn().mockResolvedValue({
        text: 'response',
        usage: { promptTokens: 10, completionTokens: 20 },
      });
      const wrappedLLM = observer.wrapLLMCall(mockLLM, 'gpt-4');

      const result = await wrappedLLM({ prompt: 'test' });

      expect(result.text).toBe('response');
      expect(mockLLM).toHaveBeenCalledWith({ prompt: 'test' });
    });
  });

  describe('createConsoleExporter', () => {
    it('should export spans to console', async () => {
      const output: string[] = [];
      const exporter = createConsoleExporter({
        format: 'json',
        output: (msg) => output.push(msg),
      });

      const span = {
        id: 'span-1',
        traceId: 'trace-1',
        name: 'test-span',
        startTime: new Date(),
        endTime: new Date(),
        attributes: { key: 'value' },
        events: [],
        status: 'ok' as const,
      };

      await exporter.export([span]);

      expect(output.length).toBe(1);
      const exported = JSON.parse(output[0]);
      expect(exported.name).toBe('test-span');
    });

    it('should format spans as pretty output', async () => {
      const output: string[] = [];
      const exporter = createConsoleExporter({
        format: 'pretty',
        output: (msg) => output.push(msg),
      });

      const span = {
        id: 'span-1',
        traceId: 'trace-1',
        name: 'test-span',
        startTime: new Date(),
        endTime: new Date(),
        attributes: {},
        events: [],
        status: 'ok' as const,
      };

      await exporter.export([span]);

      expect(output.length).toBe(1);
      expect(output[0]).toContain('test-span');
    });
  });
});
