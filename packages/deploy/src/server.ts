/**
 * Server creation
 * @module @seashore/deploy
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Context, MiddlewareHandler } from 'hono';
import type { Server, ServerConfig, ThreadResponse } from './types.js';
import { createChatHandler, createAgentHandler } from './handlers.js';

/**
 * Parse rate limit window to milliseconds
 */
function parseWindow(window: string): number {
  const match = window.match(/^(\d+)(s|m|h)$/);
  if (!match) return 60000; // default 1 minute

  const [, value, unit] = match;
  const num = parseInt(value, 10);

  switch (unit) {
    case 's':
      return num * 1000;
    case 'm':
      return num * 60 * 1000;
    case 'h':
      return num * 60 * 60 * 1000;
    default:
      return 60000;
  }
}

/**
 * Simple in-memory rate limiter
 */
function createRateLimiter(
  requests: number,
  windowMs: number,
  keyGenerator: (c: Context) => string
): MiddlewareHandler {
  const store = new Map<string, { count: number; resetTime: number }>();

  return async (c, next) => {
    const key = keyGenerator(c);
    const now = Date.now();

    let entry = store.get(key);

    if (!entry || now > entry.resetTime) {
      entry = { count: 0, resetTime: now + windowMs };
      store.set(key, entry);
    }

    entry.count++;

    if (entry.count > requests) {
      return c.json({ error: 'Too many requests' }, 429);
    }

    await next();
  };
}

/**
 * Create bearer auth middleware
 */
function createBearerAuth(validate: (token: string) => Promise<boolean>): MiddlewareHandler {
  return async (c, next) => {
    const auth = c.req.header('Authorization');

    if (!auth?.startsWith('Bearer ')) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const token = auth.slice(7);
    const valid = await validate(token);

    if (!valid) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    await next();
  };
}

/**
 * Create API key auth middleware
 */
function createApiKeyAuth(
  validate: (key: string) => Promise<boolean>,
  header = 'x-api-key'
): MiddlewareHandler {
  return async (c, next) => {
    const key = c.req.header(header);

    if (!key) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const valid = await validate(key);

    if (!valid) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    await next();
  };
}

/**
 * In-memory thread storage (for demo/dev)
 */
const threads = new Map<string, ThreadResponse>();

/**
 * Create server
 * @param config - Server configuration
 * @returns Server instance
 * @example
 * ```typescript
 * const server = createServer({
 *   agents: { chat: agent },
 *   cors: { origin: '*' },
 * })
 *
 * // Cloudflare Workers
 * export default { fetch: server.app.fetch }
 *
 * // Node.js
 * serve({ fetch: server.app.fetch, port: 3000 })
 * ```
 */
export function createServer(config: ServerConfig): Server {
  const {
    agents,
    middleware = [],
    cors: corsConfig,
    auth,
    rateLimit,
    streaming,
    errorHandler,
  } = config;

  const app = new Hono();

  // Error handling
  app.onError((error, c) => {
    if (errorHandler) {
      return errorHandler(error, c);
    }
    console.error('Server error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  });

  // CORS
  if (corsConfig) {
    app.use(
      '*',
      cors({
        origin: corsConfig.origin,
        allowMethods: corsConfig.methods || ['GET', 'POST', 'OPTIONS'],
        allowHeaders: corsConfig.headers || ['Content-Type', 'Authorization'],
        credentials: corsConfig.credentials,
      })
    );
  }

  // Authentication
  if (auth) {
    if (auth.type === 'bearer') {
      app.use('/api/*', createBearerAuth(auth.validate));
    } else if (auth.type === 'api-key') {
      app.use('/api/*', createApiKeyAuth(auth.validate, auth.header));
    }
  }

  // Rate limiting
  if (rateLimit) {
    const windowMs = parseWindow(rateLimit.window);
    const keyGenerator =
      rateLimit.keyGenerator ||
      ((c) => c.req.header('x-forwarded-for') || c.req.header('cf-connecting-ip') || 'anonymous');

    app.use('/api/*', createRateLimiter(rateLimit.requests, windowMs, keyGenerator));
  }

  // Custom middleware
  for (const mw of middleware) {
    app.use('*', mw);
  }

  // Health check
  app.get('/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }));

  // Default chat endpoint (uses first agent)
  const defaultAgent = Object.values(agents)[0];
  if (defaultAgent) {
    app.post('/api/chat', createChatHandler({ agent: defaultAgent, streaming }));
  }

  // Agent-specific endpoints
  app.post('/api/agents/:agentName/run', createAgentHandler(agents, { streaming }));

  // Thread endpoints
  app.get('/api/threads/:threadId', (c) => {
    const threadId = c.req.param('threadId');
    const thread = threads.get(threadId);

    if (!thread) {
      return c.json({ error: 'Thread not found' }, 404);
    }

    return c.json(thread);
  });

  // List available agents
  app.get('/api/agents', (c) => {
    const agentList = Object.entries(agents).map(([name, agent]) => ({
      name,
      displayName: agent.name,
    }));
    return c.json({ agents: agentList });
  });

  return {
    app: {
      fetch: app.fetch.bind(app),
      get: app.get.bind(app),
      post: app.post.bind(app),
      use: app.use.bind(app),
    },
  };
}
