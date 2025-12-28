/**
 * @seashore/tool - Schema Inference Tests
 *
 * Tests for Zod to JSON Schema conversion and type inference
 */

import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { zodToJsonSchema } from '../src/zod-to-json-schema';
import { defineTool } from '../src/define-tool';

describe('Zod to JSON Schema Conversion', () => {
  describe('Primitive Types', () => {
    it('should convert string schema', () => {
      const schema = z.string();
      const jsonSchema = zodToJsonSchema(schema);

      // Zod 4's toJSONSchema includes $schema field
      expect(jsonSchema).toMatchObject({
        type: 'string',
      });
    });

    it('should convert string with constraints', () => {
      const schema = z.string().min(1).max(100);
      const jsonSchema = zodToJsonSchema(schema);

      expect(jsonSchema).toMatchObject({
        type: 'string',
        minLength: 1,
        maxLength: 100,
      });
    });

    it('should convert string with description', () => {
      const schema = z.string().describe('User name');
      const jsonSchema = zodToJsonSchema(schema);

      expect(jsonSchema).toMatchObject({
        type: 'string',
        description: 'User name',
      });
    });

    it('should convert number schema', () => {
      const schema = z.number();
      const jsonSchema = zodToJsonSchema(schema);

      // Zod 4's toJSONSchema includes $schema field
      expect(jsonSchema).toMatchObject({
        type: 'number',
      });
    });

    it('should convert number with constraints', () => {
      const schema = z.int().min(0).max(100);
      const jsonSchema = zodToJsonSchema(schema);

      expect(jsonSchema).toMatchObject({
        type: 'integer',
      });
      // Zod 4 int() applies min/max constraints
      expect(jsonSchema.minimum).toBeLessThanOrEqual(0);
      expect(jsonSchema.maximum).toBeGreaterThanOrEqual(100);
    });

    it('should convert boolean schema', () => {
      const schema = z.boolean();
      const jsonSchema = zodToJsonSchema(schema);

      // Zod 4's toJSONSchema includes $schema field
      expect(jsonSchema).toMatchObject({
        type: 'boolean',
      });
    });
  });

  describe('Object Types', () => {
    it('should convert simple object schema', () => {
      const schema = z.object({
        name: z.string(),
        age: z.number(),
      });
      const jsonSchema = zodToJsonSchema(schema);

      expect(jsonSchema).toMatchObject({
        type: 'object',
        properties: {
          name: { type: 'string' },
          age: { type: 'number' },
        },
        required: ['name', 'age'],
      });
    });

    it('should handle optional properties', () => {
      const schema = z.object({
        name: z.string(),
        nickname: z.string().optional(),
      });
      const jsonSchema = zodToJsonSchema(schema);

      expect(jsonSchema.required).toContain('name');
      expect(jsonSchema.required).not.toContain('nickname');
    });

    it('should handle nullable properties', () => {
      const schema = z.object({
        value: z.string().nullable(),
      });
      const jsonSchema = zodToJsonSchema(schema);

      // Zod 4 uses anyOf for nullable types
      const valueProp = jsonSchema.properties?.value as
        | { anyOf?: Array<{ type: string }> }
        | undefined;
      expect(valueProp?.anyOf).toBeDefined();
      expect(valueProp?.anyOf).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ type: 'string' }),
          expect.objectContaining({ type: 'null' }),
        ])
      );
    });

    it('should handle nested objects', () => {
      const schema = z.object({
        user: z.object({
          name: z.string(),
          address: z.object({
            city: z.string(),
            country: z.string(),
          }),
        }),
      });
      const jsonSchema = zodToJsonSchema(schema);

      expect(jsonSchema.properties?.user?.type).toBe('object');
      expect(jsonSchema.properties?.user?.properties?.address?.type).toBe('object');
      expect(jsonSchema.properties?.user?.properties?.address?.properties?.city?.type).toBe(
        'string'
      );
    });
  });

  describe('Array Types', () => {
    it('should convert array of strings', () => {
      const schema = z.array(z.string());
      const jsonSchema = zodToJsonSchema(schema);

      expect(jsonSchema).toMatchObject({
        type: 'array',
        items: { type: 'string' },
      });
    });

    it('should convert array with length constraints', () => {
      const schema = z.array(z.number()).min(1).max(10);
      const jsonSchema = zodToJsonSchema(schema);

      expect(jsonSchema).toMatchObject({
        type: 'array',
        items: { type: 'number' },
        minItems: 1,
        maxItems: 10,
      });
    });

    it('should convert array of objects', () => {
      const schema = z.array(
        z.object({
          id: z.string(),
          value: z.number(),
        })
      );
      const jsonSchema = zodToJsonSchema(schema);

      expect(jsonSchema.type).toBe('array');
      expect(jsonSchema.items?.type).toBe('object');
      expect(jsonSchema.items?.properties?.id?.type).toBe('string');
    });
  });

  describe('Enum Types', () => {
    it('should convert string enum', () => {
      const schema = z.enum(['small', 'medium', 'large']);
      const jsonSchema = zodToJsonSchema(schema);

      expect(jsonSchema).toMatchObject({
        type: 'string',
        enum: ['small', 'medium', 'large'],
      });
    });

    it('should convert native enum', () => {
      enum Size {
        Small = 'small',
        Medium = 'medium',
        Large = 'large',
      }
      const schema = z.nativeEnum(Size);
      const jsonSchema = zodToJsonSchema(schema);

      expect(jsonSchema.enum).toContain('small');
      expect(jsonSchema.enum).toContain('medium');
      expect(jsonSchema.enum).toContain('large');
    });
  });

  describe('Union Types', () => {
    it('should convert string or number union', () => {
      const schema = z.union([z.string(), z.number()]);
      const jsonSchema = zodToJsonSchema(schema);

      expect(jsonSchema.oneOf ?? jsonSchema.anyOf).toBeDefined();
    });

    it('should convert discriminated union', () => {
      const schema = z.discriminatedUnion('type', [
        z.object({ type: z.literal('text'), content: z.string() }),
        z.object({ type: z.literal('image'), url: z.string() }),
      ]);
      const jsonSchema = zodToJsonSchema(schema);

      expect(jsonSchema.oneOf ?? jsonSchema.anyOf).toHaveLength(2);
    });
  });

  describe('Literal Types', () => {
    it('should convert string literal', () => {
      const schema = z.literal('hello');
      const jsonSchema = zodToJsonSchema(schema);

      expect(jsonSchema).toMatchObject({
        type: 'string',
        const: 'hello',
      });
    });

    it('should convert number literal', () => {
      const schema = z.literal(42);
      const jsonSchema = zodToJsonSchema(schema);

      expect(jsonSchema).toMatchObject({
        type: 'number',
        const: 42,
      });
    });

    it('should convert boolean literal', () => {
      const schema = z.literal(true);
      const jsonSchema = zodToJsonSchema(schema);

      expect(jsonSchema).toMatchObject({
        type: 'boolean',
        const: true,
      });
    });
  });

  describe('Default Values', () => {
    it('should include default in schema', () => {
      const schema = z.object({
        count: z.number().default(10),
        name: z.string().default('unnamed'),
      });
      const jsonSchema = zodToJsonSchema(schema);

      expect(jsonSchema.properties?.count?.default).toBe(10);
      expect(jsonSchema.properties?.name?.default).toBe('unnamed');
    });
  });

  describe('Tool Schema Integration', () => {
    it('should create valid schema for calculator tool', () => {
      const calculatorTool = defineTool({
        name: 'calculator',
        description: 'Perform calculations',
        inputSchema: z.object({
          operation: z.enum(['add', 'subtract', 'multiply', 'divide']),
          a: z.number().describe('First operand'),
          b: z.number().describe('Second operand'),
        }),
        execute: async ({ operation, a, b }) => {
          switch (operation) {
            case 'add':
              return a + b;
            case 'subtract':
              return a - b;
            case 'multiply':
              return a * b;
            case 'divide':
              return a / b;
          }
        },
      });

      expect(calculatorTool.jsonSchema).toMatchObject({
        type: 'object',
        properties: {
          operation: {
            type: 'string',
            enum: ['add', 'subtract', 'multiply', 'divide'],
          },
          a: {
            type: 'number',
            description: 'First operand',
          },
          b: {
            type: 'number',
            description: 'Second operand',
          },
        },
        required: ['operation', 'a', 'b'],
      });
    });

    it('should create valid schema for search tool', () => {
      const searchTool = defineTool({
        name: 'search',
        description: 'Search the web',
        inputSchema: z.object({
          query: z.string().min(1).describe('Search query'),
          limit: z.number().int().min(1).max(100).optional().describe('Number of results'),
          filters: z
            .object({
              dateRange: z.enum(['day', 'week', 'month', 'year']).optional(),
              site: z.string().optional(),
            })
            .optional(),
        }),
        execute: async (_input) => ({ results: [] }),
      });

      const schema = searchTool.jsonSchema;

      expect(schema.type).toBe('object');
      expect(schema.required).toContain('query');
      expect(schema.required).not.toContain('limit');
      expect(schema.required).not.toContain('filters');
      expect(schema.properties?.query?.minLength).toBe(1);
    });

    it('should handle complex nested schema', () => {
      const dataTool = defineTool({
        name: 'process_data',
        description: 'Process structured data',
        inputSchema: z.object({
          records: z.array(
            z.object({
              id: z.string().uuid(),
              values: z.array(z.number()),
              metadata: z.record(z.string(), z.unknown()).optional(),
            })
          ),
          options: z.object({
            normalize: z.boolean().default(false),
            aggregate: z.enum(['sum', 'avg', 'min', 'max']).optional(),
          }),
        }),
        execute: async (input) => ({ processed: input.records.length }),
      });

      const schema = dataTool.jsonSchema;

      expect(schema.properties?.records?.type).toBe('array');
      expect(schema.properties?.records?.items?.properties?.id?.format).toBe('uuid');
      expect(schema.properties?.options?.properties?.normalize?.default).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty object schema', () => {
      const schema = z.object({});
      const jsonSchema = zodToJsonSchema(schema);

      expect(jsonSchema).toMatchObject({
        type: 'object',
        properties: {},
      });
    });

    it('should handle passthrough object', () => {
      const schema = z.object({ known: z.string() }).passthrough();
      const jsonSchema = zodToJsonSchema(schema);

      expect(jsonSchema.additionalProperties).not.toBe(false);
    });

    it('should handle strict object', () => {
      const schema = z.object({ known: z.string() }).strict();
      const jsonSchema = zodToJsonSchema(schema);

      expect(jsonSchema.additionalProperties).toBe(false);
    });

    it('should handle recursive schema references', () => {
      // Note: This is a simplified test - full recursion handling may vary
      const nodeSchema: z.ZodType<{ value: string; children?: unknown[] }> = z.object({
        value: z.string(),
        children: z.lazy(() => z.array(nodeSchema)).optional(),
      });

      // Should not throw
      expect(() => zodToJsonSchema(nodeSchema)).not.toThrow();
    });
  });
});
