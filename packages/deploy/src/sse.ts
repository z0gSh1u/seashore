/**
 * SSE stream utilities
 * @module @seashore/deploy
 */

import type { SSEStreamConfig, StreamChunk } from './types.js';

/**
 * SSE message formatter
 */
function formatSSEMessage(data: unknown, event?: string): string {
  let message = '';
  if (event) {
    message += `event: ${event}\n`;
  }
  message += `data: ${JSON.stringify(data)}\n\n`;
  return message;
}

/**
 * Create SSE stream from async iterable
 * @param chunks - Async iterable of stream chunks
 * @param config - SSE configuration
 * @returns ReadableStream for SSE response
 * @example
 * ```typescript
 * const stream = createSSEStream(agent.stream({ messages }))
 * return new Response(stream, {
 *   headers: { 'Content-Type': 'text/event-stream' }
 * })
 * ```
 */
export function createSSEStream(
  chunks: AsyncIterable<StreamChunk>,
  config: SSEStreamConfig = {}
): ReadableStream<Uint8Array> {
  const { heartbeatInterval = 30000 } = config;
  const encoder = new TextEncoder();

  let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

  return new ReadableStream({
    async start(controller) {
      // Send initial data if provided
      if (config.initialData) {
        controller.enqueue(encoder.encode(formatSSEMessage(config.initialData, 'init')));
      }

      // Start heartbeat
      if (heartbeatInterval > 0) {
        heartbeatTimer = setInterval(() => {
          controller.enqueue(encoder.encode(': heartbeat\n\n'));
        }, heartbeatInterval);
      }
    },

    async pull(controller) {
      try {
        for await (const chunk of chunks) {
          const event = chunk.type;
          controller.enqueue(encoder.encode(formatSSEMessage(chunk, event)));

          if (chunk.type === 'done' || chunk.type === 'error') {
            break;
          }
        }
      } catch (error) {
        controller.enqueue(
          encoder.encode(
            formatSSEMessage({ type: 'error', message: (error as Error).message }, 'error')
          )
        );
      } finally {
        if (heartbeatTimer) {
          clearInterval(heartbeatTimer);
        }
        controller.close();
      }
    },

    cancel() {
      if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
      }
    },
  });
}

/**
 * Create SSE response headers
 */
export function createSSEHeaders(
  additionalHeaders?: Record<string, string>
): Record<string, string> {
  return {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'Content-Encoding': 'identity',
    ...additionalHeaders,
  };
}

/**
 * Create NDJSON stream from async iterable
 */
export function createNDJSONStream(chunks: AsyncIterable<StreamChunk>): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();

  return new ReadableStream({
    async pull(controller) {
      try {
        for await (const chunk of chunks) {
          controller.enqueue(encoder.encode(JSON.stringify(chunk) + '\n'));

          if (chunk.type === 'done' || chunk.type === 'error') {
            break;
          }
        }
      } catch (error) {
        controller.enqueue(
          encoder.encode(
            JSON.stringify({ type: 'error', message: (error as Error).message }) + '\n'
          )
        );
      } finally {
        controller.close();
      }
    },
  });
}
