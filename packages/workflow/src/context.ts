/**
 * @seashore/workflow - Context Management
 *
 * Workflow context utilities and management
 */

import type { WorkflowContext, MutableWorkflowContext } from './types';

/**
 * Create a new immutable workflow context
 */
export function createWorkflowContext(initial: Partial<WorkflowContext> = {}): WorkflowContext {
  const nodeOutputs = initial.nodeOutputs ?? {};

  return {
    nodeOutputs,
    metadata: initial.metadata ?? {},
    currentNode: initial.currentNode,
    executionPath: initial.executionPath ?? [],
    loopState: initial.loopState,
    signal: initial.signal,

    getNodeOutput<T = unknown>(nodeName: string): T | undefined {
      return nodeOutputs[nodeName] as T | undefined;
    },
  };
}

/**
 * Create a mutable workflow context with helper methods
 */
export function createMutableWorkflowContext(
  initial: Partial<WorkflowContext> = {}
): MutableWorkflowContext {
  const nodeOutputs: Record<string, unknown> = { ...initial.nodeOutputs };
  const metadata: Record<string, unknown> = { ...initial.metadata };
  const executionPath: string[] = [...(initial.executionPath ?? [])];
  let loopState = initial.loopState ? { ...initial.loopState } : undefined;
  const signal = initial.signal;
  let currentNode = initial.currentNode;

  const ctx: MutableWorkflowContext = {
    nodeOutputs,
    metadata,
    executionPath,
    loopState,
    signal,
    currentNode,

    setNodeOutput(nodeName: string, output: unknown): void {
      nodeOutputs[nodeName] = output;
    },

    getNodeOutput<T = unknown>(nodeName: string): T | undefined {
      return nodeOutputs[nodeName] as T | undefined;
    },

    setMetadata(key: string, value: unknown): void {
      metadata[key] = value;
    },

    getMetadata<T = unknown>(key: string): T | undefined {
      return metadata[key] as T | undefined;
    },

    updateLoopState(updates: Partial<NonNullable<typeof loopState>>): void {
      if (!loopState) {
        loopState = {
          index: 0,
          iteration: 0,
          isFirst: true,
          isLast: false,
          ...updates,
        };
      } else {
        loopState = { ...loopState, ...updates };
      }
      ctx.loopState = loopState;
    },

    toContext(): WorkflowContext {
      const frozenOutputs = { ...nodeOutputs };
      return {
        nodeOutputs: frozenOutputs,
        metadata: { ...metadata },
        currentNode,
        executionPath: [...executionPath],
        loopState: loopState ? { ...loopState } : undefined,
        signal,

        getNodeOutput<T = unknown>(nodeName: string): T | undefined {
          return frozenOutputs[nodeName] as T | undefined;
        },
      };
    },
  };

  return ctx;
}

/**
 * Merge multiple contexts together
 */
export function mergeContexts(...contexts: Partial<WorkflowContext>[]): WorkflowContext {
  const nodeOutputs: Record<string, unknown> = {};
  const metadata: Record<string, unknown> = {};
  let executionPath: readonly string[] = [];
  let signal: AbortSignal | undefined;
  let currentNode: string | undefined;
  let loopState: WorkflowContext['loopState'];

  const merged: WorkflowContext = {
    nodeOutputs,
    metadata,
    executionPath,
    signal,

    getNodeOutput<T = unknown>(nodeName: string): T | undefined {
      return nodeOutputs[nodeName] as T | undefined;
    },
  };

  for (const ctx of contexts) {
    if (ctx.nodeOutputs) {
      Object.assign(merged.nodeOutputs, ctx.nodeOutputs);
    }
    if (ctx.metadata) {
      Object.assign(merged.metadata, ctx.metadata);
    }
    if (ctx.loopState) {
      (merged as { loopState?: typeof ctx.loopState }).loopState = { ...ctx.loopState };
    }
    if (ctx.signal) {
      (merged as { signal?: AbortSignal }).signal = ctx.signal;
    }
  }

  return merged;
}

/**
 * Clone a context (deep copy)
 */
