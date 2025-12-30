/**
 * @seashore/agent - ReAct Agent
 *
 * Implementation of the ReAct (Reasoning + Acting) agent pattern
 */

import { chat } from '@seashore/llm';
import type { Message, TokenUsage } from '@seashore/llm';
import { filterChatMessages } from '@seashore/llm';
import type { Tool } from '@seashore/tool';
import type {
  Agent,
  AgentConfig,
  AgentRunResult,
  AgentStreamChunk,
  RunOptions,
  ToolCallRecord,
} from './types';
import { executeTools, formatToolResult, type ToolCallRequest } from './tool-executor';
import { AgentError, checkAborted, wrapError } from './error-handler';
import { StreamChunks, collectStream } from './stream';

/**
 * Default configuration values
 */
const DEFAULT_MAX_ITERATIONS = 5;
const DEFAULT_TEMPERATURE = 0.7;

/**
 * Create a ReAct agent
 *
 * The ReAct pattern consists of:
 * 1. Thought: LLM reasons about the current state
 * 2. Action: LLM decides which tool to call (if any)
 * 3. Observation: Tool execution result
 * 4. Repeat until task is complete
 *
 * @example
 * ```typescript
 * import { createAgent } from '@seashore/agent';
 * import { openaiText } from '@seashore/llm';
 * import { defineTool } from '@seashore/tool';
 *
 * const weatherTool = defineTool({
 *   name: 'get_weather',
 *   description: 'Get current weather for a location',
 *   inputSchema: z.object({ location: z.string() }),
 *   execute: async ({ location }) => ({ temp: 72, conditions: 'sunny' }),
 * });
 *
 * const agent = createAgent({
 *   name: 'WeatherBot',
 *   systemPrompt: 'You are a helpful weather assistant.',
 *   model: openaiText('gpt-4o'),
 *   tools: [weatherTool],
 * });
 *
 * const result = await agent.run('What is the weather in Tokyo?');
 * console.log(result.content);
 * ```
 */
export function createAgent<
  TTools extends readonly Tool<unknown, unknown>[] = readonly Tool<unknown, unknown>[],
