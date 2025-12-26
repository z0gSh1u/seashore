/**
 * @seashore/mcp - MCP (Model Context Protocol) client for Seashore Agent framework
 * @module @seashore/mcp
 *
 * @example Basic usage
 * ```typescript
 * import { createMCPClient, createMCPToolBridge } from '@seashore/mcp'
 * import { createAgent } from '@seashore/agent'
 * import { openaiText } from '@seashore/llm'
 *
 * // Connect to an MCP server
 * const client = await createMCPClient({
 *   transport: 'stdio',
 *   command: 'npx',
 *   args: ['-y', '@modelcontextprotocol/server-filesystem', '/path/to/allowed'],
 * })
 *
 * // Bridge MCP tools to Seashore format
 * const bridge = await createMCPToolBridge({
 *   client,
 *   rename: (name) => `fs_${name}`,
 * })
 *
 * // Use in an agent
 * const agent = createAgent({
 *   name: 'file-agent',
 *   adapter: openaiText('gpt-4o'),
 *   tools: bridge.getTools(),
 * })
 * ```
 */

// MCP Client
export { createMCPClient, type MCPClient, type MCPClientConfig } from './client.js';

// Tool Bridge
export { createMCPToolBridge, type ToolBridge, type ToolBridgeConfig } from './bridge.js';

// Server Discovery
export {
  discoverMCPServers,
  autoDiscoverMCPServers,
  type ServerInfo,
  type MCPServerConfig,
} from './discovery.js';

// Transports
export {
  StdioTransport,
  createStdioTransport,
  SSETransport,
  createSSETransport,
  WebSocketTransport,
  createWebSocketTransport,
  MCPError,
  MCPConnectionError,
  MCPTimeoutError,
} from './transports/index.js';

// Types
export type {
  MCPTool,
  MCPResource,
  MCPPrompt,
  MCPPromptArgument,
  MCPToolResult,
  MCPResourceResult,
  MCPPromptResult,
  MCPContent,
  MCPTextContent,
  MCPImageContent,
  MCPResourceContent,
  MCPResourceContents,
  MCPPromptMessage,
  MCPResourceCallback,
  MCPResourceChangeEvent,
  JSONSchema,
} from './types.js';
