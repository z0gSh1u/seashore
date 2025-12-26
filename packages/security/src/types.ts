/**
 * Security types
 * @module @seashore/security
 */

/**
 * Text adapter interface for LLM-based checks
 */
export interface TextAdapter {
  generate(prompt: string): Promise<string>;
}

/**
 * Violation severity levels
 */
export type ViolationSeverity = 'low' | 'medium' | 'high' | 'critical';

/**
 * Violation details
 */
export interface Violation {
  /** Rule name that triggered the violation */
  rule: string;
  /** Severity level */
  severity: ViolationSeverity;
  /** Human-readable message */
  message: string;
  /** Additional details */
  details?: Record<string, unknown>;
  /** Position in content */
  position?: {
    start: number;
    end: number;
  };
}

/**
 * Result of a security check
 */
export interface SecurityCheckResult {
  /** Whether the check passed */
  passed: boolean;
  /** Transformed output (if any) */
  output?: string;
  /** Whether content was transformed */
  transformed?: boolean;
  /** List of violations found */
  violations: Violation[];
}

/**
 * Security rule interface
 */
export interface SecurityRule {
  /** Rule name */
  name: string;
  /** Rule description */
  description: string;
  /** Where this rule applies */
  type: 'input' | 'output' | 'both';

  /**
   * Check content against this rule
   */
  check(
    content: string,
    context?: {
      llmAdapter?: TextAdapter;
      metadata?: Record<string, unknown>;
    }
  ): Promise<SecurityCheckResult>;
}

/**
 * Action to take on violation
 */
export type ViolationAction = 'block' | 'warn' | 'log';

/**
 * PII action type
 */
export type PIIAction = 'block' | 'redact' | 'warn';

/**
 * Length limit action type
 */
export type LengthAction = 'block' | 'truncate' | 'warn';

/**
 * Guardrails configuration
 */
export interface GuardrailsConfig {
  /** LLM adapter for LLM-based checks */
  llmAdapter?: TextAdapter;
  /** Rules for input validation */
  inputRules: SecurityRule[];
  /** Rules for output validation */
  outputRules: SecurityRule[];
  /** Default action on violation */
  onViolation?: ViolationAction;
}

/**
 * Guardrails interface
 */
export interface Guardrails {
  /** Check input content */
  checkInput(content: string): Promise<SecurityCheckResult>;
  /** Check output content */
  checkOutput(content: string): Promise<SecurityCheckResult>;
  /** Batch check inputs */
  checkInputBatch(contents: string[]): Promise<SecurityCheckResult[]>;
  /** Batch check outputs */
  checkOutputBatch(contents: string[]): Promise<SecurityCheckResult[]>;
}

/**
 * Input filter interface
 */
export interface InputFilter {
  /** Filter content */
  filter(content: string): Promise<SecurityCheckResult>;
  /** Batch filter */
  filterBatch(contents: string[]): Promise<SecurityCheckResult[]>;
}

/**
 * Output filter interface
 */
export interface OutputFilter {
  /** Filter content */
  filter(content: string): Promise<SecurityCheckResult>;
  /** Batch filter */
  filterBatch(contents: string[]): Promise<SecurityCheckResult[]>;
}

/**
 * Security rule configuration base
 */
export interface SecurityRuleConfig {
  /** Rule name */
  name: string;
  /** Rule description */
  description: string;
  /** Rule type */
  type: 'input' | 'output' | 'both';
}

/**
 * Rule-based security rule config
 */
export interface RuleBasedSecurityRuleConfig extends SecurityRuleConfig {
  /** Check function */
  check: (content: string) => Promise<SecurityCheckResult>;
}

/**
 * LLM-based security rule config
 */
export interface LLMSecurityRuleConfig extends SecurityRuleConfig {
  /** LLM check configuration */
  llmCheck: {
    /** Prompt template with {content} placeholder */
    prompt: string;
    /** Parse LLM response */
    parseResponse: (response: string) => SecurityCheckResult;
  };
}
