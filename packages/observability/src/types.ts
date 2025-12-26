/**
 * Observability type definitions
 * @module @seashore/observability
 */

/**
 * Span type for categorizing operations
 */
export type SpanType = 'llm' | 'tool' | 'agent' | 'workflow' | 'custom';

/**
 * Span status codes
 */
export type SpanStatus = 'unset' | 'ok' | 'error';

/**
 * Span context for propagation
 */
export interface SpanContext {
  /** Trace ID */
  traceId: string;
  /** Span ID */
  spanId: string;
  /** Trace flags */
  traceFlags?: number;
}

/**
 * Span attributes
 */
export type SpanAttributes = Record<string, string | number | boolean | undefined>;

/**
 * Span event
 */
export interface SpanEvent {
  /** Event name */
  name: string;
  /** Event timestamp */
  timestamp: Date;
  /** Event attributes */
  attributes?: SpanAttributes;
}

/**
 * Token usage statistics
 */
export interface TokenUsage {
  /** Tokens in prompt */
  promptTokens: number;
  /** Tokens in completion */
  completionTokens: number;
  /** Total tokens */
  totalTokens: number;
}

/**
 * Span interface
 */
export interface Span {
  /** Span name */
  name: string;
  /** Span type */
  type: SpanType;
  /** Span context */
  context: SpanContext;
  /** Parent span context */
  parentContext?: SpanContext;
  /** Span attributes */
  attributes: SpanAttributes;
  /** Span events */
  events: SpanEvent[];
  /** Span status */
  status: { code: SpanStatus; message?: string };
  /** Start time */
  startTime: Date;
  /** End time */
  endTime?: Date;
  /** Duration in milliseconds */
  durationMs?: number;
  /** Token usage (for LLM spans) */
  tokenUsage?: TokenUsage;

  /** Set span attributes */
  setAttributes(attributes: SpanAttributes): void;
  /** Set span status */
  setStatus(status: { code: SpanStatus; message?: string }): void;
  /** Add an event */
  addEvent(name: string, attributes?: SpanAttributes): void;
  /** Record an exception */
  recordException(error: Error): void;
  /** End the span */
  end(): void;
  /** Check if span is recording */
  isRecording(): boolean;
}

/**
 * Trace event for export
 */
export interface TraceEvent {
  /** Trace ID */
  traceId: string;
  /** Span ID */
  spanId: string;
  /** Parent span ID */
  parentSpanId?: string;
  /** Operation name */
  name: string;
  /** Span type */
  type: SpanType;
  /** Span attributes */
  attributes: SpanAttributes;
  /** Events */
  events: SpanEvent[];
  /** Status */
  status: { code: SpanStatus; message?: string };
  /** Start time (ISO string) */
  startTime: string;
  /** End time (ISO string) */
  endTime?: string;
  /** Duration in ms */
  durationMs?: number;
  /** Token usage */
  tokenUsage?: TokenUsage;
}

/**
 * Tracer configuration
 */
export interface TracerConfig {
  /** Service name */
  serviceName: string;
  /** Sampling rate (0-1) */
  samplingRate?: number;
  /** Storage configuration */
  storage?: {
    type: 'postgres' | 'memory';
    db?: unknown;
  };
  /** Exporters */
  exporters?: ExporterConfig[];
}

/**
 * Exporter configuration
 */
export type ExporterConfig =
  | { type: 'console' }
  | { type: 'otlp'; endpoint: string; headers?: Record<string, string> };

/**
 * Tracer interface
 */
export interface Tracer {
  /** Service name */
  serviceName: string;
  /** Start a new span */
  startSpan(name: string, options?: StartSpanOptions): Span;
  /** Execute function with automatic span management */
  withSpan<T>(name: string, fn: (span: Span) => Promise<T>, options?: StartSpanOptions): Promise<T>;
  /** Get active span context */
  getActiveContext(): SpanContext | undefined;
  /** Execute function with specific context */
  withContext<T>(context: SpanContext, fn: () => Promise<T>): Promise<T>;
  /** Flush pending spans */
  flush(): Promise<void>;
  /** Shutdown tracer */
  shutdown(): Promise<void>;
}

/**
 * Options for starting a span
 */
export interface StartSpanOptions {
  /** Span type */
  type?: SpanType;
  /** Parent context */
  parentContext?: SpanContext;
  /** Initial attributes */
  attributes?: SpanAttributes;
}

/**
 * Token counter configuration
 */
export interface TokenCounterConfig {
  /** Default encoding name */
  defaultEncoding?: string;
  /** Model to encoding mapping */
  modelEncodings?: Record<string, string>;
}

/**
 * Token counter interface
 */
export interface TokenCounter {
  /** Count tokens in text */
  count(text: string, options?: { model?: string }): number;
  /** Count tokens in messages */
  countMessages(
    messages: { role: string; content: string }[],
    options?: { model?: string }
  ): number;
  /** Count tokens in multiple texts */
  countBatch(texts: string[], options?: { model?: string }): number[];
  /** Count total tokens in multiple texts */
  countTotal(texts: string[], options?: { model?: string }): number;
  /** Estimate cost */
  estimateCost(usage: TokenUsage & { model: string }): number;
}

/**
 * Log level
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * Log entry
 */
export interface LogEntry {
  /** Log level */
  level: LogLevel;
  /** Log message */
  message: string;
  /** Timestamp */
  timestamp: Date;
  /** Additional data */
  data?: Record<string, unknown>;
  /** Span context */
  spanContext?: SpanContext;
}

/**
 * Logger configuration
 */
export interface LoggerConfig {
  /** Logger name */
  name: string;
  /** Minimum log level */
  level?: LogLevel;
  /** Output format */
  format?: 'json' | 'pretty';
  /** Transports */
  transports?: LogTransportConfig[];
}

/**
 * Log transport configuration
 */
export type LogTransportConfig = { type: 'console' } | { type: 'file'; path: string };

/**
 * Logger interface
 */
export interface Logger {
  /** Logger name */
  name: string;
  /** Log debug message */
  debug(message: string, data?: Record<string, unknown>): void;
  /** Log info message */
  info(message: string, data?: Record<string, unknown>): void;
  /** Log warning message */
  warn(message: string, data?: Record<string, unknown>): void;
  /** Log error message */
  error(message: string, data?: Record<string, unknown>): void;
  /** Create child logger */
  child(name: string): Logger;
  /** Set span context for logs */
  setSpanContext(context: SpanContext): void;
}
