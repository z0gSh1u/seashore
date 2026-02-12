# 上下文管理

**上下文管理**是精心制作有效提示词和管理对话状态以从 LLM 获得最佳结果的艺术。Seashore 提供了用于**系统提示**、**少样本学习**和**对话管理**的实用工具。

## 概述

有效的上下文管理对 Agent 性能至关重要：

```
┌────────────────────────────────────────────┐
│           Context Window (128K)            │
├────────────────────────────────────────────┤
│ System Prompt (role, instructions)         │ ← Agent 是谁？
├────────────────────────────────────────────┤
│ Few-Shot Examples (input/output pairs)     │ ← 应该如何表现？
├────────────────────────────────────────────┤
│ Conversation History (past messages)       │ ← 讨论了什么？
├────────────────────────────────────────────┤
│ Retrieved Context (RAG documents)          │ ← 什么知识是相关的？
├────────────────────────────────────────────┤
│ Current User Query                         │ ← 用户现在想要什么？
└────────────────────────────────────────────┘
```

**核心概念：**
- **系统提示** - 定义 Agent 行为和能力
- **少样本学习** - 通过示例教学
- **对话历史** - 跨轮次维护上下文
- **上下文窗口** - 管理 token 限制

---

## 系统提示

系统提示定义了你的 Agent **是谁**以及**如何**表现。

### 基础系统提示

```typescript
import { createReActAgent } from '@seashore/agent'

const agent = createReActAgent({
  model: () => llm('gpt-4o'),
  systemPrompt: 'You are a helpful assistant.',
  tools: [],
})
```

### 结构化系统提示构建器

Seashore 提供了用于复杂系统提示的流式构建器：

```typescript
import { systemPrompt } from '@seashore/core'

const prompt = systemPrompt()
  .role('You are an expert software engineer specializing in TypeScript and React.')
  .instruction('Always provide type-safe code examples')
  .instruction('Explain your reasoning before providing solutions')
  .instruction('Cite relevant documentation when available')
  .constraint('Keep responses concise (under 500 words)')
  .constraint('Never provide code without explaining it')
  .constraint('Always use modern TypeScript syntax (no var, use const/let)')
  .example({
    input: 'How do I create a React component?',
    output: 'Here\'s a type-safe functional component:\n\n```typescript\ninterface Props {\n  name: string\n}\n\nconst Greeting: React.FC<Props> = ({ name }) => {\n  return <h1>Hello, {name}!</h1>\n}\n```'
  })
  .outputFormat('code', { language: 'typescript' })
  .build()

const agent = createReActAgent({
  model: () => llm('gpt-4o'),
  systemPrompt: prompt,
  tools: [searchTool],
})
```

### 系统提示组件

#### 1. 角色定义

定义 Agent **是谁**：

```typescript
const prompt = systemPrompt()
  .role('You are a customer support agent for Acme Corp.')
  .build()
```

**示例：**
- "You are a helpful coding assistant"
- "You are an expert data scientist"
- "You are a professional translator"
- "You are a research assistant specializing in AI"

#### 2. 指令

定义 Agent **应该做什么**：

```typescript
const prompt = systemPrompt()
  .role('You are a helpful assistant.')
  .instruction('Always search the knowledge base before answering')
  .instruction('Provide sources for all factual claims')
  .instruction('If unsure, admit uncertainty and suggest how to find the answer')
  .build()
```

#### 3. 约束

定义 Agent **不应该做什么**：

```typescript
const prompt = systemPrompt()
  .role('You are a safe assistant.')
  .constraint('Never provide medical advice')
  .constraint('Do not share personal information')
  .constraint('Refuse requests for harmful content')
  .constraint('Keep responses under 300 words')
  .build()
```

#### 4. 示例

展示 Agent **应该如何**表现：

```typescript
const prompt = systemPrompt()
  .role('You are a helpful assistant.')
  .example({
    input: 'What is 2+2?',
    output: 'The answer is 4.'
  })
  .example({
    input: 'What is the weather?',
    output: 'I don\'t have access to real-time weather data. Please use the get_weather tool or check a weather website.'
  })
  .build()
```

#### 5. 输出格式

定义响应**应该如何**格式化：

```typescript
// JSON 格式
const jsonPrompt = systemPrompt()
  .role('You extract structured data.')
  .outputFormat('json')
  .build()
// "Respond with valid JSON only. Do not include any other text."

// 代码格式
const codePrompt = systemPrompt()
  .role('You are a code generator.')
  .outputFormat('code', { language: 'python' })
  .build()
// "Respond with ONLY a python code block. Do not include explanations."

// Markdown 格式
const mdPrompt = systemPrompt()
  .role('You write documentation.')
  .outputFormat('markdown')
  .build()
// "Respond in Markdown format."
```

