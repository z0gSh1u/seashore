/**
 * @seashore/workflow - Tool Node
 *
 * Node type for tool execution
 */

import type { WorkflowNode, ToolNodeConfig, WorkflowContext } from '../types.js';

/**
 * Tool node output
 */
export interface ToolNodeOutput<T = unknown> {
  /** Tool execution result */
  readonly result: T;

  /** Whether execution succeeded */
  readonly success: boolean;

  /** Error message if failed */
  readonly error?: string;

  /** Execution duration in milliseconds */
  readonly durationMs: number;
}

/**
 * Create a tool node for executing a tool
 *
 * @example
 * ```typescript
 * import { createToolNode } from '@seashore/workflow';
 * import { searchTool } from './tools';
 *
 * const searchNode = createToolNode({
 *   name: 'search',
 *   tool: searchTool,
 *   input: (nodeInput, ctx) => ({
 *     query: ctx.nodeOutputs['analyze']?.query ?? nodeInput,
 *   }),
 * });
 * ```
 */
export function createToolNode<TToolInput = unknown, TToolOutput = unknown>(
  config: ToolNodeConfig<TToolInput, TToolOutput>
): WorkflowNode<unknown, ToolNodeOutput<TToolOutput>> {
  const { name, tool, input: inputMapper, transform } = config;

  return {
    name,
    type: 'tool',

    async execute(nodeInput: unknown, ctx: WorkflowContext): Promise<ToolNodeOutput<TToolOutput>> {
      const startTime = Date.now();
      void ctx; // Mark as intentionally unused

      try {
        // Map input
        const toolInput = inputMapper ? inputMapper(nodeInput, ctx) : (nodeInput as TToolInput);

        // Execute tool
        const result = await tool.execute(toolInput);

        // Transform output if needed
        const output = transform ? transform(result.data as TToolOutput) : result.data;

        return {
          result: output as TToolOutput,
          success: result.success,
          error: result.error,
          durationMs: Date.now() - startTime,
        };
      } catch (error) {
        return {
          result: undefined as TToolOutput,
          success: false,
          error: error instanceof Error ? error.message : String(error),
          durationMs: Date.now() - startTime,
        };
      }
    },
  };
}
