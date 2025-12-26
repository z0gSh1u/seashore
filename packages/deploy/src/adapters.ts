/**
 * Runtime adapters
 * @module @seashore/deploy
 */

import type { Server, RuntimeAdapter, RuntimeAdapterOptions } from './types.js';

/**
 * Cloudflare Workers adapter
 * @param server - Server instance
 * @param options - Adapter options
 * @returns Fetch handler for Cloudflare Workers
 * @example
 * ```typescript
 * export default {
 *   async fetch(request: Request, env: Env, ctx: ExecutionContext) {
 *     const server = createServer({ agents: { chat: agent } })
 *     return cloudflareAdapter(server, { env, ctx }).fetch(request)
 *   }
 * }
 * ```
 */
export const cloudflareAdapter: RuntimeAdapter = (
  server: Server,
  options?: RuntimeAdapterOptions
) => {
  return {
    async fetch(request: Request): Promise<Response> {
      try {
        const response = await server.app.fetch(request);

        // Ensure streaming headers are set correctly for Cloudflare
        const contentType = response.headers.get('content-type');
        if (contentType?.includes('text/event-stream')) {
          const newHeaders = new Headers(response.headers);
          newHeaders.set('Content-Encoding', 'identity');
          newHeaders.set('Cache-Control', 'no-cache, no-store');

          return new Response(response.body, {
            status: response.status,
            statusText: response.statusText,
            headers: newHeaders,
          });
        }

        return response;
      } catch (error) {
        console.error('Cloudflare adapter error:', error);
        return new Response(JSON.stringify({ error: 'Internal server error' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    },
  };
};

/**
 * Node.js adapter
 * @param server - Server instance
 * @param options - Adapter options
 * @returns Fetch handler for Node.js
 * @example
 * ```typescript
 * import { serve } from '@hono/node-server'
 *
 * const server = createServer({ agents: { chat: agent } })
 * const { fetch } = nodeAdapter(server)
 *
 * serve({ fetch, port: 3000 })
 * ```
 */
export const nodeAdapter: RuntimeAdapter = (server: Server, _options?: RuntimeAdapterOptions) => {
  return {
    async fetch(request: Request): Promise<Response> {
      try {
        return await server.app.fetch(request);
      } catch (error) {
        console.error('Node adapter error:', error);
        return new Response(JSON.stringify({ error: 'Internal server error' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    },
  };
};
