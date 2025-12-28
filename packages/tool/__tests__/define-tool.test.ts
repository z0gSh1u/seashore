/**
 * @seashore/tool - Unit Tests
 */

import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { defineTool } from '../src/define-tool';
import { zodToJsonSchema } from '../src/zod-to-json-schema';

describe('@seashore/tool', () => {
  describe('defineTool', () => {
    it('should create a tool with correct properties', () => {
      const tool = defineTool({
        name: 'test_tool',
        description: 'A test tool',
        inputSchema: z.object({
          message: z.string().describe('A message'),
        }),
        execute: async ({ message }) => ({ echo: message }),
      });

      expect(tool.name).toBe('test_tool');
      expect(tool.description).toBe('A test tool');
      expect(tool.needsApproval).toBe(false);
      expect(tool.jsonSchema).toBeDefined();
      expect(tool.jsonSchema.type).toBe('object');
    });

    it('should validate input correctly', () => {
      const tool = defineTool({
        name: 'validator',
        description: 'Validates input',
        inputSchema: z.object({
          count: z.number().min(0),
        }),
        execute: async ({ count }) => ({ doubled: count * 2 }),
      });

      expect(tool.validate({ count: 5 })).toBe(true);
      expect(tool.validate({ count: -1 })).toBe(false);
      expect(tool.validate({ count: 'five' })).toBe(false);
      expect(tool.validate({})).toBe(false);
    });

    it('should parse input and throw on invalid', () => {
      const tool = defineTool({
        name: 'parser',
        description: 'Parses input',
        inputSchema: z.object({
          name: z.string(),
        }),
        execute: async ({ name }) => ({ greeting: `Hello, ${name}` }),
      });

      expect(tool.parse({ name: 'World' })).toEqual({ name: 'World' });
      expect(() => tool.parse({})).toThrow();
      expect(() => tool.parse({ name: 123 })).toThrow();
    });

    it('should execute tool and return success result', async () => {
      const tool = defineTool({
        name: 'calculator',
        description: 'Adds two numbers',
        inputSchema: z.object({
          a: z.number(),
          b: z.number(),
        }),
        execute: async ({ a, b }) => ({ sum: a + b }),
      });

      const result = await tool.execute({ a: 2, b: 3 });

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ sum: 5 });
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
      expect(result.error).toBeUndefined();
    });

    it('should return error result on execution failure', async () => {
      const tool = defineTool({
        name: 'failer',
        description: 'Always fails',
        inputSchema: z.object({}),
        execute: async () => {
          throw new Error('Something went wrong');
        },
      });

      const result = await tool.execute({});

      expect(result.success).toBe(false);
      expect(result.error).toBe('Something went wrong');
      expect(result.data).toBeUndefined();
    });

    it('should return error result on validation failure', async () => {
      const tool = defineTool({
        name: 'strict',
        description: 'Requires valid input',
        inputSchema: z.object({
          email: z.string().email(),
        }),
        execute: async ({ email }) => ({ valid: true, email }),
      });

      const result = await tool.execute({ email: 'not-an-email' } as any);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should respect needsApproval flag', () => {
      const tool = defineTool({
        name: 'dangerous',
        description: 'Requires approval',
        inputSchema: z.object({}),
        execute: async () => ({}),
        needsApproval: true,
      });

      expect(tool.needsApproval).toBe(true);
    });

    it('should timeout long-running executions', async () => {
      const tool = defineTool({
        name: 'slow',
        description: 'Takes too long',
        inputSchema: z.object({}),
        timeout: 100,
        execute: async () => {
          await new Promise((resolve) => setTimeout(resolve, 500));
          return { done: true };
        },
      });

      const result = await tool.execute({});

      expect(result.success).toBe(false);
      expect(result.error).toContain('timed out');
    });

    it('should retry on failure when configured', async () => {
      let attempts = 0;

      const tool = defineTool({
        name: 'flaky',
        description: 'Fails twice then succeeds',
        inputSchema: z.object({}),
        retry: {
          maxAttempts: 3,
          delay: 10,
        },
        execute: async () => {
          attempts++;
          if (attempts < 3) {
            throw new Error('Not yet');
          }
          return { attempts };
        },
      });

      const result = await tool.execute({});

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ attempts: 3 });
    });

    it('should include context in execution', async () => {
      let capturedContext: any;

      const tool = defineTool({
        name: 'contextual',
        description: 'Uses context',
        inputSchema: z.object({}),
        execute: async (_, context) => {
          capturedContext = context;
          return {};
        },
      });

      await tool.execute(
        {},
        {
          threadId: 'thread-123',
          userId: 'user-456',
        }
      );

      expect(capturedContext.threadId).toBe('thread-123');
      expect(capturedContext.userId).toBe('user-456');
      expect(capturedContext.executionId).toBeDefined();
    });
  });

  describe('zodToJsonSchema', () => {
    it('should convert simple object schema', () => {
      const schema = z.object({
        name: z.string(),
        age: z.number(),
      });

      const jsonSchema = zodToJsonSchema(schema);

      expect(jsonSchema.type).toBe('object');
      expect(jsonSchema.properties?.['name']?.type).toBe('string');
      expect(jsonSchema.properties?.['age']?.type).toBe('number');
      expect(jsonSchema.required).toContain('name');
      expect(jsonSchema.required).toContain('age');
    });

    it('should handle optional fields', () => {
      const schema = z.object({
        required: z.string(),
        optional: z.string().optional(),
      });

      const jsonSchema = zodToJsonSchema(schema);

      expect(jsonSchema.required).toContain('required');
      expect(jsonSchema.required).not.toContain('optional');
    });

    it('should convert enums', () => {
      const schema = z.object({
        status: z.enum(['active', 'inactive', 'pending']),
      });

      const jsonSchema = zodToJsonSchema(schema);

      expect(jsonSchema.properties?.['status']?.type).toBe('string');
      expect(jsonSchema.properties?.['status']?.enum).toEqual(['active', 'inactive', 'pending']);
    });

    it('should convert arrays', () => {
      const schema = z.object({
        tags: z.array(z.string()),
      });

      const jsonSchema = zodToJsonSchema(schema);

      expect(jsonSchema.properties?.['tags']?.type).toBe('array');
      expect(jsonSchema.properties?.['tags']?.items?.type).toBe('string');
    });

    it('should include descriptions', () => {
      const schema = z.object({
        query: z.string().describe('The search query'),
      });

      const jsonSchema = zodToJsonSchema(schema);

      expect(jsonSchema.properties?.['query']?.description).toBe('The search query');
    });

    it('should convert nested objects', () => {
      const schema = z.object({
        user: z.object({
          name: z.string(),
          email: z.string(),
        }),
      });

      const jsonSchema = zodToJsonSchema(schema);

      expect(jsonSchema.properties?.['user']?.type).toBe('object');
      expect(jsonSchema.properties?.['user']?.properties?.['name']?.type).toBe('string');
    });

    it('should handle non-object root schema', () => {
      // Zod 4's toJSONSchema supports all types, not just objects
      const schema = z.string();
      const jsonSchema = zodToJsonSchema(schema);

      expect(jsonSchema).toMatchObject({
        type: 'string',
      });
    });
  });
});
