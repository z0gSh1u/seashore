# Agents

**ReAct agents** 是能够**推理**任务并使用工具**行动**以完成目标的智能角色。它们通过观察-行动循环进行迭代,直到完成任务或达到最大迭代次数。

## 概览

Seashore 实现了 **ReAct (推理 + 行动)** 模式,其中 agents:

1. **推理** - 分析用户请求和当前上下文
2. **行动** - 调用工具来收集信息或执行操作
3. **观察** - 处理工具结果并更新理解
4. **重复** - 继续直到任务完成或达到最大迭代次数

```
┌──────────────────────────────────────────────────────────┐
│                     User Query                           │
└─────────────────────┬────────────────────────────────────┘
                      │
                      ▼
         ┌────────────────────────┐
         │   System Prompt +      │
         │   Conversation History │
         └────────┬───────────────┘
                  │
                  ▼
         ┌────────────────────────┐
         │   LLM Reasoning        │────────┐
         │   (What should I do?)  │        │
         └────────┬───────────────┘        │
                  │                        │
                  ▼                        │
         ┌────────────────────────┐        │
         │   Tool Selection       │        │ Iteration
         │   (Choose action)      │        │ Loop
         └────────┬───────────────┘        │
                  │                        │
                  ▼                        │
         ┌────────────────────────┐        │
         │   Tool Execution       │        │
         │   (Perform action)     │        │
         └────────┬───────────────┘        │
                  │                        │
                  ▼                        │
         ┌────────────────────────┐        │
         │   Observation          │────────┘
         │   (Process results)    │
         └────────┬───────────────┘
                  │
                  ▼
         ┌────────────────────────┐
         │   Final Response       │
         └────────────────────────┘
```

---

## 创建 ReAct Agent

### 基础 Agent

```typescript
import { createReActAgent } from '@seashore/agent'
import { createLLMAdapter } from '@seashore/core'
import { z } from 'zod'

// 1. 创建 LLM 适配器
const llm = createLLMAdapter({
  provider: 'openai',
  apiKey: process.env.OPENAI_API_KEY!,
})

// 2. 定义工具
const searchTool = {
  name: 'search',
  description: 'Search the web for information',
  parameters: z.object({
    query: z.string().describe('Search query'),
  }),
  execute: async ({ query }) => {
    // 调用搜索 API
    return { results: [...] }
  },
}

// 3. 创建 agent
const agent = createReActAgent({
  model: () => llm('gpt-4o'),
  systemPrompt: 'You are a helpful research assistant.',
  tools: [searchTool],
  maxIterations: 5,
})

// 4. 运行 agent
const response = await agent.run([
  { role: 'user', content: 'What is the capital of France?' }
])

console.log(response.result.content)
// "The capital of France is Paris."
```

---

## Agent 配置

### ReActAgentConfig

```typescript
interface ReActAgentConfig {
  /** 返回 TanStack AI 模型的模型函数 */
  model: () => any

  /** 定义 agent 行为的系统提示词 */
  systemPrompt: string

  /** Agent 可用的工具 */
  tools?: Tool[]

  /** 停止前的最大迭代次数 (默认: 10) */
  maxIterations?: number

  /** 用于过滤请求/响应的护栏 */
  guardrails?: Guardrail[]

  /** 结构化响应的输出 schema */
  outputSchema?: z.ZodType<any>
}
```

### 配置示例

**使用多个工具:**
```typescript
const agent = createReActAgent({
  model: () => llm('gpt-4o'),
  systemPrompt: 'You are a helpful assistant.',
  tools: [searchTool, calculatorTool, weatherTool],
  maxIterations: 10,
})
```

