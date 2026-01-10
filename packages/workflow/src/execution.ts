/**
 * @seashore/workflow - Execution Engine
 *
 * Core workflow execution logic with token-level streaming support
 */

import type {
  Workflow,
  WorkflowConfig,
  WorkflowContext,
  WorkflowNode,
  Edge,
  WorkflowEvent,
  WorkflowExecutionOptions,
  WorkflowExecutionResult,
  StreamingWorkflowContext,
  LLMTokenEventData,
} from './types';
import { createMutableWorkflowContext } from './context';

/**
 * Workflow execution error
 */
export class WorkflowExecutionError extends Error {
  constructor(
    message: string,
    public readonly nodeName: string,
    public readonly cause?: Error,
    public readonly context?: Partial<WorkflowContext>
  ) {
    super(message);
    this.name = 'WorkflowExecutionError';
  }
}

/**
 * Workflow abort error
 */
export class WorkflowAbortError extends Error {
  constructor(
    message: string = 'Workflow execution aborted',
    public readonly context?: Partial<WorkflowContext>
  ) {
    super(message);
    this.name = 'WorkflowAbortError';
  }
}

/**
 * Workflow timeout error
 */
export class WorkflowTimeoutError extends Error {
  constructor(
    message: string = 'Workflow execution timed out',
    public readonly nodeName?: string,
    public readonly context?: Partial<WorkflowContext>
  ) {
    super(message);
    this.name = 'WorkflowTimeoutError';
  }
}

/**
 * Find the next nodes to execute based on edges
 */
function findNextNodes(
  currentNodeName: string,
  edges: readonly Edge[],
  nodes: readonly WorkflowNode[],
  context: WorkflowContext
): WorkflowNode[] {
  const outgoingEdges = edges.filter((edge) => edge.from === currentNodeName);

  if (outgoingEdges.length === 0) {
    return [];
  }

  const nodeMap = new Map(nodes.map((n) => [n.name, n]));
  const nextNodes: WorkflowNode[] = [];

  for (const edge of outgoingEdges) {
    // Check edge condition if present
    if (edge.condition && !edge.condition(context)) {
      continue;
    }

    const targetNode = nodeMap.get(edge.to);
    if (targetNode) {
      nextNodes.push(targetNode);
    }
  }

  return nextNodes;
}

/**
 * Get the start node of a workflow
 */
function getStartNode(config: WorkflowConfig): WorkflowNode {
  const startNodeName =
    config.startNode ?? config.nodes.find((n) => !config.edges.some((e) => e.to === n.name))?.name;

  if (!startNodeName) {
    throw new WorkflowExecutionError('Could not determine start node', 'unknown');
  }

  const startNode = config.nodes.find((n) => n.name === startNodeName);
  if (!startNode) {
    throw new WorkflowExecutionError(`Start node "${startNodeName}" not found`, startNodeName);
  }

  return startNode;
}

/**
 * Execute a single node with timeout support
 */
async function executeNode(
  node: WorkflowNode,
  input: unknown,
  context: WorkflowContext,
  timeout?: number
): Promise<unknown> {
  if (context.signal?.aborted) {
    throw new WorkflowAbortError('Workflow aborted before node execution', context);
  }

  const executePromise = node.execute(input, context);

  if (!timeout) {
    return executePromise;
  }

  return Promise.race([
    executePromise,
    new Promise((_, reject) =>
      setTimeout(
        () => reject(new WorkflowTimeoutError(`Node "${node.name}" timed out`, node.name, context)),
        timeout
      )
    ),
  ]);
}

/**
 * Execute a workflow with the given input
 */
