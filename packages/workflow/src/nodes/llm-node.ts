/**
 * @seashore/workflow - LLM Node
 *
 * Node type for LLM operations
 */

import type { WorkflowNode, LLMNodeConfig, WorkflowContext } from '../types.js';

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
 * Create an LLM node for chat completions
 *
 * @example
 * ```typescript
 * import { createLLMNode } from '@seashore/workflow';
 * import { openaiText } from '@seashore/llm';
 *
 * const analyzeNode = createLLMNode({
 *   name: 'analyze',
 *   adapter: openaiText('gpt-4o'),
 *   systemPrompt: 'You are an analyzer.',
 *   prompt: 'Analyze this: {{input}}',
 * });
 * ```
 */
export function createLLMNode(config: LLMNodeConfig): WorkflowNode<unknown, LLMNodeOutput> {
  const {
    name,
    adapter: _adapter,
    prompt,
    messages: messagesBuilder,
    systemPrompt,
    tools: _tools,
    outputSchema,
    temperature: _temperature,
  } = config;

  return {
    name,
    type: 'llm',
    outputSchema,

    async execute(input: unknown, ctx: WorkflowContext): Promise<LLMNodeOutput> {
      // Build messages
      let messages: Array<{ role: string; content: string }>;

      if (messagesBuilder) {
        messages = await Promise.resolve(messagesBuilder(input, ctx));
      } else {
        const promptContent =
          typeof prompt === 'function'
            ? await prompt(input, ctx)
            : (prompt ?? JSON.stringify(input));

        messages = [];
        if (systemPrompt) {
          messages.push({ role: 'system', content: systemPrompt });
        }
        messages.push({ role: 'user', content: promptContent });
      }

      // For now, return a simple structure
      // In a real implementation, this would call the adapter
      // This is a simplified version that shows the interface

      // Note: The actual adapter integration depends on @tanstack/ai patterns
      // which may vary. This provides a compatible interface.
      const result: LLMNodeOutput = {
        content: `[LLM Response for ${name}]`,
        structured: outputSchema ? {} : undefined,
        usage: {
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
        },
      };

      return result;
    },
  };
}
