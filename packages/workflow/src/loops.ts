/**
 * @seashore/workflow - Loop Control
 *
 * Loop and iteration management for workflows
 */

import type { WorkflowNode, WorkflowContext } from './types.js';
import { createMutableWorkflowContext } from './context.js';

/**
 * Loop state for tracking iterations
 */
export interface LoopState {
  index: number;
  iteration: number;
  isFirst: boolean;
  isLast: boolean;
  value?: unknown;
  accumulator?: unknown;
}

/**
 * Loop break signal
 */
export class LoopBreakSignal extends Error {
  constructor(public readonly value?: unknown) {
    super('Loop break');
    this.name = 'LoopBreakSignal';
  }
}

/**
 * Loop continue signal
 */
export class LoopContinueSignal extends Error {
  constructor() {
    super('Loop continue');
    this.name = 'LoopContinueSignal';
  }
}

/**
 * Create a loop node that executes a node multiple times
 */
export function createLoopNode<TInput = unknown, TOutput = unknown>(config: {
  name: string;
  node: WorkflowNode<TInput, TOutput>;
  while?: (ctx: WorkflowContext) => boolean;
  until?: (ctx: WorkflowContext) => boolean;
  times?: number;
  maxIterations?: number;
  onIteration?: (state: LoopState, ctx: WorkflowContext) => void;
}): WorkflowNode<TInput, TOutput[]> {
  const {
    name,
    node,
    while: whileCondition,
    until: untilCondition,
    times,
    maxIterations = 100,
    onIteration,
  } = config;

  return {
    name,
    type: 'custom',

    async execute(input: TInput, ctx: WorkflowContext): Promise<TOutput[]> {
      const results: TOutput[] = [];
      let iteration = 0;
      const maxIter = times ?? maxIterations;

      // Create mutable context for loop
      const mutableCtx = createMutableWorkflowContext({
        ...ctx,
      });

      mutableCtx.updateLoopState({
        index: 0,
        iteration: 0,
        isFirst: true,
        isLast: false,
      });

      while (iteration < maxIter) {
        // Check abort signal
        if (ctx.signal?.aborted) {
          break;
        }

        // Update loop state
        const loopState: LoopState = {
          index: iteration,
          iteration: iteration + 1,
          isFirst: iteration === 0,
          isLast: times !== undefined ? iteration === times - 1 : false,
          accumulator: results,
        };
        mutableCtx.updateLoopState(loopState);

        const currentCtx = mutableCtx.toContext();

        // Check while condition (before execution)
        if (whileCondition && !whileCondition(currentCtx)) {
          break;
        }

        // Notify iteration callback
        if (onIteration) {
          onIteration(loopState, currentCtx);
        }

        try {
          // Execute the node
          const result = await node.execute(input, currentCtx);
          results.push(result);

          // Store result in context
          mutableCtx.setNodeOutput(node.name, result);

          // Check until condition (after execution)
          if (untilCondition && untilCondition(mutableCtx.toContext())) {
            break;
          }

          // Check fixed times
          if (times !== undefined && iteration >= times - 1) {
            break;
          }
        } catch (error) {
          if (error instanceof LoopBreakSignal) {
            if (error.value !== undefined) {
              results.push(error.value as TOutput);
            }
            break;
          }
          if (error instanceof LoopContinueSignal) {
            iteration++;
            continue;
          }
          throw error;
        }

        iteration++;
      }

      return results;
    },
  };
}

/**
 * Create a forEach loop that iterates over an array
 */
