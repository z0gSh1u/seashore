import type { EmbeddingConfig, EmbeddingAdapter } from './types.js';

const DEFAULT_BASE_URLS: Record<EmbeddingConfig['provider'], string> = {
  openai: 'https://api.openai.com/v1',
};

/**
 * Creates an embedding adapter based on the provided configuration.
 */
export function createEmbeddingAdapter(model: string, config: EmbeddingConfig): EmbeddingAdapter {
  const baseURL = config.baseURL ?? DEFAULT_BASE_URLS[config.provider];

  return {
    async embed(input: string | string[]): Promise<number[][]> {
      const inputs = Array.isArray(input) ? input : [input];

      switch (config.provider) {
        case 'openai':
          return embedOpenAI(model, baseURL, config, inputs);
        default: {
          throw new Error(`Unsupported embedding provider: ${String(config.provider)}`);
        }
      }
    },
  };
}

/**
 * Requests embeddings from OpenAI's API for the given inputs and configuration.
 */
async function embedOpenAI(
  model: string,
  baseURL: string,
  config: EmbeddingConfig,
  inputs: string[],
): Promise<number[][]> {
  const body: Record<string, unknown> = {
    model,
    input: inputs,
  };
  if (config.dimensions !== undefined) {
    body.dimensions = config.dimensions;
  }

  const response = await fetch(`${baseURL}/embeddings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OpenAI Embedding API error (${response.status}): ${text}`);
  }

  const data = (await response.json()) as {
    data: Array<{ embedding: number[] }>;
  };
  return data.data.map((d) => d.embedding);
}
