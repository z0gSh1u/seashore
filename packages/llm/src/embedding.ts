/**
 * @seashore/llm - Embedding Adapters
 *
 * Embedding vector generation adapters
 */

import type {
  EmbeddingAdapter,
  EmbeddingOptions,
  EmbeddingResult,
  BatchEmbeddingResult,
} from './types';
import { OPENAI_DEFAULT_BASE_URL, GEMINI_DEFAULT_BASE_URL } from './types';

/**
 * Options for configuring embedding adapters
 */
export interface EmbeddingAdapterOptions {
  /**
   * API Key for the provider.
   * If not provided, the adapter will attempt to load it from environment variables.
   */
  readonly apiKey?: string;
  /**
   * Base URL for the API endpoint.
   * Use this for local proxies, enterprise deployments, or compatible third-party APIs.
   */
  readonly baseURL?: string;
}

/**
 * Create an OpenAI embedding adapter
 */
export function openaiEmbed(
  model: string = 'text-embedding-3-small',
  dimensions?: number,
  options?: EmbeddingAdapterOptions
): EmbeddingAdapter {
  return {
    provider: 'openai',
    model,
    dimensions,
    apiKey: options?.apiKey,
    baseURL: options?.baseURL,
  };
}

/**
 * Create a Gemini embedding adapter
 */
export function geminiEmbed(
  model: string = 'text-embedding-004',
  dimensions?: number,
  options?: EmbeddingAdapterOptions
): EmbeddingAdapter {
  return {
    provider: 'gemini',
    model,
    dimensions,
    apiKey: options?.apiKey,
    baseURL: options?.baseURL,
  };
}

/**
 * Generate embedding for a single text input
 */
export async function generateEmbedding(options: EmbeddingOptions): Promise<EmbeddingResult> {
  const { adapter, input } = options;
  const textInput = Array.isArray(input) ? input[0] : input;

  if (typeof textInput !== 'string') {
    throw new Error('Input must be a string for single embedding generation');
  }

  switch (adapter.provider) {
    case 'openai':
      return generateOpenAIEmbedding(adapter, textInput);
    case 'gemini':
      return generateGeminiEmbedding(adapter, textInput);
    default:
      throw new Error(`Unsupported embedding provider: ${adapter.provider}`);
  }
}

/**
 * Generate embeddings for multiple text inputs
 */
export async function generateBatchEmbeddings(
  options: EmbeddingOptions
): Promise<BatchEmbeddingResult> {
  const { adapter, input } = options;
  const texts = Array.isArray(input) ? input : [input];

  switch (adapter.provider) {
    case 'openai':
      return generateOpenAIBatchEmbeddings(adapter, texts);
    case 'gemini':
      return generateGeminiBatchEmbeddings(adapter, texts);
    default:
      throw new Error(`Unsupported embedding provider: ${adapter.provider}`);
  }
}

// OpenAI embedding implementation
async function generateOpenAIEmbedding(
  adapter: EmbeddingAdapter,
  text: string
): Promise<EmbeddingResult> {
  const apiKey = getApiKey(adapter.apiKey, 'OPENAI_API_KEY');

  const body: Record<string, unknown> = {
    model: adapter.model,
    input: text,
  };

  if (adapter.dimensions !== undefined) {
    body['dimensions'] = adapter.dimensions;
  }

  const url = buildOpenAIUrl(adapter.baseURL, '/embeddings');
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI embedding error: ${error}`);
  }

  const data = (await response.json()) as OpenAIEmbeddingResponse;
  const firstEmbedding = data.data[0];
  if (!firstEmbedding) {
    throw new Error('OpenAI embedding error: No embedding data returned');
  }

  return {
    embedding: firstEmbedding.embedding,
    model: data.model,
    usage: {
      promptTokens: data.usage.prompt_tokens,
      completionTokens: 0,
      totalTokens: data.usage.total_tokens,
    },
  };
}

async function generateOpenAIBatchEmbeddings(
  adapter: EmbeddingAdapter,
  texts: readonly string[]
): Promise<BatchEmbeddingResult> {
  const apiKey = getApiKey(adapter.apiKey, 'OPENAI_API_KEY');

  const body: Record<string, unknown> = {
    model: adapter.model,
    input: texts,
  };

  if (adapter.dimensions !== undefined) {
    body['dimensions'] = adapter.dimensions;
  }

  const url = buildOpenAIUrl(adapter.baseURL, '/embeddings');
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI embedding error: ${error}`);
  }

  const data = (await response.json()) as OpenAIEmbeddingResponse;

  // Sort by index to maintain order
  const sortedData = [...data.data].sort((a, b) => a.index - b.index);

  return {
    embeddings: sortedData.map((item) => item.embedding),
    model: data.model,
    usage: {
      promptTokens: data.usage.prompt_tokens,
      completionTokens: 0,
      totalTokens: data.usage.total_tokens,
    },
  };
}

