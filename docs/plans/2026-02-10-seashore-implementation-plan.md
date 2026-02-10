# Seashore Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a TypeScript Agent framework based on @tanstack/ai, covering LLM adapters, Agent orchestration, RAG, MCP, evaluation, and deployment.

**Architecture:** Grouped monorepo with 5 packages (`core`, `agent`, `data`, `platform`, `react`). Core wraps @tanstack/ai adapters. Agent provides ReAct + DAG Workflow engines. Data handles PostgreSQL persistence and pgvector-based RAG. Platform integrates MCP client, guardrails, evaluation, and Hono deployment. React provides hooks for frontend integration.

**Tech Stack:** pnpm, Nx, Rollup (ESM only), Vitest, @tanstack/ai, Drizzle ORM, PostgreSQL + pgvector, Hono, Zod, React 18, @modelcontextprotocol/sdk

---

## Phase 0: Monorepo Scaffold

### Task 1: Initialize pnpm workspace

**Files:**
- Create: `pnpm-workspace.yaml`
- Create: `.npmrc`
- Modify: `package.json` (root)

**Step 1: Create root package.json**

```bash
pnpm init
```

**Step 2: Edit root package.json**

Write `package.json`:

```json
{
  "name": "seashore",
  "private": true,
  "type": "module",
  "engines": {
    "node": ">=20.0.0"
  },
  "packageManager": "pnpm@9.15.4",
  "scripts": {
    "build": "pnpm nx run-many -t build",
    "test": "pnpm nx run-many -t test",
    "lint": "pnpm nx run-many -t lint",
    "typecheck": "pnpm nx run-many -t typecheck"
  }
}
```

**Step 3: Create pnpm-workspace.yaml**

Write `pnpm-workspace.yaml`:

```yaml
packages:
  - "packages/*"
```

**Step 4: Create .npmrc**

Write `.npmrc`:

```
auto-install-peers=true
strict-peer-dependencies=false
```

**Step 5: Commit**

```bash
git add package.json pnpm-workspace.yaml .npmrc
git commit -m "chore: initialize pnpm workspace"
```

---

### Task 2: Configure Nx

**Files:**
- Create: `nx.json`

**Step 1: Install Nx**

```bash
pnpm add -Dw nx @nx/js
```

**Step 2: Create nx.json**

Write `nx.json`:

```json
{
  "$schema": "./node_modules/nx/schemas/nx-schema.json",
  "namedInputs": {
    "default": ["{projectRoot}/**/*", "sharedGlobals"],
    "sharedGlobals": ["tsconfig.base.json"]
  },
  "targetDefaults": {
    "build": {
      "dependsOn": ["^build"],
      "inputs": ["default"],
      "cache": true
    },
    "test": {
      "dependsOn": ["^build"],
      "cache": true
    },
    "typecheck": {
      "dependsOn": ["^build"],
      "cache": true
    }
  }
}
```

**Step 3: Commit**

```bash
git add nx.json package.json pnpm-lock.yaml
git commit -m "chore: configure Nx monorepo"
```

---

### Task 3: Configure TypeScript base

**Files:**
- Create: `tsconfig.base.json`

**Step 1: Install TypeScript**

```bash
pnpm add -Dw typescript @types/node
```

**Step 2: Create tsconfig.base.json**

Write `tsconfig.base.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "bundler",
    "lib": ["ES2022"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": false,
    "paths": {
      "@seashore/core": ["./packages/core/src/index.ts"],
      "@seashore/agent": ["./packages/agent/src/index.ts"],
      "@seashore/data": ["./packages/data/src/index.ts"],
      "@seashore/platform": ["./packages/platform/src/index.ts"],
      "@seashore/react": ["./packages/react/src/index.ts"]
    }
  },
  "exclude": ["node_modules", "dist"]
}
```

**Step 3: Commit**

```bash
git add tsconfig.base.json package.json pnpm-lock.yaml
git commit -m "chore: configure TypeScript base"
```

---

### Task 4: Configure Vitest

**Files:**
- Create: `vitest.workspace.ts`

**Step 1: Install Vitest**

```bash
pnpm add -Dw vitest
```

**Step 2: Create vitest.workspace.ts**

Write `vitest.workspace.ts`:

```typescript
import { defineWorkspace } from 'vitest/config'

export default defineWorkspace([
  'packages/*/vitest.config.ts',
])
```

**Step 3: Commit**

```bash
git add vitest.workspace.ts package.json pnpm-lock.yaml
git commit -m "chore: configure Vitest workspace"
```

---

### Task 5: Configure shared Rollup build

**Files:**
- Create: `tools/rollup.base.mjs`

**Step 1: Install Rollup and plugins**

```bash
pnpm add -Dw rollup @rollup/plugin-typescript @rollup/plugin-node-resolve @rollup/plugin-commonjs rollup-plugin-dts
```

**Step 2: Create tools/rollup.base.mjs**

Write `tools/rollup.base.mjs`:

```javascript
import resolve from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'
import typescript from '@rollup/plugin-typescript'
import dts from 'rollup-plugin-dts'

/**
 * Create a standard Rollup config for a Seashore package.
 * @param {object} opts
 * @param {string} opts.input - Entry file path (default: 'src/index.ts')
 * @param {string[]} opts.external - Additional external dependencies
 * @param {string} opts.tsconfig - Path to tsconfig (default: 'tsconfig.json')
 */
export function createRollupConfig(opts = {}) {
  const input = opts.input ?? 'src/index.ts'
  const external = opts.external ?? []
  const tsconfig = opts.tsconfig ?? 'tsconfig.json'

  return [
    {
      input,
      output: {
        dir: 'dist',
        format: 'es',
        sourcemap: true,
        preserveModules: true,
        preserveModulesRoot: 'src',
      },
      external: [
        /node_modules/,
        /^@tanstack\//,
        /^@seashore\//,
        ...external,
      ],
      plugins: [
        resolve(),
        commonjs(),
        typescript({
          tsconfig,
          declaration: true,
          declarationDir: 'dist',
        }),
      ],
    },
    {
      input,
      output: {
        dir: 'dist',
        format: 'es',
        preserveModules: true,
        preserveModulesRoot: 'src',
      },
      external: [
        /node_modules/,
        /^@tanstack\//,
        /^@seashore\//,
        ...external,
      ],
      plugins: [dts({ tsconfig })],
    },
  ]
}
```

**Step 3: Commit**

```bash
git add tools/ package.json pnpm-lock.yaml
git commit -m "chore: add shared Rollup config"
```

---

### Task 6: Scaffold all 5 packages

**Files:**
- Create: `packages/core/package.json`
- Create: `packages/core/tsconfig.json`
- Create: `packages/core/vitest.config.ts`
- Create: `packages/core/rollup.config.mjs`
- Create: `packages/core/src/index.ts`
- (Repeat for agent, data, platform, react)

**Step 1: Create @seashore/core scaffold**

Write `packages/core/package.json`:

```json
{
  "name": "@seashore/core",
  "version": "0.0.1",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "files": ["dist"],
  "scripts": {
    "build": "rollup -c rollup.config.mjs",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@tanstack/ai": "^0.0.1",
    "@tanstack/ai-openai": "^0.0.1",
    "@tanstack/ai-anthropic": "^0.0.1",
    "@tanstack/ai-gemini": "^0.0.1",
    "zod": "^3.24.0"
  },
  "devDependencies": {
    "typescript": "catalog:",
    "vitest": "catalog:",
    "rollup": "catalog:"
  }
}
```

Note: `^0.0.1` is placeholder — use latest actual versions at time of implementation via `pnpm add`.

Write `packages/core/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist"
  },
  "include": ["src"]
}
```

Write `packages/core/vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
```

Write `packages/core/rollup.config.mjs`:

```javascript
import { createRollupConfig } from '../../tools/rollup.base.mjs'

export default createRollupConfig()
```

Write `packages/core/src/index.ts`:

```typescript
// @seashore/core
export {}
```

**Step 2: Create @seashore/agent scaffold**

Same structure as core, with `package.json`:

```json
{
  "name": "@seashore/agent",
  "version": "0.0.1",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "files": ["dist"],
  "scripts": {
    "build": "rollup -c rollup.config.mjs",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@seashore/core": "workspace:*",
    "@tanstack/ai": "^0.0.1",
    "zod": "^3.24.0"
  }
}
```

**Step 3: Create @seashore/data scaffold**

```json
{
  "name": "@seashore/data",
  "version": "0.0.1",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "files": ["dist"],
  "scripts": {
    "build": "rollup -c rollup.config.mjs",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@seashore/core": "workspace:*",
    "drizzle-orm": "^0.38.0",
    "zod": "^3.24.0"
  },
  "devDependencies": {
    "drizzle-kit": "^0.31.0"
  }
}
```

**Step 4: Create @seashore/platform scaffold**

```json
{
  "name": "@seashore/platform",
  "version": "0.0.1",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "files": ["dist"],
  "scripts": {
    "build": "rollup -c rollup.config.mjs",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@seashore/core": "workspace:*",
    "@seashore/agent": "workspace:*",
    "@seashore/data": "workspace:*",
    "@modelcontextprotocol/sdk": "^1.0.0",
    "hono": "^4.0.0",
    "zod": "^3.24.0"
  }
}
```

**Step 5: Create @seashore/react scaffold**

```json
{
  "name": "@seashore/react",
  "version": "0.0.1",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "files": ["dist"],
  "scripts": {
    "build": "rollup -c rollup.config.mjs",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@seashore/core": "workspace:*",
    "@seashore/agent": "workspace:*"
  },
  "peerDependencies": {
    "react": "^18.0.0"
  }
}
```

Each package also gets identical `tsconfig.json`, `vitest.config.ts`, `rollup.config.mjs`, and empty `src/index.ts`.

**Step 6: Install all deps and verify**

```bash
pnpm install
pnpm nx run-many -t typecheck
```

Expected: All 5 packages pass type check.

**Step 7: Commit**

```bash
git add packages/
git commit -m "chore: scaffold all 5 packages"
```

---

### Task 7: Configure .gitignore and EditorConfig

**Files:**
- Modify: `.gitignore`
- Create: `.editorconfig`

**Step 1: Write .gitignore**

Write `.gitignore`:

```
node_modules/
dist/
*.tsbuildinfo
.nx/
.env
.env.*
.DS_Store
```

**Step 2: Write .editorconfig**

Write `.editorconfig`:

```ini
root = true

[*]
indent_style = space
indent_size = 2
end_of_line = lf
charset = utf-8
trim_trailing_whitespace = true
insert_final_newline = true
```

**Step 3: Commit**

```bash
git add .gitignore .editorconfig
git commit -m "chore: add gitignore and editorconfig"
```

---

## Phase 1: @seashore/core

### Task 8: LLM adapter — types and factory

**Files:**
- Create: `packages/core/src/llm/types.ts`
- Create: `packages/core/src/llm/adapter.ts`
- Create: `packages/core/src/llm/adapter.test.ts`
- Create: `packages/core/src/llm/index.ts`

**Step 1: Write the failing test**

Write `packages/core/src/llm/adapter.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { createLLMAdapter } from './adapter.js'

describe('createLLMAdapter', () => {
  it('should create an OpenAI adapter', () => {
    const adapter = createLLMAdapter({
      provider: 'openai',
      apiKey: 'test-key',
    })
    expect(adapter).toBeDefined()
    expect(typeof adapter).toBe('function')
  })

  it('should create an Anthropic adapter', () => {
    const adapter = createLLMAdapter({
      provider: 'anthropic',
      apiKey: 'test-key',
    })
    expect(adapter).toBeDefined()
    expect(typeof adapter).toBe('function')
  })

  it('should create a Gemini adapter', () => {
    const adapter = createLLMAdapter({
      provider: 'gemini',
      apiKey: 'test-key',
    })
    expect(adapter).toBeDefined()
    expect(typeof adapter).toBe('function')
  })

  it('should throw on invalid provider', () => {
    expect(() =>
      createLLMAdapter({
        provider: 'invalid' as never,
        apiKey: 'test-key',
      })
    ).toThrow('Unsupported provider')
  })

  it('should accept custom baseURL', () => {
    const adapter = createLLMAdapter({
      provider: 'openai',
      apiKey: 'test-key',
      baseURL: 'https://custom.api.com/v1',
    })
    expect(adapter).toBeDefined()
  })
})
```

**Step 2: Run test to verify it fails**

```bash
pnpm --filter @seashore/core test -- --run src/llm/adapter.test.ts
```

Expected: FAIL — module `./adapter.js` not found.

**Step 3: Write types**

Write `packages/core/src/llm/types.ts`:

```typescript
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
```

**Step 4: Write implementation**

Write `packages/core/src/llm/adapter.ts`:

```typescript
import { createOpenaiChat } from '@tanstack/ai-openai'
import { createAnthropicChat } from '@tanstack/ai-anthropic'
import { createGeminiChat } from '@tanstack/ai-gemini'
import type { LLMAdapterConfig, LLMAdapterFactory } from './types.js'

export function createLLMAdapter(config: LLMAdapterConfig): LLMAdapterFactory {
  switch (config.provider) {
    case 'openai':
      return createOpenaiChat(config.apiKey, {
        baseURL: config.baseURL,
      })
    case 'anthropic':
      return createAnthropicChat(config.apiKey, {
        baseURL: config.baseURL,
      })
    case 'gemini':
      return createGeminiChat(config.apiKey, {
        baseURL: config.baseURL,
      })
    default: {
      const _exhaustive: never = config.provider
      throw new Error(`Unsupported provider: ${String(_exhaustive)}`)
    }
  }
}
```

**Step 5: Write barrel export**

Write `packages/core/src/llm/index.ts`:

```typescript
export { createLLMAdapter } from './adapter.js'
export type { LLMAdapterConfig, LLMAdapterFactory, LLMProvider } from './types.js'
```

**Step 6: Run test to verify it passes**

```bash
pnpm --filter @seashore/core test -- --run src/llm/adapter.test.ts
```

Expected: PASS

**Step 7: Commit**

