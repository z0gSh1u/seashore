/**
 * Request handlers
 * @module @seashore/deploy
 */

import type { Context } from 'hono';
import type {
  Agent,
  HandlerConfig,
  ChatRequest,
  ChatResponse,
  AgentRequest,
  StreamChunk,
} from './types.js';
import { createSSEStream, createSSEHeaders, createNDJSONStream } from './sse.js';

/**
 * Generate thread ID
 */
function generateThreadId(): string {
  return `thread_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * Create async generator for streaming
 */
async function* createMockStream(content: string): AsyncIterable<StreamChunk> {
  // Simulate streaming by splitting content into chunks
  const words = content.split(' ');
  for (const word of words) {
    yield { type: 'text', content: word + ' ' };
    await new Promise((r) => setTimeout(r, 50));
  }
  yield { type: 'done' };
}

/**
 * Create chat handler
 * @param config - Handler configuration
 * @returns Hono handler function
 * @example
 * ```typescript
 * app.post('/api/chat', createChatHandler({ agent }))
 * ```
 */
export function createChatHandler(config: HandlerConfig) {
  const { agent, streaming } = config;

  return async (c: Context): Promise<Response> => {
    try {
      const body = await c.req.json<ChatRequest>();
      const { messages, threadId = generateThreadId(), stream = false } = body;

      if (stream) {
        // Streaming response
        const headers =
          streaming?.format === 'ndjson'
            ? { 'Content-Type': 'application/x-ndjson' }
            : createSSEHeaders(streaming?.headers);

        let streamIterable: AsyncIterable<StreamChunk>;

        if (agent.stream) {
          streamIterable = agent.stream({ messages });
        } else {
          // Fallback: run sync and mock streaming
          const result = await agent.run({ messages });
          streamIterable = createMockStream(result.content);
        }

        const responseStream =
          streaming?.format === 'ndjson'
            ? createNDJSONStream(streamIterable)
            : createSSEStream(streamIterable);

        return new Response(responseStream, { headers });
      }

      // Non-streaming response
      const result = await agent.run({ messages });

      const response: ChatResponse = {
        content: result.content,
        threadId,
        toolCalls: result.toolCalls,
      };

      return c.json(response);
    } catch (error) {
      return c.json({ error: (error as Error).message }, 500);
    }
  };
}

/**
 * Create agent handler
 * @param agents - Map of agent names to agents
 * @param config - Handler configuration
 * @returns Hono handler function
 * @example
 * ```typescript
 * app.post('/api/agents/:agentName/run', createAgentHandler(agents))
 * ```
 */
export function createAgentHandler(
  agents: Record<string, Agent>,
  config?: Omit<HandlerConfig, 'agent'>
) {
  const { streaming } = config || {};

  return async (c: Context): Promise<Response> => {
    try {
      const agentName = c.req.param('agentName');
      const agent = agents[agentName];

      if (!agent) {
        return c.json({ error: `Agent '${agentName}' not found` }, 404);
      }

      const body = await c.req.json<AgentRequest>();
      const { input, threadId = generateThreadId(), stream = false } = body;

      // Normalize input to messages
      const messages =
        typeof input === 'string' ? [{ role: 'user' as const, content: input }] : input.messages;

      if (stream) {
        const headers =
          streaming?.format === 'ndjson'
            ? { 'Content-Type': 'application/x-ndjson' }
            : createSSEHeaders(streaming?.headers);

        let streamIterable: AsyncIterable<StreamChunk>;

        if (agent.stream) {
          streamIterable = agent.stream({ messages });
        } else {
          const result = await agent.run({ messages });
          streamIterable = createMockStream(result.content);
        }

        const responseStream =
          streaming?.format === 'ndjson'
            ? createNDJSONStream(streamIterable)
            : createSSEStream(streamIterable);

        return new Response(responseStream, { headers });
      }

      const result = await agent.run({ messages });

      return c.json({
        content: result.content,
        threadId,
        toolCalls: result.toolCalls,
      });
    } catch (error) {
      return c.json({ error: (error as Error).message }, 500);
    }
  };
}

/**
 * Create stream handler for custom streaming endpoints
 * @param streamFn - Function that returns async iterable of chunks
 * @param config - Handler configuration
 * @returns Hono handler function
 */
export function createStreamHandler(
  streamFn: (c: Context) => AsyncIterable<StreamChunk>,
  config?: Pick<HandlerConfig, 'streaming'>
) {
  const { streaming } = config || {};

  return async (c: Context): Promise<Response> => {
    try {
      const chunks = streamFn(c);

      const headers =
        streaming?.format === 'ndjson'
          ? { 'Content-Type': 'application/x-ndjson' }
          : createSSEHeaders(streaming?.headers);

      const responseStream =
        streaming?.format === 'ndjson' ? createNDJSONStream(chunks) : createSSEStream(chunks);

      return new Response(responseStream, { headers });
    } catch (error) {
      return c.json({ error: (error as Error).message }, 500);
    }
  };
}