// Gemini embedding implementation
async function generateGeminiEmbedding(
  adapter: EmbeddingAdapter,
  text: string
): Promise<EmbeddingResult> {
  const apiKey = getApiKey(adapter.apiKey, 'GOOGLE_API_KEY');

  const url = buildGeminiUrl(adapter.baseURL, adapter.model, 'embedContent', apiKey);
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: `models/${adapter.model}`,
      content: {
        parts: [{ text }],
      },
      outputDimensionality: adapter.dimensions,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Gemini embedding error: ${error}`);
  }

  const data = (await response.json()) as GeminiEmbeddingResponse;

  return {
    embedding: data.embedding.values,
    model: adapter.model,
  };
}

async function generateGeminiBatchEmbeddings(
  adapter: EmbeddingAdapter,
  texts: readonly string[]
): Promise<BatchEmbeddingResult> {
  const apiKey = getApiKey(adapter.apiKey, 'GOOGLE_API_KEY');

  const requests = texts.map((text) => ({
    model: `models/${adapter.model}`,
    content: {
      parts: [{ text }],
    },
    outputDimensionality: adapter.dimensions,
  }));

  const url = buildGeminiUrl(adapter.baseURL, adapter.model, 'batchEmbedContents', apiKey);
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ requests }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Gemini batch embedding error: ${error}`);
  }

  const data = (await response.json()) as GeminiBatchEmbeddingResponse;

  return {
    embeddings: data.embeddings.map((e) => e.values),
    model: adapter.model,
  };
}

// Helper to get environment variable
function getEnvVar(name: string): string {
  const value = process.env[name];
  if (value === undefined || value === '') {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

/**
 * Get API key with priority: adapter config > environment variable
 */
function getApiKey(adapterApiKey: string | undefined, envVarName: string): string {
  if (adapterApiKey !== undefined && adapterApiKey !== '') {
    return adapterApiKey;
  }
  return getEnvVar(envVarName);
}

/**
 * Build the full API URL for OpenAI endpoints
 */
function buildOpenAIUrl(baseURL: string | undefined, path: string): string {
  const base = baseURL ?? OPENAI_DEFAULT_BASE_URL;
  // Remove trailing slash from base and leading slash from path for clean concatenation
  const cleanBase = base.endsWith('/') ? base.slice(0, -1) : base;
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${cleanBase}${cleanPath}`;
}

/**
 * Build the full API URL for Gemini endpoints
 */
function buildGeminiUrl(
  baseURL: string | undefined,
  model: string,
  action: string,
  apiKey: string
): string {
  const base = baseURL ?? GEMINI_DEFAULT_BASE_URL;
  const cleanBase = base.endsWith('/') ? base.slice(0, -1) : base;
  return `${cleanBase}/models/${model}:${action}?key=${apiKey}`;
}

// Response types
interface OpenAIEmbeddingResponse {
  data: Array<{
    index: number;
    embedding: number[];
  }>;
  model: string;
  usage: {
    prompt_tokens: number;
    total_tokens: number;
  };
}

interface GeminiEmbeddingResponse {
  embedding: {
    values: number[];
  };
}

interface GeminiBatchEmbeddingResponse {
  embeddings: Array<{
    values: number[];
  }>;
}
