/**
 * @seashore/tool - Zod to JSON Schema Converter
 *
 * Converts Zod schemas to JSON Schema for LLM function calling
 */

import type { ZodSchema } from 'zod';
import type { JsonSchema, JsonSchemaProperty } from './types.js';

// Internal type for Zod type definitions
interface ZodTypeDef {
  typeName: string;
  shape?: () => Record<string, ZodSchema>;
  description?: string;
  innerType?: ZodSchema;
  options?: readonly ZodSchema[];
  type?: ZodSchema;
}

/**
 * Convert a Zod schema to JSON Schema
 */
export function zodToJsonSchema(schema: ZodSchema): JsonSchema {
  const typeDef = schema._def as ZodTypeDef;

  if (typeDef.typeName !== 'ZodObject') {
    throw new Error('Root schema must be a ZodObject');
  }

  const shape = typeDef.shape?.() ?? {};
  const properties: Record<string, JsonSchemaProperty> = {};
  const required: string[] = [];

  for (const [key, value] of Object.entries(shape)) {
    const prop = zodPropertyToJsonSchema(value as ZodSchema);
    properties[key] = prop;

    // Check if field is required (not optional/nullable)
    if (!isOptional(value as ZodSchema)) {
      required.push(key);
    }
  }

  return {
    type: 'object',
    properties,
    required,
    additionalProperties: false,
  };
}

/**
 * Convert a Zod property to JSON Schema property
 */
function zodPropertyToJsonSchema(schema: ZodSchema): JsonSchemaProperty {
  const def = schema._def as ZodTypeDef;

  // Handle optional/nullable by unwrapping
  if (def.typeName === 'ZodOptional' || def.typeName === 'ZodNullable') {
    return zodPropertyToJsonSchema(def.innerType!);
  }

  const base: JsonSchemaProperty = {
    type: zodTypeToJsonType(def.typeName),
    description: def.description,
  };

  switch (def.typeName) {
    case 'ZodEnum':
    case 'ZodNativeEnum':
      return {
        ...base,
        enum: (def as ZodTypeDef & { values?: readonly unknown[] }).values,
      };

    case 'ZodArray':
      return {
        ...base,
        items: zodPropertyToJsonSchema(def.type!),
      };

    case 'ZodObject': {
      const shape = def.shape?.() ?? {};
      const props: Record<string, JsonSchemaProperty> = {};
      const req: string[] = [];

      for (const [key, value] of Object.entries(shape)) {
        props[key] = zodPropertyToJsonSchema(value as ZodSchema);
        if (!isOptional(value as ZodSchema)) {
          req.push(key);
        }
      }

      return {
        ...base,
        properties: props,
        required: req,
      };
    }

    default:
      return base;
  }
}

/**
 * Map Zod type names to JSON Schema types
 */
function zodTypeToJsonType(typeName: string): string {
  switch (typeName) {
    case 'ZodString':
      return 'string';
    case 'ZodNumber':
    case 'ZodBigInt':
      return 'number';
    case 'ZodBoolean':
      return 'boolean';
    case 'ZodArray':
      return 'array';
    case 'ZodObject':
      return 'object';
    case 'ZodNull':
      return 'null';
    case 'ZodAny':
    case 'ZodUnknown':
      return 'any';
    default:
      return 'string';
  }
}

/**
 * Check if a Zod schema is optional
 */
function isOptional(schema: ZodSchema): boolean {
  const def = schema._def as ZodTypeDef & { typeName: string };
  return def.typeName === 'ZodOptional' || def.typeName === 'ZodNullable';
}