export function cloneContext(ctx: WorkflowContext): WorkflowContext {
  const nodeOutputs = JSON.parse(JSON.stringify(ctx.nodeOutputs));

  return {
    nodeOutputs,
    metadata: JSON.parse(JSON.stringify(ctx.metadata)),
    currentNode: ctx.currentNode,
    executionPath: ctx.executionPath ? [...ctx.executionPath] : [],
    loopState: ctx.loopState ? { ...ctx.loopState } : undefined,
    signal: ctx.signal,

    getNodeOutput<T = unknown>(nodeName: string): T | undefined {
      return nodeOutputs[nodeName] as T | undefined;
    },
  };
}

/**
 * Create a child context that inherits from a parent
 */
export function createChildContext(
  parent: WorkflowContext,
  overrides: Partial<WorkflowContext> = {}
): WorkflowContext {
  const nodeOutputs = { ...parent.nodeOutputs, ...overrides.nodeOutputs };

  return {
    nodeOutputs,
    metadata: { ...parent.metadata, ...overrides.metadata },
    currentNode: overrides.currentNode ?? parent.currentNode,
    executionPath: overrides.executionPath ?? parent.executionPath,
    loopState: overrides.loopState ?? parent.loopState,
    signal: overrides.signal ?? parent.signal,

    getNodeOutput<T = unknown>(nodeName: string): T | undefined {
      return nodeOutputs[nodeName] as T | undefined;
    },
  };
}

/**
 * Extract a subset of node outputs from context
 */
export function extractNodeOutputs(
  ctx: WorkflowContext,
  nodeNames: string[]
): Record<string, unknown> {
  const outputs: Record<string, unknown> = {};

  for (const name of nodeNames) {
    if (name in ctx.nodeOutputs) {
      outputs[name] = ctx.nodeOutputs[name];
    }
  }

  return outputs;
}

/**
 * Check if a node has been executed (has output in context)
 */
export function hasNodeExecuted(ctx: WorkflowContext, nodeName: string): boolean {
  return nodeName in ctx.nodeOutputs;
}

/**
 * Get all executed node names from context
 */
export function getExecutedNodes(ctx: WorkflowContext): string[] {
  return Object.keys(ctx.nodeOutputs);
}

/**
 * Create an abort controller for workflow execution
 */
export function createWorkflowAbortController(): {
  controller: AbortController;
  abort: (reason?: string) => void;
  isAborted: () => boolean;
} {
  const controller = new AbortController();

  return {
    controller,
    abort: (reason?: string) => {
      controller.abort(reason);
    },
    isAborted: () => controller.signal.aborted,
  };
}

/**
 * Context accessor helper for accessing nested values safely
 */
export function createContextAccessor(ctx: WorkflowContext) {
  return {
    /**
     * Get a node output by name
     */
    output<T = unknown>(nodeName: string): T | undefined {
      return ctx.nodeOutputs[nodeName] as T | undefined;
    },

    /**
     * Get a nested value from a node output
     */
    outputPath<T = unknown>(nodeName: string, path: string): T | undefined {
      const output = ctx.nodeOutputs[nodeName];
      if (output === undefined) return undefined;

      const parts = path.split('.');
      let value: unknown = output;

      for (const part of parts) {
        if (value === null || value === undefined) return undefined;
        if (typeof value !== 'object') return undefined;
        value = (value as Record<string, unknown>)[part];
      }

      return value as T | undefined;
    },

    /**
     * Get metadata by key
     */
    meta<T = unknown>(key: string): T | undefined {
      return ctx.metadata[key] as T | undefined;
    },

    /**
     * Get current loop state
     */
    loop() {
      return ctx.loopState;
    },

    /**
     * Check if currently in a loop
     */
    inLoop(): boolean {
      return ctx.loopState !== undefined;
    },

    /**
     * Get the current loop index
     */
    loopIndex(): number {
      return ctx.loopState?.index ?? -1;
    },

    /**
     * Get the current loop value
     */
    loopValue<T = unknown>(): T | undefined {
      return ctx.loopState?.value as T | undefined;
    },
  };
}
