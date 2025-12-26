/**
 * ChatMessage component
 * @module @seashore/genui
 */

import React from 'react';
import type { ChatMessageProps, ToolCallUI } from '../types.js';
import { ChatToolResult } from './ChatToolResult.js';

/**
 * Format timestamp to readable string
 */
function formatTime(date: Date): string {
  return date.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * ChatMessage component - renders a single chat message
 * @example
 * ```tsx
 * <ChatMessage
 *   message={{
 *     id: '1',
 *     role: 'assistant',
 *     content: 'Hello! How can I help you?',
 *     createdAt: new Date(),
 *   }}
 * />
 * ```
 */
export function ChatMessage({
  message,
  className = '',
  genUIRegistry,
}: ChatMessageProps): React.ReactElement {
  const { role, content, toolCalls, toolResult, createdAt } = message;

  const roleLabel = {
    user: 'You',
    assistant: 'Assistant',
    system: 'System',
    tool: 'Tool',
  }[role];

  const roleClass = `seashore-chat-message-${role}`;

  // Convert tool calls to ToolCallUI format for rendering
  const toolCallUIs: ToolCallUI[] =
    toolCalls?.map((tc) => ({
      id: tc.id,
      name: tc.name,
      args: tc.arguments,
      isLoading: false,
    })) ?? [];

  return (
    <div className={`seashore-chat-message ${roleClass} ${className}`}>
      <div className="seashore-chat-message-header">
        <span className="seashore-chat-message-role">{roleLabel}</span>
        <span className="seashore-chat-message-time">{formatTime(createdAt)}</span>
      </div>

      <div className="seashore-chat-message-content">
        {/* Text content */}
        {content && (
          <div className="seashore-chat-message-text">
            {content.split('\n').map((line, i) => (
              <React.Fragment key={i}>
                {line}
                {i < content.split('\n').length - 1 && <br />}
              </React.Fragment>
            ))}
          </div>
        )}

        {/* Tool calls */}
        {toolCallUIs.length > 0 && (
          <div className="seashore-chat-tool-calls">
            {toolCallUIs.map((toolCall) => (
              <ChatToolResult key={toolCall.id} toolCall={toolCall} genUIRegistry={genUIRegistry} />
            ))}
          </div>
        )}

        {/* Tool result (for tool role messages) */}
        {role === 'tool' && toolResult && (
          <div className="seashore-chat-tool-result">
            <ChatToolResult
              toolCall={{
                id: toolResult.toolCallId,
                name: toolResult.name,
                args: {},
                result: toolResult.result,
                isLoading: false,
              }}
              genUIRegistry={genUIRegistry}
            />
          </div>
        )}
      </div>
    </div>
  );
}
