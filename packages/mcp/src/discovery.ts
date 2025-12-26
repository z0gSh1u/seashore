/**
 * MCP Server Discovery
 * Discovers MCP servers from configuration files
 * @module @seashore/mcp
 */

import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import type { MCPServerConfig, ServerInfo } from './types.js';

/**
 * MCP configuration file format (mcp.json)
 */
interface MCPConfigFile {
  servers: Record<string, MCPServerEntry>;
}

interface MCPServerEntry {
  /** Transport type (default: stdio) */
  transport?: 'stdio' | 'sse' | 'websocket';
  /** Command to run (for stdio) */
  command?: string;
  /** Arguments for command */
  args?: string[];
  /** Working directory */
  cwd?: string;
  /** Environment variables (supports ${ENV_VAR} syntax) */
  env?: Record<string, string>;
  /** URL for SSE/WebSocket */
  url?: string;
  /** HTTP headers */
  headers?: Record<string, string>;
}

/**
 * Expand environment variables in a string
 * Supports ${VAR} and ${VAR:-default} syntax
 */
function expandEnvVars(value: string): string {
  return value.replace(/\$\{([^}]+)\}/g, (match, expr) => {
    // Handle default value syntax: ${VAR:-default}
    const [varName, defaultValue] = expr.split(':-');
    const envValue = process.env[varName];

    if (envValue !== undefined) {
      return envValue;
    }

    if (defaultValue !== undefined) {
      return defaultValue;
    }

    // Return empty string if no value and no default
    return '';
  });
}

/**
 * Process environment variables object
 */
function processEnvVars(
  env: Record<string, string> | undefined
): Record<string, string> | undefined {
  if (!env) return undefined;

  const processed: Record<string, string> = {};
  for (const [key, value] of Object.entries(env)) {
    processed[key] = expandEnvVars(value);
  }
  return processed;
}

/**
 * Convert config entry to ServerInfo
 */
function entryToServerInfo(name: string, entry: MCPServerEntry, basePath: string): MCPServerConfig {
  const transport = entry.transport ?? 'stdio';

  // Resolve relative command paths
  let command = entry.command;
  if (
    command &&
    !command.includes('/') &&
    !command.includes('\\') &&
    command !== 'npx' &&
    command !== 'node'
  ) {
    command = resolve(basePath, command);
  }

  // Resolve relative cwd
  let cwd = entry.cwd;
  if (cwd) {
    cwd = resolve(basePath, cwd);
  }

  return {
    name,
    transport,
    command,
    args: entry.args,
    cwd,
    env: processEnvVars(entry.env),
    url: entry.url,
    headers: entry.headers,
  };
}

/**
 * Discover MCP servers from a configuration file
 * @param configPath - Path to mcp.json configuration file
 * @returns Array of server configurations
 * @example
 * ```typescript
 * import { discoverMCPServers, createMCPClient } from '@seashore/mcp'
 *
 * const servers = await discoverMCPServers('./mcp.json')
 *
 * for (const server of servers) {
 *   const client = await createMCPClient(server)
 *   console.log(`Connected to ${server.name}`)
 * }
 * ```
 *
 * @example mcp.json format
 * ```json
 * {
 *   "servers": {
 *     "filesystem": {
 *       "command": "npx",
 *       "args": ["-y", "@modelcontextprotocol/server-filesystem", "/allowed/path"]
 *     },
 *     "github": {
 *       "command": "npx",
 *       "args": ["-y", "@modelcontextprotocol/server-github"],
 *       "env": {
 *         "GITHUB_TOKEN": "${GITHUB_TOKEN}"
 *       }
 *     },
 *     "remote-api": {
 *       "transport": "sse",
 *       "url": "https://api.example.com/mcp"
 *     }
 *   }
 * }
 * ```
 */
export async function discoverMCPServers(configPath: string): Promise<MCPServerConfig[]> {
  const absolutePath = resolve(configPath);

  if (!existsSync(absolutePath)) {
    throw new Error(`MCP configuration file not found: ${absolutePath}`);
  }

  const content = await readFile(absolutePath, 'utf-8');
  const config: MCPConfigFile = JSON.parse(content);

  if (!config.servers || typeof config.servers !== 'object') {
    throw new Error('Invalid MCP configuration: missing "servers" object');
  }

  const basePath = dirname(absolutePath);
  const servers: MCPServerConfig[] = [];

  for (const [name, entry] of Object.entries(config.servers)) {
    servers.push(entryToServerInfo(name, entry, basePath));
  }

  return servers;
}

/**
 * Try to discover MCP servers from common locations
 * Searches in order: ./mcp.json, ~/.config/mcp/mcp.json
 * @returns Array of server configurations, or empty array if no config found
 */
export async function autoDiscoverMCPServers(): Promise<MCPServerConfig[]> {
  const searchPaths = [
    './mcp.json',
    resolve(process.env.HOME ?? process.env.USERPROFILE ?? '.', '.config/mcp/mcp.json'),
    resolve(process.cwd(), '.mcp.json'),
  ];

  for (const path of searchPaths) {
    if (existsSync(path)) {
      try {
        return await discoverMCPServers(path);
      } catch {
        // Continue to next path
      }
    }
  }

  return [];
}

export type { ServerInfo, MCPServerConfig };