```bash
git add packages/core/src/llm/
git commit -m "feat(core): add LLM adapter factory"
```

---

### Task 9: Embedding adapter

**Files:**
- Create: `packages/core/src/embedding/types.ts`
- Create: `packages/core/src/embedding/adapter.ts`
- Create: `packages/core/src/embedding/adapter.test.ts`
- Create: `packages/core/src/embedding/index.ts`

**Step 1: Write the failing test**

Write `packages/core/src/embedding/adapter.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createEmbeddingAdapter } from './adapter.js'

// Mock global fetch
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

describe('createEmbeddingAdapter', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should create an OpenAI embedding adapter', () => {
    const adapter = createEmbeddingAdapter({
      provider: 'openai',
      model: 'text-embedding-3-small',
      apiKey: 'test-key',
    })
    expect(adapter).toBeDefined()
    expect(typeof adapter.embed).toBe('function')
  })

  it('should call OpenAI embeddings API with correct payload', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [{ embedding: [0.1, 0.2, 0.3] }],
      }),
    })

    const adapter = createEmbeddingAdapter({
      provider: 'openai',
      model: 'text-embedding-3-small',
      apiKey: 'test-key',
    })

    const result = await adapter.embed('hello world')
    expect(result).toEqual([[0.1, 0.2, 0.3]])
    expect(mockFetch).toHaveBeenCalledOnce()

    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://api.openai.com/v1/embeddings')
    expect(init.method).toBe('POST')

    const body = JSON.parse(init.body as string)
    expect(body.model).toBe('text-embedding-3-small')
    expect(body.input).toEqual(['hello world'])
  })

  it('should handle batch input', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [
          { embedding: [0.1, 0.2] },
          { embedding: [0.3, 0.4] },
        ],
      }),
    })

    const adapter = createEmbeddingAdapter({
      provider: 'openai',
      model: 'text-embedding-3-small',
      apiKey: 'test-key',
    })

    const result = await adapter.embed(['hello', 'world'])
    expect(result).toEqual([[0.1, 0.2], [0.3, 0.4]])
  })

  it('should support custom baseURL', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [{ embedding: [0.1] }] }),
    })

    const adapter = createEmbeddingAdapter({
      provider: 'openai',
      model: 'text-embedding-3-small',
      apiKey: 'test-key',
      baseURL: 'https://custom.api.com/v1',
    })

    await adapter.embed('test')
    const [url] = mockFetch.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://custom.api.com/v1/embeddings')
  })

  it('should support dimensions option', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [{ embedding: [0.1] }] }),
    })

    const adapter = createEmbeddingAdapter({
      provider: 'openai',
      model: 'text-embedding-3-small',
      apiKey: 'test-key',
      dimensions: 256,
    })

    await adapter.embed('test')
    const body = JSON.parse((mockFetch.mock.calls[0] as [string, RequestInit])[1].body as string)
    expect(body.dimensions).toBe(256)
  })

  it('should throw on API error', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      text: async () => 'Invalid API key',
    })

    const adapter = createEmbeddingAdapter({
      provider: 'openai',
      model: 'text-embedding-3-small',
      apiKey: 'bad-key',
    })

    await expect(adapter.embed('test')).rejects.toThrow()
  })
})
```

**Step 2: Run test to verify it fails**

```bash
pnpm --filter @seashore/core test -- --run src/embedding/adapter.test.ts
```

Expected: FAIL

**Step 3: Write types**

Write `packages/core/src/embedding/types.ts`:

```typescript
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
```

**Step 4: Write implementation**

Write `packages/core/src/embedding/adapter.ts`:

```typescript
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
```

**Step 5: Write barrel export**

Write `packages/core/src/embedding/index.ts`:

```typescript
export { createEmbeddingAdapter } from './adapter.js'
export type { EmbeddingConfig, EmbeddingAdapter, EmbeddingProvider } from './types.js'
```

**Step 6: Run test to verify it passes**

```bash
pnpm --filter @seashore/core test -- --run src/embedding/adapter.test.ts
```

Expected: PASS

**Step 7: Commit**

```bash
git add packages/core/src/embedding/
git commit -m "feat(core): add embedding adapter with OpenAI and Gemini support"
```

---

### Task 10: Tool definitions and presets

**Files:**
- Create: `packages/core/src/tool/types.ts`
- Create: `packages/core/src/tool/toolkit.ts`
- Create: `packages/core/src/tool/presets/serper.ts`
- Create: `packages/core/src/tool/presets/firecrawl.ts`
- Create: `packages/core/src/tool/toolkit.test.ts`
- Create: `packages/core/src/tool/presets/serper.test.ts`
- Create: `packages/core/src/tool/presets/firecrawl.test.ts`
- Create: `packages/core/src/tool/index.ts`

**Step 1: Write the failing tests**

Write `packages/core/src/tool/toolkit.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { createToolkit } from './toolkit.js'

describe('createToolkit', () => {
  it('should combine tools into a toolkit', () => {
    const tool1 = { name: 'tool1' }
    const tool2 = { name: 'tool2' }
    const toolkit = createToolkit([tool1, tool2] as never[])
    expect(toolkit).toHaveLength(2)
    expect(toolkit[0]).toBe(tool1)
    expect(toolkit[1]).toBe(tool2)
  })

  it('should return empty array for empty input', () => {
    const toolkit = createToolkit([])
    expect(toolkit).toEqual([])
  })
})
```

Write `packages/core/src/tool/presets/serper.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { serperSearchDefinition } from './serper.js'

describe('serperSearchDefinition', () => {
  it('should have correct name', () => {
    expect(serperSearchDefinition.name).toBe('web_search')
  })

  it('should have description', () => {
    expect(serperSearchDefinition.description).toBeDefined()
  })
})
```

Write `packages/core/src/tool/presets/firecrawl.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { firecrawlScrapeDefinition } from './firecrawl.js'

describe('firecrawlScrapeDefinition', () => {
  it('should have correct name', () => {
    expect(firecrawlScrapeDefinition.name).toBe('web_scrape')
  })

  it('should have description', () => {
    expect(firecrawlScrapeDefinition.description).toBeDefined()
  })
})
```

**Step 2: Run tests to verify they fail**

```bash
pnpm --filter @seashore/core test -- --run src/tool/
```

Expected: FAIL

**Step 3: Write implementations**

Write `packages/core/src/tool/types.ts`:

```typescript
// Re-export @tanstack/ai tool types for convenience
export type { ServerTool } from '@tanstack/ai'
```

Write `packages/core/src/tool/toolkit.ts`:

```typescript
import type { ServerTool } from '@tanstack/ai'

export function createToolkit<T extends ServerTool[]>(tools: T): T {
  return tools
}
```

Write `packages/core/src/tool/presets/serper.ts`:

```typescript
import { toolDefinition } from '@tanstack/ai'
import { z } from 'zod'

export const serperSearchDefinition = toolDefinition({
  name: 'web_search',
  description: 'Search the web using Serper API and return relevant results',
  inputSchema: z.object({
    query: z.string().describe('The search query'),
    numResults: z.number().optional().default(10).describe('Number of results to return'),
    type: z
      .enum(['search', 'news', 'images'])
      .optional()
      .default('search')
      .describe('Type of search'),
  }),
  outputSchema: z.object({
    results: z.array(
      z.object({
        title: z.string(),
        link: z.string(),
        snippet: z.string(),
        position: z.number().optional(),
      }),
    ),
  }),
})

export interface SerperConfig {
  apiKey: string
  baseURL?: string
}

export function createSerperSearch(config: SerperConfig) {
  const baseURL = config.baseURL ?? 'https://google.serper.dev'

  return serperSearchDefinition.server(async (input) => {
    const response = await fetch(`${baseURL}/${input.type}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': config.apiKey,
      },
      body: JSON.stringify({
        q: input.query,
        num: input.numResults,
      }),
    })

    if (!response.ok) {
      const text = await response.text()
      throw new Error(`Serper API error (${response.status}): ${text}`)
    }

    const data = (await response.json()) as {
      organic?: Array<{
        title: string
        link: string
        snippet: string
        position: number
      }>
    }

    return {
      results: (data.organic ?? []).map((item) => ({
        title: item.title,
        link: item.link,
        snippet: item.snippet,
        position: item.position,
      })),
    }
  })
}
```

Write `packages/core/src/tool/presets/firecrawl.ts`:

```typescript
import { toolDefinition } from '@tanstack/ai'
import { z } from 'zod'

export const firecrawlScrapeDefinition = toolDefinition({
  name: 'web_scrape',
  description: 'Scrape a web page and return its content as markdown',
  inputSchema: z.object({
    url: z.string().url().describe('The URL to scrape'),
    formats: z
      .array(z.enum(['markdown', 'html', 'rawHtml', 'screenshot']))
      .optional()
      .default(['markdown'])
      .describe('Output formats'),
  }),
  outputSchema: z.object({
    content: z.string(),
    metadata: z.object({
      title: z.string().optional(),
      description: z.string().optional(),
      sourceURL: z.string().optional(),
    }),
  }),
})

export interface FirecrawlConfig {
  apiKey: string
  baseURL?: string
}

export function createFirecrawlScrape(config: FirecrawlConfig) {
  const baseURL = config.baseURL ?? 'https://api.firecrawl.dev/v1'

  return firecrawlScrapeDefinition.server(async (input) => {
    const response = await fetch(`${baseURL}/scrape`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        url: input.url,
        formats: input.formats,
      }),
    })

    if (!response.ok) {
      const text = await response.text()
      throw new Error(`Firecrawl API error (${response.status}): ${text}`)
    }

    const data = (await response.json()) as {
      data: {
        markdown?: string
        html?: string
        metadata?: {
          title?: string
          description?: string
          sourceURL?: string
        }
      }
    }

    return {
      content: data.data.markdown ?? data.data.html ?? '',
      metadata: {
        title: data.data.metadata?.title,
        description: data.data.metadata?.description,
        sourceURL: data.data.metadata?.sourceURL,
      },
    }
  })
}
```

Write `packages/core/src/tool/index.ts`:

```typescript
export { createToolkit } from './toolkit.js'
export {
  serperSearchDefinition,
  createSerperSearch,
  type SerperConfig,
} from './presets/serper.js'
export {
  firecrawlScrapeDefinition,
  createFirecrawlScrape,
  type FirecrawlConfig,
} from './presets/firecrawl.js'
```

**Step 4: Run tests to verify they pass**

```bash
pnpm --filter @seashore/core test -- --run src/tool/
```

Expected: PASS

**Step 5: Commit**

```bash
git add packages/core/src/tool/
git commit -m "feat(core): add tool toolkit and Serper/Firecrawl presets"
```

---

### Task 11: Context Engineering helpers

**Files:**
- Create: `packages/core/src/context/system-prompt.ts`
- Create: `packages/core/src/context/few-shot.ts`
- Create: `packages/core/src/context/system-prompt.test.ts`
- Create: `packages/core/src/context/few-shot.test.ts`
- Create: `packages/core/src/context/index.ts`

**Step 1: Write the failing tests**

Write `packages/core/src/context/system-prompt.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { systemPrompt } from './system-prompt.js'

describe('systemPrompt', () => {
  it('should build a basic system prompt with role', () => {
    const prompt = systemPrompt().role('You are a helpful assistant').build()
    expect(prompt).toContain('You are a helpful assistant')
  })

  it('should include instructions', () => {
    const prompt = systemPrompt()
      .role('Assistant')
      .instruction('Always be concise')
      .instruction('Use bullet points')
      .build()
    expect(prompt).toContain('Always be concise')
    expect(prompt).toContain('Use bullet points')
  })

  it('should include constraints', () => {
    const prompt = systemPrompt()
      .role('Assistant')
      .constraint('Do not make up data')
      .build()
    expect(prompt).toContain('Do not make up data')
  })

  it('should include examples', () => {
    const prompt = systemPrompt()
      .role('Assistant')
      .example({ input: 'Hello', output: 'Hi there!' })
      .build()
    expect(prompt).toContain('Hello')
    expect(prompt).toContain('Hi there!')
  })

  it('should include output format', () => {
    const prompt = systemPrompt()
      .role('Code generator')
      .outputFormat('json')
      .build()
    expect(prompt).toContain('JSON')
  })

  it('should include code output format with language', () => {
    const prompt = systemPrompt()
      .role('Code generator')
      .outputFormat('code', { language: 'typescript' })
      .build()
    expect(prompt).toContain('typescript')
  })

  it('should chain all methods fluently', () => {
    const prompt = systemPrompt()
      .role('Data analyst')
      .instruction('Be precise')
      .constraint('No fabrication')
      .example({ input: 'Q', output: 'A' })
      .outputFormat('json')
      .build()

    expect(typeof prompt).toBe('string')
    expect(prompt.length).toBeGreaterThan(0)
  })
})
```

Write `packages/core/src/context/few-shot.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { fewShotMessages } from './few-shot.js'

describe('fewShotMessages', () => {
  it('should convert examples to message pairs', () => {
    const messages = fewShotMessages([
      { user: 'What is 2+2?', assistant: '4' },
    ])
    expect(messages).toHaveLength(2)
    expect(messages[0]).toEqual({ role: 'user', content: 'What is 2+2?' })
    expect(messages[1]).toEqual({ role: 'assistant', content: '4' })
  })

  it('should handle multiple examples', () => {
    const messages = fewShotMessages([
      { user: 'Q1', assistant: 'A1' },
      { user: 'Q2', assistant: 'A2' },
    ])
    expect(messages).toHaveLength(4)
  })

  it('should return empty array for empty input', () => {
    const messages = fewShotMessages([])
    expect(messages).toEqual([])
  })
})
```

**Step 2: Run tests to verify they fail**

```bash
pnpm --filter @seashore/core test -- --run src/context/
```

Expected: FAIL

**Step 3: Write implementations**

Write `packages/core/src/context/system-prompt.ts`:

```typescript
interface Example {
  input: string
  output: string
}

type OutputFormat = 'json' | 'code' | 'markdown' | 'text'

interface OutputFormatOptions {
  language?: string
}