**使用护栏:**
```typescript
import { createGuardrail } from '@seashore/platform'

const moderationGuardrail = createGuardrail({
  beforeRequest: async (messages) => {
    // 过滤有害内容
    return messages.filter(m => !containsHarmful(m.content))
  },
  afterResponse: async (result) => {
    // 验证响应
    if (containsSensitiveInfo(result.content)) {
      return { ...result, content: '[REDACTED]' }
    }
    return result
  },
})

const agent = createReActAgent({
  model: () => llm('gpt-4o'),
  systemPrompt: 'You are a safe assistant.',
  tools: [searchTool],
  guardrails: [moderationGuardrail],
})
```

**使用结构化输出:**
```typescript
const outputSchema = z.object({
  answer: z.string(),
  confidence: z.number().min(0).max(1),
  sources: z.array(z.string()),
})

const agent = createReActAgent({
  model: () => llm('gpt-4o'),
  systemPrompt: 'Provide answers with sources.',
  tools: [searchTool],
  outputSchema,
})

const response = await agent.run([
  { role: 'user', content: 'Who invented the telephone?' }
])

// response.result 是类型安全的
console.log(response.result.answer)      // "Alexander Graham Bell"
console.log(response.result.confidence)  // 0.95
console.log(response.result.sources)     // ["https://..."]
```

---

## 消息流

### 消息类型

```typescript
interface Message {
  role: 'user' | 'assistant' | 'system'
  content: string
}
```

**角色:**
- `system` - Agent 的指令(自动注入)
- `user` - 用户输入或问题
- `assistant` - Agent 响应

### 对话历史

Agents 接受消息数组,维护对话上下文:

```typescript
const messages: Message[] = [
  { role: 'user', content: 'What is 2+2?' },
]

const response1 = await agent.run(messages)
console.log(response1.result.content)  // "4"

// 继续对话
messages.push(
  { role: 'assistant', content: response1.result.content },
  { role: 'user', content: 'What about 5+5?' }
)

const response2 = await agent.run(messages)
console.log(response2.result.content)  // "10"
```

### 消息转换

**系统提示词注入:**
```typescript
// 用户提供:
[
  { role: 'user', content: 'Hello!' }
]

// Agent 内部发送:
[
  { role: 'system', content: 'You are a helpful assistant.' },
  { role: 'user', content: 'Hello!' }
]
```

**工具调用消息:**
```typescript
// 当 agent 调用工具时:
[
  { role: 'system', content: '...' },
  { role: 'user', content: 'Search for cats' },
  { role: 'assistant', content: '', toolCalls: [{...}] },
  { role: 'tool', content: 'Search results: ...' },
  { role: 'assistant', content: 'I found information about cats...' }
]
```

---

## 工具调用

### 工具接口

```typescript
interface Tool {
  name: string
  description: string
  parameters: z.ZodType<any>
  execute: (args: any) => Promise<any> | any
}
```

### 工具执行流程

1. **Agent 决定** 基于推理调用工具
2. **LLM 生成** 带有结构化参数的工具调用
3. **Seashore 验证** 根据 Zod schema 验证参数
4. **工具执行** 并返回结果
5. **Agent 观察** 结果并继续推理

```typescript
// 工具定义
const weatherTool = {
  name: 'get_weather',
  description: 'Get current weather for a location',
  parameters: z.object({
    location: z.string(),
    units: z.enum(['celsius', 'fahrenheit']).default('celsius'),
  }),
  execute: async ({ location, units }) => {
    const response = await fetch(`/api/weather?location=${location}`)
    const data = await response.json()
    return `${data.temp}°${units === 'celsius' ? 'C' : 'F'}, ${data.condition}`
  },
}

// 工具调用示例
const response = await agent.run([
  { role: 'user', content: 'What is the weather in Tokyo?' }
])

// Agent 内部:
// 1. 决定调用 get_weather
// 2. 生成: { location: 'Tokyo', units: 'celsius' }
// 3. 执行: weatherTool.execute({ location: 'Tokyo', units: 'celsius' })
// 4. 观察: "22°C, sunny"
// 5. 响应: "The weather in Tokyo is currently 22°C and sunny."
```

### 多个工具调用

Agents 可以进行多次顺序工具调用:

```typescript
const response = await agent.run([
  { role: 'user', content: 'Compare weather in Tokyo and London' }
])

// Agent 执行:
// 迭代 1: 调用 get_weather({ location: 'Tokyo' })
// 迭代 2: 调用 get_weather({ location: 'London' })
// 迭代 3: 综合比较响应
```

### 工具调用检查

```typescript
const response = await agent.run(messages)

// 检查进行的工具调用
response.result.toolCalls.forEach(call => {
  console.log(`Tool: ${call.name}`)
  console.log(`Arguments: ${JSON.stringify(call.arguments)}`)
})
```

---

## 迭代管理

### 最大迭代次数

Agents 在达到 `maxIterations` 后停止,以防止无限循环:

```typescript
const agent = createReActAgent({
  model: () => llm('gpt-4o'),
  systemPrompt: 'You are helpful.',
  tools: [complexTool],
  maxIterations: 3,  // 3 次工具调用后停止
})
```

**迭代示例:**

```typescript
// 简单查询 (1 次迭代)
await agent.run([
  { role: 'user', content: 'What is 2+2?' }
])
// 迭代: 1 (直接回答,无工具)

// 单个工具调用 (2 次迭代)
await agent.run([
  { role: 'user', content: 'Search for cats' }
])
// 迭代 1: 调用搜索工具
// 迭代 2: 综合响应

// 多个工具调用 (4 次迭代)
await agent.run([
  { role: 'user', content: 'Compare prices of iPhone in US and UK' }
])
// 迭代 1: 调用 price_lookup({ product: 'iPhone', country: 'US' })
// 迭代 2: 调用 price_lookup({ product: 'iPhone', country: 'UK' })
// 迭代 3: 调用 currency_convert({ from: 'GBP', to: 'USD' })
// 迭代 4: 综合比较响应
```

### TanStack AI 集成

Seashore 使用 TanStack AI 的 `maxSteps`:

```typescript
import { chat, maxIterations } from '@tanstack/ai'

// 内部实现
const response = await chat({
  model: model(),
  messages: [...],
  maxSteps: maxIterations(config.maxIterations),
  tools: config.tools,
})
```

---

## 运行 Agents

### 同步执行

```typescript
const response = await agent.run(messages, options?)
```

**返回 `AgentResponse`:**
```typescript
interface AgentResponse {
  messages: Message[]       // 完整对话,包括工具调用
  result: AgentResult       // 最终结果
}

interface AgentResult {
  content: string           // Agent 的响应文本
  toolCalls: ToolCall[]     // 所有进行的工具调用
}
```

**示例:**
```typescript
const response = await agent.run([
  { role: 'user', content: 'What is the weather in Paris?' }
])

console.log(response.result.content)
// "The current weather in Paris is 18°C and cloudy."

console.log(response.messages.length)
// 4 (system + user + tool call + final response)

console.log(response.result.toolCalls.length)
// 1 (get_weather was called once)
```

### 流式执行

```typescript
const response = await agent.stream(messages, options?)
```

**返回 `StreamingAgentResponse`:**
```typescript
interface StreamingAgentResponse extends AgentResponse {
  stream: AsyncIterable<any>  // Token stream
}
```

**示例:**
```typescript
const response = await agent.stream([
  { role: 'user', content: 'Tell me about Seashore' }
])

// 实时流式传输 tokens
for await (const chunk of response.stream) {
  process.stdout.write(chunk.content)
}

// 流式传输完成后
console.log(response.result.content)  // 完整响应
console.log(response.messages)        // 完整历史
```

### 运行选项

```typescript
interface RunOptions {
  abortSignal?: AbortSignal
}
```

**中止执行:**
```typescript
const controller = new AbortController()

// 启动 agent
const promise = agent.run(messages, {
  abortSignal: controller.signal
})

// 5 秒后中止
setTimeout(() => controller.abort(), 5000)

try {
  await promise
} catch (err) {
  console.error('Agent aborted:', err)
}
```

---

## 护栏

