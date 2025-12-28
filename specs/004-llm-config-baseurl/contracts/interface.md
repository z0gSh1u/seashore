# Public API Interface Changes

**Feature**: `004-llm-config-baseurl`

## `packages/llm`

### `TextAdapterConfig`

**Before**:
```typescript
export interface TextAdapterConfig {
  readonly provider: 'openai' | 'anthropic' | 'gemini';
  readonly model: string;
}
```

**After**:
```typescript
export type TextAdapterConfig =
  | OpenAIAdapterConfig
  | AnthropicAdapterConfig
  | GeminiAdapterConfig;

// (See data-model.md for full definitions)
```

### `createTextAdapter(config: TextAdapterConfig)`

The factory function (if it exists, or wherever `TextAdapterConfig` is used) will now accept the expanded configuration object.

- **Behavior Change**:
  - If `provider` is `'openai'`, `baseURL` and `organization` are passed to the adapter.
  - `apiKey` is passed to all adapters if present.
