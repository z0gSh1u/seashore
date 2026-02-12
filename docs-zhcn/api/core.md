# @seashore/core API 参考

`@seashore/core` 包提供了构建 AI 代理的基础工具，包括 LLM 适配器、嵌入生成、工具集成和上下文工程。

## 目录

- [LLM 适配器](#llm-适配器)
  - [createLLMAdapter](#createllmadapter)
  - [LLMAdapterConfig](#llmadapterconfig)
  - [LLMProvider](#llmprovider)
- [嵌入适配器](#嵌入适配器)
  - [createEmbeddingAdapter](#createembeddingadapter)
  - [EmbeddingConfig](#embeddingconfig)
  - [EmbeddingAdapter](#embeddingadapter)
- [工具](#工具)
  - [createToolkit](#createtoolkit)
  - [createSerperSearch](#createserpersearch)
  - [createFirecrawlScrape](#createfirecrawlscrape)
- [上下文工程](#上下文工程)
  - [systemPrompt](#systemprompt)
  - [fewShotMessages](#fewshotmessages)

---

## LLM 适配器

### createLLMAdapter

创建一个用于生成与 TanStack AI 兼容的 LLM 适配器的工厂函数。

```typescript
function createLLMAdapter(config: LLMAdapterConfig): LLMAdapterFactory
```

**参数：**
- `config` (`LLMAdapterConfig`)：LLM 适配器的配置

**返回值：**
- `LLMAdapterFactory`：一个接受模型名称并返回 TanStack AI 兼容适配器的函数

**示例：**

```typescript
import { createLLMAdapter } from '@seashore/core'

// OpenAI
const openaiAdapter = createLLMAdapter({
  provider: 'openai',
  apiKey: process.env.OPENAI_API_KEY!,
})
const gpt4 = openaiAdapter('gpt-4o')

// Anthropic
const anthropicAdapter = createLLMAdapter({
  provider: 'anthropic',
  apiKey: process.env.ANTHROPIC_API_KEY!,
})
const claude = anthropicAdapter('claude-sonnet-4')

// Gemini
const geminiAdapter = createLLMAdapter({
  provider: 'gemini',
  apiKey: process.env.GOOGLE_API_KEY!,
})
const geminiPro = geminiAdapter('gemini-2.0-flash-exp')

// 自定义 base URL（例如 Azure OpenAI）
const azureAdapter = createLLMAdapter({
  provider: 'openai',
  apiKey: process.env.AZURE_API_KEY!,
  baseURL: 'https://your-resource.openai.azure.com/openai/deployments',
})
```

---

### LLMAdapterConfig

LLM 适配器的配置接口。

```typescript
interface LLMAdapterConfig {
  provider: LLMProvider
  apiKey: string
  baseURL?: string
}
```

**属性：**
- `provider` (`LLMProvider`)：要使用的 LLM 提供商（`'openai'` | `'anthropic'` | `'gemini'`）
- `apiKey` (`string`)：用于身份验证的 API 密钥
- `baseURL` (`string`，可选)：API 请求的自定义基础 URL（例如用于 Azure OpenAI 或本地代理）

---

### LLMProvider

支持的 LLM 提供商的类型联合。

```typescript
type LLMProvider = 'openai' | 'anthropic' | 'gemini'
```

**支持的提供商：**
- `'openai'`：OpenAI 模型（GPT-4、GPT-4o 等）
- `'anthropic'`：Anthropic 模型（Claude 3、Claude Sonnet 4 等）
- `'gemini'`：Google Gemini 模型（Gemini 2.0 Flash 等）

---

## 嵌入适配器

### createEmbeddingAdapter

创建一个用于从文本生成向量嵌入的嵌入适配器。

```typescript
function createEmbeddingAdapter(config: EmbeddingConfig): EmbeddingAdapter
```

**参数：**
- `config` (`EmbeddingConfig`)：嵌入适配器的配置

**返回值：**
- `EmbeddingAdapter`：一个带有 `embed` 方法用于生成嵌入的适配器

**示例：**

```typescript
import { createEmbeddingAdapter } from '@seashore/core'

// OpenAI 嵌入
const embedder = createEmbeddingAdapter({
  provider: 'openai',
  model: 'text-embedding-3-small',
  apiKey: process.env.OPENAI_API_KEY!,
})

// 单个文本
const [embedding] = await embedder.embed('Hello world')
console.log(embedding.length) // 1536 维度

// 多个文本
const embeddings = await embedder.embed([
  'First document',
  'Second document',
  'Third document',
])
console.log(embeddings.length) // 3

// 自定义维度（仅限 OpenAI）
const smallEmbedder = createEmbeddingAdapter({
  provider: 'openai',
  model: 'text-embedding-3-small',
  apiKey: process.env.OPENAI_API_KEY!,
  dimensions: 512, // 从默认的 1536 减少
})

// Gemini 嵌入
const geminiEmbedder = createEmbeddingAdapter({
  provider: 'gemini',
  model: 'text-embedding-004',
  apiKey: process.env.GOOGLE_API_KEY!,
})
```

**注意：** Anthropic 目前不提供嵌入 API。请使用 OpenAI 或 Gemini 进行嵌入。

---

### EmbeddingConfig

嵌入适配器的配置接口。

```typescript
interface EmbeddingConfig {
  provider: EmbeddingProvider
  model: string
  apiKey: string
  baseURL?: string
  dimensions?: number
}
```

**属性：**
- `provider` (`EmbeddingProvider`)：嵌入提供商（`'openai'` | `'gemini'` | `'anthropic'`）
- `model` (`string`)：要使用的嵌入模型（例如 `'text-embedding-3-small'`、`'text-embedding-004'`）
- `apiKey` (`string`)：用于身份验证的 API 密钥
- `baseURL` (`string`，可选)：API 请求的自定义基础 URL
- `dimensions` (`number`，可选)：嵌入的维度数量（仅限 OpenAI）

**常用模型：**
- OpenAI：`'text-embedding-3-small'`、`'text-embedding-3-large'`、`'text-embedding-ada-002'`
- Gemini：`'text-embedding-004'`、`'embedding-001'`

---

### EmbeddingAdapter

由 `createEmbeddingAdapter` 返回的嵌入适配器接口。

```typescript
interface EmbeddingAdapter {
  embed(input: string | string[]): Promise<number[][]>
}
```

**方法：**
- `embed(input: string | string[])`：为一个或多个文本生成嵌入
  - **参数：**
    - `input`：要嵌入的单个字符串或字符串数组
  - **返回值：** Promise，解析为嵌入数组（每个嵌入是一个 `number[]`）

---

## 工具

### createToolkit

从 TanStack AI 工具数组创建类型化工具包。这是一个提供类型安全的辅助函数。

```typescript
function createToolkit<T extends ServerTool[]>(tools: T): T
```

**参数：**
- `tools` (`T extends ServerTool[]`)：TanStack AI 服务器工具数组

**返回值：**
- `T`：保留类型的相同工具数组

**示例：**

```typescript
import { createToolkit } from '@seashore/core'
import { toolDefinition } from '@tanstack/ai'
import { z } from 'zod'

const weatherTool = toolDefinition({
  name: 'get_weather',
  description: 'Get current weather for a location',
  inputSchema: z.object({
    location: z.string(),
    units: z.enum(['celsius', 'fahrenheit']).optional(),
  }),
  outputSchema: z.object({
    temperature: z.number(),
    conditions: z.string(),
  }),
}).server(async (input) => {
  // 实现
  return { temperature: 72, conditions: 'sunny' }
})

const calculatorTool = toolDefinition({
  name: 'calculator',
  description: 'Perform mathematical calculations',
  inputSchema: z.object({
    expression: z.string(),
  }),
  outputSchema: z.object({
    result: z.number(),
  }),
}).server(async (input) => {
  return { result: eval(input.expression) }
})

// 创建类型化工具包
const toolkit = createToolkit([weatherTool, calculatorTool])
```

---

### createSerperSearch

创建一个由 Serper API 驱动的网络搜索工具。

```typescript
function createSerperSearch(config: SerperConfig): ServerTool
```

**参数：**
- `config` (`SerperConfig`)：Serper API 的配置

**返回值：**
- `ServerTool`：用于网络搜索的 TanStack AI 服务器工具

**工具定义：**

```typescript
const serperSearchDefinition = toolDefinition({
  name: 'web_search',
  description: 'Search the web using Serper API and return relevant results',
  inputSchema: z.object({
    query: z.string().describe('The search query'),
    numResults: z.number().optional().default(10).describe('Number of results to return'),
    type: z.enum(['search', 'news', 'images']).optional().default('search').describe('Type of search'),
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
```

**示例：**

```typescript
import { createSerperSearch, createToolkit } from '@seashore/core'

const searchTool = createSerperSearch({
  apiKey: process.env.SERPER_API_KEY!,
})

const toolkit = createToolkit([searchTool])

// 与代理一起使用
import { createReActAgent } from '@seashore/agent'
import { createLLMAdapter } from '@seashore/core'

const agent = createReActAgent({
  model: createLLMAdapter({ provider: 'openai', apiKey: '...' })('gpt-4o'),
  systemPrompt: 'You are a helpful research assistant with web search capabilities.',
  tools: toolkit,
})

const response = await agent.run([
  { role: 'user', content: 'What are the latest developments in AI?' },
])
```

---

### SerperConfig

Serper 搜索工具的配置接口。

```typescript
interface SerperConfig {
  apiKey: string
  baseURL?: string
}
```

**属性：**
- `apiKey` (`string`)：Serper API 密钥（在 [serper.dev](https://serper.dev) 获取）
- `baseURL` (`string`，可选)：自定义基础 URL（默认为 `'https://google.serper.dev'`）

---

### createFirecrawlScrape

创建一个由 Firecrawl API 驱动的网页抓取工具。

```typescript
function createFirecrawlScrape(config: FirecrawlConfig): ServerTool
```

**参数：**
- `config` (`FirecrawlConfig`)：Firecrawl API 的配置

**返回值：**
- `ServerTool`：用于网页抓取的 TanStack AI 服务器工具

**工具定义：**

```typescript
const firecrawlScrapeDefinition = toolDefinition({
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
```

**示例：**

```typescript
import { createFirecrawlScrape, createToolkit } from '@seashore/core'

const scrapeTool = createFirecrawlScrape({
  apiKey: process.env.FIRECRAWL_API_KEY!,
})

const toolkit = createToolkit([scrapeTool])

// 与代理一起使用
import { createReActAgent } from '@seashore/agent'
import { createLLMAdapter } from '@seashore/core'

const agent = createReActAgent({
  model: createLLMAdapter({ provider: 'openai', apiKey: '...' })('gpt-4o'),
  systemPrompt: 'You are a helpful assistant that can scrape web pages.',
  tools: toolkit,
})

const response = await agent.run([
  { role: 'user', content: 'Scrape https://example.com and summarize it' },
])
```

---

### FirecrawlConfig

Firecrawl 抓取工具的配置接口。

```typescript
interface FirecrawlConfig {
  apiKey: string
  baseURL?: string
}
```

**属性：**
- `apiKey` (`string`)：Firecrawl API 密钥（在 [firecrawl.dev](https://firecrawl.dev) 获取）
- `baseURL` (`string`，可选)：自定义基础 URL（默认为 `'https://api.firecrawl.dev/v1'`）

---

## 上下文工程

### systemPrompt

创建一个用于构建结构化系统提示的构建器。

```typescript
function systemPrompt(): SystemPromptBuilder
```

**返回值：**
- `SystemPromptBuilder`：具有可链式调用方法的构建器

**SystemPromptBuilder 接口：**

```typescript
interface SystemPromptBuilder {
  role(description: string): SystemPromptBuilder
  instruction(text: string): SystemPromptBuilder
  constraint(text: string): SystemPromptBuilder
  example(example: { input: string; output: string }): SystemPromptBuilder
  outputFormat(format: 'json' | 'code' | 'markdown' | 'text', options?: { language?: string }): SystemPromptBuilder
  build(): string
}
```

**方法：**
- `role(description)`：设置 AI 的角色/人格
- `instruction(text)`：添加指令（可多次调用）
- `constraint(text)`：添加约束或规则（可多次调用）
- `example(example)`：添加输入/输出示例（可多次调用）
- `outputFormat(format, options?)`：指定所需的输出格式
- `build()`：生成最终提示字符串

**示例：**

```typescript
import { systemPrompt } from '@seashore/core'

// 基础提示
const prompt = systemPrompt()
  .role('You are an expert Python programmer')
  .instruction('Write clean, well-documented code')
  .instruction('Follow PEP 8 style guidelines')
  .constraint('Do not use deprecated libraries')
  .constraint('Always include type hints')
  .build()

// 带示例的提示
const translatorPrompt = systemPrompt()
  .role('You are a professional translator')
  .instruction('Translate the input text to French')
  .example({ input: 'Hello world', output: 'Bonjour le monde' })
  .example({ input: 'Good morning', output: 'Bonjour' })
  .outputFormat('text')
  .build()

// JSON 输出格式
const jsonPrompt = systemPrompt()
  .role('You are a data extraction assistant')
  .instruction('Extract structured data from the input')
  .outputFormat('json')
  .build()

// 代码输出格式
const codePrompt = systemPrompt()
  .role('You are a code generator')
  .instruction('Generate production-ready code')
  .outputFormat('code', { language: 'typescript' })
  .build()

// 与代理一起使用
import { createReActAgent } from '@seashore/agent'
import { createLLMAdapter } from '@seashore/core'

const agent = createReActAgent({
  model: createLLMAdapter({ provider: 'openai', apiKey: '...' })('gpt-4o'),
  systemPrompt: prompt,
  tools: [],
})
```

**输出格式选项：**
- `'json'`：指示模型仅以有效 JSON 格式响应
- `'code'`：指示模型以代码块响应（可选择指定语言）
- `'markdown'`：指示模型以 Markdown 格式响应
- `'text'`：指示模型以纯文本响应

---

### fewShotMessages

从少样本示例创建消息数组，用于上下文学习。

```typescript
function fewShotMessages(examples: FewShotExample[]): Message[]
```

**参数：**
- `examples` (`FewShotExample[]`)：示例交互数组

**返回值：**
- `Message[]`：用户/助手消息对数组

**类型：**

```typescript
interface FewShotExample {
  user: string
  assistant: string
}

interface Message {
  role: 'user' | 'assistant'
  content: string
}
```

**示例：**

```typescript
import { fewShotMessages } from '@seashore/core'
import { createReActAgent } from '@seashore/agent'
import { createLLMAdapter } from '@seashore/core'

const examples = fewShotMessages([
  {
    user: 'Translate "hello" to Spanish',
    assistant: 'Hola',
  },
  {
    user: 'Translate "goodbye" to Spanish',
    assistant: 'Adiós',
  },
  {
    user: 'Translate "thank you" to Spanish',
    assistant: 'Gracias',
  },
])

// 在代理中用作初始消息
const agent = createReActAgent({
  model: createLLMAdapter({ provider: 'openai', apiKey: '...' })('gpt-4o'),
  systemPrompt: 'You are a translation assistant',
  tools: [],
})

const response = await agent.run([
  ...examples,
  { role: 'user', content: 'Translate "good morning" to Spanish' },
])
// 预期：\"Buenos días\"

// 或者添加到现有对话之前
const conversation = [
  { role: 'user' as const, content: 'Translate "please" to Spanish' },
]

const responseWithExamples = await agent.run([
  ...examples,
  ...conversation,
])
```

---

## 完整使用示例

```typescript
import {
  createLLMAdapter,
  createEmbeddingAdapter,
  createToolkit,
  createSerperSearch,
  createFirecrawlScrape,
  systemPrompt,
  fewShotMessages,
} from '@seashore/core'

// 1. 创建 LLM 适配器
const llmAdapter = createLLMAdapter({
  provider: 'openai',
  apiKey: process.env.OPENAI_API_KEY!,
})

// 2. 创建嵌入适配器
const embedder = createEmbeddingAdapter({
  provider: 'openai',
  model: 'text-embedding-3-small',
  apiKey: process.env.OPENAI_API_KEY!,
})

// 3. 创建工具
const searchTool = createSerperSearch({
  apiKey: process.env.SERPER_API_KEY!,
})

const scrapeTool = createFirecrawlScrape({
  apiKey: process.env.FIRECRAWL_API_KEY!,
})

const toolkit = createToolkit([searchTool, scrapeTool])

// 4. 构建系统提示
const prompt = systemPrompt()
  .role('You are an expert research assistant')
  .instruction('Search the web for accurate, up-to-date information')
  .instruction('Cite your sources with URLs')
  .constraint('Only use verified information from reputable sources')
  .constraint('If unsure, say so rather than making up information')
  .outputFormat('markdown')
  .build()

// 5. 创建少样本示例
const examples = fewShotMessages([
  {
    user: 'What is the capital of France?',
    assistant: 'The capital of France is Paris. [Source: Wikipedia]',
  },
])

// 6. 与代理一起使用（参见 @seashore/agent 文档）
import { createReActAgent } from '@seashore/agent'

const agent = createReActAgent({
  model: llmAdapter('gpt-4o'),
  systemPrompt: prompt,
  tools: toolkit,
})

const response = await agent.run([
  ...examples,
  { role: 'user', content: 'Research the latest AI breakthroughs in 2026' },
])
```

---

## 类型导出

所有类型都导出供您的应用程序使用：

```typescript
import type {
  LLMAdapterConfig,
  LLMAdapterFactory,
  LLMProvider,
  EmbeddingConfig,
  EmbeddingAdapter,
  EmbeddingProvider,
  SerperConfig,
  FirecrawlConfig,
} from '@seashore/core'
```

---

## 错误处理

此包中的所有函数对于无效配置或 API 失败都会抛出错误：

```typescript
import { createLLMAdapter, createEmbeddingAdapter } from '@seashore/core'

try {
  const adapter = createLLMAdapter({
    provider: 'invalid' as any, // TypeScript 会捕获此错误
    apiKey: '...',
  })
} catch (error) {
  console.error('Unsupported provider:', error)
}

try {
  const embedder = createEmbeddingAdapter({
    provider: 'anthropic',
    model: 'any-model',
    apiKey: '...',
  })
  await embedder.embed('test')
} catch (error) {
  console.error('Anthropic does not offer an embedding API')
}
```

---

## 最佳实践

1. **安全存储 API 密钥**：永远不要硬编码 API 密钥。使用环境变量或密钥管理服务。

2. **选择合适的模型**：使用更小、更快的模型（如 `gpt-4o-mini`）进行开发和测试，使用更大的模型（如 `gpt-4o`）用于生产。

3. **批量嵌入**：生成多个嵌入时，将数组传递给 `embed()` 而不是多次调用它。

4. **重用适配器**：创建一次适配器并在整个应用程序中重用它们。

5. **结构化提示**：使用 `systemPrompt()` 构建器构建复杂提示以保持一致性。

6. **提供示例**：使用 `fewShotMessages()` 提高特定任务的模型准确性。

7. **错误处理**：始终将 API 调用包装在 try/catch 块中，以优雅地处理速率限制和网络错误。
