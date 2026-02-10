import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js'
import { toolDefinition } from '@tanstack/ai'
import { z } from 'zod'

export interface MCPConnectionConfig {
  transport: 'stdio' | 'sse'
  // stdio options
  command?: string
  args?: string[]
  // sse options
  url?: string
}

/**
 * Convert an MCP tool's JSON Schema to a @tanstack/ai tool definition.
 * This is a simplified converter — it does not handle all JSON Schema features.
 */
export function convertMCPToolToTanstack(
  mcpTool: { name: string; description?: string; inputSchema?: Record<string, unknown> },
  callFn: (args: Record<string, unknown>) => Promise<unknown>,
) {
  // Build a permissive Zod schema from JSON Schema
  // For full fidelity you'd use a json-schema-to-zod library,
  // but for the MVP we use z.record as a passthrough
  const def = toolDefinition({
    name: mcpTool.name,
    description: mcpTool.description ?? '',
    inputSchema: z.record(z.unknown()),
  })

  return def.server(async (input) => {
    return callFn(input as Record<string, unknown>)
  })
}

export async function connectMCP(config: MCPConnectionConfig) {
  let transport: StdioClientTransport | SSEClientTransport

  if (config.transport === 'stdio') {
    if (!config.command) throw new Error('command is required for stdio transport')
    transport = new StdioClientTransport({
      command: config.command,
      args: config.args ?? [],
    })
  } else if (config.transport === 'sse') {
    if (!config.url) throw new Error('url is required for sse transport')
    transport = new SSEClientTransport(new URL(config.url))
  } else {
    throw new Error(`Unsupported transport: ${String(config.transport)}`)
  }

  const client = new Client({ name: 'seashore-mcp-client', version: '0.0.1' })
  await client.connect(transport)

  const { tools } = await client.listTools()

  return tools.map((tool) =>
    convertMCPToolToTanstack(tool, async (args) => {
      const result = await client.callTool({ name: tool.name, arguments: args })
      return result.content
    }),
  )
}
