/**
 * ChatMessages component
 * @module @seashore/genui
 */

import React, { useEffect, useRef } from 'react';
import type { ChatMessagesProps, ChatMessage as ChatMessageType } from '../types.js';
import { ChatMessage } from './ChatMessage.js';

/**
 * ChatMessages component - displays a list of chat messages
 * @example
 * ```tsx
 * <ChatMessages
 *   messages={messages}
 *   isLoading={isLoading}
 *   autoScroll={true}
 * />
 * ```
 */
export function ChatMessages({
  messages,
  renderMessage,
  isLoading = false,
  loadingIndicator,
  autoScroll = true,
  className = '',
  genUIRegistry,
}: ChatMessagesProps): React.ReactElement {
  const containerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (autoScroll && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, autoScroll]);

  const defaultLoadingIndicator = (
    <div className="seashore-chat-loading">
      <div className="seashore-chat-loading-dots">
        <span />
        <span />
        <span />
      </div>
    </div>
  );

  return (
    <div ref={containerRef} className={`seashore-chat-messages ${className}`}>
      {messages.length === 0 && !isLoading && (
        <div className="seashore-chat-empty">
          <p>No messages yet. Start a conversation!</p>
        </div>
      )}

      {messages.map((message) => (
        <div key={message.id} className="seashore-chat-message-wrapper">
          {renderMessage ? (
            renderMessage(message)
          ) : (
            <ChatMessage message={message} genUIRegistry={genUIRegistry} />
          )}
        </div>
      ))}

      {isLoading && (
        <div className="seashore-chat-message-wrapper seashore-chat-loading-wrapper">
          {loadingIndicator ?? defaultLoadingIndicator}
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}
