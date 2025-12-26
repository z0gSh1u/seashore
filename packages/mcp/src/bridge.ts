/**
 * MCP Tool Bridge - bridges MCP tools to Seashore tool format
 * @module @seashore/mcp
 */

import type { ToolConfig } from '@seashore/tool';
import type { MCPClient, MCPTool, ToolBridgeConfig, JSONSchema } from './types.js';
import { z } from 'zod';

/**
 * Tool Bridge interface
 */
export interface ToolBridge {
  /** Get all bridged tools */
  getTools(): ToolConfig<z.ZodTypeAny, unknown>[];
  /** Get a specific bridged tool by name */
  getTool(name: string): ToolConfig<z.ZodTypeAny, unknown> | undefined;
}

/**
 * Convert JSON Schema to Zod schema
 * This is a simplified conversion that handles common cases
 */
function jsonSchemaToZod(schema: JSONSchema): z.ZodTypeAny {
  if (!schema.type) {
    return z.any();
  }

  switch (schema.type) {
    case 'string':
      let stringSchema = z.string();
      if (schema.description) {
        stringSchema = stringSchema.describe(schema.description);
      }
      return stringSchema;

    case 'number':
    case 'integer':
      let numberSchema = z.number();
      if (schema.description) {
        numberSchema = numberSchema.describe(schema.description);
      }
      return numberSchema;

    case 'boolean':
      let boolSchema = z.boolean();
      if (schema.description) {
        boolSchema = boolSchema.describe(schema.description);
      }
      return boolSchema;

    case 'array':
      const itemSchema = schema.items ? jsonSchemaToZod(schema.items) : z.any();
      let arraySchema = z.array(itemSchema);
      if (schema.description) {
        arraySchema = arraySchema.describe(schema.description);
      }
      return arraySchema;

    case 'object':
      if (schema.properties) {
        const shape: Record<string, z.ZodTypeAny> = {};
        const required = schema.required ?? [];

        for (const [key, value] of Object.entries(schema.properties)) {
          const propSchema = jsonSchemaToZod(value);
          shape[key] = required.includes(key) ? propSchema : propSchema.optional();
        }

        let objectSchema = z.object(shape);
        if (schema.description) {
          objectSchema = objectSchema.describe(schema.description);
        }
        return objectSchema;
      }
      return z.record(z.any());

    case 'null':
      return z.null();

    default:
      return z.any();
  }
}

/**
 * Create a Seashore tool from an MCP tool
 */
function createSeahoreTool(
  client: MCPClient,
  mcpTool: MCPTool,
  options: {
    rename?: (name: string) => string;
    descriptionPrefix?: string;
  }
): ToolConfig<z.ZodTypeAny, unknown> {
  const name = options.rename ? options.rename(mcpTool.name) : mcpTool.name;
  const description = options.descriptionPrefix
    ? `${options.descriptionPrefix}${mcpTool.description ?? ''}`
    : (mcpTool.description ?? '');

  // Convert JSON Schema to Zod
  const inputSchema = jsonSchemaToZod(mcpTool.inputSchema);

  return {
    name,
    description,
    inputSchema,
    execute: async (input: unknown) => {
      const result = await client.callTool(mcpTool.name, input);

      // Extract text content from MCP result
      if (result.content && result.content.length > 0) {
        const textContent = result.content
          .filter((c) => c.type === 'text')
          .map((c) => (c as { type: 'text'; text: string }).text)
          .join('\n');

        if (result.isError) {
          throw new Error(textContent || 'MCP tool execution failed');
        }

        return textContent || result;
      }

      return result;
    },
  };
}

/**
 * Create an MCP tool bridge
 * Converts MCP tools to Seashore tool format
 * @example
 * ```typescript
 * import { createMCPClient, createMCPToolBridge } from '@seashore/mcp'
 * import { createAgent } from '@seashore/agent'
 *
 * const client = await createMCPClient({
 *   transport: 'stdio',
 *   command: 'npx',
 *   args: ['-y', '@modelcontextprotocol/server-filesystem', '/path'],
 * })
 *
 * const bridge = await createMCPToolBridge({
 *   client,
 *   rename: (name) => `fs_${name}`,
 * })
 *
 * const agent = createAgent({
 *   name: 'file-agent',
 *   adapter: openaiText('gpt-4o'),
 *   tools: bridge.getTools(),
 * })
 * ```
 */
export async function createMCPToolBridge(config: ToolBridgeConfig): Promise<ToolBridge> {
  const { client, filter, rename, descriptionPrefix } = config;

  // Fetch tools from MCP server
  let mcpTools = await client.listTools();

  // Apply filter if provided
  if (filter) {
    mcpTools = mcpTools.filter(filter);
  }

  // Convert to Seashore tools
  const tools = mcpTools.map((mcpTool) =>
    createSeahoreTool(client, mcpTool, { rename, descriptionPrefix })
  );

  // Create name lookup map
  const toolMap = new Map<string, ToolConfig<z.ZodTypeAny, unknown>>();
  for (const tool of tools) {
    toolMap.set(tool.name, tool);
  }

  return {
    getTools(): ToolConfig<z.ZodTypeAny, unknown>[] {
      return tools;
    },

    getTool(name: string): ToolConfig<z.ZodTypeAny, unknown> | undefined {
      return toolMap.get(name);
    },
  };
}

export type { ToolBridgeConfig };
