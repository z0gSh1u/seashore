/**
 * Deploy package tests
 */

import { describe, it, expect, vi } from 'vitest';
import {
  createServer,
  createChatHandler,
  createAgentHandler,
  cloudflareAdapter,
  nodeAdapter,
  createSSEStream,
  createSSEHeaders,
  type Agent,
  type StreamChunk,
} from '../src/index.js';

// Mock agent
function createMockAgent(name: string): Agent {
  return {
    name,
    async run({ messages }) {
      const lastMessage = messages[messages.length - 1];
      return {
        content: `Echo: ${lastMessage.content}`,
      };
    },
    async *stream({ messages }) {
      const lastMessage = messages[messages.length - 1];
      yield { type: 'text', content: 'Echo: ' };
      yield { type: 'text', content: lastMessage.content };
      yield { type: 'done' };
    },
  };
}

describe('@seashore/deploy', () => {
  describe('createServer', () => {
    it('should create a server with agents', () => {
      const agent = createMockAgent('test-agent');
      const server = createServer({ agents: { test: agent } });

      expect(server).toBeDefined();
      expect(server.app).toBeDefined();
      expect(server.app.fetch).toBeInstanceOf(Function);
    });

    it('should handle health check', async () => {
      const agent = createMockAgent('test-agent');
      const server = createServer({ agents: { test: agent } });

      const request = new Request('http://localhost/health');
      const response = await server.app.fetch(request);

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.status).toBe('ok');
    });

    it('should list agents', async () => {
      const agent = createMockAgent('test-agent');
      const server = createServer({ agents: { test: agent } });

      const request = new Request('http://localhost/api/agents');
      const response = await server.app.fetch(request);

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.agents).toHaveLength(1);
      expect(body.agents[0].name).toBe('test');
    });

    it('should handle chat requests', async () => {
      const agent = createMockAgent('chat-agent');
      const server = createServer({ agents: { chat: agent } });

      const request = new Request('http://localhost/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Hello' }],
        }),
      });

      const response = await server.app.fetch(request);
      expect(response.status).toBe(200);

      const body = await response.json();
      expect(body.content).toBe('Echo: Hello');
      expect(body.threadId).toBeDefined();
    });

    it('should handle agent-specific requests', async () => {
      const agent = createMockAgent('specific-agent');
      const server = createServer({ agents: { specific: agent } });

      const request = new Request('http://localhost/api/agents/specific/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: 'Test input',
        }),
      });

      const response = await server.app.fetch(request);
      expect(response.status).toBe(200);

      const body = await response.json();
      expect(body.content).toBe('Echo: Test input');
    });

    it('should return 404 for unknown agent', async () => {
      const agent = createMockAgent('known-agent');
      const server = createServer({ agents: { known: agent } });

      const request = new Request('http://localhost/api/agents/unknown/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: 'Test' }),
      });

      const response = await server.app.fetch(request);
      expect(response.status).toBe(404);
    });
  });

  describe('createChatHandler', () => {
    it('should create a chat handler', () => {
      const agent = createMockAgent('test');
      const handler = createChatHandler({ agent });

      expect(handler).toBeInstanceOf(Function);
    });
  });

  describe('createAgentHandler', () => {
    it('should create an agent handler', () => {
      const agents = { test: createMockAgent('test') };
      const handler = createAgentHandler(agents);

      expect(handler).toBeInstanceOf(Function);
    });
  });

  describe('cloudflareAdapter', () => {
    it('should create Cloudflare adapter', () => {
      const agent = createMockAgent('test');
      const server = createServer({ agents: { test: agent } });
      const adapter = cloudflareAdapter(server);

      expect(adapter.fetch).toBeInstanceOf(Function);
    });

    it('should handle requests through adapter', async () => {
      const agent = createMockAgent('test');
      const server = createServer({ agents: { test: agent } });
      const adapter = cloudflareAdapter(server);

      const request = new Request('http://localhost/health');
      const response = await adapter.fetch(request);

      expect(response.status).toBe(200);
    });
  });

  describe('nodeAdapter', () => {
    it('should create Node.js adapter', () => {
      const agent = createMockAgent('test');
      const server = createServer({ agents: { test: agent } });
      const adapter = nodeAdapter(server);

      expect(adapter.fetch).toBeInstanceOf(Function);
    });

    it('should handle requests through adapter', async () => {
      const agent = createMockAgent('test');
      const server = createServer({ agents: { test: agent } });
      const adapter = nodeAdapter(server);

      const request = new Request('http://localhost/health');
      const response = await adapter.fetch(request);

      expect(response.status).toBe(200);
    });
  });

  describe('createSSEStream', () => {
    it('should create SSE stream from chunks', async () => {
      async function* generateChunks(): AsyncIterable<StreamChunk> {
        yield { type: 'text', content: 'Hello' };
        yield { type: 'text', content: ' World' };
        yield { type: 'done' };
      }

      const stream = createSSEStream(generateChunks());
      expect(stream).toBeInstanceOf(ReadableStream);
    });
  });

  describe('createSSEHeaders', () => {
    it('should create correct SSE headers', () => {
      const headers = createSSEHeaders();

      expect(headers['Content-Type']).toBe('text/event-stream');
      expect(headers['Cache-Control']).toBe('no-cache');
      expect(headers['Connection']).toBe('keep-alive');
    });

    it('should merge additional headers', () => {
      const headers = createSSEHeaders({ 'X-Custom': 'value' });

      expect(headers['X-Custom']).toBe('value');
      expect(headers['Content-Type']).toBe('text/event-stream');
    });
  });

  describe('Rate limiting', () => {
    it('should apply rate limiting', async () => {
      const agent = createMockAgent('test');
      const server = createServer({
        agents: { test: agent },
        rateLimit: {
          requests: 2,
          window: '1m',
        },
      });

      // First two requests should succeed
      for (let i = 0; i < 2; i++) {
        const request = new Request('http://localhost/api/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Forwarded-For': 'test-ip',
          },
          body: JSON.stringify({
            messages: [{ role: 'user', content: 'Test' }],
          }),
        });
        const response = await server.app.fetch(request);
        expect(response.status).toBe(200);
      }

      // Third request should be rate limited
      const request = new Request('http://localhost/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Forwarded-For': 'test-ip',
        },
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Test' }],
        }),
      });
      const response = await server.app.fetch(request);
      expect(response.status).toBe(429);
    });
  });

  describe('Authentication', () => {
    it('should require bearer token when auth is configured', async () => {
      const agent = createMockAgent('test');
      const server = createServer({
        agents: { test: agent },
        auth: {
          type: 'bearer',
          validate: async (token) => token === 'valid-token',
        },
      });

      // Request without token
      const noAuthRequest = new Request('http://localhost/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Test' }],
        }),
      });
      const noAuthResponse = await server.app.fetch(noAuthRequest);
      expect(noAuthResponse.status).toBe(401);

      // Request with valid token
      const authRequest = new Request('http://localhost/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token',
        },
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Test' }],
        }),
      });
      const authResponse = await server.app.fetch(authRequest);
      expect(authResponse.status).toBe(200);
    });
  });
});
