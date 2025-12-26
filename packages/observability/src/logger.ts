/**
 * Logger implementation
 * @module @seashore/observability
 */

import type { Logger, LoggerConfig, LogLevel, LogEntry, SpanContext } from './types.js';

/**
 * Log level priority
 */
const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

/**
 * Logger implementation
 */
class LoggerImpl implements Logger {
  name: string;
  private config: LoggerConfig;
  private minLevel: number;
  private spanContext?: SpanContext;

  constructor(config: LoggerConfig, parentName?: string) {
    this.name = parentName ? `${parentName}.${config.name}` : config.name;
    this.config = config;
    this.minLevel = LOG_LEVELS[config.level ?? 'info'];
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= this.minLevel;
  }

  private formatEntry(entry: LogEntry): string {
    const timestamp = entry.timestamp.toISOString();
    const level = entry.level.toUpperCase().padEnd(5);
    const spanInfo = entry.spanContext ? ` [trace:${entry.spanContext.traceId.slice(0, 8)}]` : '';

    if (this.config.format === 'json') {
      return JSON.stringify({
        timestamp,
        level: entry.level,
        name: this.name,
        message: entry.message,
        ...entry.data,
        ...(entry.spanContext && {
          traceId: entry.spanContext.traceId,
          spanId: entry.spanContext.spanId,
        }),
      });
    }

    // Pretty format
    const dataStr = entry.data ? ` ${JSON.stringify(entry.data)}` : '';
    return `${timestamp} ${level} [${this.name}]${spanInfo} ${entry.message}${dataStr}`;
  }

  private log(level: LogLevel, message: string, data?: Record<string, unknown>): void {
    if (!this.shouldLog(level)) return;

    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date(),
      data,
      spanContext: this.spanContext,
    };

    const formatted = this.formatEntry(entry);

    // Output to configured transports
    for (const transport of this.config.transports ?? [{ type: 'console' }]) {
      if (transport.type === 'console') {
        switch (level) {
          case 'debug':
            // eslint-disable-next-line no-console
            console.debug(formatted);
            break;
          case 'info':
            // eslint-disable-next-line no-console
            console.info(formatted);
            break;
          case 'warn':
            // eslint-disable-next-line no-console
            console.warn(formatted);
            break;
          case 'error':
            // eslint-disable-next-line no-console
            console.error(formatted);
            break;
        }
      }
      // File transport would be implemented here
    }
  }

  debug(message: string, data?: Record<string, unknown>): void {
    this.log('debug', message, data);
  }

  info(message: string, data?: Record<string, unknown>): void {
    this.log('info', message, data);
  }

  warn(message: string, data?: Record<string, unknown>): void {
    this.log('warn', message, data);
  }

  error(message: string, data?: Record<string, unknown>): void {
    this.log('error', message, data);
  }

  child(name: string): Logger {
    return new LoggerImpl({ ...this.config, name }, this.name);
  }

  setSpanContext(context: SpanContext): void {
    this.spanContext = context;
  }
}

/**
 * Create a logger
 * @param config - Logger configuration
 * @returns Logger instance
 * @example
 * ```typescript
 * const logger = createLogger({
 *   name: 'my-agent',
 *   level: 'info',
 *   format: 'pretty',
 * })
 *
 * logger.info('Agent started', { agentId: 'abc123' })
 * logger.error('Failed to process', { error: 'timeout' })
 *
 * const childLogger = logger.child('tools')
 * childLogger.debug('Tool called', { toolName: 'search' })
 * ```
 */
export function createLogger(config: LoggerConfig): Logger {
  return new LoggerImpl(config);
}

export type { Logger, LoggerConfig, LogLevel };
