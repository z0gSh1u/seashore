/**
 * @seashore/llm - Structured Output
 *
 * Support for structured/typed LLM outputs using Zod schemas
 */

import type { z, ZodSchema, ZodError } from 'zod';
import type { Message, TextAdapter, TokenUsage, StreamChunk } from './types.js';
import { chat } from './adapters.js';

/**
 * Structured output options
 */
export interface StructuredOutputOptions<T extends ZodSchema> {
  /** LLM adapter to use */
  readonly adapter: TextAdapter;

  /** Messages to send */
  readonly messages: readonly Message[];

  /** Output schema */
  readonly schema: T;

  /** Schema name for the LLM */
  readonly name?: string;

  /** Description of what the output should contain */
  readonly description?: string;

  /** Temperature */
  readonly temperature?: number;

  /** Max tokens */
  readonly maxTokens?: number;

  /** Abort signal */
  readonly signal?: AbortSignal;

  /** Whether to use strict mode (fail on parse errors) */
  readonly strict?: boolean;

  /** Custom system prompt for structured output */
  readonly systemPrompt?: string;
}

/**
 * Structured output result
 */
export interface StructuredResult<T> {
  /** Parsed data */
  readonly data: T;

  /** Raw content from LLM */
  readonly raw: string;

  /** Token usage */
  readonly usage?: TokenUsage;

  /** Parse warnings (if any) */
  readonly warnings?: string[];
}

/**
 * Generate structured output from an LLM
 *
 * Uses JSON mode or function calling depending on the provider to ensure
 * the output matches the specified Zod schema.
 *
 * @example
 * ```typescript
 * import { generateStructured, openaiText } from '@seashore/llm';
 * import { z } from 'zod';
 *
 * const result = await generateStructured({
 *   adapter: openaiText('gpt-4o'),
 *   messages: [{ role: 'user', content: 'Extract info from: John Doe, 30 years old' }],
 *   schema: z.object({
 *     name: z.string(),
 *     age: z.number(),
 *   }),
 * });
 *
 * console.log(result.data); // { name: 'John Doe', age: 30 }
 * ```
 */
export async function generateStructured<T extends ZodSchema>(
  options: StructuredOutputOptions<T>
): Promise<StructuredResult<z.infer<T>>> {
  const {
    adapter,
    messages,
    schema,
    name = 'output',
    description,
    temperature = 0,
    signal,
    strict = true,
    systemPrompt,
  } = options;

  // Build system message with schema instructions
  const schemaDescription = buildSchemaDescription(schema, name, description);
  const systemMessage: Message = {
    role: 'system',
    content: systemPrompt ?? buildStructuredSystemPrompt(schemaDescription),
  };

  // Prepare messages with system prompt
  const fullMessages: Message[] = [systemMessage, ...messages.filter((m) => m.role !== 'system')];

  // Collect response
  let content = '';
  let usage: TokenUsage | undefined;

  for await (const chunk of chat({
    adapter,
    messages: fullMessages,
    temperature,
    signal,
  })) {
    if (chunk.type === 'content' && chunk.delta) {
      content += chunk.delta;
    }
    if (chunk.type === 'finish' && chunk.usage) {
      usage = chunk.usage;
    }
  }

  // Extract JSON from response
  const { json, warnings } = extractJSON(content);

  if (!json) {
    throw new StructuredOutputError('Failed to extract JSON from LLM response', content, undefined);
  }

  // Parse with schema
  try {
    const data = schema.parse(json) as z.infer<T>;

    return {
      data,
      raw: content,
      usage,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  } catch (error) {
    if (strict) {
      throw new StructuredOutputError(
        'LLM output does not match schema',
        content,
        error as ZodError
      );
    }

    // In non-strict mode, try to return partial data
    const partialResult = schema.safeParse(json);
    if (partialResult.success) {
      return {
        data: partialResult.data as z.infer<T>,
        raw: content,
        usage,
        warnings: [...warnings, 'Parsed with warnings'],
      };
    }

    throw new StructuredOutputError('LLM output does not match schema', content, error as ZodError);
  }
}

/**
 * Stream structured output with partial results
 *
 * Yields partial parsed results as the LLM streams its response.
 * Useful for showing progressive updates to the user.
 */
export async function* streamStructured<T extends ZodSchema>(
  options: StructuredOutputOptions<T>
): AsyncIterable<{
  partial: Partial<z.infer<T>> | null;
  chunk: StreamChunk;
  complete: boolean;
}> {
  const { adapter, messages, schema, temperature = 0, signal, systemPrompt } = options;

  const schemaDescription = buildSchemaDescription(schema, options.name ?? 'output');
  const systemMessage: Message = {
    role: 'system',
    content: systemPrompt ?? buildStructuredSystemPrompt(schemaDescription),
  };

  const fullMessages: Message[] = [systemMessage, ...messages.filter((m) => m.role !== 'system')];

  let content = '';

  for await (const chunk of chat({
    adapter,
    messages: fullMessages,
    temperature,
    signal,
  })) {
    if (chunk.type === 'content' && chunk.delta) {
      content += chunk.delta;
    }

    // Try to parse partial JSON
    const partial = tryParsePartial(content, schema);

    yield {
      partial,
      chunk,
      complete: chunk.type === 'finish',
    };
  }
}

/**
 * Error thrown when structured output parsing fails
 */
export class StructuredOutputError extends Error {
  readonly rawContent: string;
  readonly zodError?: ZodError;

  constructor(message: string, rawContent: string, zodError?: ZodError) {
    super(message);
    this.name = 'StructuredOutputError';
    this.rawContent = rawContent;
    this.zodError = zodError;
  }
}

/**
 * Build a description of the schema for the LLM
 */
function buildSchemaDescription(schema: ZodSchema, name: string, description?: string): string {
  const zodDescription = getZodDescription(schema);

  const parts: string[] = [];

  if (description) {
    parts.push(description);
  }

  if (zodDescription) {
    parts.push(zodDescription);
  }

  // Get a simple representation of the schema structure
  const structure = getSchemaStructure(schema);
  parts.push(`Expected JSON structure:\n${structure}`);

  return parts.join('\n\n');
}

/**
 * Build system prompt for structured output
 */
function buildStructuredSystemPrompt(schemaDescription: string): string {
  return `You are a helpful assistant that responds in valid JSON format only.

${schemaDescription}

Important rules:
1. Respond ONLY with valid JSON that matches the expected structure
2. Do not include any text before or after the JSON
3. Do not wrap the JSON in markdown code blocks
4. Ensure all required fields are present
5. Use null for optional fields if the value is unknown`;
}

/**
 * Extract JSON from LLM response
 */
function extractJSON(content: string): { json: unknown; warnings: string[] } {
  const warnings: string[] = [];

  // Try direct parse first
  try {
    return { json: JSON.parse(content), warnings };
  } catch {
    // Continue to extraction
  }

  // Try to extract from markdown code block
  const codeBlockMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    warnings.push('Extracted JSON from code block');
    try {
      return { json: JSON.parse(codeBlockMatch[1]!.trim()), warnings };
    } catch {
      // Continue
    }
  }

  // Try to find JSON object or array in content
  const jsonMatch = content.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
  if (jsonMatch) {
    warnings.push('Extracted JSON from content');
    try {
      return { json: JSON.parse(jsonMatch[1]!), warnings };
    } catch {
      // Continue
    }
  }

  return { json: null, warnings };
}

