/**
 * Tracer implementation
 * @module @seashore/observability
 */

import type {
  Tracer,
  TracerConfig,
  Span,
  SpanContext,
  SpanType,
  SpanStatus,
  SpanAttributes,
  SpanEvent,
  StartSpanOptions,
  TraceEvent,
  TokenUsage,
} from './types.js';

// Generate unique IDs
function generateId(length: number = 16): string {
  const chars = '0123456789abcdef';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

/**
 * Span implementation
 */
class SpanImpl implements Span {
  name: string;
  type: SpanType;
  context: SpanContext;
  parentContext?: SpanContext;
  attributes: SpanAttributes = {};
  events: SpanEvent[] = [];
  status: { code: SpanStatus; message?: string } = { code: 'unset' };
  startTime: Date;
  endTime?: Date;
  durationMs?: number;
  tokenUsage?: TokenUsage;

  private recording = true;
  private onEnd?: (span: SpanImpl) => void;

  constructor(
    name: string,
    type: SpanType,
    context: SpanContext,
    parentContext?: SpanContext,
    attributes?: SpanAttributes,
    onEnd?: (span: SpanImpl) => void
  ) {
    this.name = name;
    this.type = type;
    this.context = context;
    this.parentContext = parentContext;
    this.attributes = attributes ?? {};
    this.startTime = new Date();
    this.onEnd = onEnd;
  }

  setAttributes(attributes: SpanAttributes): void {
    if (!this.recording) return;
    Object.assign(this.attributes, attributes);
  }

  setStatus(status: { code: SpanStatus; message?: string }): void {
    if (!this.recording) return;
    this.status = status;
  }

  addEvent(name: string, attributes?: SpanAttributes): void {
    if (!this.recording) return;
    this.events.push({
      name,
      timestamp: new Date(),
      attributes,
    });
  }

  recordException(error: Error): void {
    if (!this.recording) return;
    this.addEvent('exception', {
      'exception.type': error.name,
      'exception.message': error.message,
      'exception.stacktrace': error.stack,
    });
    this.setStatus({ code: 'error', message: error.message });
  }

  end(): void {
    if (!this.recording) return;
    this.recording = false;
    this.endTime = new Date();
    this.durationMs = this.endTime.getTime() - this.startTime.getTime();
    this.onEnd?.(this);
  }

  isRecording(): boolean {
    return this.recording;
  }

  toTraceEvent(): TraceEvent {
    return {
      traceId: this.context.traceId,
      spanId: this.context.spanId,
      parentSpanId: this.parentContext?.spanId,
      name: this.name,
      type: this.type,
      attributes: this.attributes,
      events: this.events,
      status: this.status,
      startTime: this.startTime.toISOString(),
      endTime: this.endTime?.toISOString(),
      durationMs: this.durationMs,
      tokenUsage: this.tokenUsage,
    };
  }
}

/**
 * Tracer implementation
 */
class TracerImpl implements Tracer {
  serviceName: string;
  private config: TracerConfig;
  private activeContext?: SpanContext;
  private pendingSpans: SpanImpl[] = [];
  private exporters: Array<(event: TraceEvent) => void> = [];

  constructor(config: TracerConfig) {
    this.serviceName = config.serviceName;
    this.config = config;

    // Setup exporters
    for (const exporterConfig of config.exporters ?? []) {
      if (exporterConfig.type === 'console') {
        this.exporters.push(this.createConsoleExporter());
      }
      // OTLP exporter would be added here
    }
  }

  private createConsoleExporter(): (event: TraceEvent) => void {
    return (event: TraceEvent) => {
      const statusIcon =
        event.status.code === 'ok' ? '✓' : event.status.code === 'error' ? '✗' : '○';
      const duration = event.durationMs ? `${event.durationMs}ms` : '-';

      // eslint-disable-next-line no-console
      console.log(
        `[${event.type}] ${statusIcon} ${event.name} (${duration})`,
        event.tokenUsage ? `tokens: ${event.tokenUsage.totalTokens}` : ''
      );
    };
  }

  private shouldSample(): boolean {
    return Math.random() < (this.config.samplingRate ?? 1.0);
  }

  startSpan(name: string, options: StartSpanOptions = {}): Span {
    const type = options.type ?? 'custom';
    const parentContext = options.parentContext ?? this.activeContext;

    const context: SpanContext = {
      traceId: parentContext?.traceId ?? generateId(32),
      spanId: generateId(16),
    };

    const span = new SpanImpl(
      name,
      type,
      context,
      parentContext,
      options.attributes,
      (completedSpan) => {
        if (this.shouldSample()) {
          const event = completedSpan.toTraceEvent();
          for (const exporter of this.exporters) {
            try {
              exporter(event);
            } catch {
              // Ignore exporter errors
            }
          }
        }
      }
    );

    this.pendingSpans.push(span);
    return span;
  }

  async withSpan<T>(
    name: string,
    fn: (span: Span) => Promise<T>,
    options: StartSpanOptions = {}
  ): Promise<T> {
    const span = this.startSpan(name, options);
    const previousContext = this.activeContext;
    this.activeContext = span.context;

    try {
      const result = await fn(span);
      span.setStatus({ code: 'ok' });
      return result;
    } catch (error) {
      span.recordException(error as Error);
      throw error;
    } finally {
      span.end();
      this.activeContext = previousContext;
    }
  }

  getActiveContext(): SpanContext | undefined {
    return this.activeContext;
  }

  async withContext<T>(context: SpanContext, fn: () => Promise<T>): Promise<T> {
    const previousContext = this.activeContext;
    this.activeContext = context;

    try {
      return await fn();
    } finally {
      this.activeContext = previousContext;
    }
  }

  async flush(): Promise<void> {
    // End any pending spans
    for (const span of this.pendingSpans) {
      if (span.isRecording()) {
        span.setStatus({ code: 'error', message: 'Span flushed before completion' });
        span.end();
      }
    }
    this.pendingSpans = [];
  }

  async shutdown(): Promise<void> {
    await this.flush();
  }
}

/**
 * Create a tracer
 * @param config - Tracer configuration
 * @returns Tracer instance
 * @example
 * ```typescript
 * const tracer = createTracer({
 *   serviceName: 'my-agent-service',
 *   samplingRate: 1.0,
 *   exporters: [{ type: 'console' }],
 * })
 *
 * await tracer.withSpan('agent.run', async (span) => {
 *   span.setAttributes({ 'agent.name': 'my-agent' })
 *   // ... do work
 * })
 * ```
 */
export function createTracer(config: TracerConfig): Tracer {
  return new TracerImpl(config);
}

export type { Tracer, TracerConfig };
