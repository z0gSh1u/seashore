/**
 * @seashore/workflow - Parallel Node
 *
 * Node type for parallel execution
 */

import type { WorkflowNode, ParallelNodeConfig, WorkflowContext } from '../types.js';
import { createMutableWorkflowContext } from '../context.js';

/**
 * Parallel node output
 */
export interface ParallelNodeOutput<T = unknown> {
  /** Results from all branches */
  readonly results: T[];

  /** Merged result (if merge function provided) */
  readonly merged?: unknown;

  /** Errors from failed branches */
  readonly errors?: Record<string, string>;

  /** Whether all branches succeeded */
  readonly allSucceeded: boolean;

  /** Execution duration in milliseconds */
  readonly durationMs: number;
}

/**
 * Create a parallel node for concurrent execution
 *
 * @example
 * ```typescript
 * import { createParallelNode } from '@seashore/workflow';
 *
 * const parallelNode = createParallelNode({
 *   name: 'parallel-search',
 *   branches: [searchWebNode, searchDocsNode, searchCacheNode],
 *   merge: (results) => results.flat(),
 * });
 * ```
 */
export function createParallelNode(
  config: ParallelNodeConfig
): WorkflowNode<unknown, ParallelNodeOutput> {
  const {
    name,
    branches,
    forEach,
    node,
    merge,
    maxConcurrency = 10,
    failurePolicy = 'partial',
  } = config;

  return {
    name,
    type: 'parallel',

    async execute(_input: unknown, ctx: WorkflowContext): Promise<ParallelNodeOutput> {
      const startTime = Date.now();
      const errors: Record<string, string> = {};

      // Determine what to execute
      let nodesToExecute: Array<{ key: string; node: WorkflowNode; input: unknown }>;

      if (branches) {
        // Static branches
        nodesToExecute = branches.map((branchNode) => ({
          key: branchNode.name,
          node: branchNode,
          input: _input,
        }));
      } else if (forEach && node) {
        // Dynamic forEach
        const items = await Promise.resolve(forEach(_input, ctx));
        nodesToExecute = items.map((item, index) => ({
          key: `item_${index}`,
          node,
          input: item,
        }));
      } else {
        return {
          results: [],
          allSucceeded: true,
          durationMs: Date.now() - startTime,
        };
      }

      // Pre-allocate results array to preserve order
      const results: unknown[] = new Array(nodesToExecute.length);

      // Execute with concurrency limit
      const executing: Array<Promise<void>> = [];
      let allSucceeded = true;

      for (let i = 0; i < nodesToExecute.length; i++) {
        const { key, node: nodeToRun, input } = nodesToExecute[i]!;

        // Check abort signal
        if (ctx.signal?.aborted) {
          break;
        }

        const index = i;
        const promise = (async () => {
          try {
            const mutableCtx = createMutableWorkflowContext({ ...ctx });
            const result = await nodeToRun.execute(input, mutableCtx.toContext());
            results[index] = result;
          } catch (error) {
            allSucceeded = false;
            errors[key] = error instanceof Error ? error.message : String(error);

            if (failurePolicy === 'all') {
              throw error;
            }
          }
        })();

        executing.push(promise);

        // Limit concurrency
        if (executing.length >= maxConcurrency) {
          await Promise.race(executing);
        }
      }

      // Wait for all to complete
      if (failurePolicy === 'all') {
        await Promise.all(executing);
      } else {
        await Promise.allSettled(executing);
      }

      // Merge results if merge function provided
      const merged = merge ? merge(results) : undefined;

      return {
        results,
        merged,
        errors: Object.keys(errors).length > 0 ? errors : undefined,
        allSucceeded,
        durationMs: Date.now() - startTime,
      };
    },
  };
}

/**
 * Create a map-reduce node for data processing
 *
 * @example
 * ```typescript
 * import { createMapReduceNode } from '@seashore/workflow';
 *
 * const mapReduceNode = createMapReduceNode({
 *   name: 'process-items',
 *   items: (input) => input.data,
 *   map: processItemNode,
 *   reduce: (results) => ({ total: results.length, items: results }),
 * });
 * ```
 */
export function createMapReduceNode<
  TItem = unknown,
  TMapResult = unknown,
  TOutput = unknown,
>(config: {
  name: string;
  items: (input: unknown, ctx: WorkflowContext) => TItem[] | Promise<TItem[]>;
  map: WorkflowNode<TItem, TMapResult>;
  reduce: (results: TMapResult[]) => TOutput;
  maxConcurrency?: number;
}): WorkflowNode<unknown, TOutput> {
  const { name, items, map, reduce, maxConcurrency = 10 } = config;

  const parallelNode = createParallelNode({
    name: `${name}_parallel`,
    forEach: (input, ctx) => items(input, ctx) as unknown[],
    node: map as WorkflowNode,
    maxConcurrency,
    failurePolicy: 'all',
  });

  return {
    name,
    type: 'parallel',

    async execute(input: unknown, ctx: WorkflowContext): Promise<TOutput> {
      const parallelResult = await parallelNode.execute(input, ctx);
      return reduce(parallelResult.results as TMapResult[]);
    },
  };
}
