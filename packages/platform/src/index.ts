/**
 * @seashore/platform
 *
 * Platform utilities for Seashore - MCP, Security, Evaluation, and Deployment
 */

// MCP - Model Context Protocol integration
export { connectMCP, convertMCPToolToTanstack } from './mcp/index.js'
export type { MCPConnectionConfig } from './mcp/index.js'

// Security - Guardrails for input/output filtering
export { createGuardrail, createLLMGuardrail } from './security/index.js'
export type {
  Guardrail,
  GuardrailResult,
  GuardrailConfig,
  LLMGuardrailConfig,
} from './security/index.js'

// Evaluation - Metrics and test suites
export { createMetric, createLLMJudgeMetric, createEvalSuite } from './eval/index.js'
export type {
  EvalMetric,
  DatasetEntry,
  EvalSuiteConfig,
  EvalResults,
  RunnableAgent,
  MetricConfig,
  LLMJudgeMetricConfig,
} from './eval/index.js'

// Deploy - Hono middleware for production deployment
export { seashoreMiddleware } from './deploy/index.js'
export type { SeashoreMiddlewareConfig } from './deploy/index.js'

