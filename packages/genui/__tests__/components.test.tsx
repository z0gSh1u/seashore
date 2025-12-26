/**
 * GenUI component tests
 * @module @seashore/genui
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderHook, act } from '@testing-library/react';
import {
  createGenUIRegistry,
  isGenUIData,
  useChat,
  useChatStream,
  renderToolCall,
} from '../src/index.js';
import type { ChatMessageType, ToolCallUI } from '../src/types.js';

describe('@seashore/genui', () => {
  describe('createGenUIRegistry', () => {
    it('should create a registry', () => {
      const registry = createGenUIRegistry();
      expect(registry).toBeDefined();
      expect(registry.names()).toEqual([]);
    });

    it('should register a component', () => {
      const registry = createGenUIRegistry();
      const TestComponent = ({ data }: { data: { value: string } }) => <div>{data.value}</div>;

      registry.register('test_tool', {
        component: TestComponent,
      });

      expect(registry.has('test_tool')).toBe(true);
      expect(registry.names()).toEqual(['test_tool']);
    });

    it('should get a registered component', () => {
      const registry = createGenUIRegistry();
      const TestComponent = ({ data }: { data: unknown }) => <div>Test</div>;

      registry.register('test_tool', {
        component: TestComponent,
      });

      const renderer = registry.get('test_tool');
      expect(renderer).toBeDefined();
      expect(renderer?.component).toBe(TestComponent);
    });

    it('should return undefined for unregistered tool', () => {
      const registry = createGenUIRegistry();
      expect(registry.get('unknown')).toBeUndefined();
      expect(registry.has('unknown')).toBe(false);
    });
  });

  describe('isGenUIData', () => {
    it('should return true for valid GenUI data', () => {
      expect(isGenUIData({ __genui: true, data: { foo: 'bar' } })).toBe(true);
    });

    it('should return false for non-GenUI data', () => {
      expect(isGenUIData({ foo: 'bar' })).toBe(false);
      expect(isGenUIData(null)).toBe(false);
      expect(isGenUIData(undefined)).toBe(false);
      expect(isGenUIData('string')).toBe(false);
      expect(isGenUIData(123)).toBe(false);
      expect(isGenUIData({ __genui: false, data: {} })).toBe(false);
    });
  });

  describe('renderToolCall', () => {
    it('should render loading state', () => {
      const toolCall: ToolCallUI = {
        id: 'call_1',
        name: 'search',
        args: { query: 'test' },
        isLoading: true,
      };

      const result = renderToolCall(toolCall);
      expect(result.isGenUI).toBe(false);
      expect(result.element).toBeDefined();
    });

    it('should render error state', () => {
      const toolCall: ToolCallUI = {
        id: 'call_1',
        name: 'search',
        args: { query: 'test' },
        isLoading: false,
        error: 'Something went wrong',
      };

      const result = renderToolCall(toolCall);
      expect(result.isGenUI).toBe(false);
      expect(result.element).toBeDefined();
    });

    it('should render default result', () => {
      const toolCall: ToolCallUI = {
        id: 'call_1',
        name: 'search',
        args: { query: 'test' },
        result: 'Search result',
        isLoading: false,
      };

      const result = renderToolCall(toolCall);
      expect(result.isGenUI).toBe(false);
      expect(result.element).toBeDefined();
    });

    it('should render GenUI component when registered', () => {
      const registry = createGenUIRegistry();
      const TestComponent = ({ data }: { data: { value: string } }) => <div>{data.value}</div>;

      registry.register('show_data', {
        component: TestComponent,
      });

      const toolCall: ToolCallUI = {
        id: 'call_1',
        name: 'show_data',
        args: {},
        result: { __genui: true, data: { value: 'Hello' } },
        isLoading: false,
      };

      const result = renderToolCall(toolCall, registry);
      expect(result.isGenUI).toBe(true);
      expect(result.element).toBeDefined();
    });
  });

  describe('useChat', () => {
    beforeEach(() => {
      vi.resetAllMocks();
    });

    it('should initialize with empty state', () => {
      const { result } = renderHook(() => useChat({ endpoint: '/api/chat' }));

      expect(result.current.messages).toEqual([]);
      expect(result.current.input).toBe('');
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.threadId).toBeNull();
    });

    it('should initialize with initial messages', () => {
      const initialMessages: ChatMessageType[] = [
        {
          id: '1',
          role: 'user',
          content: 'Hello',
          createdAt: new Date(),
        },
      ];

      const { result } = renderHook(() => useChat({ endpoint: '/api/chat', initialMessages }));

      expect(result.current.messages).toHaveLength(1);
      expect(result.current.messages[0].content).toBe('Hello');
    });

    it('should update input', () => {
      const { result } = renderHook(() => useChat({ endpoint: '/api/chat' }));

      act(() => {
        result.current.setInput('New message');
      });

      expect(result.current.input).toBe('New message');
    });

    it('should clear messages', () => {
      const initialMessages: ChatMessageType[] = [
        {
          id: '1',
          role: 'user',
          content: 'Hello',
          createdAt: new Date(),
        },
      ];

      const { result } = renderHook(() => useChat({ endpoint: '/api/chat', initialMessages }));

      act(() => {
        result.current.clearMessages();
      });

      expect(result.current.messages).toEqual([]);
    });
  });

  describe('useChatStream', () => {
    it('should initialize with empty state', () => {
      const { result } = renderHook(() => useChatStream());

      expect(result.current.streamingText).toBe('');
      expect(result.current.toolCalls.size).toBe(0);
      expect(result.current.isStreaming).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('should have stop function', () => {
      const { result } = renderHook(() => useChatStream());

      expect(typeof result.current.stopStream).toBe('function');
    });
  });
});