/**
 * Try to parse partial JSON (streaming)
 */
function tryParsePartial<T extends ZodSchema>(
  content: string,
  schema: T
): Partial<z.infer<T>> | null {
  // Try to extract and parse JSON
  const { json } = extractJSON(content);

  if (!json) {
    return null;
  }

  // Try safe parse (allows partial matches)
  const result = schema.safeParse(json);

  if (result.success) {
    return result.data as z.infer<T>;
  }

  // Return the raw JSON even if it doesn't fully match
  return json as Partial<z.infer<T>>;
}

/**
 * Get description from Zod schema
 */
function getZodDescription(schema: ZodSchema): string | undefined {
  // Access internal Zod description if available
  const desc = (schema as unknown as { description?: string }).description;
  return desc;
}

/**
 * Get a simple text representation of schema structure
 */
function getSchemaStructure(schema: ZodSchema): string {
  try {
    // Use Zod's internal structure if available
    const shape = (schema as unknown as { shape?: Record<string, ZodSchema> }).shape;

    if (shape) {
      const fields = Object.entries(shape).map(([key, fieldSchema]) => {
        const isOptional =
          (fieldSchema as unknown as { _def?: { typeName?: string } })._def?.typeName ===
          'ZodOptional';
        const typeStr = getZodTypeName(fieldSchema);
        return `  "${key}"${isOptional ? '?' : ''}: ${typeStr}`;
      });

      return `{\n${fields.join(',\n')}\n}`;
    }

    return '{ ... }';
  } catch {
    return '{ ... }';
  }
}

/**
 * Get type name from Zod schema
 */
function getZodTypeName(schema: ZodSchema): string {
  const def = (schema as unknown as { _def?: { typeName?: string } })._def;

  if (!def?.typeName) {
    return 'unknown';
  }

  switch (def.typeName) {
    case 'ZodString':
      return 'string';
    case 'ZodNumber':
      return 'number';
    case 'ZodBoolean':
      return 'boolean';
    case 'ZodArray':
      return 'array';
    case 'ZodObject':
      return 'object';
    case 'ZodOptional':
      return getZodTypeName((def as { innerType?: ZodSchema }).innerType as ZodSchema);
    case 'ZodNullable':
      return `${getZodTypeName((def as { innerType?: ZodSchema }).innerType as ZodSchema)} | null`;
    default:
      return def.typeName.replace('Zod', '').toLowerCase();
  }
}
