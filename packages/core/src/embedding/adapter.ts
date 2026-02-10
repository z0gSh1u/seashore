import type { EmbeddingConfig, EmbeddingAdapter } from './types.js'

const DEFAULT_BASE_URLS: Record<EmbeddingConfig['provider'], string> = {
  openai: 'https://api.openai.com/v1',
  gemini: 'https://generativelanguage.googleapis.com/v1beta',
  anthropic: 'https://api.anthropic.com/v1',
}

export function createEmbeddingAdapter(config: EmbeddingConfig): EmbeddingAdapter {
  const baseURL = config.baseURL ?? DEFAULT_BASE_URLS[config.provider]

  return {
    async embed(input: string | string[]): Promise<number[][]> {
      const inputs = Array.isArray(input) ? input : [input]

      switch (config.provider) {
        case 'openai':
          return embedOpenAI(baseURL, config, inputs)
        case 'gemini':
          return embedGemini(baseURL, config, inputs)
        case 'anthropic':
          return embedAnthropic(baseURL, config, inputs)
        default: {
          const _exhaustive: never = config.provider
          throw new Error(`Unsupported embedding provider: ${String(_exhaustive)}`)
        }
      }
    },
  }
}

async function embedOpenAI(
  baseURL: string,
  config: EmbeddingConfig,
  inputs: string[],
): Promise<number[][]> {
  const body: Record<string, unknown> = {
    model: config.model,
    input: inputs,
  }
  if (config.dimensions !== undefined) {
    body.dimensions = config.dimensions
  }

  const response = await fetch(`${baseURL}/embeddings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`OpenAI Embedding API error (${response.status}): ${text}`)
  }

  const data = (await response.json()) as {
    data: Array<{ embedding: number[] }>
  }
  return data.data.map((d) => d.embedding)
}

async function embedGemini(
  baseURL: string,
  config: EmbeddingConfig,
  inputs: string[],
): Promise<number[][]> {
  const requests = inputs.map((text) => ({
    model: `models/${config.model}`,
    content: { parts: [{ text }] },
  }))

  const response = await fetch(
    `${baseURL}/models/${config.model}:batchEmbedContents?key=${config.apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requests }),
    },
  )

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Gemini Embedding API error (${response.status}): ${text}`)
  }

  const data = (await response.json()) as {
    embeddings: Array<{ values: number[] }>
  }
  return data.embeddings.map((e) => e.values)
}

async function embedAnthropic(
  _baseURL: string,
  _config: EmbeddingConfig,
  _inputs: string[],
): Promise<number[][]> {
  // Anthropic does not currently have a public embedding API.
  // This is a placeholder for future support.
  throw new Error(
    'Anthropic does not currently offer an embedding API. ' +
    'Use OpenAI or Gemini for embeddings.',
  )
}
