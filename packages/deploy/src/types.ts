/**
 * Deploy types
 * @module @seashore/deploy
 */

import type { Context, MiddlewareHandler } from 'hono';

/**
 * Message type
 */
export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

/**
 * Token usage
 */
export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

/**
 * Tool call
 */
export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  result?: unknown;
}

/**
 * Chat request
 */
export interface ChatRequest {
  messages: Message[];
  threadId?: string;
  stream?: boolean;
  agentConfig?: {
    maxSteps?: number;
    timeout?: number;
  };
}

/**
 * Chat response
 */
export interface ChatResponse {
  content: string;
  threadId: string;
  toolCalls?: ToolCall[];
  usage?: TokenUsage;
}

/**
 * Agent request
 */
export interface AgentRequest {
  input: string | { messages: Message[] };
  threadId?: string;
  stream?: boolean;
  config?: {
    maxSteps?: number;
    timeout?: number;
  };
}

/**
 * Thread response
 */
export interface ThreadResponse {
  id: string;
  messages: Message[];
  createdAt: string;
  updatedAt: string;
}

/**
 * Agent interface (minimal for deploy)
 */
export interface Agent {
  name: string;
  run(input: { messages: Message[] }): Promise<{ content: string; toolCalls?: ToolCall[] }>;
  stream?(input: { messages: Message[] }): AsyncIterable<StreamChunk>;
}

/**
 * Stream chunk types
 */
export type StreamChunk =
  | { type: 'text'; content: string }
  | { type: 'tool_call_start'; id: string; name: string }
  | { type: 'tool_call_end'; id: string; result: unknown }
  | { type: 'genui'; toolName: string; data: unknown }
  | { type: 'done'; usage?: TokenUsage }
  | { type: 'error'; message: string };

/**
 * CORS configuration
 */
export interface CORSConfig {
  origin: string | string[];
  methods?: string[];
  headers?: string[];
  credentials?: boolean;
}

/**
 * Auth configuration
 */
export interface AuthConfig {
  type: 'bearer' | 'api-key' | 'custom';
  validate: (credential: string) => Promise<boolean>;
  header?: string;
}

/**
 * Rate limit configuration
 */
export interface RateLimitConfig {
  requests: number;
  window: string;
  keyGenerator?: (c: Context) => string;
}

/**
 * Streaming configuration
 */
export interface StreamingConfig {
  format: 'sse' | 'ndjson';
  headers?: Record<string, string>;
}

/**
 * Server configuration
 */
export interface ServerConfig {
  /** Registered agents */
  agents: Record<string, Agent>;
  /** Custom middleware */
  middleware?: MiddlewareHandler[];
  /** CORS configuration */
  cors?: CORSConfig;
  /** Authentication */
  auth?: AuthConfig;
  /** Rate limiting */
  rateLimit?: RateLimitConfig;
  /** Streaming configuration */
  streaming?: StreamingConfig;
  /** Error handler */
  errorHandler?: (error: Error, c: Context) => Response;
}

/**
 * Handler configuration
 */
export interface HandlerConfig {
  /** Agent to use */
  agent: Agent;
  /** Streaming configuration */
  streaming?: StreamingConfig;
}

/**
 * SSE stream configuration
 */
export interface SSEStreamConfig {
  /** Initial data */
  initialData?: unknown;
  /** Heartbeat interval in ms */
  heartbeatInterval?: number;
}

/**
 * Runtime adapter options
 */
export interface RuntimeAdapterOptions {
  env?: Record<string, unknown>;
  ctx?: { waitUntil: (promise: Promise<unknown>) => void };
}

/**
 * Runtime adapter type
 */
export type RuntimeAdapter = (
  server: Server,
  options?: RuntimeAdapterOptions
) => {
  fetch: (request: Request) => Promise<Response>;
};

/**
 * Server interface
 */
export interface Server {
  /** Underlying Hono app */
  app: {
    fetch: (request: Request) => Promise<Response>;
    get: (path: string, handler: (c: Context) => Response | Promise<Response>) => void;
    post: (path: string, handler: (c: Context) => Response | Promise<Response>) => void;
    use: (path: string, middleware: MiddlewareHandler) => void;
  };
  /** Start listening (Node.js only) */
  listen?: (port: number) => void;
}
