/**
 * Schema validation tests
 * 
 * Tests the Drizzle schema definitions for threads and messages tables.
 */

import { describe, it, expect } from 'vitest';
import { threads, messages, type Thread, type Message, type NewThread, type NewMessage } from '../src/schema.js';

describe('Schema Definitions', () => {
  describe('threads schema', () => {
    it('should have correct table name', () => {
      expect((threads as any)[Symbol.for('drizzle:Name')]).toBe('threads');
    });

    it('should define Thread type correctly', () => {
      // Type-only test - if this compiles, types are correct
      const thread: Thread = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        title: 'Test Thread',
        metadata: { userId: 'user123' },
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      expect(thread.id).toBeDefined();
      expect(thread.title).toBeDefined();
    });

    it('should define NewThread type for inserts', () => {
      // Type-only test
      const newThread: NewThread = {
        title: 'New Thread',
        metadata: { tag: 'test' },
      };
      
      expect(newThread.title).toBeDefined();
    });

    it('should allow optional fields', () => {
      const minimalThread: NewThread = {};
      expect(minimalThread).toBeDefined();
    });
  });

  describe('messages schema', () => {
    it('should have correct table name', () => {
      expect((messages as any)[Symbol.for('drizzle:Name')]).toBe('messages');
    });

    it('should define Message type correctly', () => {
      const message: Message = {
        id: '123e4567-e89b-12d3-a456-426614174001',
        threadId: '123e4567-e89b-12d3-a456-426614174000',
        role: 'user',
        content: 'Hello, world!',
        name: null,
        toolCalls: null,
        toolCallId: null,
        metadata: { timestamp: Date.now() },
        sequence: 0,
        createdAt: new Date(),
      };
      
      expect(message.id).toBeDefined();
      expect(message.role).toBe('user');
    });

    it('should support all role types', () => {
      const roles: Array<'user' | 'assistant' | 'system' | 'tool'> = ['user', 'assistant', 'system', 'tool'];
      
      roles.forEach(role => {
        const message: NewMessage = {
          threadId: '123e4567-e89b-12d3-a456-426614174000',
          role,
          content: 'Test message',
          sequence: 0,
        };
        expect(message.role).toBe(role);
      });
    });

    it('should support tool calls structure', () => {
      const messageWithTools: NewMessage = {
        threadId: '123e4567-e89b-12d3-a456-426614174000',
        role: 'assistant',
        content: 'Calling tool...',
        sequence: 1,
        toolCalls: [{
          id: 'call_123',
          type: 'function',
          function: {
            name: 'get_weather',
            arguments: '{"location":"San Francisco"}',
          },
        }],
      };
      
      expect(messageWithTools.toolCalls).toHaveLength(1);
      expect(messageWithTools.toolCalls![0].function.name).toBe('get_weather');
    });

    it('should support tool response messages', () => {
      const toolResponse: NewMessage = {
        threadId: '123e4567-e89b-12d3-a456-426614174000',
        role: 'tool',
        content: '{"temperature": 72, "condition": "sunny"}',
        name: 'get_weather',
        toolCallId: 'call_123',
        sequence: 2,
      };
      
      expect(toolResponse.role).toBe('tool');
      expect(toolResponse.toolCallId).toBe('call_123');
    });
  });

  describe('Type safety', () => {
    it('should enforce required fields at compile time', () => {
      // These should compile successfully
      const validMessage: NewMessage = {
        threadId: '123e4567-e89b-12d3-a456-426614174000',
        role: 'user',
        content: 'Required fields present',
        sequence: 0,
      };
      
      expect(validMessage).toBeDefined();
      
      // The following would fail TypeScript compilation:
      // const invalid: NewMessage = {
      //   role: 'user',
      //   content: 'Missing threadId',
      //   sequence: 0,
      // };
    });

    it('should allow metadata of any shape', () => {
      const thread1: NewThread = {
        metadata: { userId: 'user1', tags: ['important'] },
      };
      
      const thread2: NewThread = {
        metadata: { customField: 123, nested: { data: true } },
      };
      
      expect(thread1.metadata).toBeDefined();
      expect(thread2.metadata).toBeDefined();
    });
  });
});