interface SystemPromptBuilder {
  role(description: string): SystemPromptBuilder
  instruction(text: string): SystemPromptBuilder
  constraint(text: string): SystemPromptBuilder
  example(example: Example): SystemPromptBuilder
  outputFormat(format: OutputFormat, options?: OutputFormatOptions): SystemPromptBuilder
  build(): string
}

export function systemPrompt(): SystemPromptBuilder {
  let roleText = ''
  const instructions: string[] = []
  const constraints: string[] = []
  const examples: Example[] = []
  let outputFormatText = ''

  const builder: SystemPromptBuilder = {
    role(description: string) {
      roleText = description
      return builder
    },

    instruction(text: string) {
      instructions.push(text)
      return builder
    },

    constraint(text: string) {
      constraints.push(text)
      return builder
    },

    example(example: Example) {
      examples.push(example)
      return builder
    },

    outputFormat(format: OutputFormat, options?: OutputFormatOptions) {
      switch (format) {
        case 'json':
          outputFormatText = 'Respond with valid JSON only. Do not include any other text.'
          break
        case 'code':
          outputFormatText = options?.language
            ? `Respond with ONLY a ${options.language} code block. Do not include explanations.`
            : 'Respond with ONLY a code block. Do not include explanations.'
          break
        case 'markdown':
          outputFormatText = 'Respond in Markdown format.'
          break
        case 'text':
          outputFormatText = 'Respond in plain text without any formatting.'
          break
      }
      return builder
    },

    build(): string {
      const sections: string[] = []

      if (roleText) {
        sections.push(roleText)
      }

      if (instructions.length > 0) {
        sections.push(
          '## Instructions\n' +
          instructions.map((i) => `- ${i}`).join('\n'),
        )
      }

      if (constraints.length > 0) {
        sections.push(
          '## Constraints\n' +
          constraints.map((c) => `- ${c}`).join('\n'),
        )
      }

      if (examples.length > 0) {
        sections.push(
          '## Examples\n' +
          examples
            .map(
              (e, idx) =>
                `### Example ${idx + 1}\n**Input:** ${e.input}\n**Output:** ${e.output}`,
            )
            .join('\n\n'),
        )
      }

      if (outputFormatText) {
        sections.push(`## Output Format\n${outputFormatText}`)
      }

      return sections.join('\n\n')
    },
  }

  return builder
}
```

Write `packages/core/src/context/few-shot.ts`:

```typescript
interface FewShotExample {
  user: string
  assistant: string
}

interface Message {
  role: 'user' | 'assistant'
  content: string
}

export function fewShotMessages(examples: FewShotExample[]): Message[] {
  return examples.flatMap((example) => [
    { role: 'user' as const, content: example.user },
    { role: 'assistant' as const, content: example.assistant },
  ])
}
```

Write `packages/core/src/context/index.ts`:

```typescript
export { systemPrompt } from './system-prompt.js'
export { fewShotMessages } from './few-shot.js'
```

**Step 4: Run tests to verify they pass**

```bash
pnpm --filter @seashore/core test -- --run src/context/
```

Expected: PASS

**Step 5: Commit**

```bash
git add packages/core/src/context/
git commit -m "feat(core): add context engineering helpers"
```

---

### Task 12: Core barrel export + full test pass

**Files:**
- Modify: `packages/core/src/index.ts`

**Step 1: Write the barrel export**

Write `packages/core/src/index.ts`:

```typescript
// LLM
export { createLLMAdapter } from './llm/index.js'
export type { LLMAdapterConfig, LLMAdapterFactory, LLMProvider } from './llm/index.js'

// Embedding
export { createEmbeddingAdapter } from './embedding/index.js'
export type { EmbeddingConfig, EmbeddingAdapter, EmbeddingProvider } from './embedding/index.js'

// Tool
export { createToolkit, createSerperSearch, createFirecrawlScrape } from './tool/index.js'
export { serperSearchDefinition, firecrawlScrapeDefinition } from './tool/index.js'
export type { SerperConfig, FirecrawlConfig } from './tool/index.js'

// Context Engineering
export { systemPrompt, fewShotMessages } from './context/index.js'
```

**Step 2: Run full core test suite**

```bash
pnpm --filter @seashore/core test
```

Expected: All tests PASS.

**Step 3: Type check**

```bash
pnpm --filter @seashore/core typecheck
```

Expected: No errors.

**Step 4: Commit**

```bash
git add packages/core/src/index.ts
git commit -m "feat(core): complete @seashore/core with barrel export"
```

---

## Phase 2: @seashore/agent

### Task 13: Workflow engine — Step and DAG types

**Files:**
- Create: `packages/agent/src/workflow/types.ts`
- Create: `packages/agent/src/workflow/dag.ts`
- Create: `packages/agent/src/workflow/dag.test.ts`

**Step 1: Write the failing test**

Write `packages/agent/src/workflow/dag.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { DAG } from './dag.js'

describe('DAG', () => {
  it('should add nodes', () => {
    const dag = new DAG()
    dag.addNode('a')
    dag.addNode('b')
    expect(dag.nodeCount).toBe(2)
  })

  it('should add edges', () => {
    const dag = new DAG()
    dag.addNode('a')
    dag.addNode('b')
    dag.addEdge('a', 'b')
    expect(dag.getDependencies('b')).toEqual(['a'])
  })

  it('should detect circular dependencies', () => {
    const dag = new DAG()
    dag.addNode('a')
    dag.addNode('b')
    dag.addEdge('a', 'b')
    dag.addEdge('b', 'a')
    expect(() => dag.topologicalSort()).toThrow('Circular dependency')
  })

  it('should return correct topological order', () => {
    const dag = new DAG()
    dag.addNode('a')
    dag.addNode('b')
    dag.addNode('c')
    dag.addEdge('a', 'b')
    dag.addEdge('a', 'c')
    dag.addEdge('b', 'c')

    const order = dag.topologicalSort()
    expect(order.indexOf('a')).toBeLessThan(order.indexOf('b'))
    expect(order.indexOf('b')).toBeLessThan(order.indexOf('c'))
  })

  it('should return nodes with no dependencies as roots', () => {
    const dag = new DAG()
    dag.addNode('a')
    dag.addNode('b')
    dag.addNode('c')
    dag.addEdge('a', 'c')
    dag.addEdge('b', 'c')

    const roots = dag.getRoots()
    expect(roots).toContain('a')
    expect(roots).toContain('b')
    expect(roots).not.toContain('c')
  })

  it('should return ready nodes (dependencies all met)', () => {
    const dag = new DAG()
    dag.addNode('a')
    dag.addNode('b')
    dag.addNode('c')
    dag.addEdge('a', 'b')
    dag.addEdge('a', 'c')

    const ready = dag.getReady(new Set(['a']))
    expect(ready).toContain('b')
    expect(ready).toContain('c')
  })
})
```

**Step 2: Run test to verify it fails**

```bash
pnpm --filter @seashore/agent test -- --run src/workflow/dag.test.ts
```

**Step 3: Write types**

Write `packages/agent/src/workflow/types.ts`:

```typescript
import type { z } from 'zod'

export interface RetryPolicy {
  maxRetries: number
  delayMs?: number
  backoffMultiplier?: number
}

export interface WorkflowContext {
  /** Shared state between steps */
  state: Map<string, unknown>
  /** Abort signal for cancellation */
  abortSignal: AbortSignal
}

export interface StepConfig<TInput = unknown, TOutput = unknown> {
  name: string
  execute: (input: TInput, ctx: WorkflowContext) => Promise<TOutput>
  outputSchema?: z.ZodSchema<TOutput>
  retryPolicy?: RetryPolicy
}

export interface StepEdgeConfig {
  after?: string | string[]
  when?: (ctx: WorkflowContext) => boolean | Promise<boolean>
  type?: 'normal' | 'human'
  prompt?: (ctx: WorkflowContext) => string
  timeout?: number
}

export type WorkflowStatus = 'idle' | 'running' | 'pending' | 'completed' | 'failed'

export interface WorkflowResult {
  status: WorkflowStatus
  state: Map<string, unknown>
  error?: Error
}

export interface PendingWorkflow {
  workflowId: string
  stepName: string
  prompt: string
  metadata: Record<string, unknown>
}

export interface HumanInputRequest {
  id: string
  type: 'approval' | 'input' | 'selection'
  prompt: string
  options?: string[]
  metadata: Record<string, unknown>
}

export interface HumanInputResponse {
  requestId: string
  approved?: boolean
  value?: string
  selectedOption?: string
}
```

**Step 4: Write DAG implementation**

Write `packages/agent/src/workflow/dag.ts`:

```typescript
export class DAG {
  private nodes = new Set<string>()
  private edges = new Map<string, Set<string>>() // node -> set of dependencies

  get nodeCount(): number {
    return this.nodes.size
  }

  addNode(id: string): void {
    this.nodes.add(id)
    if (!this.edges.has(id)) {
      this.edges.set(id, new Set())
    }
  }

  addEdge(from: string, to: string): void {
    if (!this.nodes.has(from) || !this.nodes.has(to)) {
      throw new Error(`Both nodes must exist: ${from} -> ${to}`)
    }
    this.edges.get(to)!.add(from)
  }

  getDependencies(id: string): string[] {
    return Array.from(this.edges.get(id) ?? [])
  }

  getRoots(): string[] {
    return Array.from(this.nodes).filter(
      (n) => (this.edges.get(n)?.size ?? 0) === 0,
    )
  }

  getReady(completed: Set<string>): string[] {
    return Array.from(this.nodes).filter((n) => {
      if (completed.has(n)) return false
      const deps = this.edges.get(n)
      if (!deps || deps.size === 0) return !completed.has(n)
      return Array.from(deps).every((d) => completed.has(d))
    })
  }

  topologicalSort(): string[] {
    const visited = new Set<string>()
    const visiting = new Set<string>()
    const result: string[] = []

    const visit = (node: string) => {
      if (visiting.has(node)) {
        throw new Error(`Circular dependency detected involving: ${node}`)
      }
      if (visited.has(node)) return

      visiting.add(node)
      for (const dep of this.edges.get(node) ?? []) {
        visit(dep)
      }
      visiting.delete(node)
      visited.add(node)
      result.push(node)
    }

    for (const node of this.nodes) {
      visit(node)
    }

    return result
  }
}
```

**Step 5: Run tests to verify they pass**

```bash
pnpm --filter @seashore/agent test -- --run src/workflow/dag.test.ts
```

Expected: PASS

**Step 6: Commit**

```bash
git add packages/agent/src/workflow/
git commit -m "feat(agent): add DAG data structure with topological sort"
```

---

### Task 14: Workflow builder and executor

**Files:**
- Create: `packages/agent/src/workflow/builder.ts`
- Create: `packages/agent/src/workflow/executor.ts`
- Create: `packages/agent/src/workflow/executor.test.ts`
- Create: `packages/agent/src/workflow/index.ts`

**Step 1: Write the failing test**

Write `packages/agent/src/workflow/executor.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { createWorkflow } from './builder.js'
import { createStep } from './builder.js'

describe('Workflow Executor', () => {
  it('should execute a single step', async () => {
    const step = createStep({
      name: 'greet',
      execute: async () => 'hello',
    })

    const workflow = createWorkflow({ name: 'test' }).step(step)
    const result = await workflow.execute()
    expect(result.status).toBe('completed')
    expect(result.state.get('greet')).toBe('hello')
  })

  it('should execute steps in dependency order', async () => {
    const order: string[] = []

    const stepA = createStep({
      name: 'a',
      execute: async () => { order.push('a'); return 1 },
    })
    const stepB = createStep({
      name: 'b',
      execute: async () => { order.push('b'); return 2 },
    })

    const workflow = createWorkflow({ name: 'test' })
      .step(stepA)
      .step(stepB, { after: 'a' })

    await workflow.execute()
    expect(order).toEqual(['a', 'b'])
  })

  it('should execute independent steps in parallel', async () => {
    const timestamps: Record<string, number> = {}

    const stepA = createStep({
      name: 'a',
      execute: async () => {
        timestamps.aStart = Date.now()
        await new Promise((r) => setTimeout(r, 50))
        timestamps.aEnd = Date.now()
        return 1
      },
    })
    const stepB = createStep({
      name: 'b',
      execute: async () => {
        timestamps.bStart = Date.now()
        await new Promise((r) => setTimeout(r, 50))
        timestamps.bEnd = Date.now()
        return 2
      },
    })

    const workflow = createWorkflow({ name: 'test' })
      .step(stepA)
      .step(stepB)

    await workflow.execute()

    // Both should start at roughly the same time if parallel
    const startDiff = Math.abs((timestamps.aStart ?? 0) - (timestamps.bStart ?? 0))
    expect(startDiff).toBeLessThan(30)
  })

  it('should support conditional steps', async () => {
    const stepA = createStep({
      name: 'a',
      execute: async () => 'high',
    })
    const stepB = createStep({
      name: 'b',
      execute: async () => 'ran-b',
    })
    const stepC = createStep({
      name: 'c',
      execute: async () => 'ran-c',
    })

    const workflow = createWorkflow({ name: 'test' })
      .step(stepA)
      .step(stepB, {
        after: 'a',
        when: (ctx) => ctx.state.get('a') === 'high',
      })
      .step(stepC, {
        after: 'a',
        when: (ctx) => ctx.state.get('a') === 'low',
      })

    const result = await workflow.execute()
    expect(result.state.get('b')).toBe('ran-b')
    expect(result.state.has('c')).toBe(false)
  })

  it('should propagate errors and mark as failed', async () => {
    const stepA = createStep({
      name: 'a',
      execute: async () => { throw new Error('boom') },
    })

    const workflow = createWorkflow({ name: 'test' }).step(stepA)
    const result = await workflow.execute()
    expect(result.status).toBe('failed')
    expect(result.error?.message).toBe('boom')
  })

  it('should support abort via AbortController', async () => {
    const controller = new AbortController()

    const stepA = createStep({
      name: 'a',
      execute: async (_input, ctx) => {
        await new Promise((resolve, reject) => {
          const timer = setTimeout(resolve, 5000)
          ctx.abortSignal.addEventListener('abort', () => {
            clearTimeout(timer)
            reject(new Error('Aborted'))
          })
        })
      },
    })

    const workflow = createWorkflow({ name: 'test' }).step(stepA)
    const promise = workflow.execute({ abortSignal: controller.signal })

    setTimeout(() => controller.abort(), 10)

    const result = await promise
    expect(result.status).toBe('failed')
  })
})
```

**Step 2: Run test to verify it fails**

```bash
pnpm --filter @seashore/agent test -- --run src/workflow/executor.test.ts
```

**Step 3: Write builder**

Write `packages/agent/src/workflow/builder.ts`:

```typescript
import { DAG } from './dag.js'
import type {
  StepConfig,
  StepEdgeConfig,
  WorkflowContext,
  WorkflowResult,
  WorkflowStatus,
} from './types.js'

