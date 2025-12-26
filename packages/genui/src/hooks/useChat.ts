/**
 * useChat hook for chat functionality
 * @module @seashore/genui
 */

import { useState, useCallback, useRef } from 'react';
import type { ChatMessage, ChatResponse, TokenUsage, GenUIRegistry } from '../types';

/**
 * Options for useChat hook
 */
export interface UseChatOptions {
  /** API endpoint */
  endpoint: string;
  /** HTTP headers */
  headers?: Record<string, string>;
  /** Request credentials */
  credentials?: RequestCredentials;
  /** Initial messages */
  initialMessages?: ChatMessage[];
  /** Initial input value */
  initialInput?: string;
  /** Thread ID */
  threadId?: string;
  /** Called when thread is created */
  onThreadCreate?: (threadId: string) => void;
  /** Called when message is added */
  onMessage?: (message: ChatMessage) => void;
  /** Called on finish */
  onFinish?: (response: ChatResponse) => void;
  /** Called on error */
  onError?: (error: Error) => void;
  /** GenUI registry */
  genUIRegistry?: GenUIRegistry;
  /** Stream protocol */
  streamProtocol?: 'sse' | 'text';
}

/**
 * Return value from useChat hook
 */
export interface UseChatReturn {
  /** Current messages */
  messages: ChatMessage[];
  /** Set messages */
  setMessages: (messages: ChatMessage[]) => void;
  /** Current input value */
  input: string;
  /** Set input value */
  setInput: (input: string) => void;
  /** Send a message */
  sendMessage: (content?: string) => Promise<void>;
  /** Stop generation */
  stop: () => void;
  /** Reload last response */
  reload: () => Promise<void>;
  /** Clear all messages */
  clearMessages: () => void;
  /** Loading state */
  isLoading: boolean;
  /** Error state */
  error: Error | null;
  /** Current thread ID */
  threadId: string | null;
  /** Attachments */
  attachments: File[];
  /** Set attachments */
  setAttachments: (files: File[]) => void;
}

/**
 * Generate a unique ID
 */
function generateId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * useChat hook for managing chat state and communication
 * @example
 * ```tsx
 * function ChatComponent() {
 *   const {
 *     messages,
 *     input,
 *     setInput,
 *     sendMessage,
 *     isLoading,
 *   } = useChat({
 *     endpoint: '/api/chat',
 *   })
 *
 *   return (
 *     <div>
 *       {messages.map(msg => (
 *         <div key={msg.id}>{msg.content}</div>
 *       ))}
 *       <input
 *         value={input}
 *         onChange={(e) => setInput(e.target.value)}
 *       />
 *       <button onClick={() => sendMessage()} disabled={isLoading}>
 *         Send
 *       </button>
 *     </div>
 *   )
 * }
 * ```
 */
export function useChat(options: UseChatOptions): UseChatReturn {
  const {
    endpoint,
    headers = {},
    credentials,
    initialMessages = [],
    initialInput = '',
    threadId: initialThreadId,
    onThreadCreate,
    onMessage,
    onFinish,
    onError,
  } = options;

  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [input, setInput] = useState(initialInput);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [threadId, setThreadId] = useState<string | null>(initialThreadId ?? null);
  const [attachments, setAttachments] = useState<File[]>([]);

  const abortControllerRef = useRef<AbortController | null>(null);

  /**
   * Send a message to the chat endpoint
   */
  const sendMessage = useCallback(
    async (content?: string) => {
      const messageContent = content ?? input;
      if (!messageContent.trim()) return;

      setError(null);
      setIsLoading(true);

      // Create user message
      const userMessage: ChatMessage = {
        id: generateId(),
        role: 'user',
        content: messageContent,
        createdAt: new Date(),
      };

      setMessages((prev) => [...prev, userMessage]);
      setInput('');

      // Notify
      onMessage?.(userMessage);

      // Create abort controller
      abortControllerRef.current = new AbortController();

      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...headers,
          },
          credentials,
          body: JSON.stringify({
            messages: [...messages, userMessage].map((m) => ({
              role: m.role,
              content: m.content,
            })),
            threadId,
            stream: true,
          }),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          throw new Error(`HTTP error: ${response.status}`);
        }

        // Handle new thread ID from response headers
        const newThreadId = response.headers.get('X-Thread-ID');
        if (newThreadId && newThreadId !== threadId) {
          setThreadId(newThreadId);
          onThreadCreate?.(newThreadId);
        }

        // Create assistant message placeholder
        const assistantMessage: ChatMessage = {
          id: generateId(),
          role: 'assistant',
          content: '',
          createdAt: new Date(),
        };

        setMessages((prev) => [...prev, assistantMessage]);

        // Process streaming response
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();

        if (!reader) {
          throw new Error('Response body is not readable');
        }

        let fullContent = '';
        let usage: TokenUsage | undefined;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (!line.trim() || !line.startsWith('data: ')) continue;

            const data = line.slice(6);
            if (data === '[DONE]') continue;

            try {
              const parsed = JSON.parse(data);

              if (parsed.type === 'text-delta') {
                fullContent += parsed.textDelta;
                setMessages((prev) => {
                  const updated = [...prev];
                  const lastIndex = updated.length - 1;
                  if (updated[lastIndex]?.role === 'assistant') {
                    updated[lastIndex] = {
                      ...updated[lastIndex],
                      content: fullContent,
                    };
                  }
                  return updated;
                });
              } else if (parsed.type === 'finish') {
                usage = parsed.usage;
              } else if (parsed.type === 'error') {
                throw new Error(parsed.error);
              }
            } catch (parseError) {
              // Ignore parse errors for non-JSON lines
            }
          }
        }

        // Final update
        setMessages((prev) => {
          const updated = [...prev];
          const lastIndex = updated.length - 1;
          if (updated[lastIndex]?.role === 'assistant') {
            updated[lastIndex] = {
              ...updated[lastIndex],
              content: fullContent,
            };
          }
          return updated;
        });

        const chatResponse: ChatResponse = {
          content: fullContent,
          threadId: threadId ?? newThreadId ?? '',
          usage,
        };

        onFinish?.(chatResponse);
      } catch (err) {
        if ((err as Error).name === 'AbortError') {
          // Aborted by user
          return;
        }

        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        onError?.(error);
      } finally {
        setIsLoading(false);
        abortControllerRef.current = null;
      }
    },
    [
      endpoint,
      headers,
      credentials,
      input,
      messages,
      threadId,
      onMessage,
      onFinish,
      onError,
      onThreadCreate,
    ]
  );

  /**
   * Stop the current generation
   */
  const stop = useCallback(() => {
    abortControllerRef.current?.abort();
    setIsLoading(false);
  }, []);

  /**
   * Reload the last assistant response
   */
  const reload = useCallback(async () => {
    // Find last user message (reverse search)
    let lastUserMessageIndex = -1;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i]!.role === 'user') {
        lastUserMessageIndex = i;
        break;
      }
    }
    if (lastUserMessageIndex === -1) return;

    const lastUserMessage = messages[lastUserMessageIndex]!;

    // Remove messages after the last user message
    setMessages(messages.slice(0, lastUserMessageIndex));

    // Resend
    await sendMessage(lastUserMessage.content);
  }, [messages, sendMessage]);

  /**
   * Clear all messages
   */
  const clearMessages = useCallback(() => {
    setMessages([]);
    setThreadId(null);
  }, []);

  return {
    messages,
    setMessages,
    input,
    setInput,
    sendMessage,
    stop,
    reload,
    clearMessages,
    isLoading,
    error,
    threadId,
    attachments,
    setAttachments,
  };
}
