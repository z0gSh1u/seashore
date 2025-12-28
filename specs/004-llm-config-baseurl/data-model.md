# Data Model: LLM Configuration

**Feature**: `004-llm-config-baseurl`

## Types

### TextAdapterConfig

The configuration object for initializing LLM adapters. Refactored to a discriminated union to support provider-specific options.

```typescript
/**
 * Base configuration shared by all providers
 */
interface BaseAdapterConfig {
  /**
   * The model ID to use (e.g., 'gpt-4', 'claude-3-opus')
   */
  readonly model: string;

  /**
   * API Key for the provider.
   * If not provided, the adapter will attempt to load it from environment variables.
   */
  readonly apiKey?: string;
}

/**
 * Configuration for OpenAI provider
 */
export interface OpenAIAdapterConfig extends BaseAdapterConfig {
  readonly provider: 'openai';

  /**
   * Organization ID (optional)
   */
  readonly organization?: string;

  /**
   * Base URL for the API (e.g., for local proxies or compatible endpoints)
   */
  readonly baseURL?: string;
}

/**
 * Configuration for Anthropic provider
 */
export interface AnthropicAdapterConfig extends BaseAdapterConfig {
  readonly provider: 'anthropic';
}

/**
 * Configuration for Gemini provider
 */
export interface GeminiAdapterConfig extends BaseAdapterConfig {
  readonly provider: 'gemini';
}

/**
 * Union of all supported adapter configurations
 */
export type TextAdapterConfig =
  | OpenAIAdapterConfig
  | AnthropicAdapterConfig
  | GeminiAdapterConfig;
```

## Validation

- **Runtime Validation**: The `llm` package currently relies on TypeScript types. The underlying `@tanstack/ai` adapters perform runtime validation (e.g., checking for API keys).
- **Environment Variables**:
  - `OPENAI_API_KEY`
  - `ANTHROPIC_API_KEY`
  - `GOOGLE_API_KEY` / `GEMINI_API_KEY`
