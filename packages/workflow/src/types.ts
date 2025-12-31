/**
 * @seashore/workflow - Types
 *
 * Type definitions for workflow orchestration
 */

import type { ZodSchema } from 'zod';
import type {
  TextAdapter,
  TextAdapterConfig,
  OpenAIAdapterConfig,
  AnthropicAdapterConfig,
  GeminiAdapterConfig,
} from '@seashore/llm';

// Re-export adapter types for convenience
export type {
  TextAdapter,
  TextAdapterConfig,
  OpenAIAdapterConfig,
  AnthropicAdapterConfig,
  GeminiAdapterConfig,
};

/**
 * LLM adapter type: supports both TextAdapter objects and configuration objects
 *
 * @example Using a TextAdapter
 * ```typescript
 * adapter: openaiText('gpt-4o', { baseURL: 'https://api.example.com/v1' })
 * ```
 *
 * @example Using a config object (backward compatible)
 * ```typescript
 * adapter: { provider: 'openai', model: 'gpt-4o' }
 * ```
 */
export type LLMAdapter = TextAdapter | TextAdapterConfig;

/**
 * Tool interface (compatible with @seashore/tool)
 */
export interface Tool<TInput = unknown, TOutput = unknown> {
  readonly name: string;
  readonly description: string;
  execute(input: TInput): Promise<{ success: boolean; data?: TOutput; error?: string }>;
}

/**
 * Workflow configuration for createWorkflow
 */
export interface WorkflowConfig {
  /** Workflow name */
  readonly name: string;

  /** Workflow description */
  readonly description?: string;

  /** Workflow nodes (array format for creation) */
  readonly nodes: readonly WorkflowNode[];

  /** Edges connecting nodes */
  readonly edges: readonly Edge[];

  /** Entry/start node name (optional, defaults to first node without incoming edges) */
  readonly startNode?: string;

  /** Global timeout in milliseconds */
  readonly timeout?: number;

  /** Metadata */
  readonly metadata?: Record<string, unknown>;
}

/**
 * Edge between nodes
 */
export interface Edge {
  /** Source node name */
  readonly from: string;

  /** Target node name */
  readonly to: string;

  /** Optional condition for this edge */
  readonly condition?: (ctx: WorkflowContext) => boolean | Promise<boolean>;
}

/**
 * Loop configuration
 */
export interface LoopConfig {
  /** Nodes included in the loop */
  readonly nodes: readonly string[];

  /** Maximum iterations */
  readonly maxIterations: number;

  /** Exit condition */
  readonly exitCondition?: (ctx: WorkflowContext) => boolean | Promise<boolean>;
}

/**
 * Base workflow node interface
 */
export interface WorkflowNode<TInput = unknown, TOutput = unknown> {
  /** Node name */
  readonly name: string;

  /** Node type */
  readonly type?: NodeType;

  /** Execute the node */
  execute: (input: TInput, ctx: WorkflowContext) => Promise<TOutput>;

  /** Input schema for validation */
  readonly inputSchema?: ZodSchema;

  /** Output schema for validation */
  readonly outputSchema?: ZodSchema;
}

/**
 * Node types
 */
export type NodeType = 'llm' | 'tool' | 'condition' | 'parallel' | 'custom';

/**
 * LLM node configuration
 */
export interface LLMNodeConfig {
  /** Node name */
  readonly name: string;

  /**
   * LLM adapter
   *
   * Supports two forms:
   * 1. TextAdapter object (e.g., openaiText('gpt-4o', { baseURL, apiKey }))
   * 2. Config object (e.g., { provider: 'openai', model: 'gpt-4o' })
   */
  readonly adapter: LLMAdapter;

  /** Static prompt or dynamic prompt function */
  readonly prompt?: string | ((input: unknown, ctx: WorkflowContext) => string | Promise<string>);

  /** Messages builder */
  readonly messages?: (
    input: unknown,
    ctx: WorkflowContext
  ) => Array<{ role: string; content: string }>;

  /** System prompt */
  readonly systemPrompt?: string;

  /** Tools available to this node */
  readonly tools?: readonly Tool<unknown, unknown>[];

  /** Output schema for structured output */
  readonly outputSchema?: ZodSchema;

  /** Temperature */
  readonly temperature?: number;

  /** Max tokens */
  readonly maxTokens?: number;
}

/**
 * Tool node configuration
 */
export interface ToolNodeConfig<TToolInput = unknown, TToolOutput = unknown> {
  /** Node name */
  readonly name: string;

  /** Tool to execute */
  readonly tool: Tool<TToolInput, TToolOutput>;

  /** Input mapping function */
  readonly input?: (nodeInput: unknown, ctx: WorkflowContext) => TToolInput;

  /** Output transform function */
  readonly transform?: (result: TToolOutput) => unknown;
}

/**
 * Condition node configuration
 */
export interface ConditionNodeConfig {
  /** Node name */
  readonly name: string;

  /** Condition to evaluate */
  readonly condition: (ctx: WorkflowContext) => boolean | Promise<boolean>;