---

## 少样本学习

**少样本学习**通过提供示例输入/输出对来教 Agent。

### 基础少样本

```typescript
import { fewShotMessages } from '@seashore/core'

const examples = fewShotMessages([
  {
    user: 'Extract the name from: John Smith, 30 years old',
    assistant: '{"name": "John Smith"}'
  },
  {
    user: 'Extract the name from: Age 25, Alice Johnson',
    assistant: '{"name": "Alice Johnson"}'
  }
])

const agent = createReActAgent({
  model: () => llm('gpt-4o'),
  systemPrompt: 'Extract names from text as JSON.',
  tools: [],
})

// 在对话前添加示例
const response = await agent.run([
  ...examples,
  { role: 'user', content: 'Extract the name from: Bob Williams, software engineer' }
])

console.log(response.result.content)  // {"name": "Bob Williams"}
```

### 工具使用的少样本

教 Agent 何时以及如何使用工具：

```typescript
const toolExamples = fewShotMessages([
  {
    user: 'What is the weather in Tokyo?',
    assistant: 'I\'ll check the weather for you. [Calls get_weather tool with location="Tokyo"]'
  },
  {
    user: 'Tell me about machine learning',
    assistant: 'I\'ll search for information. [Calls search tool with query="machine learning"]'
  }
])

const agent = createReActAgent({
  model: () => llm('gpt-4o'),
  systemPrompt: 'You are helpful. Use tools when needed.',
  tools: [weatherTool, searchTool],
})

const response = await agent.run([
  ...toolExamples,
  { role: 'user', content: 'What is the weather in London?' }
])
```

### 格式化的少样本

教特定输出格式：

```typescript
const formatExamples = fewShotMessages([
  {
    user: 'Summarize: Seashore is a framework for building AI agents',
    assistant: '**Summary**: Agent framework\n**Key Points**:\n- AI agent development\n- Framework-based approach'
  },
  {
    user: 'Summarize: React is a JavaScript library for building user interfaces',
    assistant: '**Summary**: UI library\n**Key Points**:\n- JavaScript-based\n- User interface development'
  }
])
```

---

## 对话管理

### 消息类型

```typescript
interface Message {
  role: 'user' | 'assistant' | 'system'
  content: string
}
```

### 构建对话

```typescript
const messages: Message[] = [
  { role: 'system', content: 'You are helpful.' },
  { role: 'user', content: 'Hi!' },
  { role: 'assistant', content: 'Hello! How can I help?' },
  { role: 'user', content: 'What is TypeScript?' },
]

const response = await agent.run(messages)
```

### 对话状态管理

```typescript
class ChatSession {
  private messages: Message[] = []
  
  constructor(
    private agent: ReActAgent,
    systemPrompt: string
  ) {
    this.messages.push({
      role: 'system',
      content: systemPrompt
    })
  }
  
  async send(userMessage: string): Promise<string> {
    // 添加用户消息
    this.messages.push({
      role: 'user',
      content: userMessage
    })
    
    // 获取 Agent 响应
    const response = await this.agent.run(this.messages)
    
    // 添加助手响应
    this.messages.push({
      role: 'assistant',
      content: response.result.content
    })
    
    return response.result.content
  }
  
  getHistory(): Message[] {
    return this.messages
  }
  
  reset() {
    const systemMsg = this.messages[0]
    this.messages = systemMsg ? [systemMsg] : []
  }
}

// 使用
const session = new ChatSession(agent, 'You are helpful.')
await session.send('Hello!')
await session.send('What is 2+2?')
console.log(session.getHistory())
```

---

## 上下文窗口管理

### Token 限制

不同模型有不同的上下文窗口：

| 提供商 | 模型 | 上下文窗口 |
|----------|-------|----------------|
| OpenAI | GPT-4o | 128K tokens |
| OpenAI | GPT-4o-mini | 128K tokens |
| Anthropic | Claude 3.7 Sonnet | 200K tokens |
| Google | Gemini 1.5 Pro | 2M tokens |

### 估算 Tokens

粗略估算：1 token ≈ 4 个字符

```typescript
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

const prompt = 'You are a helpful assistant...'
console.log(estimateTokens(prompt))  // ~8 tokens
```

### 截断对话

仅保留最近的消息：

