/**
 * ChatInput component
 * @module @seashore/genui
 */

import React, { useState, useRef, useCallback, KeyboardEvent, ChangeEvent } from 'react';
import type { ChatInputProps } from '../types.js';

/**
 * ChatInput component - input field for chat messages
 * @example
 * ```tsx
 * <ChatInput
 *   onSubmit={(content) => sendMessage(content)}
 *   placeholder="Type a message..."
 *   disabled={isLoading}
 * />
 * ```
 */
export function ChatInput({
  onSubmit,
  placeholder = 'Type a message...',
  disabled = false,
  multiline = true,
  maxRows = 5,
  allowAttachments = false,
  acceptedFileTypes,
  onAttachment,
  submitOnEnter = true,
  submitOnShiftEnter = false,
  className = '',
}: ChatInputProps): React.ReactElement {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /**
   * Adjust textarea height based on content
   */
  const adjustHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea || !multiline) return;

    // Reset height to auto to get correct scrollHeight
    textarea.style.height = 'auto';

    // Calculate new height
    const lineHeight = parseInt(getComputedStyle(textarea).lineHeight) || 24;
    const maxHeight = lineHeight * maxRows;
    const newHeight = Math.min(textarea.scrollHeight, maxHeight);

    textarea.style.height = `${newHeight}px`;
  }, [multiline, maxRows]);

  /**
   * Handle input change
   */
  const handleChange = useCallback(
    (e: ChangeEvent<HTMLTextAreaElement>) => {
      setValue(e.target.value);
      adjustHeight();
    },
    [adjustHeight]
  );

  /**
   * Handle form submission
   */
  const handleSubmit = useCallback(() => {
    const trimmedValue = value.trim();
    if (!trimmedValue || disabled) return;

    onSubmit(trimmedValue);
    setValue('');

    // Reset height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [value, disabled, onSubmit]);

  /**
   * Handle key press
   */
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key !== 'Enter') return;

      const shouldSubmit = (submitOnEnter && !e.shiftKey) || (submitOnShiftEnter && e.shiftKey);

      if (shouldSubmit) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [submitOnEnter, submitOnShiftEnter, handleSubmit]
  );

  /**
   * Handle file selection
   */
  const handleFileSelect = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file && onAttachment) {
        onAttachment(file);
      }
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    },
    [onAttachment]
  );

  /**
   * Open file picker
   */
  const handleAttachClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  return (
    <div className={`seashore-chat-input ${className}`}>
      <div className="seashore-chat-input-container">
        {allowAttachments && (
          <>
            <button
              type="button"
              className="seashore-chat-attach-button"
              onClick={handleAttachClick}
              disabled={disabled}
              aria-label="Attach file"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
              </svg>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileSelect}
              accept={acceptedFileTypes?.join(',')}
              style={{ display: 'none' }}
            />
          </>
        )}

        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          rows={1}
          className="seashore-chat-textarea"
          aria-label="Chat message input"
        />

        <button
          type="button"
          onClick={handleSubmit}
          disabled={disabled || !value.trim()}
          className="seashore-chat-send-button"
          aria-label="Send message"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </button>
      </div>
    </div>
  );
}
