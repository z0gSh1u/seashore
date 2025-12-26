/**
 * @seashore/security
 * Security guardrails and content filtering package
 * @module @seashore/security
 */

// Types
export type {
  SecurityRule,
  SecurityCheckResult,
  Violation,
  ViolationSeverity,
  ViolationAction,
  PIIAction,
  LengthAction,
  Guardrails,
  GuardrailsConfig,
  InputFilter,
  OutputFilter,
  TextAdapter,
  SecurityRuleConfig,
  RuleBasedSecurityRuleConfig,
  LLMSecurityRuleConfig,
} from './types.js';

// Guardrails
export { createGuardrails } from './guardrails.js';

// Filters
export { createInputFilter, createOutputFilter, type FilterConfig } from './filters.js';

// Rules
export {
  promptInjectionRule,
  piiDetectionRule,
  toxicityRule,
  topicBlockRule,
  lengthLimitRule,
  createSecurityRule,
  type PromptInjectionRuleConfig,
  type PIIDetectionRuleConfig,
  type ToxicityRuleConfig,
  type TopicBlockRuleConfig,
  type LengthLimitRuleConfig,
} from './rules.js';

// Middleware
export {
  securityMiddleware,
  type SecurityMiddlewareConfig,
  type SecurityMiddlewareFn,
  type InputViolationResult,
  type OutputViolationResult,
  type MiddlewareResult,
} from './middleware.js';