  /** Target node if true */
  readonly ifTrue: string;

  /** Target node if false */
  readonly ifFalse: string;
}

/**
 * Parallel node configuration
 */
export interface ParallelNodeConfig {
  /** Node name */
  readonly name: string;

  /** Branches to execute in parallel (static) */
  readonly branches?: readonly WorkflowNode[];

  /** Dynamic parallel - items generator */
  readonly forEach?: (input: unknown, ctx: WorkflowContext) => unknown[];

  /** Node to execute for each item (when using forEach) */
  readonly node?: WorkflowNode;

  /** Merge function for results */
  readonly merge?: (results: unknown[]) => unknown;

  /** Maximum concurrency */
  readonly maxConcurrency?: number;

  /** Failure policy */
  readonly failurePolicy?: 'all' | 'partial' | 'none';
}

/**
 * Custom node configuration
 */
export interface CustomNodeConfig<TInput = unknown, TOutput = unknown> {
  /** Node name */
  readonly name: string;

  /** Execution function */
  readonly execute: (input: TInput, ctx: WorkflowContext) => Promise<TOutput>;

  /** Input schema */
  readonly inputSchema?: ZodSchema;

  /** Output schema */
  readonly outputSchema?: ZodSchema;
}

/**
 * Workflow context available to nodes - mutable during execution
 */
export interface WorkflowContext {
  /** Node outputs collected during execution */
  readonly nodeOutputs: Record<string, unknown>;

  /** Custom metadata */
  readonly metadata: Record<string, unknown>;

  /** Current node being executed */
  readonly currentNode?: string;

  /** Execution path so far */
  readonly executionPath?: readonly string[];

  /** Loop state (if in a loop) */
  readonly loopState?: {
    readonly index: number;
    readonly iteration: number;
    readonly isFirst: boolean;
    readonly isLast: boolean;
    readonly value?: unknown;
    readonly accumulator?: unknown;
  };

  /** Abort signal */
  readonly signal?: AbortSignal;
}

/**
 * Mutable context for internal use during execution
 */
export interface MutableWorkflowContext {
  /** Node outputs */
  nodeOutputs: Record<string, unknown>;

  /** Metadata */
  metadata: Record<string, unknown>;

  /** Current node */
  currentNode?: string;

  /** Execution path */
  executionPath: string[];

  /** Loop state */
  loopState?: {
    index: number;
    iteration: number;
    isFirst: boolean;
    isLast: boolean;
    value?: unknown;
    accumulator?: unknown;
  };

  /** Signal */
  signal?: AbortSignal;

  /** Set node output */
  setNodeOutput(nodeName: string, output: unknown): void;

  /** Get node output */
  getNodeOutput<T = unknown>(nodeName: string): T | undefined;

  /** Set metadata */
  setMetadata(key: string, value: unknown): void;

  /** Get metadata */
  getMetadata<T = unknown>(key: string): T | undefined;

  /** Update loop state */
  updateLoopState(updates: Partial<NonNullable<MutableWorkflowContext['loopState']>>): void;

  /** Convert to immutable context */
  toContext(): WorkflowContext;
}

/**
 * Workflow execution result
 */
export interface WorkflowExecutionResult<TOutput = unknown> {
  /** Final output */
  readonly output: TOutput;

  /** Execution path taken */
  readonly nodeExecutionOrder: readonly string[];

  /** Node outputs */
  readonly nodeOutputs: Record<string, unknown>;

  /** Total duration in milliseconds */
  readonly durationMs: number;

  /** Workflow context at completion */
  readonly context?: WorkflowContext;
}

/**
 * Workflow execution options
 */
export interface WorkflowExecutionOptions {
  /** Timeout in milliseconds */
  readonly timeout?: number;

  /** Abort signal */
  readonly signal?: AbortSignal;

  /** Maximum iterations (for loop protection) */
  readonly maxIterations?: number;

  /** Initial metadata */
  readonly metadata?: Record<string, unknown>;

  /** Event callback */
  readonly onEvent?: (event: WorkflowEvent) => void;
}

/**
 * Workflow stream event types
 */
export type WorkflowEventType =
  | 'workflow_start'
  | 'node_start'
  | 'node_complete'
  | 'node_error'
  | 'workflow_complete'
  | 'workflow_error';

/**
 * Workflow stream event
 */
export interface WorkflowEvent {
  readonly type: WorkflowEventType;
  readonly timestamp: number;
  readonly data?: Record<string, unknown>;
}

/**
 * Workflow instance
 */
export interface Workflow<TInput = unknown, TOutput = unknown> {
  /** Workflow configuration */
  readonly config: WorkflowConfig;

  /** Execute the workflow */
  execute(
    input: TInput,
    options?: WorkflowExecutionOptions
  ): Promise<WorkflowExecutionResult<TOutput>>;

  /** Execute with streaming events */
  stream(
    input: TInput,
    options?: WorkflowExecutionOptions
  ): AsyncGenerator<WorkflowEvent, WorkflowExecutionResult<TOutput>, undefined>;
}
