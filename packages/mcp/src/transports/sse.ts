/**
 * SSE (Server-Sent Events) transport for MCP
 * Communicates with MCP server via HTTP SSE
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

interface PendingRequest {
  resolve: (result: unknown) => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
}

/**
 * SSE Transport class
 */
export class SSETransport {
  private eventSource: EventSource | null = null;
  private requestId = 0;
  private pendingRequests = new Map<number, PendingRequest>();
  private notificationHandlers = new Map<string, (params: unknown) => void>();
  private connected = false;
  private config: MCPClientConfig;
  private sessionId: string | null = null;
  private messageEndpoint: string | null = null;

  constructor(config: MCPClientConfig) {
    if (!config.url) {
      throw new Error('SSETransport requires a url');
    }
    this.config = config;
  }

  /**
   * Connect to the MCP server via SSE
   */
  async connect(): Promise<void> {
    if (this.connected) {
      return;
    }

    return new Promise((resolve, reject) => {
      const url = new URL(this.config.url!);

      // Add headers as query params for SSE (since EventSource doesn't support headers)
      if (this.config.headers) {
        for (const [key, value] of Object.entries(this.config.headers)) {
          url.searchParams.set(`_header_${key}`, value);
        }
      }

      this.eventSource = new EventSource(url.toString());

      const connectionTimeout = setTimeout(() => {
        this.eventSource?.close();
        reject(new MCPTimeoutError('SSE connection timeout'));
      }, this.config.timeout ?? 30000);

      this.eventSource.onopen = () => {
        clearTimeout(connectionTimeout);
      };

      this.eventSource.onerror = (event) => {
        clearTimeout(connectionTimeout);
        if (!this.connected) {
          reject(new MCPConnectionError('Failed to connect via SSE'));
        } else {
          this.handleDisconnect();
        }
      };

      this.eventSource.addEventListener('endpoint', (event) => {
        // Server sends the endpoint for sending messages
        const data = JSON.parse(event.data);
        this.messageEndpoint = data.endpoint;
        this.sessionId = data.sessionId;

        // Now initialize
        this.initialize()
          .then(() => {
            clearTimeout(connectionTimeout);
            this.connected = true;
            resolve();
          })
          .catch((err) => {
            clearTimeout(connectionTimeout);
            reject(err);
          });
      });

      this.eventSource.addEventListener('message', (event) => {
        this.handleMessage(event.data);
      });
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
      const message = JSON.parse(data) as JSONRPCResponse;

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
        const typedMessage = message as unknown as { method: string; params?: unknown };
        const handler = this.notificationHandlers.get(typedMessage.method);
        if (handler) {
          handler(typedMessage.params);
        }
      }
    } catch {
      // Ignore parse errors
    }
  }

  /**
   * Handle disconnect
   */
  private handleDisconnect(): void {
    this.connected = false;

    // Reject all pending requests
    for (const [id, pending] of this.pendingRequests) {
      clearTimeout(pending.timeout);
      pending.reject(new MCPConnectionError('SSE connection lost'));
      this.pendingRequests.delete(id);
    }

    // Auto-reconnect if configured
    if (this.config.reconnect) {
      setTimeout(() => {
        this.reconnect().catch(() => {
          // Ignore reconnect errors
        });
      }, this.config.reconnectInterval ?? 5000);
    }
  }

  /**
   * Send a JSON-RPC request via HTTP POST
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

    // For initialization, we might not have the endpoint yet
    const endpoint = this.messageEndpoint ?? this.config.url;

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new MCPTimeoutError(`Request timed out: ${method}`));
      }, this.config.timeout ?? 30000);

      this.pendingRequests.set(id, { resolve, reject, timeout });

      fetch(endpoint!, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.config.headers,
          ...(this.sessionId ? { 'X-Session-ID': this.sessionId } : {}),
        },
        body: JSON.stringify(request),
      })
        .then(async (response) => {
          if (!response.ok) {
            clearTimeout(timeout);
            this.pendingRequests.delete(id);
            reject(new MCPError(-1, `HTTP error: ${response.status}`));
          }
          // Response will come via SSE
        })
        .catch((error) => {
          clearTimeout(timeout);
          this.pendingRequests.delete(id);
          reject(new MCPConnectionError(`Request failed: ${error.message}`));
        });
    });
  }

  /**
   * Send a notification
   */
  notify(method: string, params?: unknown): void {
    const notification = {
      jsonrpc: '2.0',
      method,
      params,
    };

    const endpoint = this.messageEndpoint ?? this.config.url;

    fetch(endpoint!, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.config.headers,
        ...(this.sessionId ? { 'X-Session-ID': this.sessionId } : {}),
      },
      body: JSON.stringify(notification),
    }).catch(() => {
      // Ignore notification errors
    });
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
    this.eventSource?.close();
    this.eventSource = null;
  }

  /**
   * Reconnect to the server
   */
  async reconnect(): Promise<void> {
    await this.close();
    await this.connect();
  }

  /**
   * Close the transport
   */
  async close(): Promise<void> {
    this.connected = false;

    // Clear pending requests
    for (const [id, pending] of this.pendingRequests) {
      clearTimeout(pending.timeout);
      pending.reject(new MCPConnectionError('Transport closed'));
      this.pendingRequests.delete(id);
    }

    this.eventSource?.close();
    this.eventSource = null;
    this.sessionId = null;
    this.messageEndpoint = null;
  }
}

/**
 * Create an SSE transport
 */
export function createSSETransport(config: MCPClientConfig): SSETransport {
  return new SSETransport(config);
}
