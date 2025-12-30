/**
 * @seashore/agent - Streaming Utilities
 *
 * Utilities for streaming agent responses
 */

import type { AgentStreamChunk, AgentRunResult, ToolCallRecord } from './types';
import type { TokenUsage } from '@seashore/llm';

/**
 * Create an async iterator that collects stream chunks into a final result
 */
export async function collectStream(
  stream: AsyncIterable<AgentStreamChunk>
): Promise<AgentRunResult> {
  let content = '';
  const toolCalls: ToolCallRecord[] = [];
  let usage: TokenUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
  let finishReason: AgentRunResult['finishReason'] = 'stop';
  let error: string | undefined;
  const startTime = Date.now();

  for await (const chunk of stream) {
    switch (chunk.type) {
      case 'content':
        if (chunk.delta !== undefined) {
          content += chunk.delta;
        }
        break;

      case 'tool-result':
        if (chunk.toolResult !== undefined && chunk.toolCall !== undefined) {
          toolCalls.push({
            id: chunk.toolCall.id,
            name: chunk.toolCall.name,
            arguments: chunk.toolCall.arguments,
            result: chunk.toolResult,
          });
        }
        break;

      case 'finish':
        if (chunk.result !== undefined) {
          return chunk.result;
        }
        break;

      case 'error':
        finishReason = 'error';
        error = chunk.error?.message;
        break;
    }
  }

  return {
    content,
    toolCalls,
    usage,
    durationMs: Date.now() - startTime,
    finishReason,
    error,
  };
}

/**
 * Stream chunk builder helpers
 */
export const StreamChunks = {
  thinking(delta: string): AgentStreamChunk {
    return { type: 'thinking', delta };
  },

  content(delta: string): AgentStreamChunk {
    return { type: 'content', delta };
  },

  toolCallStart(id: string, name: string): AgentStreamChunk {
    return {
      type: 'tool-call-start',
      toolCall: { id, name },
    };
  },

  toolCallArgs(id: string, name: string, args: string): AgentStreamChunk {
    return {
      type: 'tool-call-args',
      toolCall: { id, name, arguments: args },
    };
  },

  toolCallEnd(id: string, name: string, args: string): AgentStreamChunk {
    return {
      type: 'tool-call-end',
      toolCall: { id, name, arguments: args },
    };
  },

  toolResult(
    id: string,
    name: string,
    args: unknown,
    result: ToolCallRecord['result']
  ): AgentStreamChunk {
    return {
      type: 'tool-result',
      toolCall: { id, name, arguments: args },
      toolResult: result,
    };
  },

  finish(result: AgentRunResult): AgentStreamChunk {
    return { type: 'finish', result };
  },

  error(error: Error): AgentStreamChunk {
    return { type: 'error', error };
  },
};

/**
 * Convert async iterable to ReadableStream for HTTP responses
 */
export function streamToReadable(
  stream: AsyncIterable<AgentStreamChunk>
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();

  return new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          const json = JSON.stringify(chunk);
          const data = `data: ${json}\n\n`;
          controller.enqueue(encoder.encode(data));
        }
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
  });
}

/**
 * Parse SSE stream back to chunks
 */
export async function* parseSSEStream(
  stream: ReadableStream<Uint8Array>
): AsyncIterable<AgentStreamChunk> {
  const decoder = new TextDecoder();
  const reader = stream.getReader();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') {
            return;
          }
          try {
            yield JSON.parse(data) as AgentStreamChunk;
          } catch {
            // Skip invalid JSON
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
