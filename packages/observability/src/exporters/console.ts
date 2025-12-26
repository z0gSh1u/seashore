/**
 * Console exporter for development and debugging
 * @module @seashore/observability
 */

import type { Span, SpanExporter, ExporterConfig } from '../types.js';

/**
 * Console exporter configuration
 */
export interface ConsoleExporterConfig extends ExporterConfig {
  /** Output format */
  format?: 'json' | 'pretty';
  /** Whether to include attributes */
  includeAttributes?: boolean;
  /** Whether to include events */
  includeEvents?: boolean;
  /** Custom output function (defaults to console.log) */
  output?: (message: string) => void;
}

/**
 * Format span as pretty string
 */
function formatSpanPretty(span: Span, config: ConsoleExporterConfig): string {
  const duration = span.endTime ? span.endTime.getTime() - span.startTime.getTime() : 0;

  const statusIcon = span.status === 'ok' ? '✓' : span.status === 'error' ? '✗' : '○';
  const statusColor =
    span.status === 'ok' ? '\x1b[32m' : span.status === 'error' ? '\x1b[31m' : '\x1b[33m';
  const reset = '\x1b[0m';

  let output = `${statusColor}${statusIcon}${reset} ${span.name} (${duration}ms)`;

  if (span.parentId) {
    output += ` [parent: ${span.parentId.slice(0, 8)}]`;
  }

  if (config.includeAttributes && Object.keys(span.attributes).length > 0) {
    output += '\n  Attributes:';
    for (const [key, value] of Object.entries(span.attributes)) {
      output += `\n    ${key}: ${JSON.stringify(value)}`;
    }
  }

  if (config.includeEvents && span.events.length > 0) {
    output += '\n  Events:';
    for (const event of span.events) {
      output += `\n    [${event.timestamp.toISOString()}] ${event.name}`;
      if (event.attributes) {
        output += ` ${JSON.stringify(event.attributes)}`;
      }
    }
  }

  if (span.error) {
    output += `\n  Error: ${span.error.message}`;
  }

  return output;
}

/**
 * Format span as JSON string
 */
function formatSpanJSON(span: Span, config: ConsoleExporterConfig): string {
  const data: Record<string, unknown> = {
    traceId: span.traceId,
    spanId: span.id,
    parentId: span.parentId,
    name: span.name,
    type: span.type,
    startTime: span.startTime.toISOString(),
    endTime: span.endTime?.toISOString(),
    durationMs: span.endTime ? span.endTime.getTime() - span.startTime.getTime() : 0,
    status: span.status,
  };

  if (config.includeAttributes) {
    data.attributes = span.attributes;
  }

  if (config.includeEvents) {
    data.events = span.events.map((e) => ({
      name: e.name,
      timestamp: e.timestamp.toISOString(),
      attributes: e.attributes,
    }));
  }

  if (span.error) {
    data.error = {
      name: span.error.name,
      message: span.error.message,
    };
  }

  return JSON.stringify(data);
}

/**
 * Create console exporter
 * Outputs spans to the console for development and debugging
 * @param config - Console exporter configuration
 * @returns SpanExporter instance
 * @example
 * ```typescript
 * const exporter = createConsoleExporter({
 *   format: 'pretty',
 *   includeAttributes: true
 * })
 *
 * const tracer = createTracer({
 *   serviceName: 'my-agent',
 *   exporter
 * })
 * ```
 */
export function createConsoleExporter(config: ConsoleExporterConfig = {}): SpanExporter {
  const {
    format = 'pretty',
    includeAttributes = true,
    includeEvents = false,
    output = console.log,
  } = config;

  const formatSpan = format === 'json' ? formatSpanJSON : formatSpanPretty;

  return {
    export: async (spans: Span[]): Promise<void> => {
      for (const span of spans) {
        output(formatSpan(span, { format, includeAttributes, includeEvents }));
      }
    },

    shutdown: async (): Promise<void> => {
      // No cleanup needed for console exporter
    },
  };
}
