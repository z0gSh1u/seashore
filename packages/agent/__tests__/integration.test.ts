/**
 * @seashore/agent - Integration Tests
 *
 * End-to-end tests with mock LLM adapter
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod';
import { createAgent } from '../src/react-agent';
import { defineTool } from '../../tool/src/define-tool';
import type { TextAdapter, Message, StreamChunk } from '../../llm/src/types';

interface MockResponse {
  content?: string;
  toolCalls?: Array<{
    id: string;
    name: string;
    arguments: Record<string, unknown>;
  }>;
}

/**
 * Mock responses storage - accessible across module scope
 */
let mockResponses: MockResponse[] = [];
let mockCallIndex = 0;

function setMockResponses(responses: MockResponse[]) {
  mockResponses = responses;
  mockCallIndex = 0;
}

/**
 * Mock the @seashore/llm chat function
 */
vi.mock('@seashore/llm', async (importOriginal) => {
  const original = await importOriginal<typeof import('@seashore/llm')>();

  const mockChat = async function* (options: {
    adapter: TextAdapter;
    messages: Message[];
    systemPrompts?: string[];
    tools?: unknown[];
    temperature?: number;
    signal?: AbortSignal;
  }): AsyncIterable<StreamChunk> {
    // Check for abort signal
    if (options.signal?.aborted) {
      throw new Error('Agent execution was aborted');
    }

    const response = mockResponses[mockCallIndex++] ?? { content: 'No more responses' };

    // Emit content if present
    if (response.content) {
      yield { type: 'content', delta: response.content };
    }

    // Emit tool calls if present (using correct type: 'tool_call')
    if (response.toolCalls) {
      for (const toolCall of response.toolCalls) {
        yield {
          type: 'tool_call',
          toolCall: {
            id: toolCall.id,
            type: 'function',
            function: {
              name: toolCall.name,
              arguments: JSON.stringify(toolCall.arguments),
            },
          },
        };
      }
    }

    // Emit done (not 'finish')
    yield {
      type: 'done',
      finishReason: response.toolCalls ? 'tool_calls' : 'stop',
      usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
    };
  };

  return {
    ...original,
    chat: mockChat,
  };
});