export function createStep<TInput = unknown, TOutput = unknown>(
  config: StepConfig<TInput, TOutput>,
): StepConfig<TInput, TOutput> {
  return config
}

interface StepEntry {
  config: StepConfig
  edge: StepEdgeConfig
}

interface WorkflowConfig {
  name: string
}

interface ExecuteOptions {
  initialState?: Map<string, unknown>
  abortSignal?: AbortSignal
}

interface Workflow {
  name: string
  step(config: StepConfig, edge?: StepEdgeConfig): Workflow
  execute(options?: ExecuteOptions): Promise<WorkflowResult>
}

export function createWorkflow(config: WorkflowConfig): Workflow {
  const steps = new Map<string, StepEntry>()
  const dag = new DAG()

  const workflow: Workflow = {
    name: config.name,

    step(stepConfig: StepConfig, edge: StepEdgeConfig = {}): Workflow {
      dag.addNode(stepConfig.name)
      steps.set(stepConfig.name, { config: stepConfig, edge })

      const after = edge.after
      if (after) {
        const deps = Array.isArray(after) ? after : [after]
        for (const dep of deps) {
          dag.addEdge(dep, stepConfig.name)
        }
      }

      return workflow
    },

    async execute(options: ExecuteOptions = {}): Promise<WorkflowResult> {
      const abortController = new AbortController()
      if (options.abortSignal) {
        options.abortSignal.addEventListener('abort', () => abortController.abort())
      }

      const ctx: WorkflowContext = {
        state: options.initialState ?? new Map(),
        abortSignal: abortController.signal,
      }

      // Validate DAG (will throw on circular deps)
      try {
        dag.topologicalSort()
      } catch (err) {
        return {
          status: 'failed',
          state: ctx.state,
          error: err instanceof Error ? err : new Error(String(err)),
        }
      }

      const completed = new Set<string>()
      const skipped = new Set<string>()

      try {
        while (completed.size + skipped.size < steps.size) {
          if (abortController.signal.aborted) {
            throw new Error('Aborted')
          }

          const ready = dag.getReady(new Set([...completed, ...skipped]))
            .filter((n) => !skipped.has(n))

          if (ready.length === 0) break

          // Evaluate conditions and filter
          const toRun: string[] = []
          for (const name of ready) {
            const entry = steps.get(name)
            if (!entry) continue

            if (entry.edge.when) {
              const shouldRun = await entry.edge.when(ctx)
              if (!shouldRun) {
                skipped.add(name)
                continue
              }
            }

            toRun.push(name)
          }

          if (toRun.length === 0 && ready.length > 0) continue

          // Execute ready steps in parallel
          await Promise.all(
            toRun.map(async (name) => {
              const entry = steps.get(name)
              if (!entry) return

              const input = ctx.state.get(name) ?? undefined
              const output = await entry.config.execute(input, ctx)
              ctx.state.set(name, output)
              completed.add(name)
            }),
          )
        }

        return { status: 'completed', state: ctx.state }
      } catch (err) {
        return {
          status: 'failed',
          state: ctx.state,
          error: err instanceof Error ? err : new Error(String(err)),
        }
      }
    },
  }

  return workflow
}
```

Write `packages/agent/src/workflow/index.ts`:

```typescript
export { createWorkflow, createStep } from './builder.js'
export { DAG } from './dag.js'
export type {
  StepConfig,
  StepEdgeConfig,
  WorkflowContext,
  WorkflowResult,
  WorkflowStatus,
  RetryPolicy,
  PendingWorkflow,
  HumanInputRequest,
  HumanInputResponse,
} from './types.js'
```

**Step 4: Run tests to verify they pass**

```bash
pnpm --filter @seashore/agent test -- --run src/workflow/
```

Expected: PASS

**Step 5: Commit**

```bash
git add packages/agent/src/workflow/
git commit -m "feat(agent): add DAG workflow builder and executor"
```

---

### Task 15: ReAct agent

**Files:**
- Create: `packages/agent/src/react-agent/types.ts`
- Create: `packages/agent/src/react-agent/agent.ts`
- Create: `packages/agent/src/react-agent/agent.test.ts`
- Create: `packages/agent/src/react-agent/index.ts`

Note: directory is `react-agent/` to avoid conflict with React (the library).

**Step 1: Write the failing test**

Write `packages/agent/src/react-agent/agent.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { createReActAgent } from './agent.js'

// Mock @tanstack/ai chat function
vi.mock('@tanstack/ai', () => ({
  chat: vi.fn(),
  maxIterations: vi.fn((n: number) => ({ type: 'maxIterations', value: n })),
}))

describe('createReActAgent', () => {
  it('should create an agent with required config', () => {
    const agent = createReActAgent({
      name: 'test-agent',
      adapter: vi.fn() as never,
      systemPrompt: 'You are helpful',
    })

    expect(agent.name).toBe('test-agent')
    expect(typeof agent.run).toBe('function')
    expect(typeof agent.stream).toBe('function')
  })

  it('should have default maxIterations of 10', () => {
    const agent = createReActAgent({
      name: 'test-agent',
      adapter: vi.fn() as never,
      systemPrompt: 'test',
    })

    expect(agent.config.maxIterations).toBe(10)
  })

  it('should accept custom maxIterations', () => {
    const agent = createReActAgent({
      name: 'test-agent',
      adapter: vi.fn() as never,
      systemPrompt: 'test',
      maxIterations: 25,
    })

    expect(agent.config.maxIterations).toBe(25)
  })

  it('should accept outputSchema at definition time', () => {
    const agent = createReActAgent({
      name: 'test-agent',
      adapter: vi.fn() as never,
      systemPrompt: 'test',
      outputSchema: {} as never,
    })

    expect(agent.config.outputSchema).toBeDefined()
  })

  it('should accept tools', () => {
    const mockTool = { name: 'mock' }
    const agent = createReActAgent({
      name: 'test-agent',
      adapter: vi.fn() as never,
      systemPrompt: 'test',
      tools: [mockTool as never],
    })

    expect(agent.config.tools).toHaveLength(1)
  })

  it('should accept guardrails', () => {
    const guardrail = {
      name: 'test-guard',
      beforeRequest: vi.fn(),
    }
    const agent = createReActAgent({
      name: 'test-agent',
      adapter: vi.fn() as never,
      systemPrompt: 'test',
      guardrails: [guardrail as never],
    })

    expect(agent.config.guardrails).toHaveLength(1)
  })
})
```

**Step 2: Run test to verify it fails**

```bash
pnpm --filter @seashore/agent test -- --run src/react-agent/agent.test.ts
```

**Step 3: Write types**

Write `packages/agent/src/react-agent/types.ts`:

```typescript
import type { z } from 'zod'

export interface Guardrail {
  name: string
  beforeRequest?: (messages: unknown[]) => Promise<GuardrailResult>
  afterResponse?: (response: unknown) => Promise<GuardrailResult>
}

export interface GuardrailResult {
  blocked: boolean
  reason?: string
}

export interface ReActAgentConfig<TOutput = unknown> {
  name: string
  adapter: unknown   // @tanstack/ai adapter — typed as unknown to avoid coupling
  systemPrompt: string
  tools?: unknown[]
  maxIterations?: number
  outputSchema?: z.ZodSchema<TOutput>
  guardrails?: Guardrail[]
  requireConfirmation?: string[]
  onConfirmationRequired?: (toolCall: unknown) => Promise<boolean>
  onToolCall?: (call: unknown) => void
  onThinking?: (text: string) => void
}

export interface RunOptions<TOutput = unknown> {
  outputSchema?: z.ZodSchema<TOutput> | null
  messages?: unknown[]
}

export interface ReActAgent<TOutput = unknown> {
  name: string
  config: Required<Pick<ReActAgentConfig<TOutput>, 'maxIterations'>> &
    ReActAgentConfig<TOutput>
  run(input: string, options?: RunOptions): Promise<TOutput>
  stream(input: string, options?: RunOptions): AsyncIterable<unknown>
}
```

**Step 4: Write implementation**

Write `packages/agent/src/react-agent/agent.ts`:

```typescript
import { chat, maxIterations } from '@tanstack/ai'
import type { ReActAgentConfig, ReActAgent, RunOptions } from './types.js'

export function createReActAgent<TOutput = unknown>(
  config: ReActAgentConfig<TOutput>,
): ReActAgent<TOutput> {
  const resolvedConfig = {
    ...config,
    maxIterations: config.maxIterations ?? 10,
  }

  return {
    name: config.name,
    config: resolvedConfig,

    async run(input: string, options?: RunOptions): Promise<TOutput> {
      const outputSchema = options?.outputSchema !== undefined
        ? options.outputSchema
        : config.outputSchema

      const messages = options?.messages ?? [
        { role: 'user' as const, content: input },
      ]

      // Run beforeRequest guardrails
      if (resolvedConfig.guardrails) {
        for (const guard of resolvedConfig.guardrails) {
          if (guard.beforeRequest) {
            const result = await guard.beforeRequest(messages)
            if (result.blocked) {
              throw new Error(`Guardrail "${guard.name}" blocked: ${result.reason}`)
            }
          }
        }
      }

      const chatOptions: Record<string, unknown> = {
        adapter: resolvedConfig.adapter,
        messages,
        systemPrompts: [resolvedConfig.systemPrompt],
        agentLoopStrategy: maxIterations(resolvedConfig.maxIterations),
      }

      if (resolvedConfig.tools) {
        chatOptions.tools = resolvedConfig.tools
      }

      if (outputSchema) {
        chatOptions.outputSchema = outputSchema
      }

      const result = await chat(chatOptions as never)

      // Run afterResponse guardrails
      if (resolvedConfig.guardrails) {
        for (const guard of resolvedConfig.guardrails) {
          if (guard.afterResponse) {
            const guardResult = await guard.afterResponse(result)
            if (guardResult.blocked) {
              throw new Error(`Guardrail "${guard.name}" blocked: ${guardResult.reason}`)
            }
          }
        }
      }

      return result as TOutput
    },

    async *stream(input: string, options?: RunOptions): AsyncIterable<unknown> {
      const messages = options?.messages ?? [
        { role: 'user' as const, content: input },
      ]

      const chatOptions: Record<string, unknown> = {
        adapter: resolvedConfig.adapter,
        messages,
        systemPrompts: [resolvedConfig.systemPrompt],
        agentLoopStrategy: maxIterations(resolvedConfig.maxIterations),
      }

      if (resolvedConfig.tools) {
        chatOptions.tools = resolvedConfig.tools
      }

      const stream = chat(chatOptions as never)
      yield* stream as AsyncIterable<unknown>
    },
  }
}
```

Write `packages/agent/src/react-agent/index.ts`:

```typescript
export { createReActAgent } from './agent.js'
export type {
  ReActAgentConfig,
  ReActAgent,
  RunOptions,
  Guardrail,
  GuardrailResult,
} from './types.js'
```

**Step 5: Run tests to verify they pass**

```bash
pnpm --filter @seashore/agent test -- --run src/react-agent/agent.test.ts
```

Expected: PASS

**Step 6: Commit**

```bash
git add packages/agent/src/react-agent/
git commit -m "feat(agent): add ReAct agent with guardrails and outputSchema"
```

---

### Task 16: Workflow agent wrapper

**Files:**
- Create: `packages/agent/src/workflow-agent/agent.ts`
- Create: `packages/agent/src/workflow-agent/agent.test.ts`
- Create: `packages/agent/src/workflow-agent/index.ts`

**Step 1: Write the failing test**

Write `packages/agent/src/workflow-agent/agent.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { createWorkflowAgent } from './agent.js'
import { createWorkflow, createStep } from '../workflow/builder.js'

describe('createWorkflowAgent', () => {
  it('should wrap a workflow as an agent', async () => {
    const step = createStep({
      name: 'process',
      execute: async (input) => `processed: ${input}`,
    })

    const workflow = createWorkflow({ name: 'test-wf' }).step(step)

    const agent = createWorkflowAgent({
      name: 'test-wf-agent',
      workflow,
    })

    expect(agent.name).toBe('test-wf-agent')
    expect(typeof agent.run).toBe('function')
  })

  it('should execute the workflow and return result', async () => {
    const step = createStep({
      name: 'double',
      execute: async () => 42,
    })

    const workflow = createWorkflow({ name: 'calc' }).step(step)
    const agent = createWorkflowAgent({ name: 'calc-agent', workflow })

    const result = await agent.run('ignored for now')
    expect(result.status).toBe('completed')
    expect(result.state.get('double')).toBe(42)
  })
})
```

**Step 2: Run test to verify it fails**

```bash
pnpm --filter @seashore/agent test -- --run src/workflow-agent/agent.test.ts
```

**Step 3: Write implementation**

Write `packages/agent/src/workflow-agent/agent.ts`:

```typescript
import type { WorkflowResult } from '../workflow/types.js'

interface WorkflowLike {
  name: string
  execute(options?: { initialState?: Map<string, unknown>; abortSignal?: AbortSignal }): Promise<WorkflowResult>
}

export interface WorkflowAgentConfig {
  name: string
  workflow: WorkflowLike
}

