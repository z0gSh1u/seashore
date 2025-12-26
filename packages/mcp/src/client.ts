/**
 * MCP Client implementation
 * @module @seashore/mcp
 */

import type {
  MCPClient,
  MCPClientConfig,
  MCPTool,
  MCPResource,
  MCPPrompt,
  MCPToolResult,
  MCPResourceResult,
  MCPPromptResult,
  MCPResourceCallback,
} from './types.js';
import {
  StdioTransport,
  SSETransport,
  WebSocketTransport,
  MCPConnectionError,
} from './transports/index.js';

/**
 * Transport interface for internal use
 */
interface Transport {
  connect(): Promise<void>;
  request(method: string, params?: unknown): Promise<unknown>;
  notify(method: string, params?: unknown): void;
  onNotification(method: string, handler: (params: unknown) => void): void;
  isConnected(): boolean;
  disconnect(): Promise<void>;
  reconnect(): Promise<void>;
  close(): Promise<void>;
}

/**
 * MCP Client implementation
 */
class MCPClientImpl implements MCPClient {
  private transport: Transport;
  private resourceSubscriptions = new Map<string, MCPResourceCallback>();

  constructor(transport: Transport) {
    this.transport = transport;

    // Setup resource change notification handler
    this.transport.onNotification('notifications/resources/updated', (params) => {
      const { uri } = params as { uri: string };
      const callback = this.resourceSubscriptions.get(uri);
      if (callback) {
        callback({ uri });
      }
    });
  }

  // Tool operations

  async listTools(): Promise<MCPTool[]> {
    const result = await this.transport.request('tools/list', {});
    const { tools } = result as { tools: MCPTool[] };
    return tools;
  }

  async callTool(name: string, args: unknown): Promise<MCPToolResult> {
    const result = await this.transport.request('tools/call', {
      name,
      arguments: args,
    });
    return result as MCPToolResult;
  }

  // Resource operations

  async listResources(): Promise<MCPResource[]> {
    const result = await this.transport.request('resources/list', {});
    const { resources } = result as { resources: MCPResource[] };
    return resources;
  }

  async readResource(uri: string): Promise<MCPResourceResult> {
    const result = await this.transport.request('resources/read', { uri });
    return result as MCPResourceResult;
  }

  async subscribeResource(uri: string, callback: MCPResourceCallback): Promise<void> {
    await this.transport.request('resources/subscribe', { uri });
    this.resourceSubscriptions.set(uri, callback);
  }

  async unsubscribeResource(uri: string): Promise<void> {
    await this.transport.request('resources/unsubscribe', { uri });
    this.resourceSubscriptions.delete(uri);
  }

  // Prompt operations

  async listPrompts(): Promise<MCPPrompt[]> {
    const result = await this.transport.request('prompts/list', {});
    const { prompts } = result as { prompts: MCPPrompt[] };
    return prompts;
  }

  async getPrompt(name: string, args: Record<string, string>): Promise<MCPPromptResult> {
    const result = await this.transport.request('prompts/get', {
      name,
      arguments: args,
    });
    return result as MCPPromptResult;
  }

  // Lifecycle

  isConnected(): boolean {
    return this.transport.isConnected();
  }

  async disconnect(): Promise<void> {
    await this.transport.disconnect();
  }

  async reconnect(): Promise<void> {
    await this.transport.reconnect();
  }

  async close(): Promise<void> {
    this.resourceSubscriptions.clear();
    await this.transport.close();
  }
}

/**
 * Create an MCP client
 * @param config - Client configuration
 * @returns Connected MCP client
 * @example
 * ```typescript
 * // Connect to stdio server
 * const client = await createMCPClient({
 *   transport: 'stdio',
 *   command: 'node',
 *   args: ['./mcp-server.js'],
 * })
 *
 * // Connect to SSE server
 * const sseClient = await createMCPClient({
 *   transport: 'sse',
 *   url: 'http://localhost:3001/mcp',
 * })
 *
 * // Connect to WebSocket server
 * const wsClient = await createMCPClient({
 *   transport: 'websocket',
 *   url: 'ws://localhost:3001/mcp',
 * })
 * ```
 */
export async function createMCPClient(config: MCPClientConfig): Promise<MCPClient> {
  let transport: Transport;

  switch (config.transport) {
    case 'stdio':
      if (!config.command) {
        throw new MCPConnectionError('stdio transport requires command');
      }
      transport = new StdioTransport(config);
      break;

    case 'sse':
      if (!config.url) {
        throw new MCPConnectionError('sse transport requires url');
      }
      transport = new SSETransport(config);
      break;

    case 'websocket':
      if (!config.url) {
        throw new MCPConnectionError('websocket transport requires url');
      }
      transport = new WebSocketTransport(config);
      break;

    default:
      throw new MCPConnectionError(`Unknown transport: ${config.transport}`);
  }

  await transport.connect();
  return new MCPClientImpl(transport);
}

export type { MCPClient, MCPClientConfig };
