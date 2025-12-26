/**
 * OTLP (OpenTelemetry Protocol) exporter
 * @module @seashore/observability
 */

import type { Span, SpanExporter, ExporterConfig } from '../types.js';

/**
 * OTLP exporter configuration
 */
export interface OTLPExporterConfig extends ExporterConfig {
  /** OTLP endpoint URL */
  endpoint: string;
  /** Request headers for authentication */
  headers?: Record<string, string>;
  /** Request timeout in milliseconds */
  timeout?: number;
  /** Batch size before export */
  batchSize?: number;
  /** Maximum batch delay in milliseconds */
  maxBatchDelay?: number;
}

/**
 * Convert internal span to OTLP format
 */
function spanToOTLP(span: Span): OTLPSpan {
  return {
    traceId: span.traceId,
    spanId: span.id,
    parentSpanId: span.parentId,
    name: span.name,
    kind: mapSpanKind(span.type),
    startTimeUnixNano: BigInt(span.startTime.getTime() * 1_000_000),
    endTimeUnixNano: span.endTime
      ? BigInt(span.endTime.getTime() * 1_000_000)
      : BigInt(Date.now() * 1_000_000),
    attributes: Object.entries(span.attributes).map(([key, value]) => ({
      key,
      value: toAnyValue(value),
    })),
    status: span.status
      ? {
          code: span.status === 'ok' ? 1 : span.status === 'error' ? 2 : 0,
          message: span.error?.message,
        }
      : { code: 0 },
    events: span.events.map((event) => ({
      timeUnixNano: BigInt(event.timestamp.getTime() * 1_000_000),
      name: event.name,
      attributes: Object.entries(event.attributes || {}).map(([key, value]) => ({
        key,
        value: toAnyValue(value),
      })),
    })),
  };
}

interface OTLPSpan {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name: string;
  kind: number;
  startTimeUnixNano: bigint;
  endTimeUnixNano: bigint;
  attributes: Array<{ key: string; value: OTLPAnyValue }>;
  status: { code: number; message?: string };
  events: Array<{
    timeUnixNano: bigint;
    name: string;
    attributes: Array<{ key: string; value: OTLPAnyValue }>;
  }>;
}

interface OTLPAnyValue {
  stringValue?: string;
  intValue?: number;
  doubleValue?: number;
  boolValue?: boolean;
  arrayValue?: { values: OTLPAnyValue[] };
}

function mapSpanKind(type?: string): number {
  switch (type) {
    case 'agent':
    case 'workflow':
      return 1; // INTERNAL
    case 'llm':
    case 'retrieval':
      return 2; // CLIENT
    case 'tool':
      return 3; // SERVER
    default:
      return 0; // UNSPECIFIED
  }
}

function toAnyValue(value: unknown): OTLPAnyValue {
  if (typeof value === 'string') {
    return { stringValue: value };
  }
  if (typeof value === 'number') {
    return Number.isInteger(value) ? { intValue: value } : { doubleValue: value };
  }
  if (typeof value === 'boolean') {
    return { boolValue: value };
  }
  if (Array.isArray(value)) {
    return { arrayValue: { values: value.map(toAnyValue) } };
  }
  return { stringValue: String(value) };
}

/**
 * Create OTLP exporter
 * Exports spans to an OpenTelemetry-compatible collector
 * @param config - OTLP exporter configuration
 * @returns SpanExporter instance
 * @example
 * ```typescript
 * const exporter = createOTLPExporter({
 *   endpoint: 'http://localhost:4318/v1/traces',
 *   headers: { 'Authorization': 'Bearer token' }
 * })
 *
 * const tracer = createTracer({
 *   serviceName: 'my-agent',
 *   exporter
 * })
 * ```
 */
export function createOTLPExporter(config: OTLPExporterConfig): SpanExporter {
  const { endpoint, headers = {}, timeout = 30000, batchSize = 100, maxBatchDelay = 5000 } = config;

  let batch: Span[] = [];
  let batchTimeout: ReturnType<typeof setTimeout> | null = null;

  const flush = async (): Promise<void> => {
    if (batch.length === 0) return;

    const spansToExport = batch;
    batch = [];

    if (batchTimeout) {
      clearTimeout(batchTimeout);
      batchTimeout = null;
    }

    const payload = {
      resourceSpans: [
        {
          resource: {
            attributes: [
              { key: 'service.name', value: { stringValue: config.serviceName || 'unknown' } },
            ],
          },
          scopeSpans: [
            {
              scope: { name: '@seashore/observability', version: '1.0.0' },
              spans: spansToExport.map(spanToOTLP),
            },
          ],
        },
      ],
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        body: JSON.stringify(payload, (_, value) =>
          typeof value === 'bigint' ? value.toString() : value
        ),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`OTLP export failed: ${response.status} ${response.statusText}`);
      }
    } finally {
      clearTimeout(timeoutId);
    }
  };

  const scheduleBatch = (): void => {
    if (batchTimeout) return;
    batchTimeout = setTimeout(() => {
      void flush();
    }, maxBatchDelay);
  };

  return {
    export: async (spans: Span[]): Promise<void> => {
      batch.push(...spans);

      if (batch.length >= batchSize) {
        await flush();
      } else {
        scheduleBatch();
      }
    },

    shutdown: async (): Promise<void> => {
      await flush();
    },
  };
}