```typescript
function truncateConversation(
  messages: Message[],
  maxTokens: number
): Message[] {
  let totalTokens = 0
  const truncated: Message[] = []
  
  // 保留系统消息
  const systemMsg = messages.find(m => m.role === 'system')
  if (systemMsg) {
    truncated.push(systemMsg)
    totalTokens += estimateTokens(systemMsg.content)
  }
  
  // 保留最近的消息（逆序）
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i]!
    if (msg.role === 'system') continue
    
    const tokens = estimateTokens(msg.content)
    if (totalTokens + tokens > maxTokens) break
    
    truncated.unshift(msg)
    totalTokens += tokens
  }
  
  return truncated
}

// 使用
const truncated = truncateConversation(messages, 4000)
```

### 滑动窗口

保留固定数量的最近消息：

```typescript
function slidingWindow(
  messages: Message[],
  windowSize: number
): Message[] {
  const systemMsg = messages.find(m => m.role === 'system')
  const conversationMsgs = messages.filter(m => m.role !== 'system')
  
  const windowed = conversationMsgs.slice(-windowSize)
  
  return systemMsg ? [systemMsg, ...windowed] : windowed
}

// 保留最后 10 条消息
const windowed = slidingWindow(messages, 10)
```

### 总结旧上下文

通过摘要压缩旧消息：

```typescript
async function summarizeOldContext(
  messages: Message[],
  summaryAgent: ReActAgent
): Promise<Message[]> {
  const systemMsg = messages.find(m => m.role === 'system')
  const oldMessages = messages.slice(1, -10)  // 除最后 10 条外的所有消息
  const recentMessages = messages.slice(-10)  // 最后 10 条
  
  if (oldMessages.length === 0) {
    return messages
  }
  
  // 总结旧上下文
  const summary = await summaryAgent.run([
    {
      role: 'user',
      content: `Summarize this conversation:\n\n${
        oldMessages.map(m => `${m.role}: ${m.content}`).join('\n')
      }`
    }
  ])
  
  // 构建新上下文
  return [
    systemMsg!,
    {
      role: 'system',
      content: `Previous conversation summary: ${summary.result.content}`
    },
    ...recentMessages
  ]
}
```

---

## 最佳实践

### 1. 清晰的角色定义

```typescript
// ❌ 不好：模糊的角色
'You are helpful.'

// ✅ 好：具体的角色
'You are a technical support agent for Acme Software. You help users troubleshoot issues with our product. You have access to our knowledge base and ticket system.'
```

### 2. 明确的指令

```typescript
// ❌ 不好：隐含期望
'Answer questions.'

// ✅ 好：明确的指令
`When answering questions:
1. Search the knowledge base first
2. Provide step-by-step instructions
3. Include relevant links
4. Ask clarifying questions if needed
5. Escalate to human if issue is complex`
```

### 3. 使用约束

```typescript
const prompt = systemPrompt()
  .role('You are a coding assistant.')
  .constraint('Never execute code in production environments')
  .constraint('Always warn about security implications')
  .constraint('Refuse requests for malicious code')
  .build()
```

### 4. 提供示例

```typescript
// ✅ 好：展示期望的行为
const examples = fewShotMessages([
  {
    user: 'How do I install this?',
    assistant: 'Let me search the installation docs. [Calls search_docs]'
  },
  {
    user: 'Reset my password',
    assistant: 'I can help! Please click the "Forgot Password" link and check your email.'
  }
])
```

### 5. 管理上下文窗口

```typescript
// 发送前检查 token 数量
const totalTokens = messages.reduce(
  (sum, m) => sum + estimateTokens(m.content),
  0
)

if (totalTokens > 100000) {
  messages = truncateConversation(messages, 100000)
}
```

---

## 高级模式

### 动态系统提示

根据上下文调整提示：

```typescript
function buildDynamicPrompt(user: User, context: Context): string {
  const builder = systemPrompt()
    .role('You are a helpful assistant.')
  
  if (user.isPremium) {
    builder
      .instruction('Provide detailed, in-depth responses')
      .instruction('Use all available tools')
  } else {
    builder
      .instruction('Keep responses concise')
      .constraint('Limit to 3 tool calls per query')
  }
  
  if (context.language !== 'en') {
    builder.instruction(`Respond in ${context.language}`)
  }
  
  return builder.build()
}
```

### 角色切换

在对话中途改变 Agent 个性：