export async function executeWorkflow<TInput = unknown, TOutput = unknown>(
  workflow: Workflow<TInput, TOutput>,
  input: TInput,
  options: WorkflowExecutionOptions = {}
): Promise<WorkflowExecutionResult<TOutput>> {
  const { signal, timeout, maxIterations = 1000, onEvent } = options;
  const config = workflow.config;
  const startTime = Date.now();

  // Create mutable context
  const mutableContext = createMutableWorkflowContext({
    nodeOutputs: {},
    metadata: {
      startTime,
      workflowName: config.name,
      ...options.metadata,
    },
    signal,
  });

  // Set up abort handling
  let abortPromise: Promise<never> | null = null;
  if (signal) {
    abortPromise = new Promise<never>((_, reject) => {
      if (signal.aborted) {
        reject(new WorkflowAbortError('Workflow execution aborted', mutableContext.toContext()));
        return;
      }
      signal.addEventListener(
        'abort',
        () => {
          reject(new WorkflowAbortError('Workflow execution aborted', mutableContext.toContext()));
        },
        { once: true }
      );
    });
  }

  // Emit workflow start event
  onEvent?.({
    type: 'workflow_start',
    timestamp: Date.now(),
    data: { input },
  });

  const nodeExecutionOrder: string[] = [];
  let iterations = 0;
  let currentOutput: unknown = input;

  try {
    // Get the start node
    let currentNodes = [getStartNode(config)];

    while (currentNodes.length > 0 && iterations < maxIterations) {
      iterations++;

      // Check for abort
      if (signal?.aborted) {
        throw new WorkflowAbortError('Workflow execution aborted', mutableContext.toContext());
      }

      // Check for timeout
      if (timeout && Date.now() - startTime > timeout) {
        throw new WorkflowTimeoutError(
          'Workflow execution timed out',
          undefined,
          mutableContext.toContext()
        );
      }

      // Execute current nodes (could be multiple for parallel execution)
      const nodeExecutionPromise = Promise.all(
        currentNodes.map(async (node) => {
          const nodeInput = mutableContext.getNodeOutput(node.name + '_input') ?? currentOutput;

          // Emit node start event
          onEvent?.({
            type: 'node_start',
            timestamp: Date.now(),
            data: { nodeName: node.name, input: nodeInput },
          });

          try {
            const ctx = mutableContext.toContext();
            const output = await executeNode(
              node,
              nodeInput,
              { ...ctx, currentNode: node.name },
              timeout ? timeout - (Date.now() - startTime) : undefined
            );

            // Store output in context
            mutableContext.setNodeOutput(node.name, output);
            mutableContext.executionPath.push(node.name);
            nodeExecutionOrder.push(node.name);

            // Emit node complete event
            onEvent?.({
              type: 'node_complete',
              timestamp: Date.now(),
              data: { nodeName: node.name, output },
            });

            return { node, output, error: null };
          } catch (error) {
            // Emit node error event
            onEvent?.({
              type: 'node_error',
              timestamp: Date.now(),
              data: { nodeName: node.name, error },
            });

            throw error;
          }
        })
      );

      // Race with abort promise if available
      const nodeResults = await (abortPromise
        ? Promise.race([nodeExecutionPromise, abortPromise])
        : nodeExecutionPromise);

      // Get the last output as current output
      if (nodeResults.length > 0) {
        const lastResult = nodeResults[nodeResults.length - 1];
        if (lastResult) {
          currentOutput = lastResult.output;
        }
      }

      // Find next nodes to execute
      const nextNodesSet = new Set<WorkflowNode>();
      for (const result of nodeResults) {
        const nextNodes = findNextNodes(
          result.node.name,
          config.edges,
          config.nodes,
          mutableContext.toContext()
        );
        for (const node of nextNodes) {
          nextNodesSet.add(node);
        }
      }
      currentNodes = Array.from(nextNodesSet);
    }

    if (iterations >= maxIterations) {
      throw new WorkflowExecutionError(
        `Maximum iterations (${maxIterations}) exceeded`,
        'unknown',
        undefined,
        mutableContext.toContext()
      );
    }

    // Emit workflow complete event
    onEvent?.({
      type: 'workflow_complete',
      timestamp: Date.now(),
      data: { output: currentOutput },
    });

    const nodeOutputs = { ...mutableContext.nodeOutputs };

    return {
      output: currentOutput as TOutput,
      nodeOutputs,
      nodeExecutionOrder,
      durationMs: Date.now() - startTime,
      context: mutableContext.toContext(),

      getNodeOutput<T = unknown>(nodeName: string): T | undefined {
        return nodeOutputs[nodeName] as T | undefined;
      },
    };
  } catch (error) {
    // Emit workflow error event
    onEvent?.({
      type: 'workflow_error',
      timestamp: Date.now(),
      data: { error },
    });

    if (
      error instanceof WorkflowExecutionError ||
      error instanceof WorkflowAbortError ||
      error instanceof WorkflowTimeoutError
    ) {
      throw error;
    }

    throw new WorkflowExecutionError(
      `Workflow execution failed: ${error instanceof Error ? error.message : String(error)}`,
      'unknown',
      error instanceof Error ? error : undefined,
      mutableContext.toContext()
    );
  }
}

