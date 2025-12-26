/**
 * MCP Client tests
 * @module @seashore/mcp
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createMCPClient,
  createMCPToolBridge,
  discoverMCPServers,
  MCPConnectionError,
} from '../src/index.js';
import type { MCPClient, MCPTool } from '../src/types.js';

// Mock implementations
const mockTools: MCPTool[] = [
  {
    name: 'search',
    description: 'Search for information',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
        limit: { type: 'number', description: 'Max results' },
      },
      required: ['query'],
    },
  },
  {
    name: 'read_file',
    description: 'Read a file',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'File path' },
      },
      required: ['path'],
    },
  },
];

// Mock client for testing
function createMockClient(): MCPClient & { _connected: boolean } {
  return {
    _connected: true,
    listTools: vi.fn().mockResolvedValue(mockTools),
    callTool: vi.fn().mockResolvedValue({
      content: [{ type: 'text', text: 'Mock result' }],
    }),
    listResources: vi
      .fn()
      .mockResolvedValue([{ uri: 'file:///test.txt', name: 'test.txt', mimeType: 'text/plain' }]),
    readResource: vi.fn().mockResolvedValue({
      contents: [{ uri: 'file:///test.txt', text: 'File content' }],
    }),
    subscribeResource: vi.fn().mockResolvedValue(undefined),
    unsubscribeResource: vi.fn().mockResolvedValue(undefined),
    listPrompts: vi.fn().mockResolvedValue([{ name: 'summarize', description: 'Summarize text' }]),
    getPrompt: vi.fn().mockResolvedValue({
      messages: [{ role: 'user', content: { type: 'text', text: 'Summarize this' } }],
    }),
    isConnected: function () {
      return this._connected;
    },
    disconnect: vi.fn().mockImplementation(function (this: { _connected: boolean }) {
      this._connected = false;
    }),
    reconnect: vi.fn().mockImplementation(function (this: { _connected: boolean }) {
      this._connected = true;
    }),
    close: vi.fn().mockImplementation(function (this: { _connected: boolean }) {
      this._connected = false;
    }),
  };
}

describe('@seashore/mcp', () => {
  describe('createMCPClient', () => {
    it('should throw error for missing command in stdio transport', async () => {
      await expect(
        createMCPClient({
          transport: 'stdio',
        })
      ).rejects.toThrow('stdio transport requires command');
    });

    it('should throw error for missing url in sse transport', async () => {
      await expect(
        createMCPClient({
          transport: 'sse',
        })
      ).rejects.toThrow('sse transport requires url');
    });

    it('should throw error for missing url in websocket transport', async () => {
      await expect(
        createMCPClient({
          transport: 'websocket',
        })
      ).rejects.toThrow('websocket transport requires url');
    });

    it('should throw error for unknown transport', async () => {
      await expect(
        createMCPClient({
          transport: 'unknown' as 'stdio',
        })
      ).rejects.toThrow('Unknown transport');
    });
  });

  describe('MCPClient operations', () => {
    let client: MCPClient;

    beforeEach(() => {
      client = createMockClient();
    });

    it('should list tools', async () => {
      const tools = await client.listTools();
      expect(tools).toHaveLength(2);
      expect(tools[0].name).toBe('search');
      expect(tools[1].name).toBe('read_file');
    });

    it('should call a tool', async () => {
      const result = await client.callTool('search', { query: 'test' });
      expect(result.content).toHaveLength(1);
      expect(result.content[0]).toEqual({ type: 'text', text: 'Mock result' });
    });

    it('should list resources', async () => {
      const resources = await client.listResources();
      expect(resources).toHaveLength(1);
      expect(resources[0].uri).toBe('file:///test.txt');
    });

    it('should read a resource', async () => {
      const result = await client.readResource('file:///test.txt');
      expect(result.contents).toHaveLength(1);
      expect(result.contents[0].text).toBe('File content');
    });

    it('should list prompts', async () => {
      const prompts = await client.listPrompts();
      expect(prompts).toHaveLength(1);
      expect(prompts[0].name).toBe('summarize');
    });

    it('should get a prompt', async () => {
      const result = await client.getPrompt('summarize', { content: 'Test text' });
      expect(result.messages).toHaveLength(1);
    });

    it('should check connection status', () => {
      expect(client.isConnected()).toBe(true);
    });

    it('should disconnect', async () => {
      await client.disconnect();
      expect(client.isConnected()).toBe(false);
    });

    it('should reconnect', async () => {
      await client.disconnect();
      expect(client.isConnected()).toBe(false);
      await client.reconnect();
      expect(client.isConnected()).toBe(true);
    });
  });

  describe('createMCPToolBridge', () => {
    let mockClient: MCPClient;

    beforeEach(() => {
      mockClient = createMockClient();
    });

    it('should bridge MCP tools to Seashore format', async () => {
      const bridge = await createMCPToolBridge({ client: mockClient });
      const tools = bridge.getTools();

      expect(tools).toHaveLength(2);
      expect(tools[0].name).toBe('search');
      expect(tools[0].description).toBe('Search for information');
      expect(tools[0].execute).toBeDefined();
    });

    it('should filter tools', async () => {
      const bridge = await createMCPToolBridge({
        client: mockClient,
        filter: (tool) => tool.name === 'search',
      });
      const tools = bridge.getTools();

      expect(tools).toHaveLength(1);
      expect(tools[0].name).toBe('search');
    });

    it('should rename tools', async () => {
      const bridge = await createMCPToolBridge({
        client: mockClient,
        rename: (name) => `mcp_${name}`,
      });
      const tools = bridge.getTools();

      expect(tools[0].name).toBe('mcp_search');
      expect(tools[1].name).toBe('mcp_read_file');
    });

    it('should add description prefix', async () => {
      const bridge = await createMCPToolBridge({
        client: mockClient,
        descriptionPrefix: '[External] ',
      });
      const tools = bridge.getTools();

      expect(tools[0].description).toBe('[External] Search for information');
    });

    it('should get tool by name', async () => {
      const bridge = await createMCPToolBridge({ client: mockClient });
      const tool = bridge.getTool('search');

      expect(tool).toBeDefined();
      expect(tool?.name).toBe('search');
    });

    it('should return undefined for unknown tool', async () => {
      const bridge = await createMCPToolBridge({ client: mockClient });
      const tool = bridge.getTool('unknown');

      expect(tool).toBeUndefined();
    });

    it('should execute bridged tool', async () => {
      const bridge = await createMCPToolBridge({ client: mockClient });
      const tool = bridge.getTool('search');

      const result = await tool?.execute({ query: 'test' });
      expect(result).toBe('Mock result');
      expect(mockClient.callTool).toHaveBeenCalledWith('search', { query: 'test' });
    });
  });

  describe('discoverMCPServers', () => {
    it('should throw error for missing file', async () => {
      await expect(discoverMCPServers('./nonexistent.json')).rejects.toThrow(
        'MCP configuration file not found'
      );
    });
  });

  describe('MCPError classes', () => {
    it('should create MCPConnectionError', () => {
      const error = new MCPConnectionError('Test connection error');
      expect(error.name).toBe('MCPConnectionError');
      expect(error.message).toBe('Test connection error');
    });
  });
});
