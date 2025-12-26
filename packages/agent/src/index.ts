/**
 * @seashore/agent
 *
 * ReAct and Workflow agents for Seashore Agent Framework
 */

// Types
export type {
  Agent,
  AgentConfig,
  AgentRunResult,
  AgentStreamChunk,
  AgentStreamChunkType,
  RunOptions,
  ToolCallRecord,
  AgentToolContext,
} from './types.js';

// Agent creation
export { createAgent } from './create-agent.js';

// ReAct agent (direct export for advanced use)
export { createAgent as createReActAgent } from './react-agent.js';

// Tool execution
export {
  executeTool,
  executeTools,
  formatToolResult,
  type ToolCallRequest,
} from './tool-executor.js';

// Error handling
export {
  AgentError,
  type AgentErrorCode,
  isRetryableError,
  withRetry,
  type RetryConfig,
  DEFAULT_RETRY_CONFIG,
  checkAborted,
  wrapError,
} from './error-handler.js';

// Streaming utilities
export { collectStream, StreamChunks, streamToReadable, parseSSEStream } from './stream.js';

// Workflow agent integration
export {
  createWorkflowAgent,
  createAgentNode,
  composeAgents,
  type WorkflowAgentConfig,
  type WorkflowAgentInput,
  type WorkflowAgentOutput,
} from './workflow-agent.js';