describe('Agent Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic Agent Execution', () => {
    it('should complete a simple task without tools', async () => {
      setMockResponses([{ content: 'Hello! How can I help you today?' }]);

      const agent = createAgent({
        name: 'SimpleBot',
        systemPrompt: 'You are a helpful assistant.',
        model: { provider: 'openai', model: 'gpt-4o' } as unknown as TextAdapter,
      });

      const result = await agent.run('Hello');

      expect(result.content).toBe('Hello! How can I help you today?');
      expect(result.finishReason).toBe('stop');
      expect(result.toolCalls).toHaveLength(0);
    });

    it('should handle multi-turn conversation', async () => {
      setMockResponses([{ content: 'The capital of France is Paris.' }]);

      const agent = createAgent({
        name: 'GeoBot',
        systemPrompt: 'You are a geography expert.',
        model: { provider: 'openai', model: 'gpt-4o' } as unknown as TextAdapter,
      });

      const result = await agent.run('What is the capital of France?');

      expect(result.content).toContain('Paris');
    });
  });

  describe('Tool Calling', () => {
    const weatherTool = defineTool({
      name: 'get_weather',
      description: 'Get current weather for a location',
      inputSchema: z.object({
        location: z.string().describe('City name'),
      }),
      execute: async ({ location }) => ({
        location,
        temperature: 22,
        conditions: 'sunny',
        humidity: 45,
      }),
    });

    const calculatorTool = defineTool({
      name: 'calculator',
      description: 'Perform mathematical calculations',
      inputSchema: z.object({
        expression: z.string().describe('Math expression'),
      }),
      execute: async ({ expression }) => {
        // Safe evaluation for tests
        const result = Function(`"use strict"; return (${expression})`)();
        return { expression, result };
      },
    });

    it('should call a single tool and use result', async () => {
      setMockResponses([
        // First response: call weather tool
        {
          toolCalls: [
            {
              id: 'call_1',
              name: 'get_weather',
              arguments: { location: 'Tokyo' },
            },
          ],
        },
        // Second response: final answer using tool result
        {
          content: 'The weather in Tokyo is currently 22°C and sunny with 45% humidity.',
        },
      ]);

      const agent = createAgent({
        name: 'WeatherBot',
        systemPrompt: 'You are a weather assistant. Use the weather tool to answer questions.',
        model: { provider: 'openai', model: 'gpt-4o' } as unknown as TextAdapter,
        tools: [weatherTool],
      });

      const result = await agent.run('What is the weather in Tokyo?');

      expect(result.content).toContain('Tokyo');
      expect(result.content).toContain('22');
      expect(result.toolCalls).toHaveLength(1);
      expect(result.toolCalls[0]?.name).toBe('get_weather');
      expect(result.toolCalls[0]?.result.success).toBe(true);
    });

    it('should call multiple tools in sequence', async () => {
      setMockResponses([
        // First: call calculator
        {
          toolCalls: [
            {
              id: 'call_1',
              name: 'calculator',
              arguments: { expression: '2 + 3' },
            },
          ],
        },
        // Second: call another calculation
        {
          toolCalls: [
            {
              id: 'call_2',
              name: 'calculator',
              arguments: { expression: '5 * 10' },
            },
          ],
        },
        // Third: final answer
        {
          content: 'The first calculation (2+3) equals 5, and the second (5*10) equals 50.',
        },
      ]);

      const agent = createAgent({
        name: 'MathBot',
        systemPrompt: 'You are a math assistant.',
        model: { provider: 'openai', model: 'gpt-4o' } as unknown as TextAdapter,
        tools: [calculatorTool],
      });

      const result = await agent.run('Calculate 2+3, then 5*10');

      expect(result.toolCalls).toHaveLength(2);
      expect(result.toolCalls[0]?.result.data).toEqual({ expression: '2 + 3', result: 5 });
      expect(result.toolCalls[1]?.result.data).toEqual({ expression: '5 * 10', result: 50 });
    });

    it('should handle tool execution errors gracefully', async () => {
      const failingTool = defineTool({
        name: 'failing_tool',
        description: 'A tool that always fails',
        inputSchema: z.object({
          input: z.string(),
        }),
        execute: async () => {
          throw new Error('Tool execution failed');
        },
      });

      setMockResponses([
        {
          toolCalls: [
            {
              id: 'call_1',
              name: 'failing_tool',
              arguments: { input: 'test' },
            },
          ],
        },
        {
          content:
            'I apologize, but the tool encountered an error. Let me try a different approach.',
        },
      ]);

      const agent = createAgent({
        name: 'ErrorBot',
        systemPrompt: 'You handle errors gracefully.',
        model: { provider: 'openai', model: 'gpt-4o' } as unknown as TextAdapter,
        tools: [failingTool],
      });

      const result = await agent.run('Use the failing tool');

      expect(result.toolCalls).toHaveLength(1);
      expect(result.toolCalls[0]?.result.success).toBe(false);
      expect(result.toolCalls[0]?.result.error).toContain('Tool execution failed');
    });
  });

  describe('Streaming', () => {
    it('should emit stream chunks correctly', async () => {
      setMockResponses([{ content: 'Hello, streaming world!' }]);

      const agent = createAgent({
        name: 'StreamBot',
        systemPrompt: 'You are a helpful assistant.',
        model: { provider: 'openai', model: 'gpt-4o' } as unknown as TextAdapter,
      });

      const chunks: string[] = [];
      for await (const chunk of agent.stream('Hello')) {
        if (chunk.type === 'content' && chunk.delta) {
          chunks.push(chunk.delta);
        }
      }

      expect(chunks.join('')).toBe('Hello, streaming world!');
    });

    it('should emit tool call events during streaming', async () => {
      const echoTool = defineTool({
        name: 'echo',
        description: 'Echo back input',
        inputSchema: z.object({ message: z.string() }),
        execute: async ({ message }) => ({ echoed: message }),
      });

      setMockResponses([
        {
          toolCalls: [{ id: 'call_1', name: 'echo', arguments: { message: 'hello' } }],
        },
        { content: 'Echoed: hello' },
      ]);

      const agent = createAgent({
        name: 'EchoBot',
        systemPrompt: 'You echo messages.',
        model: { provider: 'openai', model: 'gpt-4o' } as unknown as TextAdapter,
        tools: [echoTool],
      });

      const chunkTypes: string[] = [];
      for await (const chunk of agent.stream('Echo hello')) {
        chunkTypes.push(chunk.type);
      }

      expect(chunkTypes).toContain('tool-call-start');
      expect(chunkTypes).toContain('tool-result');
      expect(chunkTypes).toContain('content');
    });
  });

  describe('Configuration Options', () => {
    it('should respect maxIterations limit', async () => {
      // Set up responses that would normally loop forever
      setMockResponses([
        {
          toolCalls: [{ id: 'call_1', name: 'echo', arguments: { message: '1' } }],
        },
        {
          toolCalls: [{ id: 'call_2', name: 'echo', arguments: { message: '2' } }],
        },
        {
          toolCalls: [{ id: 'call_3', name: 'echo', arguments: { message: '3' } }],
        },
      ]);

      const echoTool = defineTool({
        name: 'echo',
        description: 'Echo',
        inputSchema: z.object({ message: z.string() }),
        execute: async ({ message }) => ({ echoed: message }),
      });

      const agent = createAgent({
        name: 'LoopBot',
        systemPrompt: 'You loop.',
        model: { provider: 'openai', model: 'gpt-4o' } as unknown as TextAdapter,
        tools: [echoTool],
        maxIterations: 2,
      });

      const result = await agent.run('Loop forever');

      expect(result.finishReason).toBe('max_iterations');
      expect(result.toolCalls.length).toBeLessThanOrEqual(2);
    });

    it('should handle abort signal', async () => {
      setMockResponses([{ content: 'This should not complete...' }]);

      const agent = createAgent({
        name: 'AbortBot',
        systemPrompt: 'You can be aborted.',
        model: { provider: 'openai', model: 'gpt-4o' } as unknown as TextAdapter,
      });

      const controller = new AbortController();
      controller.abort();

      // Agent returns a result with finishReason: 'error' instead of throwing
      const result = await agent.run('Hello', { signal: controller.signal });
      expect(result.finishReason).toBe('error');
      expect(result.error).toMatch(/abort/i);
    });

    it('should pass custom metadata to tools', async () => {
      let capturedContext: unknown;

      const contextTool = defineTool({
        name: 'capture_context',
        description: 'Captures execution context',
        inputSchema: z.object({ value: z.string() }),
        execute: async (_input, context) => {
          capturedContext = context;
          return { captured: true };
        },
      });

      setMockResponses([
        {
          toolCalls: [{ id: 'call_1', name: 'capture_context', arguments: { value: 'test' } }],
        },
        { content: 'Done' },
      ]);

      const agent = createAgent({
        name: 'ContextBot',
        systemPrompt: 'You capture context.',
        model: { provider: 'openai', model: 'gpt-4o' } as unknown as TextAdapter,
        tools: [contextTool],
      });

      await agent.run('Capture context', {
        threadId: 'thread-123',
        userId: 'user-456',
        metadata: { customField: 'customValue' },
      });

      // The tool executor passes threadId, userId, and metadata.agentName
      expect(capturedContext).toMatchObject({
        threadId: 'thread-123',
        userId: 'user-456',
        metadata: { agentName: 'ContextBot' },
      });
    });
  });

  describe('Weather Agent Scenario (from spec)', () => {
    it('should handle weather query end-to-end', async () => {
      const weatherTool = defineTool({
        name: 'get_weather',
        description: 'Get current weather for a location',
        inputSchema: z.object({
          location: z.string().describe('City name in Chinese or English'),
        }),
        execute: async ({ location }) => ({
          location,
          temperature: 15,
          conditions: '晴朗',
          humidity: 60,
          wind: '东北风 3级',
        }),
      });

      setMockResponses([
        {
          toolCalls: [{ id: 'weather_1', name: 'get_weather', arguments: { location: '北京' } }],
        },
        {
          content: '北京今天天气晴朗，气温15°C，湿度60%，东北风3级。适合外出活动！',
        },
      ]);

      const agent = createAgent({
        name: 'WeatherAssistant',
        systemPrompt: '你是一个友好的天气助手。使用天气工具查询用户询问的城市天气，并用中文回复。',
        model: { provider: 'openai', model: 'gpt-4o' } as unknown as TextAdapter,
        tools: [weatherTool],
      });

      const result = await agent.run('北京今天天气如何？');

      expect(result.content).toContain('北京');
      expect(result.content).toContain('15');
      expect(result.toolCalls).toHaveLength(1);
      expect(result.toolCalls[0]?.name).toBe('get_weather');
      expect(result.finishReason).toBe('stop');
    });
  });
});
