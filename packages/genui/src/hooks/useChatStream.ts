/**
 * useChatStream hook for SSE streaming
 * @module @seashore/genui
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import type { StreamChunk, ToolCallUI } from '../types.js';

/**
 * Options for useChatStream hook
 */
export interface UseChatStreamOptions {
  /** SSE endpoint URL */
  url?: string;
  /** Called on each text delta */
  onTextDelta?: (delta: string) => void;
  /** Called when tool call starts */
  onToolCallStart?: (toolCallId: string, toolName: string) => void;
  /** Called on tool call argument delta */
  onToolCallDelta?: (toolCallId: string, argsTextDelta: string) => void;
  /** Called when tool result is received */
  onToolResult?: (toolCallId: string, result: unknown) => void;
  /** Called when stream finishes */
  onFinish?: () => void;
  /** Called on error */
  onError?: (error: Error) => void;
}

/**
 * Return value from useChatStream hook
 */
export interface UseChatStreamReturn {
  /** Start streaming from URL */
  startStream: (url: string, options?: RequestInit) => void;
  /** Stop current stream */
  stopStream: () => void;
  /** Current streaming text */
  streamingText: string;
  /** Active tool calls */
  toolCalls: Map<string, ToolCallUI>;
  /** Whether currently streaming */
  isStreaming: boolean;
  /** Current error */
  error: Error | null;
}

/**
 * useChatStream hook for handling SSE streams
 * @example
 * ```tsx
 * function StreamingChat() {
 *   const {
 *     startStream,
 *     stopStream,
 *     streamingText,
 *     isStreaming,
 *   } = useChatStream({
 *     onFinish: () => console.log('Stream finished'),
 *   })
 *
 *   const handleSend = () => {
 *     startStream('/api/chat/stream', {
 *       method: 'POST',
 *       body: JSON.stringify({ message: 'Hello' }),
 *     })
 *   }
 *
 *   return (
 *     <div>
 *       <p>{streamingText}</p>
 *       {isStreaming ? (
 *         <button onClick={stopStream}>Stop</button>
 *       ) : (
 *         <button onClick={handleSend}>Send</button>
 *       )}
 *     </div>
 *   )
 * }
 * ```
 */
export function useChatStream(options: UseChatStreamOptions = {}): UseChatStreamReturn {
  const { onTextDelta, onToolCallStart, onToolCallDelta, onToolResult, onFinish, onError } =
    options;

  const [streamingText, setStreamingText] = useState('');
  const [toolCalls, setToolCalls] = useState<Map<string, ToolCallUI>>(new Map());
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const toolCallArgsRef = useRef<Map<string, string>>(new Map());

  /**
   * Process a stream chunk
   */
  const processChunk = useCallback(
    (chunk: StreamChunk) => {
      switch (chunk.type) {
        case 'text-delta':
          setStreamingText((prev) => prev + chunk.textDelta);
          onTextDelta?.(chunk.textDelta);
          break;

        case 'tool-call-start':
          setToolCalls((prev) => {
            const newMap = new Map(prev);
            newMap.set(chunk.toolCallId, {
              id: chunk.toolCallId,
              name: chunk.toolName,
              args: {},
              isLoading: true,
            });
            return newMap;
          });
          toolCallArgsRef.current.set(chunk.toolCallId, '');
          onToolCallStart?.(chunk.toolCallId, chunk.toolName);
          break;

        case 'tool-call-delta':
          const currentArgs = toolCallArgsRef.current.get(chunk.toolCallId) ?? '';
          const newArgs = currentArgs + chunk.argsTextDelta;
          toolCallArgsRef.current.set(chunk.toolCallId, newArgs);

          // Try to parse args
          try {
            const parsedArgs = JSON.parse(newArgs);
            setToolCalls((prev) => {
              const newMap = new Map(prev);
              const existing = newMap.get(chunk.toolCallId);
              if (existing) {
                newMap.set(chunk.toolCallId, {
                  ...existing,
                  args: parsedArgs,
                });
              }
              return newMap;
            });
          } catch {
            // Incomplete JSON, wait for more data
          }

          onToolCallDelta?.(chunk.toolCallId, chunk.argsTextDelta);
          break;

        case 'tool-result':
          setToolCalls((prev) => {
            const newMap = new Map(prev);
            const existing = newMap.get(chunk.toolCallId);
            if (existing) {
              newMap.set(chunk.toolCallId, {
                ...existing,
                result: chunk.result,
                isLoading: false,
              });
            }
            return newMap;
          });
          onToolResult?.(chunk.toolCallId, chunk.result);
          break;

        case 'finish':
          setIsStreaming(false);
          onFinish?.();
          break;

        case 'error':
          const error = new Error(chunk.error);
          setError(error);
          setIsStreaming(false);
          onError?.(error);
          break;
      }
    },
    [onTextDelta, onToolCallStart, onToolCallDelta, onToolResult, onFinish, onError]
  );

  /**
   * Start a new stream
   */
  const startStream = useCallback(
    async (url: string, fetchOptions?: RequestInit) => {
      // Reset state
      setStreamingText('');
      setToolCalls(new Map());
      setError(null);
      setIsStreaming(true);
      toolCallArgsRef.current.clear();

      // Create abort controller
      abortControllerRef.current = new AbortController();

      try {
        const response = await fetch(url, {
          ...fetchOptions,
          headers: {
            Accept: 'text/event-stream',
            ...fetchOptions?.headers,
          },
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          throw new Error(`HTTP error: ${response.status}`);
        }

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();

        if (!reader) {
          throw new Error('Response body is not readable');
        }

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const text = decoder.decode(value, { stream: true });
          const lines = text.split('\n');

          for (const line of lines) {
            if (!line.trim() || !line.startsWith('data: ')) continue;

            const data = line.slice(6);
            if (data === '[DONE]') {
              setIsStreaming(false);
              onFinish?.();
              continue;
            }

            try {
              const chunk = JSON.parse(data) as StreamChunk;
              processChunk(chunk);
            } catch {
              // Ignore parse errors
            }
          }
        }
      } catch (err) {
        if ((err as Error).name === 'AbortError') {
          setIsStreaming(false);
          return;
        }

        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        setIsStreaming(false);
        onError?.(error);
      } finally {
        abortControllerRef.current = null;
      }
    },
    [processChunk, onFinish, onError]
  );

  /**
   * Stop the current stream
   */
  const stopStream = useCallback(() => {
    abortControllerRef.current?.abort();
    setIsStreaming(false);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  return {
    startStream,
    stopStream,
    streamingText,
    toolCalls,
    isStreaming,
    error,
  };
}
