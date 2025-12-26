/**
 * MCP (Model Context Protocol) type definitions
 * @module @seashore/mcp
 */

import type { z } from 'zod';

/**
 * JSON Schema definition for MCP tool inputs
 */
export interface JSONSchema {
  type?: string;
  properties?: Record<string, JSONSchema>;
  required?: string[];
  description?: string;
  items?: JSONSchema;
  enum?: unknown[];
  default?: unknown;
  [key: string]: unknown;
}

/**
 * MCP tool definition from server
 */
export interface MCPTool {
  /** Unique tool name */
  name: string;
  /** Human-readable description */
  description?: string;
  /** JSON Schema for tool input */
  inputSchema: JSONSchema;
}

/**
 * MCP resource definition
 */
export interface MCPResource {
  /** Resource URI (e.g., file:///path/to/file) */
  uri: string;
  /** Human-readable name */
  name: string;
  /** Optional description */
  description?: string;
  /** MIME type of the resource */
  mimeType?: string;
}

/**
 * MCP prompt definition
 */
export interface MCPPrompt {
  /** Prompt name */
  name: string;
  /** Description of what the prompt does */
  description?: string;
  /** Arguments the prompt accepts */
  arguments?: MCPPromptArgument[];
}

/**
 * MCP prompt argument
 */
export interface MCPPromptArgument {
  /** Argument name */
  name: string;
  /** Description */
  description?: string;
  /** Whether this argument is required */
  required?: boolean;
}

/**
 * Result from calling an MCP tool
 */
export interface MCPToolResult {
  /** Result content */
  content: MCPContent[];
  /** Whether the tool call resulted in an error */
  isError?: boolean;
}

/**
 * MCP content types
 */
export type MCPContent = MCPTextContent | MCPImageContent | MCPResourceContent;

export interface MCPTextContent {
  type: 'text';
  text: string;
}

export interface MCPImageContent {
  type: 'image';
  data: string;
  mimeType: string;
}

export interface MCPResourceContent {
  type: 'resource';
  resource: {
    uri: string;
    text?: string;
    blob?: string;
    mimeType?: string;
  };
}

/**
 * Result from reading an MCP resource
 */
export interface MCPResourceResult {
  /** Resource contents */
  contents: MCPResourceContents[];
}

export interface MCPResourceContents {
  uri: string;
  mimeType?: string;
  text?: string;
  blob?: string;
}

/**
 * Result from getting an MCP prompt
 */
export interface MCPPromptResult {
  /** Prompt description */
  description?: string;
  /** Generated messages */
  messages: MCPPromptMessage[];
}

export interface MCPPromptMessage {
  role: 'user' | 'assistant';
  content: MCPTextContent | MCPImageContent | MCPResourceContent;
}

/**
 * Resource change event
 */
export interface MCPResourceChangeEvent {
  uri: string;
}

/**
 * Callback for resource changes
 */
export type MCPResourceCallback = (event: MCPResourceChangeEvent) => void;

/**
 * MCP server configuration from discovery
 */
export interface MCPServerConfig {
  /** Server name/identifier */
  name: string;
  /** Transport type */
  transport: 'stdio' | 'sse' | 'websocket';
  /** Command to run (for stdio) */
  command?: string;
  /** Arguments for the command */
  args?: string[];
  /** Working directory */
  cwd?: string;
  /** Environment variables */
  env?: Record<string, string>;
  /** URL (for sse/websocket) */
  url?: string;
  /** HTTP headers (for sse/websocket) */
  headers?: Record<string, string>;
}

/**
 * Configuration for creating an MCP client
 */
export interface MCPClientConfig {
  /** Transport type */
  transport: 'stdio' | 'sse' | 'websocket';

  // stdio configuration
  /** Command to run */
  command?: string;
  /** Arguments for the command */
  args?: string[];
  /** Working directory */
  cwd?: string;
  /** Environment variables */
  env?: Record<string, string>;

  // Network configuration (sse/websocket)
  /** Server URL */
  url?: string;
  /** HTTP headers */
  headers?: Record<string, string>;

  // Common configuration
  /** Request timeout in ms */
  timeout?: number;
  /** Auto-reconnect on connection loss */
  reconnect?: boolean;
  /** Reconnect interval in ms */
  reconnectInterval?: number;
  /** Maximum reconnect attempts */
  maxReconnectAttempts?: number;
}

/**
 * MCP Client interface
 */
export interface MCPClient {
  // Tool operations
  /** List available tools */
  listTools(): Promise<MCPTool[]>;
  /** Call a tool with arguments */
  callTool(name: string, args: unknown): Promise<MCPToolResult>;

  // Resource operations
  /** List available resources */
  listResources(): Promise<MCPResource[]>;
  /** Read a resource by URI */
  readResource(uri: string): Promise<MCPResourceResult>;
  /** Subscribe to resource changes */
  subscribeResource(uri: string, callback: MCPResourceCallback): Promise<void>;
  /** Unsubscribe from resource changes */
  unsubscribeResource(uri: string): Promise<void>;

  // Prompt operations
  /** List available prompts */
  listPrompts(): Promise<MCPPrompt[]>;
  /** Get a prompt with arguments */
  getPrompt(name: string, args: Record<string, string>): Promise<MCPPromptResult>;

  // Lifecycle
  /** Check if connected */
  isConnected(): boolean;
  /** Disconnect from server */
  disconnect(): Promise<void>;
  /** Reconnect to server */
  reconnect(): Promise<void>;
  /** Close the client (terminate subprocess) */
  close(): Promise<void>;
}

/**
 * Server info from discovery
 */
export interface ServerInfo {
  /** Server name */
  name: string;
  /** Transport configuration */
  transport: 'stdio' | 'sse' | 'websocket';
  /** Command (for stdio) */
  command?: string;
  /** Args (for stdio) */
  args?: string[];
  /** Environment variables */
  env?: Record<string, string>;
  /** URL (for network transports) */
  url?: string;
  /** Headers (for network transports) */
  headers?: Record<string, string>;
}

/**
 * Configuration for tool bridge
 */
export interface ToolBridgeConfig {
  /** MCP client instance */
  client: MCPClient;
  /** Optional filter function */
  filter?: (tool: MCPTool) => boolean;
  /** Optional rename function */
  rename?: (name: string) => string;
  /** Optional description prefix */
  descriptionPrefix?: string;
}
