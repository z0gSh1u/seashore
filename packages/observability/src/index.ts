/**
 * @seashore/observability
 * Observability package for agent tracing, logging, and metrics
 * @module @seashore/observability
 */

// Types
export type {
  Span,
  SpanEvent,
  SpanType,
  Tracer,
  TracerConfig,
  SpanExporter,
  ExporterConfig,
  TokenCounter,
  TokenCounterConfig,
  TokenEstimate,
  TokenCost,
  Logger,
  LoggerConfig,
  LogLevel,
  LogEntry,
} from './types.js';

// Tracer
export { createTracer } from './tracer.js';

// Token Counter
export { createTokenCounter } from './tokens.js';

// Logger
export { createLogger } from './logger.js';

// Middleware
export {
  observabilityMiddleware,
  createAgentObserver,
  type ObservabilityContext,
} from './middleware.js';

// Exporters
export {
  createOTLPExporter,
  createConsoleExporter,
  type OTLPExporterConfig,
  type ConsoleExporterConfig,
} from './exporters/index.js';
