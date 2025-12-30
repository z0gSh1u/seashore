/**
 * @seashore/agent - Types
 *
 * Type definitions for agents
 */

import type { ZodSchema } from 'zod';
import type { AnyTextAdapter, Message, TokenUsage } from '@seashore/llm';
import type { Tool, ToolResult } from '@seashore/tool';

/**
 * Run options for agent execution
 */
export interface RunOptions {
  /** Thread ID for conversation context */
  readonly threadId?: string;

  /** User ID for attribution */
  readonly userId?: string;

  /** Abort signal for cancellation */
  readonly signal?: AbortSignal;

  /** Custom metadata */
  readonly metadata?: Record<string, unknown>;

  /** Override max iterations for this run */
  readonly maxIterations?: number;

  /** Override temperature for this run */
  readonly temperature?: number;
}

/**
 * Agent configuration
 */
export interface AgentConfig<
  TTools extends readonly Tool<unknown, unknown>[] = readonly Tool<unknown, unknown>[],
> {
  /** Agent name */
  readonly name: string;

  /** System prompt */
  readonly systemPrompt: string;

  /** LLM model adapter */
  readonly model: AnyTextAdapter;

  /** Available tools */
  readonly tools?: TTools;

  /** Maximum tool call iterations */
  readonly maxIterations?: number;

  /** Temperature parameter */
  readonly temperature?: number;

  /** Structured output schema (optional) */
  readonly outputSchema?: ZodSchema;
}

/**
 * Agent run result
 */
export interface AgentRunResult {
  /** Final response content */
  readonly content: string;

  /** Structured output (if outputSchema was provided) */
  readonly structured?: unknown;

  /** Tool calls made during execution */
  readonly toolCalls: readonly ToolCallRecord[];

  /** Total token usage */
  readonly usage: TokenUsage;

  /** Execution duration in milliseconds */
  readonly durationMs: number;

  /** Finish reason */
  readonly finishReason: 'stop' | 'max_iterations' | 'error';

  /** Error message (if finishReason is 'error') */
  readonly error?: string;
}

/**
 * Record of a tool call during execution
 */
export interface ToolCallRecord {
  readonly id: string;
  readonly name: string;
  readonly arguments: unknown;
  readonly result: ToolResult<unknown>;
}

/**
 * Stream chunk types
 */
export type AgentStreamChunkType =
  | 'thinking'
  | 'content'
  | 'tool-call-start'
  | 'tool-call-args'
  | 'tool-call-end'
  | 'tool-result'
  | 'finish'
  | 'error';

/**
 * Agent stream chunk
 */
export interface AgentStreamChunk {
  readonly type: AgentStreamChunkType;

  /** Text delta for 'thinking' or 'content' chunks */
  readonly delta?: string;

  /** Tool call information */
  readonly toolCall?: {
    readonly id: string;
    readonly name: string;
    readonly arguments?: unknown;
  };

  /** Tool result for 'tool-result' chunks */
  readonly toolResult?: ToolResult<unknown>;

  /** Final result for 'finish' chunks */
  readonly result?: AgentRunResult;

  /** Error for 'error' chunks */
  readonly error?: Error;
}

/**
 * Agent interface
 */
export interface Agent<
  TTools extends readonly Tool<unknown, unknown>[] = readonly Tool<unknown, unknown>[],
> {
  /** Agent name */
  readonly name: string;

  /** Available tools */
  readonly tools: TTools;

  /** Run agent synchronously */
  run(input: string, options?: RunOptions): Promise<AgentRunResult>;

  /** Run agent with streaming */
  stream(input: string, options?: RunOptions): AsyncIterable<AgentStreamChunk>;

  /** Continue conversation with message history */
  chat(messages: readonly Message[], options?: RunOptions): AsyncIterable<AgentStreamChunk>;
}

/**
 * Internal message with tool calls
 */
export interface InternalMessage extends Message {
  readonly toolCalls?: readonly {
    readonly id: string;
    readonly type: 'function';
    readonly function: {
      readonly name: string;
      readonly arguments: string;
    };
  }[];
}

/**
 * Tool execution context for the agent
 */
export interface AgentToolContext {
  readonly agentName: string;
  readonly threadId?: string;
  readonly userId?: string;
  readonly signal?: AbortSignal;
}
