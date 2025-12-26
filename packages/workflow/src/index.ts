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
} from './types.js';

// Workflow factory
export { createWorkflow, WorkflowConfigError } from './workflow.js';

// Execution
export {
  executeWorkflow,
  executeWorkflowStream,
  createWorkflowExecutor,
  WorkflowExecutionError,
  WorkflowAbortError,
  WorkflowTimeoutError,
} from './execution.js';

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
} from './context.js';

// LLM Node
export { createLLMNode } from './nodes/llm-node.js';
export type { LLMNodeOutput } from './nodes/llm-node.js';

// Tool Node
export { createToolNode } from './nodes/tool-node.js';
export type { ToolNodeOutput } from './nodes/tool-node.js';

// Condition Node
export { createConditionNode, createSwitchNode } from './nodes/condition-node.js';
export type {
  ConditionNodeOutput,
  SwitchNodeConfig,
  SwitchNodeOutput,
} from './nodes/condition-node.js';

// Parallel Node
export { createParallelNode, createMapReduceNode } from './nodes/parallel-node.js';
export type { ParallelNodeOutput } from './nodes/parallel-node.js';

// Custom Node
export {
  createNode,
  createPassthroughNode,
  createTransformNode,
  createDelayNode,
  createLogNode,
  createValidationNode,
} from './nodes/custom-node.js';

// Loop Control
export {
  createLoopNode,
  createForEachNode,
  createReduceNode,
  breakLoop,
  continueLoop,
  LoopBreakSignal,
  LoopContinueSignal,
} from './loops.js';

export type { LoopState } from './loops.js';

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
} from './error-handler.js';

export type { RetryOptions } from './error-handler.js';