export interface WorkflowAgent {
  name: string
  run(input: string, options?: { abortSignal?: AbortSignal }): Promise<WorkflowResult>
}

export function createWorkflowAgent(config: WorkflowAgentConfig): WorkflowAgent {
  return {
    name: config.name,
    async run(input: string, options?: { abortSignal?: AbortSignal }): Promise<WorkflowResult> {
      const initialState = new Map<string, unknown>()
      initialState.set('__input', input)
      return config.workflow.execute({
        initialState,
        abortSignal: options?.abortSignal,
      })
    },
  }
}
```

Write `packages/agent/src/workflow-agent/index.ts`:

```typescript
export { createWorkflowAgent } from './agent.js'
export type { WorkflowAgentConfig, WorkflowAgent } from './agent.js'
```

**Step 4: Run tests to verify they pass**

```bash
pnpm --filter @seashore/agent test -- --run src/workflow-agent/
```

Expected: PASS

**Step 5: Commit**

```bash
git add packages/agent/src/workflow-agent/
git commit -m "feat(agent): add workflow agent wrapper"
```

---

### Task 17: Agent barrel export + full test pass

**Files:**
- Modify: `packages/agent/src/index.ts`

**Step 1: Write barrel export**

```typescript
// Workflow
export { createWorkflow, createStep, DAG } from './workflow/index.js'
export type {
  StepConfig, StepEdgeConfig, WorkflowContext, WorkflowResult,
  WorkflowStatus, RetryPolicy, PendingWorkflow,
  HumanInputRequest, HumanInputResponse,
} from './workflow/index.js'

// ReAct Agent
export { createReActAgent } from './react-agent/index.js'
export type { ReActAgentConfig, ReActAgent, RunOptions, Guardrail, GuardrailResult } from './react-agent/index.js'

// Workflow Agent
export { createWorkflowAgent } from './workflow-agent/index.js'
export type { WorkflowAgentConfig, WorkflowAgent } from './workflow-agent/index.js'
```

**Step 2: Run full agent test suite + typecheck**

```bash
pnpm --filter @seashore/agent test && pnpm --filter @seashore/agent typecheck
```

Expected: All PASS.

**Step 3: Commit**

```bash
git add packages/agent/src/index.ts
git commit -m "feat(agent): complete @seashore/agent with barrel export"
```

---

## Phase 3: @seashore/data

### Task 18: Drizzle storage schema

**Files:**
- Create: `packages/data/src/storage/schema.ts`
- Create: `packages/data/src/storage/schema.test.ts`

**Step 1: Write the failing test**

Write `packages/data/src/storage/schema.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { threads, messages, workflowRuns } from './schema.js'

describe('Storage Schema', () => {
  it('should export threads table', () => {
    expect(threads).toBeDefined()
    // Drizzle tables have a Symbol for the table name
    expect(typeof threads).toBe('object')
  })

  it('should export messages table', () => {
    expect(messages).toBeDefined()
  })

  it('should export workflowRuns table', () => {
    expect(workflowRuns).toBeDefined()
  })
})
```

**Step 2: Run test to verify it fails**

```bash
pnpm --filter @seashore/data test -- --run src/storage/schema.test.ts
```

**Step 3: Write schema**

Write `packages/data/src/storage/schema.ts`:

```typescript
import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
} from 'drizzle-orm/pg-core'

export const threads = pgTable('seashore_threads', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: text('title'),
  metadata: jsonb('metadata').$type<Record<string, unknown>>(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export const messages = pgTable('seashore_messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  threadId: uuid('thread_id')
    .references(() => threads.id, { onDelete: 'cascade' })
    .notNull(),
  role: text('role').$type<'user' | 'assistant' | 'system' | 'tool'>().notNull(),
  content: jsonb('content').notNull(),
  toolCalls: jsonb('tool_calls').$type<unknown[]>(),
  toolResults: jsonb('tool_results').$type<unknown[]>(),
  tokenUsage: jsonb('token_usage').$type<{
    promptTokens?: number
    completionTokens?: number
    totalTokens?: number
  }>(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const workflowRuns = pgTable('seashore_workflow_runs', {
  id: uuid('id').primaryKey().defaultRandom(),
  workflowName: text('workflow_name').notNull(),
  status: text('status')
    .$type<'running' | 'pending' | 'completed' | 'failed'>()
    .notNull()
    .default('running'),
  state: jsonb('state').$type<Record<string, unknown>>().notNull().default({}),
  currentStep: text('current_step'),
  error: text('error'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})
```

**Step 4: Run test to verify it passes**

```bash
pnpm --filter @seashore/data test -- --run src/storage/schema.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add packages/data/src/storage/
git commit -m "feat(data): add Drizzle storage schema for threads, messages, workflow runs"
```

---

### Task 19: Storage service

**Files:**
- Create: `packages/data/src/storage/service.ts`
- Create: `packages/data/src/storage/service.test.ts`
- Create: `packages/data/src/storage/index.ts`

**Step 1: Write the failing test**

Write `packages/data/src/storage/service.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createStorageService } from './service.js'

// Create a mock Drizzle db
function createMockDb() {
  const mockResult = { id: 'test-id', title: 'Test', createdAt: new Date(), updatedAt: new Date() }
  const chain = {
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([mockResult]),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    offset: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    then: vi.fn(),
  }
  return {
    insert: vi.fn().mockReturnValue(chain),
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue(chain),
    }),
    update: vi.fn().mockReturnValue(chain),
    delete: vi.fn().mockReturnValue(chain),
    _chain: chain,
    _mockResult: mockResult,
  }
}

describe('createStorageService', () => {
  it('should create a storage service', () => {
    const db = createMockDb()
    const service = createStorageService(db as never)
    expect(service).toBeDefined()
    expect(typeof service.createThread).toBe('function')
    expect(typeof service.getThread).toBe('function')
    expect(typeof service.listThreads).toBe('function')
    expect(typeof service.addMessage).toBe('function')
    expect(typeof service.getMessages).toBe('function')
  })
})
```

**Step 2: Run test to verify it fails**

```bash
pnpm --filter @seashore/data test -- --run src/storage/service.test.ts
```

**Step 3: Write service**

Write `packages/data/src/storage/service.ts`:

```typescript
import { eq, desc } from 'drizzle-orm'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import { threads, messages, workflowRuns } from './schema.js'

export interface PaginationOpts {
  limit?: number
  offset?: number
}

export interface NewMessage {
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: unknown
  toolCalls?: unknown[]
  toolResults?: unknown[]
  tokenUsage?: {
    promptTokens?: number
    completionTokens?: number
    totalTokens?: number
  }
}

export type Thread = typeof threads.$inferSelect
export type Message = typeof messages.$inferSelect
export type WorkflowRun = typeof workflowRuns.$inferSelect

export interface StorageService {
  // Threads
  createThread(opts?: { title?: string; metadata?: Record<string, unknown> }): Promise<Thread>
  getThread(id: string): Promise<Thread | undefined>
  listThreads(opts?: PaginationOpts): Promise<Thread[]>
  deleteThread(id: string): Promise<void>

  // Messages
  addMessage(threadId: string, message: NewMessage): Promise<Message>
  getMessages(threadId: string, opts?: PaginationOpts): Promise<Message[]>

  // Workflow Runs
  saveWorkflowRun(run: Partial<typeof workflowRuns.$inferInsert> & { id?: string }): Promise<WorkflowRun>
  getWorkflowRun(id: string): Promise<WorkflowRun | undefined>
  updateWorkflowRun(id: string, data: Partial<typeof workflowRuns.$inferInsert>): Promise<void>
}

export function createStorageService(db: PostgresJsDatabase): StorageService {
  return {
    async createThread(opts) {
      const [thread] = await db
        .insert(threads)
        .values({
          title: opts?.title,
          metadata: opts?.metadata,
        })
        .returning()
      return thread!
    },

    async getThread(id) {
      const [thread] = await db
        .select()
        .from(threads)
        .where(eq(threads.id, id))
        .limit(1)
      return thread
    },

    async listThreads(opts) {
      return db
        .select()
        .from(threads)
        .orderBy(desc(threads.updatedAt))
        .limit(opts?.limit ?? 50)
        .offset(opts?.offset ?? 0)
    },

    async deleteThread(id) {
      await db.delete(threads).where(eq(threads.id, id))
    },

    async addMessage(threadId, message) {
      const [msg] = await db
        .insert(messages)
        .values({
          threadId,
          role: message.role,
          content: message.content,
          toolCalls: message.toolCalls,
          toolResults: message.toolResults,
          tokenUsage: message.tokenUsage,
        })
        .returning()

      // Touch thread updatedAt
      await db
        .update(threads)
        .set({ updatedAt: new Date() })
        .where(eq(threads.id, threadId))

      return msg!
    },

    async getMessages(threadId, opts) {
      return db
        .select()
        .from(messages)
        .where(eq(messages.threadId, threadId))
        .orderBy(messages.createdAt)
        .limit(opts?.limit ?? 100)
        .offset(opts?.offset ?? 0)
    },

    async saveWorkflowRun(run) {
      const [result] = await db
        .insert(workflowRuns)
        .values(run as typeof workflowRuns.$inferInsert)
        .returning()
      return result!
    },

    async getWorkflowRun(id) {
      const [run] = await db
        .select()
        .from(workflowRuns)
        .where(eq(workflowRuns.id, id))
        .limit(1)
      return run
    },

    async updateWorkflowRun(id, data) {
      await db
        .update(workflowRuns)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(workflowRuns.id, id))
    },
  }
}
```

Write `packages/data/src/storage/index.ts`:

```typescript
export { createStorageService } from './service.js'
export type { StorageService, PaginationOpts, NewMessage, Thread, Message, WorkflowRun } from './service.js'
export { threads, messages, workflowRuns } from './schema.js'
```

**Step 4: Run tests to verify they pass**

```bash
pnpm --filter @seashore/data test -- --run src/storage/
```

Expected: PASS

**Step 5: Commit**

```bash
git add packages/data/src/storage/
git commit -m "feat(data): add storage service with Drizzle ORM"
```

---

### Task 20: VectorDB schema and service

**Files:**
- Create: `packages/data/src/vectordb/schema.ts`
- Create: `packages/data/src/vectordb/service.ts`
- Create: `packages/data/src/vectordb/service.test.ts`
- Create: `packages/data/src/vectordb/index.ts`

**Step 1: Write the failing test**

Write `packages/data/src/vectordb/service.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { embeddings } from './schema.js'
import type { VectorDBService, SearchQuery } from './service.js'

describe('VectorDB Schema', () => {
  it('should export embeddings table', () => {
    expect(embeddings).toBeDefined()
  })
})

describe('VectorDBService interface', () => {
  it('should define SearchQuery type correctly', () => {
    const query: SearchQuery = {
      mode: 'hybrid',
      topK: 5,
      vector: [0.1, 0.2],
      text: 'hello',
      hybridWeights: { vector: 0.7, text: 0.3 },
    }
    expect(query.mode).toBe('hybrid')
    expect(query.topK).toBe(5)
  })
})
```

**Step 2: Run test to verify it fails**

```bash
pnpm --filter @seashore/data test -- --run src/vectordb/service.test.ts
```

**Step 3: Write schema**

Write `packages/data/src/vectordb/schema.ts`:

```typescript
import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  index,
  customType,
} from 'drizzle-orm/pg-core'
import { vector } from 'drizzle-orm/pg-core'

// Custom tsvector type (Drizzle doesn't have native support)
const tsvector = customType<{ data: string }>({
  dataType() {
    return 'tsvector'
  },
})

export const embeddings = pgTable(
  'seashore_embeddings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    collection: text('collection').notNull(),
    content: text('content').notNull(),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
    embedding: vector('embedding', { dimensions: 1536 }),
    contentTsv: tsvector('content_tsv'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('seashore_embedding_hnsw_idx').using(
      'hnsw',
      table.embedding.op('vector_cosine_ops'),
    ),
    index('seashore_content_tsv_idx').using('gin', table.contentTsv),
    index('seashore_collection_idx').on(table.collection),
  ],
)
```

**Step 4: Write service**

Write `packages/data/src/vectordb/service.ts`:

```typescript
import { eq, sql, and } from 'drizzle-orm'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import { embeddings } from './schema.js'
import type { EmbeddingAdapter } from '@seashore/core'

export interface DocumentInput {
  content: string
  metadata?: Record<string, unknown>
}

export interface SearchResult {
  id: string
  content: string
  metadata: Record<string, unknown> | null
  score: number
}

export interface SearchQuery {
  vector?: number[]
  text?: string
  mode: 'vector' | 'text' | 'hybrid'
  topK: number
  filter?: Record<string, unknown>
  hybridWeights?: { vector: number; text: number }
}

export interface MetadataFilter {
  collection?: string
  metadata?: Record<string, unknown>
}

export interface VectorDBService {
  upsert(collection: string, docs: DocumentInput[], embeddingAdapter: EmbeddingAdapter): Promise<void>
  search(collection: string, query: SearchQuery): Promise<SearchResult[]>
  delete(collection: string, filter?: MetadataFilter): Promise<void>
}

export function createVectorDBService(db: PostgresJsDatabase): VectorDBService {
  return {
    async upsert(collection, docs, embeddingAdapter) {
      const texts = docs.map((d) => d.content)
      const vectors = await embeddingAdapter.embed(texts)

      const values = docs.map((doc, i) => ({
        collection,
        content: doc.content,
        metadata: doc.metadata ?? {},
        embedding: vectors[i]!,
        contentTsv: sql`to_tsvector('english', ${doc.content})`,
      }))

      for (const value of values) {
        await db.insert(embeddings).values(value as never)
      }
    },

    async search(collection, query) {
      switch (query.mode) {
        case 'vector':
          return searchVector(db, collection, query)
        case 'text':
          return searchText(db, collection, query)
        case 'hybrid':
          return searchHybrid(db, collection, query)
        default: {
          const _exhaustive: never = query.mode
          throw new Error(`Unsupported search mode: ${String(_exhaustive)}`)
        }
      }
    },

    async delete(collection, filter) {
      const conditions = [eq(embeddings.collection, collection)]
      // Additional metadata filtering could be added here
      await db.delete(embeddings).where(and(...conditions))
    },
  }
}

