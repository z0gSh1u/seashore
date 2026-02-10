/**
 * MCP (Model Context Protocol) client integration
 *
 * Provides utilities to connect to MCP servers and convert MCP tools
 * to @tanstack/ai tool definitions.
 */

export { connectMCP, convertMCPToolToTanstack } from './client.js'
export type { MCPConnectionConfig } from './client.js'
