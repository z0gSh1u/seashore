/**
 * WebSocket transport for MCP
 * Communicates with MCP server via WebSocket
 * @module @seashore/mcp
 */

import type { MCPClientConfig } from '../types.js';
import { MCPConnectionError, MCPTimeoutError, MCPError } from './stdio.js';

/**
 * JSON-RPC types
 */
interface JSONRPCRequest {
  jsonrpc: '2.0';
  id: number;
  method: string;
  params?: unknown;
}

interface JSONRPCResponse {
  jsonrpc: '2.0';
  id: number;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

interface JSONRPCNotification {
  jsonrpc: '2.0';
  method: string;
  params?: unknown;
}

type JSONRPCMessage = JSONRPCResponse | JSONRPCNotification;

interface PendingRequest {
  resolve: (result: unknown) => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
}

/**
 * WebSocket Transport class
 */
export class WebSocketTransport {
  private ws: WebSocket | null = null;
  private requestId = 0;
  private pendingRequests = new Map<number, PendingRequest>();
  private notificationHandlers = new Map<string, (params: unknown) => void>();
  private connected = false;
  private config: MCPClientConfig;
  private reconnectAttempts = 0;

  constructor(config: MCPClientConfig) {
    if (!config.url) {
      throw new Error('WebSocketTransport requires a url');
    }
    this.config = config;
  }

  /**
   * Connect to the MCP server via WebSocket
   */
  async connect(): Promise<void> {
    if (this.connected) {
      return;
    }

    return new Promise((resolve, reject) => {
      const url = new URL(this.config.url!);

      // Add headers as query params (WebSocket doesn't support custom headers)
      if (this.config.headers) {
        for (const [key, value] of Object.entries(this.config.headers)) {
          url.searchParams.set(`_header_${key}`, value);
        }
      }

      this.ws = new WebSocket(url.toString());

      const connectionTimeout = setTimeout(() => {
        this.ws?.close();
        reject(new MCPTimeoutError('WebSocket connection timeout'));
      }, this.config.timeout ?? 30000);

      this.ws.onopen = () => {
        clearTimeout(connectionTimeout);
        this.reconnectAttempts = 0;

        // Initialize MCP protocol
        this.initialize()
          .then(() => {
            this.connected = true;
            resolve();
          })
          .catch((err) => {
            reject(err);
          });
      };

      this.ws.onerror = (event) => {
        clearTimeout(connectionTimeout);
        if (!this.connected) {
          reject(new MCPConnectionError('WebSocket connection failed'));
        }
      };

      this.ws.onclose = (event) => {
        this.handleDisconnect(event);
      };

      this.ws.onmessage = (event) => {
        this.handleMessage(event.data);
      };
    });
  }

  /**
   * Initialize MCP protocol
   */
  private async initialize(): Promise<void> {
    await this.request('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {
        roots: { listChanged: true },
      },
      clientInfo: {
        name: '@seashore/mcp',
        version: '0.1.0',
      },
    });

    // Send initialized notification
    this.notify('notifications/initialized', {});
  }

  /**
   * Handle incoming message
   */
  private handleMessage(data: string): void {
    try {
      const message = JSON.parse(data) as JSONRPCMessage;

      // Handle response
      if ('id' in message && message.id !== undefined) {
        const pending = this.pendingRequests.get(message.id);
        if (pending) {
          clearTimeout(pending.timeout);
          this.pendingRequests.delete(message.id);

          if ('error' in message && message.error) {
            pending.reject(new MCPError(message.error.code, message.error.message));
          } else {
            pending.resolve(message.result);
          }
        }
        return;
      }

      // Handle notification
      if ('method' in message) {
        const handler = this.notificationHandlers.get(message.method);
        if (handler) {
          handler(message.params);
        }
      }
    } catch {
      // Ignore parse errors
    }
  }

  /**
   * Handle disconnect
   */
  private handleDisconnect(event: CloseEvent): void {
    const wasConnected = this.connected;
    this.connected = false;

    // Reject all pending requests
    for (const [id, pending] of this.pendingRequests) {
      clearTimeout(pending.timeout);
      pending.reject(new MCPConnectionError(`WebSocket closed: ${event.code} ${event.reason}`));
      this.pendingRequests.delete(id);
    }

    // Auto-reconnect if configured and was previously connected
    if (wasConnected && this.config.reconnect) {
      const maxAttempts = this.config.maxReconnectAttempts ?? 10;
      if (this.reconnectAttempts < maxAttempts) {
        this.reconnectAttempts++;
        const delay = this.config.reconnectInterval ?? 5000;
        setTimeout(() => {
          this.connect().catch(() => {
            // Ignore reconnect errors
          });
        }, delay);
      }
    }
  }

  /**
   * Send a JSON-RPC request
   */
  async request(method: string, params?: unknown): Promise<unknown> {
    if (!this.connected && method !== 'initialize') {
      throw new MCPConnectionError('Not connected to MCP server');
    }

    const id = ++this.requestId;
    const request: JSONRPCRequest = {
      jsonrpc: '2.0',
      id,
      method,
      params,
    };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new MCPTimeoutError(`Request timed out: ${method}`));
      }, this.config.timeout ?? 30000);

      this.pendingRequests.set(id, { resolve, reject, timeout });

      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify(request));
      } else {
        clearTimeout(timeout);
        this.pendingRequests.delete(id);
        reject(new MCPConnectionError('WebSocket not open'));
      }
    });
  }

  /**
   * Send a notification
   */
  notify(method: string, params?: unknown): void {
    const notification: JSONRPCNotification = {
      jsonrpc: '2.0',
      method,
      params,
    };

    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(notification));
    }
  }

  /**
   * Register a notification handler
   */
  onNotification(method: string, handler: (params: unknown) => void): void {
    this.notificationHandlers.set(method, handler);
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Disconnect from the server
   */
  async disconnect(): Promise<void> {
    this.connected = false;
    // Disable auto-reconnect
    this.config.reconnect = false;
    this.ws?.close(1000, 'Client disconnect');
    this.ws = null;
  }

  /**
   * Reconnect to the server
   */
  async reconnect(): Promise<void> {
    await this.close();
    // Re-enable reconnect
    this.config.reconnect = true;
    await this.connect();
  }

  /**
   * Close the transport
   */
  async close(): Promise<void> {
    this.connected = false;
    this.config.reconnect = false;

    // Clear pending requests
    for (const [id, pending] of this.pendingRequests) {
      clearTimeout(pending.timeout);
      pending.reject(new MCPConnectionError('Transport closed'));
      this.pendingRequests.delete(id);
    }

    this.ws?.close(1000, 'Client close');
    this.ws = null;
    this.reconnectAttempts = 0;
  }
}

/**
 * Create a WebSocket transport
 */
export function createWebSocketTransport(config: MCPClientConfig): WebSocketTransport {
  return new WebSocketTransport(config);
}