```typescript
let currentPersona = 'helpful'

const personas = {
  helpful: systemPrompt()
    .role('You are a friendly, helpful assistant.')
    .build(),
  
  technical: systemPrompt()
    .role('You are a technical expert who provides precise, detailed answers.')
    .build(),
  
  concise: systemPrompt()
    .role('You provide brief, to-the-point answers.')
    .build(),
}

function switchPersona(persona: keyof typeof personas) {
  currentPersona = persona
  // 更新对话中的系统消息
  messages[0] = {
    role: 'system',
    content: personas[persona]
  }
}
```

### 分层上下文

按优先级组织上下文：

```typescript
interface HierarchicalContext {
  systemPrompt: string
  globalContext: string  // 始终包含
  sessionContext: string  // 特定于会话
  recentContext: Message[]  // 最近的对话
}

function buildHierarchicalMessages(ctx: HierarchicalContext): Message[] {
  return [
    { role: 'system', content: ctx.systemPrompt },
    { role: 'system', content: `Global context: ${ctx.globalContext}` },
    { role: 'system', content: `Session context: ${ctx.sessionContext}` },
    ...ctx.recentContext
  ]
}
```

### 上下文注入

动态注入相关上下文：

```typescript
async function chatWithContextInjection(
  userQuery: string,
  rag: RAGPipeline
): Promise<string> {
  // 检索相关上下文
  const relevantDocs = await rag.retrieve(userQuery)
  
  // 构建上下文字符串
  const context = relevantDocs
    .map(d => d.content)
    .join('\n\n---\n\n')
  
  // 将上下文注入系统提示
  const systemPrompt = `You are a helpful assistant.
  
Use the following context to answer questions:

${context}

Always cite which part of the context you used.`
  
  // 使用注入的上下文运行 Agent
  const response = await agent.run([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userQuery }
  ])
  
  return response.result.content
}
```

---

## 常见陷阱

### 1. 过长的系统提示

```typescript
// ❌ 不好：5000 字的系统提示
const prompt = `You are an assistant. Here are 500 rules...`

// ✅ 好：简洁、聚焦的提示
const prompt = systemPrompt()
  .role('You are an assistant.')
  .instruction('Follow company guidelines')
  .constraint('Keep responses under 500 words')
  .build()
```

### 2. 冲突的指令

```typescript
// ❌ 不好：矛盾的指令
.instruction('Be very detailed')
.constraint('Keep responses under 50 words')

// ✅ 好：一致的指令
.instruction('Be concise but complete')
.constraint('Aim for 100-200 words')
```

### 3. 忽略 Token 限制

```typescript
// ❌ 不好：无限制的对话
messages.push(newMessage)  // 永远增长

// ✅ 好：受管理的对话
if (estimateTokens(messages) > MAX_TOKENS) {
  messages = truncateConversation(messages, MAX_TOKENS)
}
messages.push(newMessage)
```

### 4. 没有少样本示例

```typescript
// ❌ 不好：期望特定格式但没有示例
systemPrompt: 'Return JSON'

// ✅ 好：展示期望的格式
const examples = fewShotMessages([
  {
    user: 'Extract data',
    assistant: '{"name": "John", "age": 30}'
  }
])
```

---

## 测试上下文

### 单元测试

```typescript
import { describe, it, expect } from 'vitest'
import { systemPrompt } from '@seashore/core'

describe('System Prompt Builder', () => {
  it('should build prompt with all components', () => {
    const prompt = systemPrompt()
      .role('You are helpful.')
      .instruction('Be concise')
      .constraint('No harmful content')
      .build()
    
    expect(prompt).toContain('You are helpful.')
    expect(prompt).toContain('Be concise')
    expect(prompt).toContain('No harmful content')
  })
})
```

### 测试少样本

```typescript
import { fewShotMessages } from '@seashore/core'

describe('Few-Shot Messages', () => {
  it('should create alternating user/assistant messages', () => {
    const examples = fewShotMessages([
      { user: 'Hi', assistant: 'Hello' },
      { user: 'Bye', assistant: 'Goodbye' }
    ])
    
    expect(examples).toHaveLength(4)
    expect(examples[0]?.role).toBe('user')
    expect(examples[1]?.role).toBe('assistant')
  })
})
```

---

## 相关概念

- **[Agents](./agents.md)** - 在 ReAct Agent 中使用上下文
- **[RAG](./rag.md)** - 注入检索到的上下文
- **[LLM 适配器](./llm-adapters.md)** - 特定于模型的上下文策略

---

## 下一步

- **[构建你的第一个 Agent](../getting-started/first-agent.md)**
- **[提示工程指南](../guides/prompt-engineering.md)**
- **[上下文示例](../../examples/context/)**
