/**
 * @seashore/llm - Stream Utilities
 *
 * Utilities for working with LLM streaming responses
 */

import type { StreamChunk, TokenUsage } from './types.js';

/**
 * Convert a stream of chunks to a Web ReadableStream
 *
 * @example
 * ```typescript
 * import { chat, toReadableStream } from '@seashore/llm';
 *
 * const response = chat({ adapter, messages });
 * const stream = toReadableStream(response);
 *
 * return new Response(stream, {
 *   headers: { 'Content-Type': 'text/event-stream' },
 * });
 * ```
 */
export function toReadableStream(chunks: AsyncIterable<StreamChunk>): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();

  return new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of chunks) {
          const sse = formatSSE(chunk);
          controller.enqueue(encoder.encode(sse));
        }
        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
  });
}

/**
 * Convert a stream to Server-Sent Events format
 */
export function toSSEStream(chunks: AsyncIterable<StreamChunk>): AsyncIterable<string> {
  return {
    async *[Symbol.asyncIterator]() {
      for await (const chunk of chunks) {
        yield formatSSE(chunk);
      }
    },
  };
}

/**
 * Format a chunk as a Server-Sent Event
 */
export function formatSSE(chunk: StreamChunk): string {
  const data = JSON.stringify(chunk);
  return `data: ${data}\n\n`;
}

/**
 * Parse SSE stream back to chunks
 */
export async function* parseSSE(stream: ReadableStream<Uint8Array>): AsyncIterable<StreamChunk> {
  const decoder = new TextDecoder();
  const reader = stream.getReader();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });

      // Process complete events
      const events = buffer.split('\n\n');
      buffer = events.pop() ?? '';

      for (const event of events) {
        if (!event.trim()) continue;

        const lines = event.split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;

            try {
              yield JSON.parse(data) as StreamChunk;
            } catch {
              // Skip malformed JSON
            }
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * Collect all content from a stream
 */
export async function collectContent(
  chunks: AsyncIterable<StreamChunk>
): Promise<{ content: string; usage?: TokenUsage }> {
  let content = '';
  let usage: TokenUsage | undefined;

  for await (const chunk of chunks) {
    if (chunk.type === 'content' && chunk.delta) {
      content += chunk.delta;
    }
    if (chunk.type === 'finish' && chunk.usage) {
      usage = chunk.usage;
    }
  }

  return { content, usage };
}

/**
 * Transform a stream, applying a function to each chunk
 */
export function transformStream<T>(
  chunks: AsyncIterable<StreamChunk>,
  transform: (chunk: StreamChunk) => T
): AsyncIterable<T> {
  return {
    async *[Symbol.asyncIterator]() {
      for await (const chunk of chunks) {
        yield transform(chunk);
      }
    },
  };
}

/**
 * Filter a stream based on chunk type
 */
export function filterStream(
  chunks: AsyncIterable<StreamChunk>,
  types: readonly StreamChunk['type'][]
): AsyncIterable<StreamChunk> {
  return {
    async *[Symbol.asyncIterator]() {
      for await (const chunk of chunks) {
        if (types.includes(chunk.type)) {
          yield chunk;
        }
      }
    },
  };
}

/**
 * Tap into a stream for side effects without modifying it
 */
export function tapStream(
  chunks: AsyncIterable<StreamChunk>,
  callback: (chunk: StreamChunk) => void | Promise<void>
): AsyncIterable<StreamChunk> {
  return {
    async *[Symbol.asyncIterator]() {
      for await (const chunk of chunks) {
        await callback(chunk);
        yield chunk;
      }
    },
  };
}

/**
 * Buffer stream chunks and emit in batches
 */
export function bufferStream(
  chunks: AsyncIterable<StreamChunk>,
  options: { maxSize?: number; maxWait?: number } = {}
): AsyncIterable<StreamChunk[]> {
  const { maxSize = 10, maxWait = 100 } = options;

  return {
    async *[Symbol.asyncIterator]() {
      let buffer: StreamChunk[] = [];
      let timeout: ReturnType<typeof setTimeout> | null = null;

      const flush = (): StreamChunk[] => {
        const result = buffer;
        buffer = [];
        if (timeout) {
          clearTimeout(timeout);
          timeout = null;
        }
        return result;
      };

      for await (const chunk of chunks) {
        buffer.push(chunk);

        if (buffer.length >= maxSize) {
          yield flush();
        } else if (!timeout) {
          timeout = setTimeout(() => {
            timeout = null;
          }, maxWait);
        }
      }

      // Flush remaining
      if (buffer.length > 0) {
        yield flush();
      }
    },
  };
}

/**
 * Create a tee (split) of a stream
 */
export function teeStream(
  chunks: AsyncIterable<StreamChunk>
): [AsyncIterable<StreamChunk>, AsyncIterable<StreamChunk>] {
  const buffer: StreamChunk[] = [];
  let done = false;
  let iterator: AsyncIterator<StreamChunk> | null = null;
  let reader1Done = false;
  let reader2Done = false;
  let reader1Index = 0;
  let reader2Index = 0;

  const getIterator = () => {
    if (!iterator) {
      iterator = chunks[Symbol.asyncIterator]();
    }
    return iterator;
  };

  const createReader = (isReader1: boolean): AsyncIterable<StreamChunk> => ({
    async *[Symbol.asyncIterator]() {
      const getIndex = () => (isReader1 ? reader1Index : reader2Index);
      const setIndex = (i: number) => {
        if (isReader1) reader1Index = i;
        else reader2Index = i;
      };
      const setDone = () => {
        if (isReader1) reader1Done = true;
        else reader2Done = true;
      };

      while (true) {
        const index = getIndex();

        if (index < buffer.length) {
          setIndex(index + 1);
          yield buffer[index]!;
          continue;
        }

        if (done) {
          setDone();
          return;
        }

        const { value, done: iterDone } = await getIterator().next();

        if (iterDone) {
          done = true;
          setDone();
          return;
        }

        buffer.push(value);
        setIndex(index + 1);
        yield value;
      }
    },
  });

  return [createReader(true), createReader(false)];
}

/**
 * Combine multiple streams into one
 */
export async function* mergeStreams(
  ...streams: AsyncIterable<StreamChunk>[]
): AsyncIterable<StreamChunk> {
  const iterators = streams.map((s) => s[Symbol.asyncIterator]());
  const pending = new Set(iterators.map((_, i) => i));

  while (pending.size > 0) {
    const promises = [...pending].map(async (i) => {
      const result = await iterators[i]!.next();
      return { index: i, result };
    });

    const { index, result } = await Promise.race(promises);

    if (result.done) {
      pending.delete(index);
    } else {
      yield result.value;
    }
  }
}