护栏为 agent 输入和输出提供**安全和过滤**。

### 护栏接口

```typescript
interface Guardrail {
  beforeRequest?: BeforeRequestHook
  afterResponse?: AfterResponseHook
}

type BeforeRequestHook = (messages: Message[]) => Message[] | Promise<Message[]>
type AfterResponseHook = (result: AgentResult) => AgentResult | Promise<AgentResult>
```

### 请求前钩子

在发送到 LLM **之前**过滤或修改消息:

```typescript
const filterGuardrail: Guardrail = {
  beforeRequest: async (messages) => {
    return messages.map(msg => ({
      ...msg,
      content: msg.content.replace(/\[REDACTED\]/g, '***')
    }))
  }
}
```

### 响应后钩子

在从 LLM 接收**之后**过滤或修改结果:

```typescript
const moderationGuardrail: Guardrail = {
  afterResponse: async (result) => {
    if (containsProfanity(result.content)) {
      return {
        ...result,
        content: 'I cannot provide that information.'
      }
    }
    return result
  }
}
```

### 多个护栏

护栏按顺序应用:

```typescript
const agent = createReActAgent({
  model: () => llm('gpt-4o'),
  systemPrompt: 'You are helpful.',
  guardrails: [
    piiFilterGuardrail,      // 第 1: 移除 PII
    moderationGuardrail,     // 第 2: 检查内容安全
    complianceGuardrail,     // 第 3: 确保合规
  ],
})
```

### 基于 LLM 的护栏

使用 LLM 验证内容:

```typescript
import { createLLMGuardrail } from '@seashore/platform'

const safetyGuardrail = createLLMGuardrail({
  model: () => llm('gpt-4o-mini'),
  prompt: 'Is this content safe? Reply YES or NO.',
  onBlock: (messages) => {
    throw new Error('Content blocked by safety filter')
  }
})

const agent = createReActAgent({
  model: () => llm('gpt-4o'),
  systemPrompt: 'You are helpful.',
  guardrails: [safetyGuardrail],
})
```

---

## 高级模式

### 多轮对话

构建有状态的聊天应用:

```typescript
class ChatSession {
  private messages: Message[] = []

  constructor(private agent: ReActAgent) {}

  async send(userMessage: string): Promise<string> {
    this.messages.push({
      role: 'user',
      content: userMessage
    })

    const response = await this.agent.run(this.messages)

    this.messages.push({
      role: 'assistant',
      content: response.result.content
    })

    return response.result.content
  }

  reset() {
    this.messages = []
  }
}

// 用法
const session = new ChatSession(agent)
await session.send('Hello!')
await session.send('What is the weather?')
await session.send('Thanks!')
session.reset()
```

### Agent 组合

链接多个专业化 agents:

```typescript
const researchAgent = createReActAgent({
  model: () => llm('gpt-4o'),
  systemPrompt: 'You are a research assistant.',
  tools: [searchTool, wikipediaTool],
})

const writingAgent = createReActAgent({
  model: () => llm('gpt-4o'),
  systemPrompt: 'You are a technical writer.',
  tools: [],
})

async function researchAndWrite(topic: string): Promise<string> {
  // 研究阶段
  const research = await researchAgent.run([
    { role: 'user', content: `Research ${topic}` }
  ])

  // 写作阶段
  const article = await writingAgent.run([
    { role: 'user', content: `Write an article based on: ${research.result.content}` }
  ])

  return article.result.content
}
```

### 动态工具选择

根据上下文提供不同的工具:

```typescript
function createContextualAgent(userRole: 'admin' | 'user') {
  const tools = [searchTool]

  if (userRole === 'admin') {
    tools.push(deleteUserTool, modifySettingsTool)
  }

  return createReActAgent({
    model: () => llm('gpt-4o'),
    systemPrompt: `You are an assistant for ${userRole}s.`,
    tools,
  })
}

const adminAgent = createContextualAgent('admin')
const userAgent = createContextualAgent('user')
```

### 错误处理