async function searchVector(
  db: PostgresJsDatabase,
  collection: string,
  query: SearchQuery,
): Promise<SearchResult[]> {
  if (!query.vector) throw new Error('vector is required for vector search')

  const vectorStr = `[${query.vector.join(',')}]`
  const rows = await db.execute(sql`
    SELECT id, content, metadata,
      1 - (embedding <=> ${vectorStr}::vector) as score
    FROM seashore_embeddings
    WHERE collection = ${collection}
    ORDER BY embedding <=> ${vectorStr}::vector
    LIMIT ${query.topK}
  `)

  return (rows as unknown as SearchResult[])
}

async function searchText(
  db: PostgresJsDatabase,
  collection: string,
  query: SearchQuery,
): Promise<SearchResult[]> {
  if (!query.text) throw new Error('text is required for text search')

  const rows = await db.execute(sql`
    SELECT id, content, metadata,
      ts_rank(content_tsv, plainto_tsquery('english', ${query.text})) as score
    FROM seashore_embeddings
    WHERE collection = ${collection}
      AND content_tsv @@ plainto_tsquery('english', ${query.text})
    ORDER BY score DESC
    LIMIT ${query.topK}
  `)

  return (rows as unknown as SearchResult[])
}

async function searchHybrid(
  db: PostgresJsDatabase,
  collection: string,
  query: SearchQuery,
): Promise<SearchResult[]> {
  if (!query.vector || !query.text) {
    throw new Error('Both vector and text are required for hybrid search')
  }

  const weights = query.hybridWeights ?? { vector: 0.7, text: 0.3 }
  const vectorStr = `[${query.vector.join(',')}]`

  // Reciprocal Rank Fusion (RRF)
  const k = 60 // RRF constant
  const rows = await db.execute(sql`
    WITH vector_results AS (
      SELECT id, content, metadata,
        ROW_NUMBER() OVER (ORDER BY embedding <=> ${vectorStr}::vector) as rank_v
      FROM seashore_embeddings
      WHERE collection = ${collection}
      ORDER BY embedding <=> ${vectorStr}::vector
      LIMIT ${query.topK * 2}
    ),
    text_results AS (
      SELECT id, content, metadata,
        ROW_NUMBER() OVER (ORDER BY ts_rank(content_tsv, plainto_tsquery('english', ${query.text})) DESC) as rank_t
      FROM seashore_embeddings
      WHERE collection = ${collection}
        AND content_tsv @@ plainto_tsquery('english', ${query.text})
      ORDER BY ts_rank(content_tsv, plainto_tsquery('english', ${query.text})) DESC
      LIMIT ${query.topK * 2}
    )
    SELECT
      COALESCE(v.id, t.id) as id,
      COALESCE(v.content, t.content) as content,
      COALESCE(v.metadata, t.metadata) as metadata,
      (
        ${weights.vector} * COALESCE(1.0 / (${k} + v.rank_v), 0) +
        ${weights.text} * COALESCE(1.0 / (${k} + t.rank_t), 0)
      ) as score
    FROM vector_results v
    FULL OUTER JOIN text_results t ON v.id = t.id
    ORDER BY score DESC
    LIMIT ${query.topK}
  `)

  return (rows as unknown as SearchResult[])
}
```

Write `packages/data/src/vectordb/index.ts`:

```typescript
export { createVectorDBService } from './service.js'
export type { VectorDBService, SearchQuery, SearchResult, DocumentInput, MetadataFilter } from './service.js'
export { embeddings } from './schema.js'
```

**Step 5: Run tests to verify they pass**

```bash
pnpm --filter @seashore/data test -- --run src/vectordb/
```

Expected: PASS

**Step 6: Commit**

```bash
git add packages/data/src/vectordb/
git commit -m "feat(data): add vectordb with pgvector HNSW and BM25 hybrid search"
```

---

### Task 21: RAG pipeline

**Files:**
- Create: `packages/data/src/rag/chunker.ts`
- Create: `packages/data/src/rag/chunker.test.ts`
- Create: `packages/data/src/rag/pipeline.ts`
- Create: `packages/data/src/rag/pipeline.test.ts`
- Create: `packages/data/src/rag/index.ts`

**Step 1: Write the failing tests**

Write `packages/data/src/rag/chunker.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { createChunker } from './chunker.js'

describe('createChunker', () => {
  it('should chunk text with fixed strategy', () => {
    const chunker = createChunker({ strategy: 'fixed', chunkSize: 10, overlap: 0 })
    const chunks = chunker.chunk('Hello World, this is a test string')
    expect(chunks.length).toBeGreaterThan(1)
    chunks.forEach((chunk) => {
      expect(chunk.length).toBeLessThanOrEqual(10)
    })
  })

  it('should chunk with overlap', () => {
    const chunker = createChunker({ strategy: 'fixed', chunkSize: 10, overlap: 3 })
    const chunks = chunker.chunk('0123456789ABCDEFGHIJ')
    expect(chunks.length).toBeGreaterThan(1)
  })

  it('should chunk with recursive strategy (by paragraphs first)', () => {
    const chunker = createChunker({ strategy: 'recursive', chunkSize: 100, overlap: 0 })
    const text = 'Paragraph one.\n\nParagraph two.\n\nParagraph three.'
    const chunks = chunker.chunk(text)
    expect(chunks.length).toBeGreaterThanOrEqual(1)
  })

  it('should return single chunk if text is smaller than chunkSize', () => {
    const chunker = createChunker({ strategy: 'fixed', chunkSize: 1000, overlap: 0 })
    const chunks = chunker.chunk('Short text')
    expect(chunks).toHaveLength(1)
    expect(chunks[0]).toBe('Short text')
  })
})
```

Write `packages/data/src/rag/pipeline.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { createRAG } from './pipeline.js'

describe('createRAG', () => {
  it('should create a RAG pipeline', () => {
    const rag = createRAG({
      embedding: { embed: vi.fn() },
      vectordb: {
        upsert: vi.fn(),
        search: vi.fn().mockResolvedValue([]),
        delete: vi.fn(),
      },
      collection: 'test',
    })
    expect(rag).toBeDefined()
    expect(typeof rag.ingest).toBe('function')
    expect(typeof rag.retrieve).toBe('function')
  })

  it('should call vectordb.search on retrieve', async () => {
    const mockSearch = vi.fn().mockResolvedValue([
      { id: '1', content: 'result', metadata: {}, score: 0.9 },
    ])
    const mockEmbed = vi.fn().mockResolvedValue([[0.1, 0.2]])

    const rag = createRAG({
      embedding: { embed: mockEmbed },
      vectordb: {
        upsert: vi.fn(),
        search: mockSearch,
        delete: vi.fn(),
      },
      collection: 'test',
      searchMode: 'vector',
      topK: 3,
    })

    const results = await rag.retrieve('query')
    expect(mockEmbed).toHaveBeenCalledWith('query')
    expect(mockSearch).toHaveBeenCalledWith('test', expect.objectContaining({
      mode: 'vector',
      topK: 3,
    }))
    expect(results).toHaveLength(1)
  })
})
```

**Step 2: Run tests to verify they fail**

```bash
pnpm --filter @seashore/data test -- --run src/rag/
```

**Step 3: Write chunker**

Write `packages/data/src/rag/chunker.ts`:

```typescript
export interface ChunkerConfig {
  strategy: 'fixed' | 'recursive'
  chunkSize: number
  overlap: number
}

export interface Chunker {
  chunk(text: string): string[]
}

export function createChunker(config: ChunkerConfig): Chunker {
  return {
    chunk(text: string): string[] {
      switch (config.strategy) {
        case 'fixed':
          return chunkFixed(text, config.chunkSize, config.overlap)
        case 'recursive':
          return chunkRecursive(text, config.chunkSize, config.overlap)
        default: {
          const _exhaustive: never = config.strategy
          throw new Error(`Unknown chunking strategy: ${String(_exhaustive)}`)
        }
      }
    },
  }
}

function chunkFixed(text: string, size: number, overlap: number): string[] {
  if (text.length <= size) return [text]

  const chunks: string[] = []
  let start = 0
  while (start < text.length) {
    chunks.push(text.slice(start, start + size))
    start += size - overlap
    if (start + overlap >= text.length && start < text.length) {
      // Don't create tiny trailing chunks
      break
    }
  }
  return chunks
}

function chunkRecursive(text: string, size: number, overlap: number): string[] {
  // Split by paragraph first, then by sentence, then by fixed size
  const separators = ['\n\n', '\n', '. ', ' ']

  function split(input: string, sepIdx: number): string[] {
    if (input.length <= size) return [input]
    if (sepIdx >= separators.length) {
      return chunkFixed(input, size, overlap)
    }

    const sep = separators[sepIdx]!
    const parts = input.split(sep)
    const result: string[] = []
    let current = ''

    for (const part of parts) {
      const candidate = current ? current + sep + part : part
      if (candidate.length <= size) {
        current = candidate
      } else {
        if (current) result.push(current)
        if (part.length > size) {
          result.push(...split(part, sepIdx + 1))
          current = ''
        } else {
          current = part
        }
      }
    }
    if (current) result.push(current)
    return result
  }

  return split(text, 0)
}
```

**Step 4: Write RAG pipeline**

Write `packages/data/src/rag/pipeline.ts`:

```typescript
import type { EmbeddingAdapter } from '@seashore/core'
import type { VectorDBService, SearchResult, DocumentInput } from '../vectordb/service.js'
import { createChunker, type ChunkerConfig } from './chunker.js'

export interface RAGConfig {
  embedding: EmbeddingAdapter
  vectordb: VectorDBService
  collection: string
  searchMode?: 'vector' | 'text' | 'hybrid'
  topK?: number
  hybridWeights?: { vector: number; text: number }
  chunker?: ChunkerConfig
}

export interface RAGPipeline {
  ingest(docs: DocumentInput[]): Promise<void>
  retrieve(query: string): Promise<SearchResult[]>
}

export function createRAG(config: RAGConfig): RAGPipeline {
  const searchMode = config.searchMode ?? 'vector'
  const topK = config.topK ?? 5
  const hybridWeights = config.hybridWeights ?? { vector: 0.7, text: 0.3 }

  return {
    async ingest(docs) {
      let docsToIngest = docs

      // Apply chunking if configured
      if (config.chunker) {
        const chunker = createChunker(config.chunker)
        docsToIngest = docs.flatMap((doc) => {
          const chunks = chunker.chunk(doc.content)
          return chunks.map((chunk) => ({
            content: chunk,
            metadata: { ...doc.metadata, _originalContent: doc.content.slice(0, 100) },
          }))
        })
      }

      await config.vectordb.upsert(config.collection, docsToIngest, config.embedding)
    },

    async retrieve(query) {
      const queryVector = searchMode !== 'text'
        ? (await config.embedding.embed(query))[0]
        : undefined

      return config.vectordb.search(config.collection, {
        mode: searchMode,
        topK,
        vector: queryVector,
        text: searchMode !== 'vector' ? query : undefined,
        hybridWeights,
      })
    },
  }
}
```

Write `packages/data/src/rag/index.ts`:

```typescript
export { createRAG } from './pipeline.js'
export type { RAGConfig, RAGPipeline } from './pipeline.js'
export { createChunker } from './chunker.js'
export type { ChunkerConfig, Chunker } from './chunker.js'
```

**Step 5: Run tests to verify they pass**

```bash
pnpm --filter @seashore/data test -- --run src/rag/
```

Expected: PASS

**Step 6: Commit**

```bash
git add packages/data/src/rag/
git commit -m "feat(data): add RAG pipeline with chunking and hybrid search"
```

---

### Task 22: Data barrel export + full test pass

**Files:**
- Modify: `packages/data/src/index.ts`

**Step 1: Write barrel export**

```typescript
// Storage
export { createStorageService } from './storage/index.js'
export type { StorageService, PaginationOpts, NewMessage, Thread, Message, WorkflowRun } from './storage/index.js'
export { threads, messages, workflowRuns } from './storage/index.js'

// VectorDB
export { createVectorDBService } from './vectordb/index.js'
export type { VectorDBService, SearchQuery, SearchResult, DocumentInput, MetadataFilter } from './vectordb/index.js'
export { embeddings } from './vectordb/index.js'

// RAG
export { createRAG, createChunker } from './rag/index.js'
export type { RAGConfig, RAGPipeline, ChunkerConfig, Chunker } from './rag/index.js'
```

**Step 2: Run full data test suite + typecheck**

```bash
pnpm --filter @seashore/data test && pnpm --filter @seashore/data typecheck
```

Expected: All PASS.

**Step 3: Commit**

```bash
git add packages/data/src/index.ts
git commit -m "feat(data): complete @seashore/data with barrel export"
```

---

## Phase 4: @seashore/platform

### Task 23: MCP client integration

**Files:**
- Create: `packages/platform/src/mcp/client.ts`
- Create: `packages/platform/src/mcp/client.test.ts`
- Create: `packages/platform/src/mcp/index.ts`

**Step 1: Write the failing test**

Write `packages/platform/src/mcp/client.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { convertMCPToolToTanstack } from './client.js'

describe('convertMCPToolToTanstack', () => {
  it('should convert an MCP tool definition to @tanstack/ai format', () => {
    const mcpTool = {
      name: 'test_tool',
      description: 'A test tool',
      inputSchema: {
        type: 'object' as const,
        properties: {
          query: { type: 'string' as const, description: 'The query' },
        },
        required: ['query'],
      },
    }

    const converted = convertMCPToolToTanstack(mcpTool, vi.fn())
    expect(converted).toBeDefined()
    expect(converted.name).toBe('test_tool')
  })
})
```

**Step 2: Run test to verify it fails**

```bash
pnpm --filter @seashore/platform test -- --run src/mcp/client.test.ts
```

**Step 3: Write implementation**

Write `packages/platform/src/mcp/client.ts`:

```typescript
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js'
import { toolDefinition } from '@tanstack/ai'
import { z } from 'zod'

