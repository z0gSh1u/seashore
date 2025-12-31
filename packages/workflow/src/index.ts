/**
 * @seashore/workflow - Main Entry Point
 *
 * A workflow orchestration library for building multi-step AI workflows
 */

// Types
export type {
  // Core types
  WorkflowConfig,
  Workflow,
  WorkflowNode,
  Edge,
  LoopConfig,
  WorkflowContext,
  MutableWorkflowContext,
  WorkflowExecutionResult,
  WorkflowExecutionOptions,
  WorkflowEvent,
  WorkflowEventType,
  // Node configs
  NodeType,
  LLMNodeConfig,
  ToolNodeConfig,
  ConditionNodeConfig,
  ParallelNodeConfig,
  CustomNodeConfig,
  // Adapter types
  LLMAdapter,
  TextAdapter,
  TextAdapterConfig,
  OpenAIAdapterConfig,
  AnthropicAdapterConfig,
  GeminiAdapterConfig,
} from './types';

// Workflow factory
export { createWorkflow, WorkflowConfigError } from './workflow';

// Execution
export {
  executeWorkflow,
  executeWorkflowStream,
  createWorkflowExecutor,
  WorkflowExecutionError,
  WorkflowAbortError,
  WorkflowTimeoutError,
} from './execution';

// Context management
export {
  createWorkflowContext,
  createMutableWorkflowContext,
  mergeContexts,
  cloneContext,
  createChildContext,
  extractNodeOutputs,
  hasNodeExecuted,
  getExecutedNodes,
  createWorkflowAbortController,
  createContextAccessor,
} from './context';

// LLM Node
export { createLLMNode } from './nodes/llm-node';
export type { LLMNodeOutput } from './nodes/llm-node';

// Tool Node
export { createToolNode } from './nodes/tool-node';
export type { ToolNodeOutput } from './nodes/tool-node';

// Condition Node
export { createConditionNode, createSwitchNode } from './nodes/condition-node';
export type {
  ConditionNodeOutput,
  SwitchNodeConfig,
  SwitchNodeOutput,
} from './nodes/condition-node';

// Parallel Node
export { createParallelNode, createMapReduceNode } from './nodes/parallel-node';
export type { ParallelNodeOutput } from './nodes/parallel-node';

// Custom Node
export {
  createNode,
  createPassthroughNode,
  createTransformNode,
  createDelayNode,
  createLogNode,
  createValidationNode,
} from './nodes/custom-node';

// Loop Control
export {
  createLoopNode,
  createForEachNode,
  createReduceNode,
  breakLoop,
  continueLoop,
  LoopBreakSignal,
  LoopContinueSignal,
} from './loops';

export type { LoopState } from './loops';

// Error Handling
export {
  WorkflowError,
  NodeExecutionError,
  ValidationError,
  withRetry,
  withFallback,
  withErrorTransform,
  withTimeout,
  createCircuitBreaker,
  catchError,
} from './error-handler';

export type { RetryOptions } from './error-handler';
