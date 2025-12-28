/**
 * @seashore/agent - Unit Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { TextAdapter } from '../../llm/src/types';
import type { Tool } from '../../tool/src/types';

// Mock @seashore/llm
vi.mock('@seashore/llm', () => ({
  chat: vi.fn(),
}));

describe('@seashore/agent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createAgent', () => {
    it('should create an agent with correct properties', async () => {
      const { createAgent } = await import('../src/create-agent');

      const agent = createAgent({
        name: 'TestAgent',
        systemPrompt: 'You are a test agent.',
        model: { provider: 'openai', model: 'gpt-4o' } as unknown as TextAdapter,
        tools: [],
      });

      expect(agent.name).toBe('TestAgent');
      expect(agent.tools).toEqual([]);
      expect(typeof agent.run).toBe('function');
      expect(typeof agent.stream).toBe('function');
      expect(typeof agent.chat).toBe('function');
    });
  });

  describe('tool-executor', () => {
    it('should execute tool successfully', async () => {
      const { executeTool } = await import('../src/tool-executor');

      const mockTool = {
        name: 'test_tool',
        description: 'A test tool',
        jsonSchema: { type: 'object' as const, properties: {}, required: [] },
        needsApproval: false,
        validate: (_input: unknown): _input is unknown => true,
        parse: (x: unknown) => x,
        execute: vi.fn().mockResolvedValue({
          success: true,
          data: { result: 'success' },
          durationMs: 10,
        }),
      } as Tool<unknown, unknown>;

      const result = await executeTool(
        mockTool,
        { id: '1', name: 'test_tool', arguments: '{}' },
        { agentName: 'TestAgent' }
      );

      expect(result.id).toBe('1');
      expect(result.name).toBe('test_tool');
      expect(mockTool.execute).toHaveBeenCalled();
    });

    it('should handle tool execution error', async () => {
      const { executeTool } = await import('../src/tool-executor');

      const mockTool = {
        name: 'failing_tool',
        description: 'A failing tool',
        jsonSchema: { type: 'object' as const, properties: {}, required: [] },
        needsApproval: false,
        validate: (_input: unknown): _input is unknown => true,
        parse: (x: unknown) => x,
        execute: vi.fn().mockRejectedValue(new Error('Tool failed')),
      } as Tool<unknown, unknown>;

      const result = await executeTool(
        mockTool,
        { id: '1', name: 'failing_tool', arguments: '{}' },
        { agentName: 'TestAgent' }
      );

      expect(result.result.success).toBe(false);
      expect(result.result.error).toBe('Tool failed');
    });

    it('should format tool result correctly', async () => {
      const { formatToolResult } = await import('../src/tool-executor');

      const successResult = formatToolResult({
        id: '1',
        name: 'tool',
        arguments: {},
        result: { success: true, data: { key: 'value' }, durationMs: 10 },
      });
      expect(successResult).toBe('{"key":"value"}');

      const errorResult = formatToolResult({
        id: '2',
        name: 'tool',
        arguments: {},
        result: { success: false, error: 'Something went wrong', durationMs: 5 },
      });
      expect(errorResult).toBe('Error: Something went wrong');
    });
  });

  describe('error-handler', () => {
    it('should identify retryable errors', async () => {
      const { isRetryableError, AgentError } = await import('../src/error-handler');

      // Retryable errors
      expect(isRetryableError(new AgentError('LLM failed', 'LLM_ERROR'))).toBe(true);
      expect(isRetryableError(new AgentError('Tool failed', 'TOOL_EXECUTION_FAILED'))).toBe(true);
      expect(isRetryableError(new Error('rate limit exceeded'))).toBe(true);
      expect(isRetryableError(new Error('network error'))).toBe(true);

      // Non-retryable errors
      expect(isRetryableError(new AgentError('Aborted', 'ABORTED'))).toBe(false);
      expect(isRetryableError(new AgentError('Validation', 'VALIDATION_ERROR'))).toBe(false);
      expect(isRetryableError(new Error('invalid input'))).toBe(false);
    });

    it('should throw on abort', async () => {
      const { checkAborted, AgentError } = await import('../src/error-handler');

      const controller = new AbortController();
      controller.abort();

      expect(() => checkAborted(controller.signal)).toThrow(AgentError);
    });
  });

  describe('stream', () => {
    it('should create stream chunks', async () => {
      const { StreamChunks } = await import('../src/stream');

      expect(StreamChunks.content('Hello').type).toBe('content');
      expect(StreamChunks.content('Hello').delta).toBe('Hello');

      expect(StreamChunks.toolCallStart('1', 'tool').type).toBe('tool-call-start');
      expect(StreamChunks.toolCallStart('1', 'tool').toolCall?.id).toBe('1');

      expect(StreamChunks.error(new Error('Test')).type).toBe('error');
    });

    it('should collect stream into result', async () => {
      const { collectStream, StreamChunks } = await import('../src/stream');

      async function* mockStream() {
        yield StreamChunks.content('Hello ');
        yield StreamChunks.content('World');
        yield StreamChunks.finish({
          content: 'Hello World',
          toolCalls: [],
          usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
          durationMs: 100,
          finishReason: 'stop',
        });
      }

      const result = await collectStream(mockStream());

      expect(result.content).toBe('Hello World');
      expect(result.finishReason).toBe('stop');
    });
  });
});
