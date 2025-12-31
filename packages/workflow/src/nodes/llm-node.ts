/**
 * @seashore/workflow - LLM Node
 *
 * Node type for LLM operations with flexible adapter configuration
 */

import type { WorkflowNode, LLMNodeConfig, LLMAdapter, WorkflowContext } from '../types';
import type { TextAdapter, TextAdapterConfig, ChatMessage } from '@seashore/llm';
import { chat, createTextAdapter } from '@seashore/llm';
import { NodeExecutionError } from '../error-handler';

/**
 * LLM node output
 */
export interface LLMNodeOutput {
  /** Response content */
  readonly content: string;

  /** Structured output (if schema provided) */
  readonly structured?: unknown;

  /** Token usage */
  readonly usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };

  /** Tool calls made (if any) */
  readonly toolCalls?: Array<{
    id: string;
    name: string;
    arguments: unknown;
    result?: unknown;
  }>;
}

/**
 * Type guard to check if an adapter is a TextAdapterConfig object
 *
 * @param adapter - The adapter to check
 * @returns True if the adapter is a TextAdapterConfig object
 */
export function isTextAdapterConfig(adapter: unknown): adapter is TextAdapterConfig {
  if (adapter === null || adapter === undefined) {
    return false;
  }
  if (typeof adapter !== 'object') {
    return false;
  }
  const obj = adapter as Record<string, unknown>;
  const validProviders = ['openai', 'anthropic', 'gemini'];
  return (
    typeof obj.provider === 'string' &&
    validProviders.includes(obj.provider) &&
    typeof obj.model === 'string'
  );
}

/**
 * Resolve adapter from LLMAdapter (TextAdapter or TextAdapterConfig)
 *
 * @param adapter - The adapter or config to resolve
 * @returns A resolved TextAdapter
 */
function resolveAdapter(adapter: LLMAdapter): TextAdapter {
  if (isTextAdapterConfig(adapter)) {
    return createTextAdapter(adapter);
  }
  // Already a TextAdapter
  return adapter as TextAdapter;
}

/**
 * Create an LLM node for chat completions
 *
 * @example
 * ```typescript
 * import { createLLMNode } from '@seashore/workflow';
 * import { openaiText } from '@seashore/llm';
 *
 * // Using TextAdapter directly (full configuration)
 * const analyzeNode = createLLMNode({
 *   name: 'analyze',
 *   adapter: openaiText('gpt-4o', {
 *     baseURL: 'https://api.example.com/v1',
 *     apiKey: process.env.CUSTOM_API_KEY,
 *   }),
 *   systemPrompt: 'You are an analyzer.',
 *   prompt: 'Analyze this: {{input}}',
 * });
 *
 * // Using TextAdapterConfig (simpler configuration)
 * const summarizeNode = createLLMNode({
 *   name: 'summarize',
 *   adapter: { provider: 'openai', model: 'gpt-4o' },
 *   prompt: 'Summarize the analysis.',
 * });
 * ```
 */
export function createLLMNode(config: LLMNodeConfig): WorkflowNode<unknown, LLMNodeOutput> {
  const {
    name,
    adapter: adapterConfig,
    prompt,
    messages: messagesBuilder,
    systemPrompt,
    tools,
    outputSchema,
    temperature,
    // Note: maxTokens is not directly supported by @tanstack/ai chat()
    // It should be configured in the adapter instead
    maxTokens: _maxTokens,
  } = config;

  // Resolve adapter once at node creation time
  const resolvedAdapter = resolveAdapter(adapterConfig);

  return {
    name,
    type: 'llm',
    outputSchema,

    async execute(input: unknown, ctx: WorkflowContext): Promise<LLMNodeOutput> {
      // Build messages - using ChatMessage type compatible with @tanstack/ai
      let chatMessages: ChatMessage[];

      if (messagesBuilder) {
        const builtMessages = await Promise.resolve(messagesBuilder(input, ctx));
        // Convert to ChatMessage format (filter out system messages)
        chatMessages = builtMessages
          .filter((m) => m.role !== 'system')
          .map((m) => ({
            role: m.role as 'user' | 'assistant' | 'tool',
            content: m.content ?? null,
          }));
      } else {
        const promptContent =
          typeof prompt === 'function'
            ? await prompt(input, ctx)
            : (prompt ?? JSON.stringify(input));

        chatMessages = [{ role: 'user', content: promptContent }];
      }

      try {
        // Call the LLM using @tanstack/ai chat function
        const stream = chat({
          adapter: resolvedAdapter,
          messages: chatMessages,
          systemPrompts: systemPrompt ? [systemPrompt] : undefined,
          tools: tools as Parameters<typeof chat>[0]['tools'],
          temperature: temperature,
          // maxTokens is not directly supported by chat(), handled by adapter
        });

        // Collect streaming response
        let content = '';
        let usage:
          | {
              promptTokens: number;
              completionTokens: number;
              totalTokens: number;
            }
          | undefined;
        const toolCalls: Array<{
          id: string;
          name: string;
          arguments: unknown;
          result?: unknown;
        }> = [];

        for await (const chunk of stream) {
          switch (chunk.type) {
            case 'content':
              // Content chunks contain delta text
              if (chunk.delta) {
                content += chunk.delta;
              }
              break;

            case 'tool_call':
              // Track tool calls
              if (chunk.toolCall) {
                const tc = chunk.toolCall;
                if (tc.id && tc.function?.name) {
                  toolCalls.push({
                    id: tc.id,
                    name: tc.function.name,
                    arguments: tc.function.arguments
                      ? JSON.parse(tc.function.arguments)
                      : undefined,
                  });
                }
              }
              break;

            case 'done':
              // Capture usage if available
              if (chunk.usage) {
                usage = chunk.usage;
              }
              break;

            case 'error':
              // Handle error chunks
              if (chunk.error) {
                throw new NodeExecutionError(
                  `LLM request failed: ${chunk.error.message ?? 'Unknown error'}`,
                  name
                );
              }
              break;
          }
        }

        const result: LLMNodeOutput = {
          content,
          structured: outputSchema ? undefined : undefined, // TODO: Implement structured output
          usage,
          toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        };

        return result;
      } catch (error) {
        // Wrap any errors in NodeExecutionError
        if (error instanceof NodeExecutionError) {
          throw error;
        }
        const errorMessage = error instanceof Error ? error.message : String(error);
        throw new NodeExecutionError(`LLM request failed: ${errorMessage}`, name);
      }
    },
  };
}