export interface MCPConnectionConfig {
  transport: 'stdio' | 'sse'
  // stdio options
  command?: string
  args?: string[]
  // sse options
  url?: string
}

/**
 * Convert an MCP tool's JSON Schema to a @tanstack/ai tool definition.
 * This is a simplified converter — it does not handle all JSON Schema features.
 */
export function convertMCPToolToTanstack(
  mcpTool: { name: string; description?: string; inputSchema?: Record<string, unknown> },
  callFn: (args: Record<string, unknown>) => Promise<unknown>,
) {
  // Build a permissive Zod schema from JSON Schema
  // For full fidelity you'd use a json-schema-to-zod library,
  // but for the MVP we use z.record as a passthrough
  const def = toolDefinition({
    name: mcpTool.name,
    description: mcpTool.description ?? '',
    inputSchema: z.record(z.unknown()),
  })

  return def.server(async (input) => {
    return callFn(input as Record<string, unknown>)
  })
}

export async function connectMCP(config: MCPConnectionConfig) {
  let transport: StdioClientTransport | SSEClientTransport

  if (config.transport === 'stdio') {
    if (!config.command) throw new Error('command is required for stdio transport')
    transport = new StdioClientTransport({
      command: config.command,
      args: config.args ?? [],
    })
  } else if (config.transport === 'sse') {
    if (!config.url) throw new Error('url is required for sse transport')
    transport = new SSEClientTransport(new URL(config.url))
  } else {
    throw new Error(`Unsupported transport: ${String(config.transport)}`)
  }

  const client = new Client({ name: 'seashore-mcp-client', version: '0.0.1' })
  await client.connect(transport)

  const { tools } = await client.listTools()

  return tools.map((tool) =>
    convertMCPToolToTanstack(tool, async (args) => {
      const result = await client.callTool({ name: tool.name, arguments: args })
      return result.content
    }),
  )
}
```

Write `packages/platform/src/mcp/index.ts`:

```typescript
export { connectMCP, convertMCPToolToTanstack } from './client.js'
export type { MCPConnectionConfig } from './client.js'
```

**Step 4: Run tests to verify they pass**

```bash
pnpm --filter @seashore/platform test -- --run src/mcp/
```

Expected: PASS

**Step 5: Commit**

```bash
git add packages/platform/src/mcp/
git commit -m "feat(platform): add MCP client integration"
```

---

### Task 24: Security / Guardrail

**Files:**
- Create: `packages/platform/src/security/guardrail.ts`
- Create: `packages/platform/src/security/llm-guardrail.ts`
- Create: `packages/platform/src/security/guardrail.test.ts`
- Create: `packages/platform/src/security/index.ts`

**Step 1: Write the failing test**

Write `packages/platform/src/security/guardrail.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { createGuardrail } from './guardrail.js'
import { createLLMGuardrail } from './llm-guardrail.js'

describe('createGuardrail', () => {
  it('should create a guardrail with beforeRequest', async () => {
    const guard = createGuardrail({
      name: 'test-guard',
      beforeRequest: async (messages) => {
        return { blocked: false }
      },
    })
    expect(guard.name).toBe('test-guard')

    const result = await guard.beforeRequest!([])
    expect(result.blocked).toBe(false)
  })

  it('should block on beforeRequest', async () => {
    const guard = createGuardrail({
      name: 'block-guard',
      beforeRequest: async () => ({
        blocked: true,
        reason: 'Blocked for testing',
      }),
    })

    const result = await guard.beforeRequest!([])
    expect(result.blocked).toBe(true)
    expect(result.reason).toBe('Blocked for testing')
  })

  it('should support afterResponse', async () => {
    const guard = createGuardrail({
      name: 'response-guard',
      afterResponse: async (response) => ({
        blocked: String(response).includes('bad'),
        reason: 'Bad content detected',
      }),
    })

    const safe = await guard.afterResponse!('good content')
    expect(safe.blocked).toBe(false)

    const unsafe = await guard.afterResponse!('this is bad content')
    expect(unsafe.blocked).toBe(true)
  })
})

describe('createLLMGuardrail', () => {
  it('should create an LLM-based guardrail', () => {
    const guard = createLLMGuardrail({
      name: 'llm-guard',
      adapter: vi.fn() as never,
      prompt: 'Is this safe?',
      parseResult: (output) => ({
        blocked: String(output).includes('UNSAFE'),
      }),
    })

    expect(guard.name).toBe('llm-guard')
    expect(typeof guard.afterResponse).toBe('function')
  })
})
```

**Step 2: Run test to verify it fails**

```bash
pnpm --filter @seashore/platform test -- --run src/security/
```

**Step 3: Write implementation**

Write `packages/platform/src/security/guardrail.ts`:

```typescript
export interface GuardrailResult {
  blocked: boolean
  reason?: string
}

export interface GuardrailConfig {
  name: string
  beforeRequest?: (messages: unknown[]) => Promise<GuardrailResult>
  afterResponse?: (response: unknown) => Promise<GuardrailResult>
}

export interface Guardrail {
  name: string
  beforeRequest?: (messages: unknown[]) => Promise<GuardrailResult>
  afterResponse?: (response: unknown) => Promise<GuardrailResult>
}

export function createGuardrail(config: GuardrailConfig): Guardrail {
  return {
    name: config.name,
    beforeRequest: config.beforeRequest,
    afterResponse: config.afterResponse,
  }
}
```

Write `packages/platform/src/security/llm-guardrail.ts`:

```typescript
import { chat } from '@tanstack/ai'
import type { Guardrail, GuardrailResult } from './guardrail.js'

export interface LLMGuardrailConfig {
  name: string
  adapter: unknown  // @tanstack/ai adapter
  prompt: string
  parseResult: (output: string) => GuardrailResult
}

export function createLLMGuardrail(config: LLMGuardrailConfig): Guardrail {
  return {
    name: config.name,
    async afterResponse(response: unknown): Promise<GuardrailResult> {
      const judgment = await chat({
        adapter: config.adapter as never,
        messages: [
          {
            role: 'user' as const,
            content: `${config.prompt}\n\nContent to evaluate:\n${String(response)}`,
          },
        ],
      })

      // Extract text from the stream
      let text = ''
      for await (const chunk of judgment as AsyncIterable<{ type: string; delta?: string }>) {
        if (chunk.type === 'content' && chunk.delta) {
          text += chunk.delta
        }
      }

      return config.parseResult(text)
    },
  }
}
```

Write `packages/platform/src/security/index.ts`:

```typescript
export { createGuardrail } from './guardrail.js'
export { createLLMGuardrail } from './llm-guardrail.js'
export type { Guardrail, GuardrailResult, GuardrailConfig } from './guardrail.js'
export type { LLMGuardrailConfig } from './llm-guardrail.js'
```

**Step 4: Run tests to verify they pass**

```bash
pnpm --filter @seashore/platform test -- --run src/security/
```

Expected: PASS

**Step 5: Commit**

```bash
git add packages/platform/src/security/
git commit -m "feat(platform): add guardrail and LLM-based guardrail"
```

---

### Task 25: Evaluation system

**Files:**
- Create: `packages/platform/src/eval/types.ts`
- Create: `packages/platform/src/eval/metric.ts`
- Create: `packages/platform/src/eval/suite.ts`
- Create: `packages/platform/src/eval/metric.test.ts`
- Create: `packages/platform/src/eval/suite.test.ts`
- Create: `packages/platform/src/eval/index.ts`

**Step 1: Write the failing tests**

Write `packages/platform/src/eval/metric.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { createMetric, createLLMJudgeMetric } from './metric.js'

describe('createMetric', () => {
  it('should create a custom metric', async () => {
    const metric = createMetric({
      name: 'json-valid',
      evaluate: async ({ output }) => {
        try { JSON.parse(output); return 1.0 } catch { return 0.0 }
      },
    })

    expect(metric.name).toBe('json-valid')
    expect(await metric.evaluate({ input: '', output: '{"a":1}' })).toBe(1.0)
    expect(await metric.evaluate({ input: '', output: 'not json' })).toBe(0.0)
  })
})

describe('createLLMJudgeMetric', () => {
  it('should create an LLM judge metric', () => {
    const metric = createLLMJudgeMetric({
      name: 'helpfulness',
      adapter: vi.fn() as never,
      prompt: 'Rate helpfulness',
      parseScore: (text) => parseFloat(text) / 10,
    })

    expect(metric.name).toBe('helpfulness')
    expect(typeof metric.evaluate).toBe('function')
  })
})
```

Write `packages/platform/src/eval/suite.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { createEvalSuite } from './suite.js'
import { createMetric } from './metric.js'

describe('createEvalSuite', () => {
  it('should run metrics against dataset', async () => {
    const lengthMetric = createMetric({
      name: 'length-check',
      evaluate: async ({ output }) => (output.length > 5 ? 1.0 : 0.0),
    })

    const suite = createEvalSuite({
      name: 'test-suite',
      dataset: [
        { input: 'Hello', expected: 'World' },
      ],
      metrics: [lengthMetric],
    })

    const mockAgent = {
      run: vi.fn().mockResolvedValue('Hello World'),
    }

    const results = await suite.run(mockAgent as never)
    expect(results.overall).toBeDefined()
    expect(results.metrics['length-check']).toBe(1.0)
  })

  it('should average scores across dataset entries', async () => {
    const exactMatch = createMetric({
      name: 'exact-match',
      evaluate: async ({ output, expected }) =>
        output === expected ? 1.0 : 0.0,
    })

    const suite = createEvalSuite({
      name: 'test-suite',
      dataset: [
        { input: 'Q1', expected: 'A1' },
        { input: 'Q2', expected: 'A2' },
      ],
      metrics: [exactMatch],
    })

    const mockAgent = {
      run: vi.fn()
        .mockResolvedValueOnce('A1')
        .mockResolvedValueOnce('WRONG'),
    }

    const results = await suite.run(mockAgent as never)
    expect(results.metrics['exact-match']).toBe(0.5)
  })
})
```

**Step 2: Run tests to verify they fail**

```bash
pnpm --filter @seashore/platform test -- --run src/eval/
```

**Step 3: Write types**

Write `packages/platform/src/eval/types.ts`:

```typescript
export interface EvalMetric {
  name: string
  evaluate(params: {
    input: string
    output: string
    expected?: string
    context?: string[]
  }): Promise<number>
}

export interface DatasetEntry {
  input: string
  expected?: string
  context?: string[]
}

export interface EvalSuiteConfig {
  name: string
  dataset: DatasetEntry[]
  metrics: EvalMetric[]
}

export interface EvalResults {
  overall: number
  metrics: Record<string, number>
  details: Array<{
    input: string
    output: string
    scores: Record<string, number>
  }>
}

export interface RunnableAgent {
  run(input: string): Promise<unknown>
}
```

**Step 4: Write metric factories**

Write `packages/platform/src/eval/metric.ts`:

```typescript
import { chat } from '@tanstack/ai'
import type { EvalMetric } from './types.js'

export interface MetricConfig {
  name: string
  evaluate: (params: {
    input: string
    output: string
    expected?: string
    context?: string[]
  }) => Promise<number>
}

export function createMetric(config: MetricConfig): EvalMetric {
  return {
    name: config.name,
    evaluate: config.evaluate,
  }
}

export interface LLMJudgeMetricConfig {
  name: string
  adapter: unknown // @tanstack/ai adapter
  prompt: string
  parseScore: (output: string) => number
}

export function createLLMJudgeMetric(config: LLMJudgeMetricConfig): EvalMetric {
  return {
    name: config.name,
    async evaluate(params) {
      const judgePrompt = [
        config.prompt,
        `\nInput: ${params.input}`,
        `Output: ${params.output}`,
        params.expected ? `Expected: ${params.expected}` : '',
      ]
        .filter(Boolean)
        .join('\n')

      const stream = chat({
        adapter: config.adapter as never,
        messages: [{ role: 'user' as const, content: judgePrompt }],
      })

      let text = ''
      for await (const chunk of stream as AsyncIterable<{ type: string; delta?: string }>) {
        if (chunk.type === 'content' && chunk.delta) {
          text += chunk.delta
        }
      }

      const score = config.parseScore(text)
      return Math.max(0, Math.min(1, score)) // Clamp 0-1
    },
  }
}
```

**Step 5: Write eval suite**

Write `packages/platform/src/eval/suite.ts`:

```typescript
import type { EvalSuiteConfig, EvalResults, RunnableAgent } from './types.js'

export function createEvalSuite(config: EvalSuiteConfig) {
  return {
    name: config.name,

    async run(agent: RunnableAgent): Promise<EvalResults> {
      const details: EvalResults['details'] = []
      const metricTotals: Record<string, number> = {}
      const metricCounts: Record<string, number> = {}

      for (const metric of config.metrics) {
        metricTotals[metric.name] = 0
        metricCounts[metric.name] = 0
      }

      for (const entry of config.dataset) {
        const rawOutput = await agent.run(entry.input)
        const output = typeof rawOutput === 'string' ? rawOutput : JSON.stringify(rawOutput)

        const scores: Record<string, number> = {}

        for (const metric of config.metrics) {
          const score = await metric.evaluate({
            input: entry.input,
            output,
            expected: entry.expected,
            context: entry.context,
          })
          scores[metric.name] = score
          metricTotals[metric.name] = (metricTotals[metric.name] ?? 0) + score
          metricCounts[metric.name] = (metricCounts[metric.name] ?? 0) + 1
        }

        details.push({ input: entry.input, output, scores })
      }

      const metrics: Record<string, number> = {}
      let overallTotal = 0
      let overallCount = 0

      for (const [name, total] of Object.entries(metricTotals)) {
        const count = metricCounts[name] ?? 1
        const avg = total / count
        metrics[name] = avg
        overallTotal += avg
        overallCount++
      }

      return {
        overall: overallCount > 0 ? overallTotal / overallCount : 0,
        metrics,
        details,
      }
    },
  }
}
```

Write `packages/platform/src/eval/index.ts`:

```typescript
export { createMetric, createLLMJudgeMetric } from './metric.js'
export { createEvalSuite } from './suite.js'
export type { EvalMetric, DatasetEntry, EvalSuiteConfig, EvalResults, RunnableAgent } from './types.js'
export type { MetricConfig, LLMJudgeMetricConfig } from './metric.js'
```

**Step 6: Run tests to verify they pass**

```bash
pnpm --filter @seashore/platform test -- --run src/eval/
```

Expected: PASS

**Step 7: Commit**

```bash
git add packages/platform/src/eval/
git commit -m "feat(platform): add evaluation system with custom and LLM-judge metrics"
```

---

### Task 26: Hono deploy middleware

**Files:**
- Create: `packages/platform/src/deploy/middleware.ts`
- Create: `packages/platform/src/deploy/middleware.test.ts`
- Create: `packages/platform/src/deploy/index.ts`

**Step 1: Write the failing test**

Write `packages/platform/src/deploy/middleware.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { seashoreMiddleware } from './middleware.js'
import { Hono } from 'hono'