export function createForEachNode<TItem = unknown, TOutput = unknown>(config: {
  name: string;
  items: (input: unknown, ctx: WorkflowContext) => TItem[] | Promise<TItem[]>;
  node: WorkflowNode<TItem, TOutput>;
  parallel?: boolean;
  maxConcurrency?: number;
}): WorkflowNode<unknown, TOutput[]> {
  const { name, items, node, parallel = false, maxConcurrency = 10 } = config;

  return {
    name,
    type: 'custom',

    async execute(input: unknown, ctx: WorkflowContext): Promise<TOutput[]> {
      const itemList = await items(input, ctx);

      if (parallel) {
        // Parallel execution with concurrency limit
        const results: TOutput[] = new Array(itemList.length);
        const executing: Promise<void>[] = [];

        for (let i = 0; i < itemList.length; i++) {
          const item = itemList[i];

          // Check abort signal
          if (ctx.signal?.aborted) {
            break;
          }

          const promise = (async (index: number, itemValue: TItem) => {
            const mutableCtx = createMutableWorkflowContext({
              ...ctx,
            });
            mutableCtx.updateLoopState({
              index,
              iteration: index + 1,
              isFirst: index === 0,
              isLast: index === itemList.length - 1,
              value: itemValue,
            });

            const result = await node.execute(itemValue, mutableCtx.toContext());
            results[index] = result;
          })(i, item!);

          executing.push(promise);

          if (executing.length >= maxConcurrency) {
            await Promise.race(executing);
          }
        }

        await Promise.all(executing);
        return results;
      }

      // Sequential execution
      const results: TOutput[] = [];

      for (let i = 0; i < itemList.length; i++) {
        const item = itemList[i];

        // Check abort signal
        if (ctx.signal?.aborted) {
          break;
        }

        const mutableCtx = createMutableWorkflowContext({
          ...ctx,
        });
        mutableCtx.updateLoopState({
          index: i,
          iteration: i + 1,
          isFirst: i === 0,
          isLast: i === itemList.length - 1,
          value: item,
        });

        try {
          const result = await node.execute(item!, mutableCtx.toContext());
          results.push(result);
        } catch (error) {
          if (error instanceof LoopBreakSignal) {
            if (error.value !== undefined) {
              results.push(error.value as TOutput);
            }
            break;
          }
          if (error instanceof LoopContinueSignal) {
            continue;
          }
          throw error;
        }
      }

      return results;
    },
  };
}

/**
 * Create a reduce loop that accumulates results
 */
export function createReduceNode<TItem = unknown, TAcc = unknown>(config: {
  name: string;
  items: (input: unknown, ctx: WorkflowContext) => TItem[] | Promise<TItem[]>;
  initial: TAcc | ((ctx: WorkflowContext) => TAcc);
  reducer: (
    accumulator: TAcc,
    item: TItem,
    index: number,
    ctx: WorkflowContext
  ) => TAcc | Promise<TAcc>;
}): WorkflowNode<unknown, TAcc> {
  const { name, items, initial, reducer } = config;

  return {
    name,
    type: 'custom',

    async execute(input: unknown, ctx: WorkflowContext): Promise<TAcc> {
      const itemList = await items(input, ctx);
      let accumulator: TAcc =
        typeof initial === 'function' ? (initial as (ctx: WorkflowContext) => TAcc)(ctx) : initial;

      for (let i = 0; i < itemList.length; i++) {
        const item = itemList[i];

        // Check abort signal
        if (ctx.signal?.aborted) {
          break;
        }

        const mutableCtx = createMutableWorkflowContext({
          ...ctx,
        });
        mutableCtx.updateLoopState({
          index: i,
          iteration: i + 1,
          isFirst: i === 0,
          isLast: i === itemList.length - 1,
          value: item,
          accumulator,
        });

        try {
          accumulator = await reducer(accumulator, item!, i, mutableCtx.toContext());
        } catch (error) {
          if (error instanceof LoopBreakSignal) {
            if (error.value !== undefined) {
              accumulator = error.value as TAcc;
            }
            break;
          }
          if (error instanceof LoopContinueSignal) {
            continue;
          }
          throw error;
        }
      }

      return accumulator;
    },
  };
}

/**
 * Helper to break out of a loop
 */
export function breakLoop(value?: unknown): never {
  throw new LoopBreakSignal(value);
}

/**
 * Helper to continue to next iteration
 */
export function continueLoop(): never {
  throw new LoopContinueSignal();
}
