/**
 * @seashore/workflow - LLM Node Tests
 *
 * Tests for LLM node functionality with model configuration
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
  };
});

// Import the mocked functions
import { chat } from '@seashore/llm';

const mockChat = chat as ReturnType<typeof vi.fn>;

describe('createLLMNode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('model configuration', () => {
    it('should accept TextAdapter directly (from openaiText, etc.)', async () => {
      // Create a mock TextAdapter (as returned by openaiText)
      const mockModel = {
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
        model: mockModel,
        prompt: 'Say hello',
      });

      const ctx = createWorkflowContext({ debug: false });
      const result = await node.execute({}, ctx);

      expect(result.content).toBe('Hello World');
      expect(mockChat).toHaveBeenCalledWith(
        expect.objectContaining({
          adapter: mockModel,
        })
      );
    });

    it('should support per-node models for different providers', async () => {
      const mockModel = { _type: 'text-adapter' };
      mockChat.mockReturnValue({
        [Symbol.asyncIterator]: async function* () {
          yield { type: 'content', delta: 'Response' };
          yield { type: 'done', finishReason: 'stop' };
        },
      });

      const nodeA = createLLMNode({
        name: 'team-a-node',
        model: mockModel,
        prompt: 'Team A task',
      });

      const nodeB = createLLMNode({
        name: 'team-b-node',
        model: mockModel,
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
      const mockModel = { _type: 'text-adapter' };

      const node = createLLMNode({
        name: 'prompt-node',
        model: mockModel,
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
      const mockModel = { _type: 'text-adapter' };

      const node = createLLMNode({
        name: 'dynamic-prompt-node',
        model: mockModel,
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
      const mockModel = { _type: 'text-adapter' };

      const node = createLLMNode({
        name: 'messages-node',
        model: mockModel,
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
      const mockModel = { _type: 'text-adapter' };

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
        model: mockModel,
        prompt: 'Generate text',
      });

      const ctx = createWorkflowContext({ debug: false });
      const result = await node.execute({}, ctx);

      expect(result.content).toBe('This is a test.');
    });

    it('should include usage information when available', async () => {
      const mockModel = { _type: 'text-adapter' };

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
        model: mockModel,
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
      const mockModel = { _type: 'text-adapter' };

      mockChat.mockReturnValue({
        [Symbol.asyncIterator]: async function* () {
          throw new Error('API connection failed');
        },
      });

      const node = createLLMNode({
        name: 'error-node',
        model: mockModel,
        prompt: 'Test',
      });

      const ctx = createWorkflowContext({ debug: false });

      await expect(node.execute({}, ctx)).rejects.toThrow('LLM request failed');
    });

    it('should handle stream errors gracefully', async () => {
      const mockModel = { _type: 'text-adapter' };

      mockChat.mockReturnValue({
        [Symbol.asyncIterator]: async function* () {
          yield { type: 'content', delta: 'Partial' };
          yield { type: 'error', error: { message: 'Rate limit exceeded' } };
        },
      });

      const node = createLLMNode({
        name: 'stream-error-node',
        model: mockModel,
        prompt: 'Test',
      });

      const ctx = createWorkflowContext({ debug: false });

      await expect(node.execute({}, ctx)).rejects.toThrow('LLM request failed');
    });
  });
});
