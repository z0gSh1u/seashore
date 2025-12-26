/**
 * Chat composite component
 * @module @seashore/genui
 */

import React, { useEffect } from 'react';
import type { ChatProps, ChatMessage as ChatMessageType } from '../types.js';
import { useChat } from '../hooks/useChat.js';
import { ChatMessages } from './ChatMessages.js';
import { ChatInput } from './ChatInput.js';

/**
 * Chat component - complete chat interface
 * @example
 * ```tsx
 * <Chat
 *   endpoint="/api/chat"
 *   placeholder="Ask me anything..."
 *   welcomeMessage="Hello! How can I help you today?"
 * />
 * ```
 */
export function Chat({
  endpoint,
  initialMessages,
  threadId,
  placeholder = 'Type a message...',
  welcomeMessage,
  className = '',
  theme = 'system',
  genUIRegistry,
  onMessageSend,
  onResponse,
  onError,
  headers,
  credentials,
}: ChatProps): React.ReactElement {
  const { messages, input, setInput, sendMessage, isLoading, error } = useChat({
    endpoint,
    initialMessages,
    threadId,
    headers,
    credentials,
    genUIRegistry,
    onFinish: onResponse,
    onError,
  });

  // Add welcome message if provided and no messages
  const displayMessages: ChatMessageType[] = React.useMemo(() => {
    if (welcomeMessage && messages.length === 0) {
      return [
        {
          id: 'welcome',
          role: 'assistant' as const,
          content: welcomeMessage,
          createdAt: new Date(),
        },
      ];
    }
    return messages;
  }, [messages, welcomeMessage]);

  // Apply theme
  useEffect(() => {
    const container = document.querySelector('.seashore-chat');
    if (!container) return;

    container.classList.remove('seashore-theme-light', 'seashore-theme-dark');

    if (theme === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      container.classList.add(prefersDark ? 'seashore-theme-dark' : 'seashore-theme-light');
    } else {
      container.classList.add(`seashore-theme-${theme}`);
    }
  }, [theme]);

  const handleSubmit = (content: string) => {
    onMessageSend?.(content);
    sendMessage(content);
  };

  return (
    <div className={`seashore-chat ${className}`} data-theme={theme}>
      <div className="seashore-chat-container">
        <ChatMessages
          messages={displayMessages}
          isLoading={isLoading}
          autoScroll={true}
          genUIRegistry={genUIRegistry}
        />

        {error && (
          <div className="seashore-chat-error">
            <span>Error: {error.message}</span>
          </div>
        )}

        <ChatInput onSubmit={handleSubmit} placeholder={placeholder} disabled={isLoading} />
      </div>
    </div>
  );
}
