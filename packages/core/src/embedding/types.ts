export type EmbeddingProvider = 'openai' | 'gemini' | 'anthropic'

export interface EmbeddingConfig {
  provider: EmbeddingProvider
  model: string
  apiKey: string
  baseURL?: string
  dimensions?: number
}

export interface EmbeddingAdapter {
  embed(input: string | string[]): Promise<number[][]>
}