```typescript
try {
  const response = await agent.run(messages)
  console.log(response.result.content)
} catch (error) {
  if (error.name === 'AbortError') {
    console.log('Agent execution was cancelled')
  } else if (error.message.includes('max iterations')) {
    console.log('Agent exceeded maximum iterations')
  } else {
    console.error('Agent error:', error)
  }
}
```

---

## 最佳实践

### 1. 清晰的系统提示词

```typescript
// ❌ 不好: 模糊的提示词
systemPrompt: 'You are helpful.'

// ✅ 好: 具体的指令
systemPrompt: `You are a customer support assistant for Acme Corp.

When answering:
- Be polite and professional
- Use search tool to find accurate information
- If you cannot help, escalate to human support
- Always verify user identity before sharing sensitive data`
```

### 2. 描述性的工具名称

```typescript
// ❌ 不好: 通用名称
name: 'search'

// ✅ 好: 具体名称
name: 'search_company_knowledge_base'
```

### 3. 详细的工具描述

```typescript
// ❌ 不好: 最小化描述
description: 'Search'

// ✅ 好: 清晰的描述
description: 'Search the company knowledge base for articles, policies, and FAQs. Use when user asks about company procedures or policies.'
```

### 4. 适当的最大迭代次数

```typescript
// 简单问答 agent
maxIterations: 3

// 研究 agent 具有多个工具
maxIterations: 10

// 复杂工作流 agent
maxIterations: 20
```

### 5. 验证工具结果

```typescript
const searchTool = {
  name: 'search',
  description: 'Search the web',
  parameters: z.object({ query: z.string() }),
  execute: async ({ query }) => {
    try {
      const results = await fetch(`/api/search?q=${query}`)
      const data = await results.json()

      if (!data.results || data.results.length === 0) {
        return 'No results found. Try a different query.'
      }

      return data.results
    } catch (error) {
      return 'Search service is temporarily unavailable.'
    }
  }
}
```

### 6. 监控工具使用

```typescript
const agent = createReActAgent({
  model: () => llm('gpt-4o'),
  systemPrompt: 'You are helpful.',
  tools: [searchTool],
})

const response = await agent.run(messages)

// 记录工具使用以进行监控
console.log('Tools used:', response.result.toolCalls.length)
response.result.toolCalls.forEach(call => {
  console.log(`- ${call.name}:`, call.arguments)
})
```

---

## 常见陷阱

### 1. 无限循环

**问题:** Agent 持续调用工具而没有取得进展。

**解决方案:** 设置适当的 `maxIterations` 并确保工具返回有用的结果。

### 2. 工具结果过载

**问题:** 工具返回太多数据,压垮上下文窗口。

**解决方案:** 总结或截断工具结果。

```typescript
execute: async ({ query }) => {
  const results = await search(query)
  // 截断到前 3 个结果
  return results.slice(0, 3).map(r => ({
    title: r.title,
    snippet: r.snippet.slice(0, 200)
  }))
}
```

### 3. 模糊的工具描述

**问题:** Agent 因为描述重叠而使用错误的工具。

**解决方案:** 使工具描述具体且不重叠。

### 4. 忽略工具错误

**问题:** 工具静默失败,agent 继续使用错误数据。

**解决方案:** 返回引导 agent 的错误消息。

```typescript
execute: async ({ userId }) => {
  try {
    return await database.getUser(userId)
  } catch (error) {
    return `Error: User ${userId} not found. Ask user to verify ID.`
  }
}
```

---

## 相关概念

- **[Workflows](./workflows.md)** - 在 DAG 中编排多个 agents
- **[Tools](./tools.md)** - 深入学习工具创建
- **[Context](./context.md)** - 优化系统提示词
- **[Guardrails](../guides/guardrails.md)** - 高级安全模式

---

## 下一步

- **[构建你的第一个 Agent](../getting-started/first-agent.md)**
- **[工具创建指南](./tools.md)**
- **[Agent 示例](../../examples/)**