/**
 * Execute a workflow with true streaming events (including token-level streaming)
 *
 * This function yields events in real-time as they occur, including:
 * - workflow_start / workflow_complete / workflow_error
 * - node_start / node_complete / node_error
 * - llm_token (for LLM nodes, yields each token as it's generated)
 */
export async function* executeWorkflowStream<TInput = unknown, TOutput = unknown>(
  workflow: Workflow<TInput, TOutput>,
  input: TInput,
  options: Omit<WorkflowExecutionOptions, 'onEvent'> = {}
): AsyncGenerator<WorkflowEvent, WorkflowExecutionResult<TOutput>, undefined> {
  const { signal, timeout, maxIterations = 1000 } = options;
  const config = workflow.config;
  const startTime = Date.now();

  // Event queue for async yielding
  const eventQueue: WorkflowEvent[] = [];
  let resolveNextEvent: (() => void) | null = null;

  // Push event to queue and notify
  const pushEvent = (event: WorkflowEvent) => {
    eventQueue.push(event);
    if (resolveNextEvent) {
      resolveNextEvent();
      resolveNextEvent = null;
    }
  };

  // Wait for next event
  const waitForEvent = (): Promise<void> => {
    if (eventQueue.length > 0) {
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      resolveNextEvent = resolve;
    });
  };

  // Create mutable context
  const mutableContext = createMutableWorkflowContext({
    nodeOutputs: {},
    metadata: {
      startTime,
      workflowName: config.name,
      ...options.metadata,
    },
    signal,
  });

  // Track execution state
  const nodeExecutionOrder: string[] = [];
  let currentOutput: unknown = input;
  let executionError: Error | null = null;
  let executionComplete = false;

  // Start async execution
  const executionPromise = (async () => {
    try {
      // Emit workflow start event
      pushEvent({
        type: 'workflow_start',
        timestamp: Date.now(),
        data: { input },
      });

      // Get the start node
      let currentNodes = [getStartNode(config)];
      let iterations = 0;

      while (currentNodes.length > 0 && iterations < maxIterations) {
        iterations++;

        // Check for abort
        if (signal?.aborted) {
          throw new WorkflowAbortError('Workflow execution aborted', mutableContext.toContext());
        }

        // Check for timeout
        if (timeout && Date.now() - startTime > timeout) {
          throw new WorkflowTimeoutError(
            'Workflow execution timed out',
            undefined,
            mutableContext.toContext()
          );
        }

        // Execute current nodes
        for (const node of currentNodes) {
          const nodeInput = mutableContext.getNodeOutput(node.name + '_input') ?? currentOutput;

          // Emit node start event
          pushEvent({
            type: 'node_start',
            timestamp: Date.now(),
            data: { nodeName: node.name, input: nodeInput },
          });

          try {
            // Create streaming context with token callback
            const baseCtx = mutableContext.toContext();
            const streamingCtx: StreamingWorkflowContext = {
              ...baseCtx,
              currentNode: node.name,
              onToken: (tokenData: LLMTokenEventData) => {
                pushEvent({
                  type: 'llm_token',
                  timestamp: Date.now(),
                  data: tokenData as unknown as Record<string, unknown>,
                });
              },
            };

            const output = await executeNode(
              node,
              nodeInput,
              streamingCtx,
              timeout ? timeout - (Date.now() - startTime) : undefined
            );

            // Store output in context
            mutableContext.setNodeOutput(node.name, output);
            mutableContext.executionPath.push(node.name);
            nodeExecutionOrder.push(node.name);
            currentOutput = output;

            // Emit node complete event
            pushEvent({
              type: 'node_complete',
              timestamp: Date.now(),
              data: { nodeName: node.name, output },
            });
          } catch (error) {
            // Emit node error event
            pushEvent({
              type: 'node_error',
              timestamp: Date.now(),
              data: { nodeName: node.name, error },
            });

            throw error;
          }
        }

        // Find next nodes to execute
        const nextNodesSet = new Set<WorkflowNode>();
        for (const executedNode of currentNodes) {
          const nextNodes = await findNextNodesAsync(
            executedNode.name,
            config,
            mutableContext.toContext()
          );
          for (const n of nextNodes) {
            nextNodesSet.add(n);
          }
        }

        currentNodes = Array.from(nextNodesSet);
      }

      // Emit workflow complete event
      pushEvent({
        type: 'workflow_complete',
        timestamp: Date.now(),
        data: { output: currentOutput },
      });
    } catch (error) {
      executionError = error as Error;

      // Emit workflow error event
      pushEvent({
        type: 'workflow_error',
        timestamp: Date.now(),
        data: { error },
      });
    } finally {
      executionComplete = true;
      // Push a null to signal completion
      if (resolveNextEvent) {
        resolveNextEvent();
        resolveNextEvent = null;
      }
    }
  })();

  // Yield events as they arrive
  while (!executionComplete || eventQueue.length > 0) {
    if (eventQueue.length === 0) {
      await waitForEvent();
    }

    while (eventQueue.length > 0) {
      const event = eventQueue.shift()!;
      yield event;
    }
  }

  // Wait for execution to fully complete
  await executionPromise;

  // Throw error if execution failed
  if (executionError) {
    if (
      executionError instanceof WorkflowExecutionError ||
      executionError instanceof WorkflowAbortError ||
      executionError instanceof WorkflowTimeoutError
    ) {
      throw executionError;
    }

    throw new WorkflowExecutionError(
      executionError.message,
      mutableContext.currentNode || 'unknown',
      executionError,
      mutableContext.toContext()
    );
  }

  const nodeOutputs = { ...mutableContext.nodeOutputs };

  return {
    output: currentOutput as TOutput,
    nodeOutputs,
    nodeExecutionOrder,
    durationMs: Date.now() - startTime,
    context: mutableContext.toContext(),

    getNodeOutput<T = unknown>(nodeName: string): T | undefined {
      return nodeOutputs[nodeName] as T | undefined;
    },
  };
}

