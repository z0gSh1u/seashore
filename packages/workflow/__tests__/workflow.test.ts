/**
 * @seashore/workflow - Unit Tests
 *
 * Comprehensive tests for workflow package
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createWorkflow,
  createNode,
  createLLMNode,
  createToolNode,
  createConditionNode,
  createSwitchNode,
  createParallelNode,
  createLoopNode,
  createForEachNode,
  createReduceNode,
  executeWorkflow,
  executeWorkflowStream,
  createWorkflowContext,
  createContextAccessor,
  withRetry,
  withFallback,
  withTimeout,
  createCircuitBreaker,
  WorkflowConfigError,
  WorkflowExecutionError,
  WorkflowTimeoutError,
  breakLoop,
} from '../src/index.js';

// Mock LLM adapter
function createMockLLMAdapter(response: string) {
  return {
    chat: vi.fn().mockResolvedValue({
      content: response,
      finishReason: 'stop',
    }),
    chatStream: vi.fn().mockImplementation(async function* () {
      yield { type: 'text-delta', textDelta: response };
      yield { type: 'finish', finishReason: 'stop' };
    }),
  };
}

// Mock tool
function createMockTool(name: string, result: unknown) {
  return {
    name,
    description: `Mock ${name} tool`,
    parameters: {},
    execute: vi.fn().mockResolvedValue(result),
  };
}

describe('createWorkflow', () => {
  it('should create a workflow with valid config', () => {
    const node1 = createNode({
      name: 'node1',
      execute: async (input) => ({ result: input }),
    });

    const node2 = createNode({
      name: 'node2',
      execute: async (input) => ({ final: input }),
    });

    const workflow = createWorkflow({
      name: 'test-workflow',
      nodes: [node1, node2],
      edges: [{ from: 'node1', to: 'node2' }],
    });

    expect(workflow.config.name).toBe('test-workflow');
    expect(workflow.config.nodes).toHaveLength(2);
    expect(workflow.config.edges).toHaveLength(1);
  });

  it('should throw on duplicate node names', () => {
    const node1 = createNode({ name: 'same', execute: async () => {} });
    const node2 = createNode({ name: 'same', execute: async () => {} });

    expect(() =>
      createWorkflow({
        name: 'test',
        nodes: [node1, node2],
        edges: [],
      })
    ).toThrow(WorkflowConfigError);
  });

  it('should throw on invalid edge references', () => {
    const node1 = createNode({ name: 'node1', execute: async () => {} });

    expect(() =>
      createWorkflow({
        name: 'test',
        nodes: [node1],
        edges: [{ from: 'node1', to: 'nonexistent' }],
      })
    ).toThrow(WorkflowConfigError);
  });
});

describe('createNode', () => {
  it('should create a custom node', async () => {
    const node = createNode({
      name: 'custom',
      execute: async (input: { value: number }) => ({
        doubled: input.value * 2,
      }),
    });

    const ctx = createWorkflowContext();
    const result = await node.execute({ value: 5 }, ctx);

    expect(result).toEqual({ doubled: 10 });
  });

  it('should validate input with schema', async () => {
    const { z } = await import('zod');

    const node = createNode({
      name: 'validated',
      inputSchema: z.object({ value: z.number().min(0) }),
      execute: async (input: { value: number }) => input,
    });

    const ctx = createWorkflowContext();

    await expect(node.execute({ value: -1 } as { value: number }, ctx)).rejects.toThrow();
  });
});

describe('createConditionNode', () => {
  it('should route based on condition', async () => {
    const conditionNode = createConditionNode({
      name: 'route',
      condition: (ctx) => {
        const output = ctx.nodeOutputs['previous'] as { success: boolean };
        return output?.success ?? false;
      },
      ifTrue: 'success-path',
      ifFalse: 'failure-path',
    });

    // Test true condition
    let ctx = createWorkflowContext({
      nodeOutputs: { previous: { success: true } },
    });
    let result = await conditionNode.execute(undefined, ctx);
    expect(result.branch).toBe('success-path');

    // Test false condition
    ctx = createWorkflowContext({
      nodeOutputs: { previous: { success: false } },
    });
    result = await conditionNode.execute(undefined, ctx);
    expect(result.branch).toBe('failure-path');
  });
});

describe('createSwitchNode', () => {
  it('should route to correct case', async () => {
    const switchNode = createSwitchNode({
      name: 'switch',
      value: (ctx) => {
        const output = ctx.nodeOutputs['previous'] as { type: string };
        return output?.type ?? 'default';
      },
      cases: {
        error: 'error-handler',
        success: 'success-handler',
        pending: 'pending-handler',
      },
      default: 'default-handler',
    });

    const ctx = createWorkflowContext({
      nodeOutputs: { previous: { type: 'error' } },
    });
    const result = await switchNode.execute(undefined, ctx);
    expect(result.branch).toBe('error-handler');
  });

  it('should use default for unknown values', async () => {
    const switchNode = createSwitchNode({
      name: 'switch',
      value: () => 'unknown',
      cases: { known: 'known-handler' },
      default: 'default-handler',
    });

    const ctx = createWorkflowContext();
    const result = await switchNode.execute(undefined, ctx);
    expect(result.branch).toBe('default-handler');
  });
});

describe('createParallelNode', () => {
  it('should execute branches in parallel', async () => {
    const executionOrder: string[] = [];

    const branch1 = createNode({
      name: 'branch1',
      execute: async () => {
        executionOrder.push('branch1-start');
        await new Promise((r) => setTimeout(r, 50));
        executionOrder.push('branch1-end');
        return { value: 1 };
      },
    });

    const branch2 = createNode({
      name: 'branch2',
      execute: async () => {
        executionOrder.push('branch2-start');
        await new Promise((r) => setTimeout(r, 10));
        executionOrder.push('branch2-end');
        return { value: 2 };
      },
    });

    const parallelNode = createParallelNode({
      name: 'parallel',
      branches: [branch1, branch2],
    });

    const ctx = createWorkflowContext();
    const result = await parallelNode.execute({}, ctx);

    expect(result.results).toHaveLength(2);
    expect(result.results[0]).toEqual({ value: 1 });
    expect(result.results[1]).toEqual({ value: 2 });

    // branch2 should complete before branch1 due to timing
    expect(executionOrder.indexOf('branch2-end')).toBeLessThan(
      executionOrder.indexOf('branch1-end')
    );
  });
});

describe('Loop Nodes', () => {
  describe('createLoopNode', () => {
    it('should execute node multiple times', async () => {
      let counter = 0;
      const incrementNode = createNode({
        name: 'increment',
        execute: async () => {
          counter++;
          return { count: counter };
        },
      });

      const loopNode = createLoopNode({
        name: 'loop',
        node: incrementNode,
        times: 5,
      });

      const ctx = createWorkflowContext();
      const results = await loopNode.execute({}, ctx);

      expect(results).toHaveLength(5);
      expect(counter).toBe(5);
    });

    it('should support while condition', async () => {
      let value = 0;
      const node = createNode({
        name: 'increment',
        execute: async () => {
          value++;
          return { value };
        },
      });

      const loopNode = createLoopNode({
        name: 'while-loop',
        node,
        while: (ctx) => {
          const output = ctx.nodeOutputs['increment'] as { value: number } | undefined;
          return (output?.value ?? 0) < 3;
        },
        maxIterations: 10,
      });

      const ctx = createWorkflowContext();
      const results = await loopNode.execute({}, ctx);

      expect(results).toHaveLength(3);
      expect(value).toBe(3);
    });
  });

  describe('createForEachNode', () => {
    it('should iterate over items', async () => {
      const processNode = createNode<number, string>({
        name: 'process',
        execute: async (item) => `processed-${item}`,
      });

      const forEachNode = createForEachNode({
        name: 'forEach',
        items: (input: { numbers: number[] }) => input.numbers,
        node: processNode,
      });

      const ctx = createWorkflowContext();
      const results = await forEachNode.execute({ numbers: [1, 2, 3] }, ctx);

      expect(results).toEqual(['processed-1', 'processed-2', 'processed-3']);
    });
  });

  describe('createReduceNode', () => {
    it('should reduce items to single value', async () => {
      const reduceNode = createReduceNode({
        name: 'sum',
        items: (input: { numbers: number[] }) => input.numbers,
        initial: 0,
        reducer: (acc, item) => acc + item,
      });

      const ctx = createWorkflowContext();
      const result = await reduceNode.execute({ numbers: [1, 2, 3, 4, 5] }, ctx);

      expect(result).toBe(15);
    });
  });
});

describe('executeWorkflow', () => {
  it('should execute a simple linear workflow', async () => {
    const node1 = createNode({
      name: 'step1',
      execute: async (input: { value: number }) => ({
        doubled: input.value * 2,
      }),
    });

    const node2 = createNode({
      name: 'step2',
      execute: async (input, ctx) => {
        const prev = ctx.nodeOutputs['step1'] as { doubled: number };
        return { final: prev.doubled + 1 };
      },
    });

    const workflow = createWorkflow({
      name: 'linear-workflow',
      nodes: [node1, node2],
      edges: [{ from: 'step1', to: 'step2' }],
    });

    const result = await executeWorkflow(workflow, { value: 5 });

    expect(result.output).toEqual({ final: 11 });
    expect(result.nodeExecutionOrder).toEqual(['step1', 'step2']);
  });

  it('should handle conditional routing', async () => {
    const checkNode = createNode({
      name: 'check',
      execute: async (input: { value: number }) => ({
        isPositive: input.value > 0,
      }),
    });

    const routeNode = createConditionNode({
      name: 'route',
      condition: (ctx) => {
        const check = ctx.nodeOutputs['check'] as { isPositive: boolean };
        return check.isPositive;
      },
      ifTrue: 'positive',
      ifFalse: 'negative',
    });

    const positiveNode = createNode({
      name: 'positive',
      execute: async () => ({ result: 'positive' }),
    });

    const negativeNode = createNode({
      name: 'negative',
      execute: async () => ({ result: 'negative' }),
    });

    const workflow = createWorkflow({
      name: 'conditional',
      nodes: [checkNode, routeNode, positiveNode, negativeNode],
      edges: [
        { from: 'check', to: 'route' },
        {
          from: 'route',
          to: 'positive',
          condition: (ctx) => {
            const route = ctx.nodeOutputs['route'] as { branch: string };
            return route.branch === 'positive';
          },
        },
        {
          from: 'route',
          to: 'negative',
          condition: (ctx) => {
            const route = ctx.nodeOutputs['route'] as { branch: string };
            return route.branch === 'negative';
          },
        },
      ],
    });

    const positiveResult = await executeWorkflow(workflow, { value: 5 });
    expect(positiveResult.output).toEqual({ result: 'positive' });

    const negativeResult = await executeWorkflow(workflow, { value: -5 });
    expect(negativeResult.output).toEqual({ result: 'negative' });
  });

  it('should emit events during execution', async () => {
    const events: Array<{ type: string }> = [];

    const node = createNode({
      name: 'single',
      execute: async () => ({ done: true }),
    });

    const workflow = createWorkflow({
      name: 'event-test',
      nodes: [node],
      edges: [],
    });

    await executeWorkflow(
      workflow,
      {},
      {
        onEvent: (event) => events.push({ type: event.type }),
      }
    );

    expect(events.map((e) => e.type)).toContain('workflow_start');
    expect(events.map((e) => e.type)).toContain('node_start');
    expect(events.map((e) => e.type)).toContain('node_complete');
    expect(events.map((e) => e.type)).toContain('workflow_complete');
  });

  it('should respect abort signal', async () => {
    const controller = new AbortController();

    const slowNode = createNode({
      name: 'slow',
      execute: async () => {
        await new Promise((r) => setTimeout(r, 1000));
        return { done: true };
      },
    });

    const workflow = createWorkflow({
      name: 'abort-test',
      nodes: [slowNode],
      edges: [],
    });

    // Abort after 10ms
    setTimeout(() => controller.abort(), 10);

    await expect(executeWorkflow(workflow, {}, { signal: controller.signal })).rejects.toThrow();
  });
});

describe('Error Handling', () => {
  describe('withRetry', () => {
    it('should retry on failure', async () => {
      let attempts = 0;
      const failingNode = createNode({
        name: 'failing',
        execute: async () => {
          attempts++;
          if (attempts < 3) {
            throw new Error('Temporary failure');
          }
          return { success: true };
        },
      });

      const retriedNode = withRetry(failingNode, {
        maxRetries: 3,
        baseDelay: 10,
      });

      const ctx = createWorkflowContext();
      const result = await retriedNode.execute({}, ctx);

      expect(result).toEqual({ success: true });
      expect(attempts).toBe(3);
    });

    it('should fail after max retries', async () => {
      const alwaysFailingNode = createNode({
        name: 'always-failing',
        execute: async () => {
          throw new Error('Permanent failure');
        },
      });

      const retriedNode = withRetry(alwaysFailingNode, {
        maxRetries: 2,
        baseDelay: 10,
      });

      const ctx = createWorkflowContext();
      await expect(retriedNode.execute({}, ctx)).rejects.toThrow();
    });
  });

  describe('withFallback', () => {
    it('should use fallback on failure', async () => {
      const primaryNode = createNode({
        name: 'primary',
        execute: async () => {
          throw new Error('Primary failed');
        },
      });

      const fallbackNode = createNode({
        name: 'fallback',
        execute: async () => ({ source: 'fallback' }),
      });

      const resilientNode = withFallback(primaryNode, fallbackNode);

      const ctx = createWorkflowContext();
      const result = await resilientNode.execute({}, ctx);

      expect(result).toEqual({ source: 'fallback' });
    });
  });

  describe('withTimeout', () => {
    it('should timeout slow nodes', async () => {
      const slowNode = createNode({
        name: 'slow',
        execute: async () => {
          await new Promise((r) => setTimeout(r, 1000));
          return { done: true };
        },
      });

      const timedNode = withTimeout(slowNode, 50);

      const ctx = createWorkflowContext();
      await expect(timedNode.execute({}, ctx)).rejects.toThrow();
    });
  });

  describe('createCircuitBreaker', () => {
    it('should open circuit after threshold failures', async () => {
      let callCount = 0;
      const failingNode = createNode({
        name: 'failing',
        execute: async () => {
          callCount++;
          throw new Error('Failure');
        },
      });

      const states: string[] = [];
      const protectedNode = createCircuitBreaker(failingNode, {
        failureThreshold: 2,
        resetTimeout: 1000,
        onStateChange: (state) => states.push(state),
      });

      const ctx = createWorkflowContext();

      // First two failures
      await expect(protectedNode.execute({}, ctx)).rejects.toThrow();
      await expect(protectedNode.execute({}, ctx)).rejects.toThrow();

      // Circuit should be open now
      expect(states).toContain('open');

      // Third call should fail fast without executing
      const currentCount = callCount;
      await expect(protectedNode.execute({}, ctx)).rejects.toThrow('Circuit breaker is open');
      expect(callCount).toBe(currentCount);
    });
  });
});

describe('Context Accessor', () => {
  it('should access node outputs', () => {
    const ctx = createWorkflowContext({
      nodeOutputs: {
        step1: { data: { nested: { value: 42 } } },
      },
      metadata: { requestId: 'req-123' },
    });

    const accessor = createContextAccessor(ctx);

    expect(accessor.output('step1')).toEqual({ data: { nested: { value: 42 } } });
    expect(accessor.outputPath('step1', 'data.nested.value')).toBe(42);
    expect(accessor.meta('requestId')).toBe('req-123');
  });

  it('should handle loop state', () => {
    const ctx = createWorkflowContext({
      loopState: {
        index: 2,
        iteration: 3,
        isFirst: false,
        isLast: false,
        value: 'item-2',
      },
    });

    const accessor = createContextAccessor(ctx);

    expect(accessor.inLoop()).toBe(true);
    expect(accessor.loopIndex()).toBe(2);
    expect(accessor.loopValue()).toBe('item-2');
  });
});
