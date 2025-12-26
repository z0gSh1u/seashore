/**
 * ChatToolResult component
 * @module @seashore/genui
 */

import React from 'react';
import type { ChatToolResultProps } from '../types.js';
import { renderToolCall } from '../renderer.js';

/**
 * ChatToolResult component - renders a tool call result
 * @example
 * ```tsx
 * <ChatToolResult
 *   toolCall={{
 *     id: 'call_123',
 *     name: 'search',
 *     args: { query: 'weather' },
 *     result: 'Sunny, 72°F',
 *     isLoading: false,
 *   }}
 *   genUIRegistry={registry}
 * />
 * ```
 */
export function ChatToolResult({
  toolCall,
  genUIRegistry,
  className = '',
}: ChatToolResultProps): React.ReactElement {
  const { element, isGenUI } = renderToolCall(toolCall, genUIRegistry);

  const containerClass = isGenUI
    ? 'seashore-chat-tool-result seashore-chat-tool-result-genui'
    : 'seashore-chat-tool-result';

  return (
    <div className={`${containerClass} ${className}`}>
      <div className="seashore-chat-tool-header">
        <span className="seashore-chat-tool-icon">🔧</span>
        <span className="seashore-chat-tool-name">{toolCall.name}</span>
        {toolCall.isLoading && <span className="seashore-chat-tool-status">Running...</span>}
      </div>

      {/* Show args if not GenUI */}
      {!isGenUI && Object.keys(toolCall.args).length > 0 && (
        <div className="seashore-chat-tool-args">
          <details>
            <summary>Arguments</summary>
            <pre>{JSON.stringify(toolCall.args, null, 2)}</pre>
          </details>
        </div>
      )}

      <div className="seashore-chat-tool-content">{element}</div>
    </div>
  );
}