>(config: AgentConfig<TTools>): Agent<TTools> {
  const {
    name,
    systemPrompt,
    model,
    tools = [] as unknown as TTools,
    maxIterations = DEFAULT_MAX_ITERATIONS,
    temperature = DEFAULT_TEMPERATURE,
    outputSchema,
  } = config;

  // Convert tools to LLM tool format
  // @tanstack/ai expects inputSchema, not parameters
  const llmTools = tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    inputSchema: tool.jsonSchema,
  }));

  return {
    name,
    tools,

    async run(input: string, options?: RunOptions): Promise<AgentRunResult> {
      const messages: Message[] = [{ role: 'user', content: input }];
      return collectStream(this.chat(messages, options));
    },

    async *stream(input: string, options?: RunOptions): AsyncIterable<AgentStreamChunk> {
      const messages: Message[] = [{ role: 'user', content: input }];
      yield* this.chat(messages, options);
    },

    async *chat(
      messages: readonly Message[],
      options?: RunOptions
    ): AsyncIterable<AgentStreamChunk> {
      const startTime = Date.now();
      const effectiveMaxIterations = options?.maxIterations ?? maxIterations;
      const effectiveTemperature = options?.temperature ?? temperature;

      // Build conversation history (system prompt passed separately to chat)
      const conversationMessages: Message[] = [...messages];

      const allToolCalls: ToolCallRecord[] = [];
      let totalUsage: TokenUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
      let iterations = 0;
      let finalContent = '';

      try {
        // ReAct loop
        while (iterations < effectiveMaxIterations) {
          checkAborted(options?.signal);
          iterations++;

          // Call LLM
          let assistantContent = '';
          const pendingToolCalls: Map<string, { name: string; arguments: string }> = new Map();

          try {
            for await (const chunk of chat({
              adapter: model,
              messages: filterChatMessages(conversationMessages),
              systemPrompts: [systemPrompt],
              tools: llmTools.length > 0 ? llmTools : undefined,
              temperature: effectiveTemperature,
            })) {
              switch (chunk.type) {
                case 'content':
                  if (chunk.delta !== undefined) {
                    assistantContent += chunk.delta;
                    yield StreamChunks.content(chunk.delta);
                  }
                  break;

                case 'tool_call':
                  // @tanstack/ai sends complete tool calls in a single chunk
                  if (chunk.toolCall !== undefined) {
                    const { id, function: fn } = chunk.toolCall;
                    pendingToolCalls.set(id, {
                      name: fn.name,
                      arguments: fn.arguments,
                    });
                    // Emit start, args, and end for compatibility
                    yield StreamChunks.toolCallStart(id, fn.name);
                    yield StreamChunks.toolCallArgs(id, fn.name, fn.arguments);
                    yield StreamChunks.toolCallEnd(id, fn.name, fn.arguments);
                  }
                  break;

                case 'done':
                  if (chunk.usage !== undefined) {
                    totalUsage = addUsage(totalUsage, chunk.usage);
                  }
                  break;
              }
            }
          } catch (error) {
            throw wrapError(error, 'LLM_ERROR');
          }

          // Check if we have tool calls to execute
          if (pendingToolCalls.size > 0) {
            // Add assistant message with tool calls
            const toolCallsArray = Array.from(pendingToolCalls.entries()).map(
              ([id, { name, arguments: args }]) => ({
                id,
                type: 'function' as const,
                function: { name, arguments: args },
              })
            );

            conversationMessages.push({
              role: 'assistant',
              content: assistantContent || null,
              toolCalls: toolCallsArray,
            });

            // Execute tools
            const toolRequests: ToolCallRequest[] = Array.from(pendingToolCalls.entries()).map(
              ([id, { name, arguments: args }]) => ({ id, name, arguments: args })
            );

            const toolResults = await executeTools(tools, toolRequests, {
              agentName: name,
              threadId: options?.threadId,
              userId: options?.userId,
              signal: options?.signal,
            });

            // Yield tool results and add to conversation
            for (const result of toolResults) {
              allToolCalls.push(result);
              yield StreamChunks.toolResult(
                result.id,
                result.name,
                result.arguments,
                result.result
              );

              // Add tool response message
              conversationMessages.push({
                role: 'tool',
                content: formatToolResult(result),
                toolCallId: result.id,
                name: result.name,
              });
            }

            // Continue the loop for next iteration
            continue;
          }

          // No tool calls, this is the final response
          finalContent = assistantContent;
          break;
        }

        // Check if we exceeded max iterations
        const finishReason: AgentRunResult['finishReason'] =
          iterations >= effectiveMaxIterations ? 'max_iterations' : 'stop';

        const result: AgentRunResult = {
          content: finalContent,
          structured:
            outputSchema !== undefined ? tryParseStructured(finalContent, outputSchema) : undefined,
          toolCalls: allToolCalls,
          usage: totalUsage,
          durationMs: Date.now() - startTime,
          finishReason,
        };

        yield StreamChunks.finish(result);
      } catch (error) {
        const agentError = error instanceof AgentError ? error : wrapError(error, 'UNKNOWN');

        yield StreamChunks.error(agentError);

        const result: AgentRunResult = {
          content: finalContent,
          toolCalls: allToolCalls,
          usage: totalUsage,
          durationMs: Date.now() - startTime,
          finishReason: 'error',
          error: agentError.message,
        };

        yield StreamChunks.finish(result);
      }
    },
  };
}

/**
 * Add two TokenUsage objects
 */
function addUsage(a: TokenUsage, b: TokenUsage): TokenUsage {
  return {
    promptTokens: a.promptTokens + b.promptTokens,
    completionTokens: a.completionTokens + b.completionTokens,
    totalTokens: a.totalTokens + b.totalTokens,
  };
}

/**
 * Try to parse structured output from content
 */
function tryParseStructured(
  content: string,
  schema: { parse: (data: unknown) => unknown }
): unknown {
  try {
    // Try to find JSON in the content
    const jsonMatch = content.match(/```json\n?([\s\S]*?)\n?```/) ?? content.match(/\{[\s\S]*\}/);

    if (jsonMatch !== null) {
      const jsonStr = jsonMatch[1] ?? jsonMatch[0];
      const parsed = JSON.parse(jsonStr) as unknown;
      return schema.parse(parsed);
    }
  } catch {
    // Ignore parse errors
  }
  return undefined;
}
