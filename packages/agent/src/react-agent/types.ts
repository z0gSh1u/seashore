import type { z } from 'zod'

/**
 * Message in a conversation
 */
export interface Message {
  role: 'user' | 'assistant' | 'system'
  content: string
}

/**
 * Tool call made by the agent
 */
export interface ToolCall {
  id: string
  name: string
  arguments: Record<string, unknown>
}

/**
 * Result from agent execution
 */
export interface AgentResult {
  content: string
  toolCalls: ToolCall[]
}

/**
 * Full agent response with messages and result
 */
export interface AgentResponse {
  messages: Message[]
  result: AgentResult
}

/**
 * Streaming agent response
 */
export interface StreamingAgentResponse extends AgentResponse {
  stream: AsyncIterable<any>
}

/**
 * Guardrail hook for modifying messages before sending
 */
export type BeforeRequestHook = (messages: Message[]) => Message[] | Promise<Message[]>

/**
 * Guardrail hook for modifying the response after receiving
 */
export type AfterResponseHook = (result: AgentResult) => AgentResult | Promise<AgentResult>

/**
 * Guardrail configuration
 */
export interface Guardrail {
  beforeRequest?: BeforeRequestHook
  afterResponse?: AfterResponseHook
}

/**
 * Tool definition for the agent
 */
export interface Tool {
  name: string
  description: string
  parameters: z.ZodType<any>
  execute: (args: any) => Promise<any> | any
}

/**
 * Options for running the agent
 */
export interface RunOptions {
  abortSignal?: AbortSignal
}

/**
 * Configuration for creating a ReAct agent
 */
export interface ReActAgentConfig {
  /**
   * Model function from @seashore/core (returns a TanStack AI model)
   */
  model: () => any

  /**
   * System prompt for the agent
   */
  systemPrompt: string

  /**
   * Tools available to the agent
   */
  tools?: Tool[]

  /**
   * Maximum iterations for the agent loop (default: 10)
   */
  maxIterations?: number

  /**
   * Guardrails for request/response filtering
   */
  guardrails?: Guardrail[]

  /**
   * Output schema for structured responses
   */
  outputSchema?: z.ZodType<any>
}

/**
 * ReAct agent interface
 */
export interface ReActAgent {
  /**
   * Run the agent with given messages
   */
  run(messages: Message[], options?: RunOptions): Promise<AgentResponse>

  /**
   * Stream the agent execution
   */
  stream(messages: Message[], options?: RunOptions): Promise<StreamingAgentResponse>
}
