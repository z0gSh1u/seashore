export type EmbeddingProvider = 'openai';

export interface EmbeddingConfig {
  provider: EmbeddingProvider;
  apiKey: string;
  baseURL?: string;
  dimensions?: number;
}

export interface EmbeddingAdapter {
  embed(input: string | string[]): Promise<number[][]>;
}
