/**
 * @seashore/workflow - LLM Node Tests
 *
 * Tests for LLM node functionality with flexible adapter configuration
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createLLMNode } from '../src/nodes/llm-node';
import { createWorkflowContext } from '../src/context';

// Mock @seashore/llm module
vi.mock('@seashore/llm', async () => {
  const actual = await vi.importActual('@seashore/llm');
  return {
    ...actual,
    chat: vi.fn(),
    createTextAdapter: vi.fn(),
  };
});

// Import the mocked functions
import { chat, createTextAdapter } from '@seashore/llm';

const mockChat = chat as ReturnType<typeof vi.fn>;
const mockCreateTextAdapter = createTextAdapter as ReturnType<typeof vi.fn>;

describe('createLLMNode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('adapter configuration', () => {
    it('should accept TextAdapter directly (from openaiText, etc.)', async () => {
      // Create a mock TextAdapter (as returned by openaiText)
      const mockAdapter = {
        _type: 'text-adapter',
        provider: 'openai',
      };

      // Mock chat to return a simple stream with @tanstack/ai chunk types
      mockChat.mockReturnValue({
        [Symbol.asyncIterator]: async function* () {
          yield { type: 'content', delta: 'Hello' };
          yield { type: 'content', delta: ' World' };
          yield { type: 'done', finishReason: 'stop' };
        },
      });

      const node = createLLMNode({
        name: 'test-node',
        adapter: mockAdapter,
        prompt: 'Say hello',
      });

      const ctx = createWorkflowContext({ debug: false });
      const result = await node.execute({}, ctx);

      expect(result.content).toBe('Hello World');
      expect(mockChat).toHaveBeenCalledWith(
        expect.objectContaining({
          adapter: mockAdapter,
        })
      );
    });

    it('should accept TextAdapterConfig object and convert to TextAdapter', async () => {
      const config = {
        provider: 'openai' as const,
        model: 'gpt-4o',
        apiKey: 'test-key',
        baseURL: 'https://api.example.com/v1',
      };

      const mockResolvedAdapter = {
        _type: 'text-adapter',
        provider: 'openai',
      };

      // Mock createTextAdapter to return our mock adapter
      mockCreateTextAdapter.mockReturnValue(mockResolvedAdapter);

      // Mock chat to return a simple stream with @tanstack/ai chunk types
      mockChat.mockReturnValue({
        [Symbol.asyncIterator]: async function* () {
          yield { type: 'content', delta: 'Response' };
          yield { type: 'done', finishReason: 'stop' };
        },
      });

      const node = createLLMNode({
        name: 'config-node',
        adapter: config,
        prompt: 'Test prompt',
      });

      const ctx = createWorkflowContext({ debug: false });
      const result = await node.execute({}, ctx);

      expect(mockCreateTextAdapter).toHaveBeenCalledWith(config);
      expect(mockChat).toHaveBeenCalledWith(
        expect.objectContaining({
          adapter: mockResolvedAdapter,
        })
      );
      expect(result.content).toBe('Response');
    });

    it('should support custom baseURL for OpenAI-compatible endpoints', async () => {
      const config = {
        provider: 'openai' as const,
        model: 'local-model',
        baseURL: 'http://localhost:1234/v1',
        apiKey: 'local-key',
      };

      const mockResolvedAdapter = {
        _type: 'text-adapter',
        provider: 'openai',
      };

      mockCreateTextAdapter.mockReturnValue(mockResolvedAdapter);
      mockChat.mockReturnValue({
        [Symbol.asyncIterator]: async function* () {
          yield { type: 'content', delta: 'Local response' };
          yield { type: 'done', finishReason: 'stop' };
        },
      });

      const node = createLLMNode({
        name: 'local-node',
        adapter: config,
        prompt: 'Test local endpoint',
      });

      const ctx = createWorkflowContext({ debug: false });
      await node.execute({}, ctx);

      expect(mockCreateTextAdapter).toHaveBeenCalledWith(
        expect.objectContaining({
          baseURL: 'http://localhost:1234/v1',
        })
      );
    });

    it('should support per-node API keys for different providers', async () => {
      const mockAdapter = { _type: 'text-adapter' };
      mockChat.mockReturnValue({
        [Symbol.asyncIterator]: async function* () {
          yield { type: 'content', delta: 'Response' };
          yield { type: 'done', finishReason: 'stop' };
        },
      });

      const nodeA = createLLMNode({
        name: 'team-a-node',
        adapter: mockAdapter,
        prompt: 'Team A task',
      });

      const nodeB = createLLMNode({
        name: 'team-b-node',
        adapter: mockAdapter,
        prompt: 'Team B task',
      });

      const ctx = createWorkflowContext({ debug: false });
      await nodeA.execute({}, ctx);
      await nodeB.execute({}, ctx);

      expect(mockChat).toHaveBeenCalledTimes(2);
    });
  });

  describe('message building', () => {
    beforeEach(() => {
      mockChat.mockReturnValue({
        [Symbol.asyncIterator]: async function* () {
          yield { type: 'content', delta: 'Response' };
          yield { type: 'done', finishReason: 'stop' };
        },
      });
    });

    it('should build messages from static prompt and systemPrompt', async () => {
      const mockAdapter = { _type: 'text-adapter' };

      const node = createLLMNode({
        name: 'prompt-node',
        adapter: mockAdapter,
        systemPrompt: 'You are a helpful assistant.',
        prompt: 'Hello!',
      });

      const ctx = createWorkflowContext({ debug: false });
      await node.execute({}, ctx);

      expect(mockChat).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: [{ role: 'user', content: 'Hello!' }],
          systemPrompts: ['You are a helpful assistant.'],
        })
      );
    });

    it('should build messages from dynamic prompt function', async () => {
      const mockAdapter = { _type: 'text-adapter' };

      const node = createLLMNode({
        name: 'dynamic-prompt-node',
        adapter: mockAdapter,
        prompt: (input: { text: string }) => `Process: ${input.text}`,
      });

      const ctx = createWorkflowContext({ debug: false });
      await node.execute({ text: 'test input' }, ctx);

      expect(mockChat).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: [{ role: 'user', content: 'Process: test input' }],
        })
      );
    });

    it('should use custom messages builder when provided', async () => {
      const mockAdapter = { _type: 'text-adapter' };

      const node = createLLMNode({
        name: 'messages-node',
        adapter: mockAdapter,
        messages: (input: { history: string[] }) =>
          input.history.map((content) => ({ role: 'user' as const, content })),
      });

      const ctx = createWorkflowContext({ debug: false });
      await node.execute({ history: ['message 1', 'message 2'] }, ctx);

      expect(mockChat).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: [
            { role: 'user', content: 'message 1' },
            { role: 'user', content: 'message 2' },
          ],
        })
      );
    });
  });

  describe('response collection', () => {
    it('should collect streaming content into final response', async () => {
      const mockAdapter = { _type: 'text-adapter' };

      mockChat.mockReturnValue({
        [Symbol.asyncIterator]: async function* () {
          yield { type: 'content', delta: 'This ' };
          yield { type: 'content', delta: 'is ' };
          yield { type: 'content', delta: 'a ' };
          yield { type: 'content', delta: 'test.' };
          yield { type: 'done', finishReason: 'stop' };
        },
      });

      const node = createLLMNode({
        name: 'streaming-node',
        adapter: mockAdapter,
        prompt: 'Generate text',
      });

      const ctx = createWorkflowContext({ debug: false });
      const result = await node.execute({}, ctx);

      expect(result.content).toBe('This is a test.');
    });

    it('should include usage information when available', async () => {
      const mockAdapter = { _type: 'text-adapter' };

      mockChat.mockReturnValue({
        [Symbol.asyncIterator]: async function* () {
          yield { type: 'content', delta: 'Response' };
          yield {
            type: 'done',
            finishReason: 'stop',
            usage: {
              promptTokens: 10,
              completionTokens: 20,
              totalTokens: 30,
            },
          };
        },
      });

      const node = createLLMNode({
        name: 'usage-node',
        adapter: mockAdapter,
        prompt: 'Test',
      });

      const ctx = createWorkflowContext({ debug: false });
      const result = await node.execute({}, ctx);

      expect(result.usage).toEqual({
        promptTokens: 10,
        completionTokens: 20,
        totalTokens: 30,
      });
    });
  });

  describe('error handling', () => {
    it('should throw NodeExecutionError when chat fails', async () => {
      const mockAdapter = { _type: 'text-adapter' };

      mockChat.mockReturnValue({
        [Symbol.asyncIterator]: async function* () {
          throw new Error('API connection failed');
        },
      });

      const node = createLLMNode({
        name: 'error-node',
        adapter: mockAdapter,
        prompt: 'Test',
      });

      const ctx = createWorkflowContext({ debug: false });

      await expect(node.execute({}, ctx)).rejects.toThrow('LLM request failed');
    });

    it('should handle stream errors gracefully', async () => {
      const mockAdapter = { _type: 'text-adapter' };

      mockChat.mockReturnValue({
        [Symbol.asyncIterator]: async function* () {
          yield { type: 'content', delta: 'Partial' };
          yield { type: 'error', error: { message: 'Rate limit exceeded' } };
        },
      });

      const node = createLLMNode({
        name: 'stream-error-node',
        adapter: mockAdapter,
        prompt: 'Test',
      });

      const ctx = createWorkflowContext({ debug: false });

      await expect(node.execute({}, ctx)).rejects.toThrow('LLM request failed');
    });
  });

  describe('type guard: isTextAdapterConfig', () => {
    it('should identify TextAdapterConfig objects', async () => {
      // Import the type guard (will be implemented in llm-node.ts)
      const { isTextAdapterConfig } = await import('../src/nodes/llm-node');

      expect(isTextAdapterConfig({ provider: 'openai', model: 'gpt-4o' })).toBe(true);
      expect(isTextAdapterConfig({ provider: 'anthropic', model: 'claude-3' })).toBe(true);
      expect(isTextAdapterConfig({ provider: 'gemini', model: 'gemini-pro' })).toBe(true);
    });

    it('should reject non-config objects', async () => {
      const { isTextAdapterConfig } = await import('../src/nodes/llm-node');

      // Mock TextAdapter doesn't have provider as string literal
      expect(isTextAdapterConfig({ _type: 'text-adapter' })).toBe(false);
      expect(isTextAdapterConfig(null)).toBe(false);
      expect(isTextAdapterConfig(undefined)).toBe(false);
      expect(isTextAdapterConfig('string')).toBe(false);
      expect(isTextAdapterConfig(123)).toBe(false);
    });
  });
});