describe('seashoreMiddleware', () => {
  it('should return a Hono app', () => {
    const middleware = seashoreMiddleware({
      agent: { name: 'test', run: vi.fn(), stream: vi.fn() } as never,
    })
    expect(middleware).toBeDefined()
    // It should be a Hono instance (has .fetch method)
    expect(typeof middleware.fetch).toBe('function')
  })

  it('should have /chat endpoint', async () => {
    const mockAgent = {
      name: 'test',
      run: vi.fn().mockResolvedValue('hello'),
      stream: vi.fn(),
      config: { maxIterations: 10 },
    }

    const app = new Hono()
    app.route('/api', seashoreMiddleware({ agent: mockAgent as never }))

    const req = new Request('http://localhost/api/chat', {
      method: 'POST',
      body: JSON.stringify({ messages: [{ role: 'user', content: 'hi' }] }),
      headers: { 'Content-Type': 'application/json' },
    })

    const res = await app.fetch(req)
    expect(res.status).toBeDefined()
  })
})
```

**Step 2: Run test to verify it fails**

```bash
pnpm --filter @seashore/platform test -- --run src/deploy/
```

**Step 3: Write implementation**

Write `packages/platform/src/deploy/middleware.ts`:

```typescript
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { streamSSE } from 'hono/streaming'
import type { StorageService } from '@seashore/data'

interface DeployableAgent {
  name: string
  stream(input: string, options?: unknown): AsyncIterable<unknown>
  run(input: string, options?: unknown): Promise<unknown>
}

export interface SeashoreMiddlewareConfig {
  agent: DeployableAgent
  storage?: StorageService
  guardrails?: unknown[]
  cors?: boolean
}

export function seashoreMiddleware(config: SeashoreMiddlewareConfig) {
  const app = new Hono()

  if (config.cors) {
    app.use('*', cors())
  }

  // POST /chat — streaming chat
  app.post('/chat', async (c) => {
    const body = await c.req.json<{
      messages: Array<{ role: string; content: string }>
      threadId?: string
      stream?: boolean
    }>()

    const lastMessage = body.messages.at(-1)
    if (!lastMessage) {
      return c.json({ error: 'No messages provided' }, 400)
    }

    // Persist incoming message if storage is configured
    if (config.storage && body.threadId) {
      await config.storage.addMessage(body.threadId, {
        role: lastMessage.role as 'user',
        content: lastMessage.content,
      })
    }

    if (body.stream === false) {
      // Non-streaming response
      const result = await config.agent.run(lastMessage.content, {
        messages: body.messages,
      })
      return c.json({ content: result })
    }

    // Streaming SSE response
    return streamSSE(c, async (stream) => {
      const iterable = config.agent.stream(lastMessage.content, {
        messages: body.messages,
      })
      for await (const chunk of iterable) {
        await stream.writeSSE({
          data: JSON.stringify(chunk),
          event: 'message',
        })
      }
      await stream.writeSSE({
        data: '[DONE]',
        event: 'done',
      })
    })
  })

  // Thread endpoints (only if storage is provided)
  if (config.storage) {
    const storage = config.storage

    app.get('/threads', async (c) => {
      const limit = Number(c.req.query('limit') ?? '50')
      const offset = Number(c.req.query('offset') ?? '0')
      const threadList = await storage.listThreads({ limit, offset })
      return c.json(threadList)
    })

    app.get('/threads/:id/messages', async (c) => {
      const id = c.req.param('id')
      const limit = Number(c.req.query('limit') ?? '100')
      const offset = Number(c.req.query('offset') ?? '0')
      const msgs = await storage.getMessages(id, { limit, offset })
      return c.json(msgs)
    })

    app.post('/threads', async (c) => {
      const body = await c.req.json<{ title?: string; metadata?: Record<string, unknown> }>()
      const thread = await storage.createThread(body)
      return c.json(thread, 201)
    })
  }

  return app
}
```

Write `packages/platform/src/deploy/index.ts`:

```typescript
export { seashoreMiddleware } from './middleware.js'
export type { SeashoreMiddlewareConfig } from './middleware.js'
```

**Step 4: Run tests to verify they pass**

```bash
pnpm --filter @seashore/platform test -- --run src/deploy/
```

Expected: PASS

**Step 5: Commit**

```bash
git add packages/platform/src/deploy/
git commit -m "feat(platform): add Hono deploy middleware with SSE streaming"
```

---

### Task 27: Platform barrel export + full test pass

**Files:**
- Modify: `packages/platform/src/index.ts`

**Step 1: Write barrel export**

```typescript
// MCP
export { connectMCP, convertMCPToolToTanstack } from './mcp/index.js'
export type { MCPConnectionConfig } from './mcp/index.js'

// Security
export { createGuardrail, createLLMGuardrail } from './security/index.js'
export type { Guardrail, GuardrailResult, GuardrailConfig, LLMGuardrailConfig } from './security/index.js'

// Evaluation
export { createMetric, createLLMJudgeMetric, createEvalSuite } from './eval/index.js'
export type {
  EvalMetric, DatasetEntry, EvalSuiteConfig, EvalResults,
  RunnableAgent, MetricConfig, LLMJudgeMetricConfig,
} from './eval/index.js'

// Deploy
export { seashoreMiddleware } from './deploy/index.js'
export type { SeashoreMiddlewareConfig } from './deploy/index.js'
```

**Step 2: Run full platform test suite + typecheck**

```bash
pnpm --filter @seashore/platform test && pnpm --filter @seashore/platform typecheck
```

Expected: All PASS.

**Step 3: Commit**

```bash
git add packages/platform/src/index.ts
git commit -m "feat(platform): complete @seashore/platform with barrel export"
```

---

## Phase 5: @seashore/react

### Task 28: useSeashoreChat hook

**Files:**
- Create: `packages/react/src/hooks/use-seashore-chat.ts`
- Create: `packages/react/src/hooks/use-seashore-chat.test.ts`
- Create: `packages/react/src/hooks/index.ts`
- Modify: `packages/react/src/index.ts`

**Step 1: Write the failing test**

Write `packages/react/src/hooks/use-seashore-chat.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { useSeashoreChat } from './use-seashore-chat.js'

// Note: Full React hook testing requires @testing-library/react-hooks
// For unit tests we just verify the module exports correctly
describe('useSeashoreChat', () => {
  it('should be a function', () => {
    expect(typeof useSeashoreChat).toBe('function')
  })
})
```

**Step 2: Run test to verify it fails**

```bash
pnpm --filter @seashore/react test -- --run src/hooks/
```

**Step 3: Write implementation**

Write `packages/react/src/hooks/use-seashore-chat.ts`:

```typescript
import { useState, useCallback, useRef } from 'react'
import type { HumanInputRequest, HumanInputResponse } from '@seashore/agent'

interface Message {
  id: string
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string
  parts?: Array<{ type: string; content: string }>
  createdAt: Date
}

export interface UseSeashoreChatConfig {
  endpoint: string
  threadId?: string
  onToolCall?: (call: unknown) => void
  onError?: (error: Error) => void
}

export interface UseSeashoreChatReturn {
  messages: Message[]
  sendMessage: (content: string) => void
  isStreaming: boolean
  error: Error | null
  pendingConfirmation: HumanInputRequest | null
  confirmAction: (response: HumanInputResponse) => void
  clearMessages: () => void
}

let messageIdCounter = 0
function generateMessageId(): string {
  return `msg_${Date.now()}_${++messageIdCounter}`
}

export function useSeashoreChat(config: UseSeashoreChatConfig): UseSeashoreChatReturn {
  const [messages, setMessages] = useState<Message[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [pendingConfirmation, setPendingConfirmation] = useState<HumanInputRequest | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const sendMessage = useCallback(
    async (content: string) => {
      const userMessage: Message = {
        id: generateMessageId(),
        role: 'user',
        content,
        createdAt: new Date(),
      }

      setMessages((prev) => [...prev, userMessage])
      setIsStreaming(true)
      setError(null)

      const assistantMessage: Message = {
        id: generateMessageId(),
        role: 'assistant',
        content: '',
        createdAt: new Date(),
      }
      setMessages((prev) => [...prev, assistantMessage])

      try {
        abortRef.current = new AbortController()

        const allMessages = [...messages, userMessage].map((m) => ({
          role: m.role,
          content: m.content,
        }))

        const response = await fetch(config.endpoint + '/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: allMessages,
            threadId: config.threadId,
            stream: true,
          }),
          signal: abortRef.current.signal,
        })

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }

        const reader = response.body?.getReader()
        if (!reader) throw new Error('No response body')

        const decoder = new TextDecoder()
        let buffer = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() ?? ''

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6)
              if (data === '[DONE]') continue

              try {
                const chunk = JSON.parse(data) as {
                  type: string
                  delta?: string
                  content?: string
                  name?: string
                }

                if (chunk.type === 'content' && chunk.delta) {
                  setMessages((prev) => {
                    const updated = [...prev]
                    const last = updated[updated.length - 1]
                    if (last?.role === 'assistant') {
                      updated[updated.length - 1] = {
                        ...last,
                        content: last.content + chunk.delta,
                      }
                    }
                    return updated
                  })
                }

                if (chunk.type === 'tool_call' && config.onToolCall) {
                  config.onToolCall(chunk)
                }
              } catch {
                // Skip invalid JSON lines
              }
            }
          }
        }
      } catch (err) {
        if (err instanceof Error && err.name !== 'AbortError') {
          setError(err)
          config.onError?.(err)
        }
      } finally {
        setIsStreaming(false)
        abortRef.current = null
      }
    },
    [config, messages],
  )

  const confirmAction = useCallback(
    (response: HumanInputResponse) => {
      setPendingConfirmation(null)
      // Send confirmation back to the server
      // This would be handled by a separate endpoint in production
    },
    [],
  )

  const clearMessages = useCallback(() => {
    setMessages([])
    setError(null)
  }, [])

  return {
    messages,
    sendMessage,
    isStreaming,
    error,
    pendingConfirmation,
    confirmAction,
    clearMessages,
  }
}
```

Write `packages/react/src/hooks/index.ts`:

```typescript
export { useSeashoreChat } from './use-seashore-chat.js'
export type { UseSeashoreChatConfig, UseSeashoreChatReturn } from './use-seashore-chat.js'
```

Write `packages/react/src/index.ts`:

```typescript
export { useSeashoreChat } from './hooks/index.js'
export type { UseSeashoreChatConfig, UseSeashoreChatReturn } from './hooks/index.js'
```

**Step 4: Run tests to verify they pass**

```bash
pnpm --filter @seashore/react test -- --run src/hooks/
```

Expected: PASS

**Step 5: Commit**

```bash
git add packages/react/src/
git commit -m "feat(react): add useSeashoreChat hook with SSE streaming"
```

---

## Phase 6: Integration & Final Verification

### Task 29: Drizzle migration config

**Files:**
- Create: `packages/data/drizzle.config.ts`

**Step 1: Write drizzle config**

Write `packages/data/drizzle.config.ts`:

```typescript
import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './src/storage/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    // User provides their own connection string
    url: process.env.DATABASE_URL ?? 'postgresql://localhost:5432/seashore',
  },
})
```

Note: Also add the vectordb schema to a separate config or combine.

**Step 2: Commit**

```bash
git add packages/data/drizzle.config.ts
git commit -m "chore(data): add Drizzle migration config"
```

---

### Task 30: Full monorepo build + test

**Step 1: Install all dependencies**

```bash
pnpm install
```

**Step 2: Build all packages in dependency order**

```bash
pnpm nx run-many -t build
```

Expected: All 5 packages build without errors.

**Step 3: Run all tests**

```bash
pnpm nx run-many -t test
```

Expected: All tests pass across all packages.

**Step 4: Type check all packages**

```bash
pnpm nx run-many -t typecheck
```

Expected: No type errors.

**Step 5: Fix any issues found**

If any errors occur, fix them in the respective package and re-run.

**Step 6: Commit any fixes**

```bash
git add -A
git commit -m "chore: fix build/test issues from full integration run"
```

---

### Task 31: Update .gitignore and root documentation placeholder

**Step 1: Verify .gitignore covers dist/ and node_modules/**

**Step 2: Final commit**

```bash
git add -A
git commit -m "chore: seashore v0.0.1 initial implementation complete"
```

---

## Summary of Task Dependencies

```
Phase 0: Tasks 1-7 (sequential, each depends on prior)
Phase 1: Tasks 8-12 (sequential within core)
Phase 2: Tasks 13-17 (sequential within agent, depends on Phase 1)
Phase 3: Tasks 18-22 (sequential within data, depends on Phase 1)
Phase 4: Tasks 23-27 (sequential within platform, depends on Phase 1-3)
Phase 5: Task 28 (depends on Phase 2)
Phase 6: Tasks 29-31 (depends on all prior phases)
```

Phases 2, 3 can run **in parallel** since they both only depend on Phase 1.
Phase 4 depends on Phases 1+2+3.
Phase 5 depends on Phase 2.
