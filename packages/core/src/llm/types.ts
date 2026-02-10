export type LLMProvider = 'openai' | 'anthropic' | 'gemini'

export interface LLMAdapterConfig {
  provider: LLMProvider
  apiKey: string
  baseURL?: string
}

/**
 * An LLM adapter factory returned by createLLMAdapter.
 * Call it with a model name to get a @tanstack/ai compatible adapter.
 *
 * Example: const adapter = createLLMAdapter({ provider: 'openai', apiKey: '...' })
 *          const chatAdapter = adapter('gpt-4o')
 */
export type LLMAdapterFactory = (model: string) => unknown
