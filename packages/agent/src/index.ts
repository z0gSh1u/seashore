/**
 * @seashore/agent
 *
 * Agent framework for Seashore. Provides:
 * - Workflow orchestration (DAG-based multi-step execution)
 * - ReAct agents (reasoning + acting with tools)
 * - Workflow agents (wrap workflows as agent interfaces)
 */

// Workflow
export { createWorkflow, createStep, DAG } from './workflow/index.js'
export type {
  StepConfig,
  StepEdgeConfig,
  WorkflowContext,
  WorkflowResult,
  WorkflowStatus,
  RetryPolicy,
  PendingWorkflow,
  HumanInputRequest,
  HumanInputResponse,
} from './workflow/index.js'

// ReAct Agent
export { createReActAgent } from './react-agent/index.js'
export type {
  ReActAgentConfig,
  ReActAgent,
  RunOptions,
  Guardrail,
  BeforeRequestHook,
  AfterResponseHook,
  Message,
  AgentResult,
  AgentResponse,
  StreamingAgentResponse,
  Tool,
  ToolCall,
} from './react-agent/index.js'

// Workflow Agent
export { createWorkflowAgent } from './workflow-agent/index.js'
export type { WorkflowAgentConfig, WorkflowAgent } from './workflow-agent/index.js'
