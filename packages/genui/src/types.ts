/**
 * GenUI type definitions
 * @module @seashore/genui
 */

import type { ReactNode, ComponentType } from 'react';

/**
 * Chat message role
 */
export type MessageRole = 'user' | 'assistant' | 'system' | 'tool';

/**
 * Tool call in a message
 */
export interface ToolCall {
  /** Unique tool call ID */
  id: string;
  /** Tool name */
  name: string;
  /** Tool arguments */
  arguments: Record<string, unknown>;
}

/**
 * Tool call result
 */
export interface ToolCallResult {
  /** Tool call ID this result corresponds to */
  toolCallId: string;
  /** Tool name */
  name: string;
  /** Result data */
  result: unknown;
  /** Whether this is a GenUI result */
  isGenUI?: boolean;
}

/**
 * Chat message
 */
export interface ChatMessage {
  /** Unique message ID */
  id: string;
  /** Message role */
  role: MessageRole;
  /** Text content */
  content: string;
  /** Tool calls (for assistant messages) */
  toolCalls?: ToolCall[];
  /** Tool result (for tool messages) */
  toolResult?: ToolCallResult;
  /** Creation timestamp */
  createdAt: Date;
}

/**
 * Chat response from server
 */
export interface ChatResponse {
  /** Response content */
  content: string;
  /** Thread ID */
  threadId: string;
  /** Token usage */
  usage?: TokenUsage;
  /** Tool calls made */
  toolCalls?: ToolCall[];
}

/**
 * Token usage statistics
 */
export interface TokenUsage {
  /** Tokens in prompt */
  promptTokens: number;
  /** Tokens in completion */
  completionTokens: number;
  /** Total tokens */
  totalTokens: number;
}

/**
 * Stream chunk types
 */
export type StreamChunk =
  | { type: 'text-delta'; textDelta: string }
  | { type: 'tool-call-start'; toolCallId: string; toolName: string }
  | { type: 'tool-call-delta'; toolCallId: string; argsTextDelta: string }
  | { type: 'tool-result'; toolCallId: string; result: unknown }
  | { type: 'finish'; usage?: TokenUsage }
  | { type: 'error'; error: string };

/**
 * Tool call UI data for rendering
 */
export interface ToolCallUI {
  /** Tool call ID */
  id: string;
  /** Tool name */
  name: string;
  /** Tool arguments */
  args: Record<string, unknown>;
  /** Tool result (if available) */
  result?: unknown;
  /** Loading state */
  isLoading: boolean;
  /** Error (if any) */
  error?: string;
}

/**
 * GenUI component data
 */
export interface GenUIData<T = unknown> {
  /** Marker for GenUI data */
  __genui: true;
  /** Component data */
  data: T;
}

/**
 * Component renderer props
 */
export interface ComponentRendererProps<T = unknown> {
  /** Data to render */
  data: T;
  /** Tool call ID */
  toolCallId: string;
  /** Tool name */
  toolName: string;
}

/**
 * Component renderer configuration
 */
export interface ComponentRenderer<T = unknown> {
  /** Main component */
  component: ComponentType<ComponentRendererProps<T>>;
  /** Loading state component */
  loading?: ComponentType<{ toolName: string }>;
  /** Error state component */
  error?: ComponentType<{ error: Error; toolName: string }>;
}

/**
 * GenUI Registry interface
 */
export interface GenUIRegistry {
  /** Register a component renderer */
  register<T>(name: string, renderer: ComponentRenderer<T>): void;
  /** Get a component renderer */
  get(name: string): ComponentRenderer | undefined;
  /** Check if a renderer exists */
  has(name: string): boolean;
  /** Get all registered names */
  names(): string[];
}

/**
 * Tool call render result
 */
export interface ToolCallRenderResult {
  /** Rendered content */
  element: ReactNode;
  /** Whether this is a GenUI component */
  isGenUI: boolean;
}

/**
 * Chat props
 */
export interface ChatProps {
  /** API endpoint for chat */
  endpoint: string;
  /** Initial messages */
  initialMessages?: ChatMessage[];
  /** Thread ID for continuation */
  threadId?: string;
  /** Placeholder text */
  placeholder?: string;
  /** Welcome message */
  welcomeMessage?: string;
  /** CSS class name */
  className?: string;
  /** Theme */
  theme?: 'light' | 'dark' | 'system';
  /** GenUI registry for custom components */
  genUIRegistry?: GenUIRegistry;
  /** Called when message is sent */
  onMessageSend?: (message: string) => void;
  /** Called when response received */
  onResponse?: (response: ChatResponse) => void;
  /** Called on error */
  onError?: (error: Error) => void;
  /** HTTP headers */
  headers?: Record<string, string>;
  /** Request credentials */
  credentials?: RequestCredentials;
}

/**
 * ChatMessages props
 */
export interface ChatMessagesProps {
  /** Messages to display */
  messages: ChatMessage[];
  /** Custom message renderer */
  renderMessage?: (message: ChatMessage) => ReactNode;
  /** Loading indicator */
  isLoading?: boolean;
  /** Loading indicator component */
  loadingIndicator?: ReactNode;
  /** Auto-scroll to bottom */
  autoScroll?: boolean;
  /** CSS class name */
  className?: string;
  /** GenUI registry */
  genUIRegistry?: GenUIRegistry;
}

/**
 * ChatInput props
 */
export interface ChatInputProps {
  /** Submit handler */
  onSubmit: (content: string) => void;
  /** Placeholder text */
  placeholder?: string;
  /** Disabled state */
  disabled?: boolean;
  /** Allow multiline input */
  multiline?: boolean;
  /** Max rows for multiline */
  maxRows?: number;
  /** Allow attachments */
  allowAttachments?: boolean;
  /** Accepted file types */
  acceptedFileTypes?: string[];
  /** Attachment handler */
  onAttachment?: (file: File) => void;
  /** Submit on Enter key */
  submitOnEnter?: boolean;
  /** Submit on Shift+Enter */
  submitOnShiftEnter?: boolean;
  /** CSS class name */
  className?: string;
}

/**
 * ChatMessage component props
 */
export interface ChatMessageProps {
  /** Message to render */
  message: ChatMessage;
  /** CSS class name */
  className?: string;
  /** GenUI registry */
  genUIRegistry?: GenUIRegistry;
}

/**
 * ChatToolResult props
 */
export interface ChatToolResultProps {
  /** Tool call to render */
  toolCall: ToolCallUI;
  /** GenUI registry */
  genUIRegistry?: GenUIRegistry;
  /** CSS class name */
  className?: string;
}
