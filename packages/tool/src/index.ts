/**
 * @seashore/tool
 *
 * Type-safe tool definitions for Seashore Agent Framework
 */

// Types
export type {
  Tool,
  ToolConfig,
  ToolContext,
  ToolResult,
  RetryConfig,
  JsonSchema,
  JsonSchemaProperty,
  ToolCallRequest,
  ToolCallResponse,
} from './types.js';

// Core
export { defineTool } from './define-tool.js';
export { zodToJsonSchema } from './zod-to-json-schema.js';

// Validation
export {
  withValidation,
  ValidationError,
  composeValidators,
  createValidator,
  sanitizeString,
  sanitizeObject,
  type ValidationIssue,
  type ValidationMiddlewareOptions,
} from './validation.js';

// Client-side tools
export {
  defineClientTool,
  isClientTool,
  type ClientTool,
  type ClientToolConfig,
  type ClientToolPending,
} from './client-tool.js';

// Approval handling
export {
  withApproval,
  createMemoryApprovalHandler,
  createAutoApprovalHandler,
  inferRiskLevel,
  type ApprovalRequest,
  type ApprovalResponse,
  type ApprovalHandler,
  type ApprovalConfig,
} from './approval.js';

// Presets
export { serperTool, type SerperConfig, type SerperResult } from './presets/serper.js';
export { firecrawlTool, type FirecrawlConfig, type FirecrawlResult } from './presets/firecrawl.js';