/**
 * Helper to find next nodes with async condition evaluation
 */
async function findNextNodesAsync(
  nodeName: string,
  config: WorkflowConfig,
  context: WorkflowContext
): Promise<WorkflowNode[]> {
  const edges = config.edges.filter((e) => e.from === nodeName);
  const nextNodes: WorkflowNode[] = [];

  for (const edge of edges) {
    // Check condition if present
    if (edge.condition) {
      const shouldFollow = await Promise.resolve(edge.condition(context));
      if (!shouldFollow) {
        continue;
      }
    }

    const node = config.nodes.find((n) => n.name === edge.to);
    if (node) {
      nextNodes.push(node);
    }
  }

  return nextNodes;
}

/**
 * Create a workflow executor with default options
 */
export function createWorkflowExecutor<TInput = unknown, TOutput = unknown>(
  workflow: Workflow<TInput, TOutput>,
  defaultOptions: WorkflowExecutionOptions = {}
) {
  return {
    /**
     * Execute the workflow with merged options
     */
    async execute(
      input: TInput,
      options: WorkflowExecutionOptions = {}
    ): Promise<WorkflowExecutionResult<TOutput>> {
      return executeWorkflow(workflow, input, { ...defaultOptions, ...options });
    },

    /**
     * Execute the workflow with streaming events
     */
    executeStream(
      input: TInput,
      options: Omit<WorkflowExecutionOptions, 'onEvent'> = {}
    ): AsyncGenerator<WorkflowEvent, WorkflowExecutionResult<TOutput>, undefined> {
      return executeWorkflowStream(workflow, input, { ...defaultOptions, ...options });
    },

    /**
     * Get the workflow configuration
     */
    get config(): WorkflowConfig {
      return workflow.config;
    },
  };
}
