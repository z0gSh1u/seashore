# Research: LLM Configuration Alignment

**Feature**: `004-llm-config-baseurl`
**Status**: Complete

## Unknowns & Clarifications

### 1. What configuration options do `@tanstack/ai` providers expose?

Analysis of the installed `@tanstack/ai-*` packages (v0.1.0) reveals the following supported configuration options in their client factory functions:

- **`@tanstack/ai-openai`**:
  - `apiKey`: string
  - `organization`: string (optional)
  - `baseURL`: string (optional)
  - *Note*: Does NOT support `headers`, `fetch`, or other `OpenAI` SDK options in the factory function.

- **`@tanstack/ai-anthropic`**:
  - `apiKey`: string
  - *Note*: Does NOT support `baseURL` or other options.

- **`@tanstack/ai-gemini`**:
  - `apiKey`: string
  - *Note*: Does NOT support `baseURL` or other options.

### 2. Can we support `headers` or `fetch` in configuration?

**Finding**: No, not at the adapter initialization level.
The `OpenAITextAdapter` (and others) instantiates the SDK client internally using a helper function (`createOpenAIClient`) that strictly filters configuration properties. It does not pass through extra options like `defaultHeaders` or `fetch`.

**Workaround**: Per-request headers can be passed via the `chat()` or `generate()` options (`options.request.headers`), which are passed to the SDK's request method. However, global configuration via `TextAdapterConfig` is not possible without upstream changes to `@tanstack/ai`.

## Decisions

### 1. Configuration Interface Design

We will convert `TextAdapterConfig` from a simple interface to a discriminated union to support provider-specific options while maintaining type safety.

```typescript
export type TextAdapterConfig =
  | OpenAIConfig
  | AnthropicConfig
  | GeminiConfig;

interface BaseConfig {
  model: string;
  apiKey?: string; // Optional, can be loaded from env
}

export interface OpenAIConfig extends BaseConfig {
  provider: 'openai';
  organization?: string;
  baseURL?: string;
}

export interface AnthropicConfig extends BaseConfig {
  provider: 'anthropic';
  // No baseURL supported by upstream yet
}

export interface GeminiConfig extends BaseConfig {
  provider: 'gemini';
  // No baseURL supported by upstream yet
}
```

### 2. Scope Adjustment

- **User Story 1 (Base URL)**: Will be implemented for **OpenAI only**, as other providers do not support it in the current `@tanstack/ai` version.
- **User Story 2 (API Key)**: Will be implemented for **all providers**.
- **User Story 3 (Full Config)**: Will be **descoped/limited**. We cannot support global `headers` or `fetch` in config. We will clarify that these are not supported by the upstream library yet.

## Rationale

- **Alignment**: We strictly follow the `@tanstack/ai` interfaces as requested ("options should be the same as those exposed by @tanstack/ai").
- **Type Safety**: Using a discriminated union prevents passing `baseURL` to providers that don't support it (which would be ignored anyway, but better to catch at compile time).
- **Constraint**: We cannot modify the upstream `@tanstack/ai` packages, so we must work within their exposed API surface.
