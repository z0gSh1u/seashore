import { chat, maxIterations } from '@tanstack/ai'
import type {
  ReActAgentConfig,
  ReActAgent,
  Message,
  AgentResponse,
  StreamingAgentResponse,
  RunOptions,
  AgentResult,
} from './types.js'

/**
 * Creates a ReAct (Reasoning + Acting) agent that can use tools
 * and iterate through multiple steps to solve tasks.
 *
 * @param config - Configuration for the agent
 * @returns ReAct agent instance
 *
 * @example
 * ```typescript
 * import { createReActAgent } from '@seashore/agent'
 * import { createLLMAdapter } from '@seashore/core'
 * import { z } from 'zod'
 *
 * const searchTool = {
 *   name: 'search',
 *   description: 'Search the web',
 *   parameters: z.object({ query: z.string() }),
 *   execute: async ({ query }) => {
 *     // Search implementation
 *     return { results: [...] }
 *   }
 * }
 *
 * const agent = createReActAgent({
 *   model: createLLMAdapter('openai', { apiKey: process.env.OPENAI_API_KEY }),
 *   systemPrompt: 'You are a helpful research assistant',
 *   tools: [searchTool],
 *   maxIterations: 5
 * })
 *
 * const response = await agent.run([
 *   { role: 'user', content: 'What is the weather in SF?' }
 * ])
 * ```
 */
export function createReActAgent(config: ReActAgentConfig): ReActAgent {
  const {
    model,
    systemPrompt,
    tools = [],
    maxIterations: maxIters = 10,
    guardrails = [],
    outputSchema,
  } = config

  /**
   * Apply all beforeRequest guardrails to messages
   */
  async function applyBeforeRequestGuardrails(messages: Message[]): Promise<Message[]> {
    let processedMessages = messages

    for (const guardrail of guardrails) {
      if (guardrail.beforeRequest) {
        processedMessages = await guardrail.beforeRequest(processedMessages)
      }
    }

    return processedMessages
  }

  /**
   * Apply all afterResponse guardrails to result
   */
  async function applyAfterResponseGuardrails(result: AgentResult): Promise<AgentResult> {
    let processedResult = result

    for (const guardrail of guardrails) {
      if (guardrail.afterResponse) {
        processedResult = await guardrail.afterResponse(processedResult)
      }
    }

    return processedResult
  }

  /**
   * Build the chat options for TanStack AI
   */
  function buildChatOptions(messages: Message[], options?: RunOptions) {
    const chatOptions: any = {
      model: model(),
      messages: [{ role: 'system' as const, content: systemPrompt }, ...messages],
      maxSteps: maxIterations(maxIters),
    }

    if (tools.length > 0) {
      chatOptions.tools = tools
    }

    if (outputSchema) {
      chatOptions.output = outputSchema
    }

    if (options?.abortSignal) {
      chatOptions.abortSignal = options.abortSignal
    }

    return chatOptions
  }

  const agent: ReActAgent = {
    /**
     * Run the agent with the given messages
     */
    async run(messages: Message[], options?: RunOptions): Promise<AgentResponse> {
      // Apply beforeRequest guardrails
      const processedMessages = await applyBeforeRequestGuardrails(messages)

      // Build chat options
      const chatOptions = buildChatOptions(processedMessages, options)

      // Call TanStack AI chat
      const response = await chat(chatOptions)

      // Extract result
      let result: AgentResult = {
        content: response.result?.content || '',
        toolCalls: response.result?.toolCalls || [],
      }

      // Apply afterResponse guardrails
      result = await applyAfterResponseGuardrails(result)

      return {
        messages: response.messages as Message[],
        result,
      }
    },

    /**
     * Stream the agent execution
     */
    async stream(messages: Message[], options?: RunOptions): Promise<StreamingAgentResponse> {
      // Apply beforeRequest guardrails
      const processedMessages = await applyBeforeRequestGuardrails(messages)

      // Build chat options
      const chatOptions = buildChatOptions(processedMessages, options)

      // Call TanStack AI chat
      const response = await chat(chatOptions)

      // Extract result
      let result: AgentResult = {
        content: response.result?.content || '',
        toolCalls: response.result?.toolCalls || [],
      }

      // Apply afterResponse guardrails
      result = await applyAfterResponseGuardrails(result)

      return {
        messages: response.messages as Message[],
        result,
        stream: response.stream,
      }
    },
  }

  return agent
}
