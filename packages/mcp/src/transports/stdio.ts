/**
 * Stdio transport for MCP
 * Communicates with MCP server via subprocess stdin/stdout
 * @module @seashore/mcp
 */

import { spawn, type ChildProcess } from 'node:child_process';
import { createInterface, type Interface as ReadlineInterface } from 'node:readline';
import type { MCPClientConfig } from '../types.js';

/**
 * JSON-RPC request/response types
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

/**
 * Pending request handler
 */
interface PendingRequest {
  resolve: (result: unknown) => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
}

/**
 * Stdio transport class
 */
export class StdioTransport {
  private process: ChildProcess | null = null;
  private readline: ReadlineInterface | null = null;
  private requestId = 0;
  private pendingRequests = new Map<number, PendingRequest>();
  private notificationHandlers = new Map<string, (params: unknown) => void>();
  private connected = false;
  private config: MCPClientConfig;

  constructor(config: MCPClientConfig) {
    if (!config.command) {
      throw new Error('StdioTransport requires a command');
    }
    this.config = config;
  }

  /**
   * Connect to the MCP server
   */
  async connect(): Promise<void> {
    if (this.connected) {
      return;
    }

    return new Promise((resolve, reject) => {
      const { command, args = [], cwd, env } = this.config;

      this.process = spawn(command!, args, {
        cwd,
        env: { ...process.env, ...env },
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      // Handle process errors
      this.process.on('error', (error) => {
        this.connected = false;
        reject(new MCPConnectionError(`Failed to start process: ${error.message}`));
      });

      this.process.on('exit', (code, signal) => {
        this.connected = false;
        // Reject all pending requests
        for (const [id, pending] of this.pendingRequests) {
          clearTimeout(pending.timeout);
          pending.reject(
            new MCPConnectionError(`Process exited with code ${code}, signal ${signal}`)
          );
          this.pendingRequests.delete(id);
        }
      });

      // Setup readline for stdout
      if (this.process.stdout) {
        this.readline = createInterface({
          input: this.process.stdout,
          crlfDelay: Infinity,
        });

        this.readline.on('line', (line) => {
          this.handleMessage(line);
        });
      }

      // Log stderr
      if (this.process.stderr) {
        this.process.stderr.on('data', (data) => {
          // eslint-disable-next-line no-console
          console.error('[MCP stderr]:', data.toString());
        });
      }

      // Initialize MCP protocol
      this.initialize()
        .then(() => {
          this.connected = true;
          resolve();
        })
        .catch(reject);
    });
  }

  /**
   * Initialize MCP protocol handshake
   */
  private async initialize(): Promise<void> {
    const result = await this.request('initialize', {
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

    return result as void;
  }

  /**
   * Handle incoming message
   */
  private handleMessage(line: string): void {
    try {
      const message = JSON.parse(line) as JSONRPCMessage;

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
      // Ignore parse errors for non-JSON lines
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

      if (this.process?.stdin?.writable) {
        this.process.stdin.write(JSON.stringify(request) + '\n');
      } else {
        clearTimeout(timeout);
        this.pendingRequests.delete(id);
        reject(new MCPConnectionError('Process stdin not writable'));
      }
    });
  }

  /**
   * Send a notification (no response expected)
   */
  notify(method: string, params?: unknown): void {
    const notification: JSONRPCNotification = {
      jsonrpc: '2.0',
      method,
      params,
    };

    if (this.process?.stdin?.writable) {
      this.process.stdin.write(JSON.stringify(notification) + '\n');
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
   * Disconnect (stop listening, keep process running)
   */
  async disconnect(): Promise<void> {
    this.connected = false;
    this.readline?.close();
    this.readline = null;
  }

  /**
   * Reconnect to the server
   */
  async reconnect(): Promise<void> {
    await this.close();
    await this.connect();
  }

  /**
   * Close the transport (terminate process)
   */
  async close(): Promise<void> {
    this.connected = false;

    // Clear pending requests
    for (const [id, pending] of this.pendingRequests) {
      clearTimeout(pending.timeout);
      pending.reject(new MCPConnectionError('Transport closed'));
      this.pendingRequests.delete(id);
    }

    this.readline?.close();
    this.readline = null;

    if (this.process) {
      this.process.kill('SIGTERM');
      this.process = null;
    }
  }
}

/**
 * MCP Error base class
 */
export class MCPError extends Error {
  code: number;

  constructor(code: number, message: string) {
    super(message);
    this.name = 'MCPError';
    this.code = code;
  }
}

/**
 * MCP Connection Error
 */
export class MCPConnectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MCPConnectionError';
  }
}

/**
 * MCP Timeout Error
 */
export class MCPTimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MCPTimeoutError';
  }
}

/**
 * Create a stdio transport
 */
export function createStdioTransport(config: MCPClientConfig): StdioTransport {
  return new StdioTransport(config);
}
