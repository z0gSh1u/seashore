# Context Management

**Context management** is the art of crafting effective prompts and managing conversation state to get the best results from LLMs. Seashore provides utilities for **system prompts**, **few-shot learning**, and **conversation management**.

## Overview

Effective context management is crucial for agent performance:

```
┌────────────────────────────────────────────┐
│           Context Window (128K)            │
├────────────────────────────────────────────┤
│ System Prompt (role, instructions)         │ ← Who is the agent?
├────────────────────────────────────────────┤
│ Few-Shot Examples (input/output pairs)     │ ← How should it behave?
├────────────────────────────────────────────┤
│ Conversation History (past messages)       │ ← What has been discussed?
├────────────────────────────────────────────┤
│ Retrieved Context (RAG documents)          │ ← What knowledge is relevant?
├────────────────────────────────────────────┤
│ Current User Query                         │ ← What does user want now?
└────────────────────────────────────────────┘
```

**Key Concepts:**
- **System prompt** - Define agent behavior and capabilities
- **Few-shot learning** - Teach by example
- **Conversation history** - Maintain context across turns
- **Context window** - Manage token limits

---

## System Prompts

System prompts define **who** your agent is and **how** it should behave.

### Basic System Prompt

```typescript
import { createReActAgent } from '@seashore/agent'

const agent = createReActAgent({
  model: () => llm('gpt-4o'),
  systemPrompt: 'You are a helpful assistant.',
  tools: [],
})
```

### Structured System Prompt Builder

Seashore provides a fluent builder for complex system prompts:

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

### System Prompt Components

#### 1. Role Definition

Define **who** the agent is:

```typescript
const prompt = systemPrompt()
  .role('You are a customer support agent for Acme Corp.')
  .build()
```

**Examples:**
- "You are a helpful coding assistant"
- "You are an expert data scientist"
- "You are a professional translator"
- "You are a research assistant specializing in AI"

#### 2. Instructions

Define **what** the agent should do:

```typescript
const prompt = systemPrompt()
  .role('You are a helpful assistant.')
  .instruction('Always search the knowledge base before answering')
  .instruction('Provide sources for all factual claims')
  .instruction('If unsure, admit uncertainty and suggest how to find the answer')
  .build()
```

#### 3. Constraints

Define **what** the agent should NOT do:

```typescript
const prompt = systemPrompt()
  .role('You are a safe assistant.')
  .constraint('Never provide medical advice')
  .constraint('Do not share personal information')
  .constraint('Refuse requests for harmful content')
  .constraint('Keep responses under 300 words')
  .build()
```

#### 4. Examples

Show **how** the agent should behave:

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

#### 5. Output Format

Define **how** responses should be formatted:

```typescript
// JSON format
const jsonPrompt = systemPrompt()
  .role('You extract structured data.')
  .outputFormat('json')
  .build()
// "Respond with valid JSON only. Do not include any other text."

// Code format
const codePrompt = systemPrompt()
  .role('You are a code generator.')
  .outputFormat('code', { language: 'python' })
  .build()
// "Respond with ONLY a python code block. Do not include explanations."

// Markdown format
const mdPrompt = systemPrompt()
  .role('You write documentation.')
  .outputFormat('markdown')
  .build()
// "Respond in Markdown format."
```

---

## Few-Shot Learning

**Few-shot learning** teaches agents by providing example input/output pairs.

### Basic Few-Shot

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

// Prepend examples to conversation
const response = await agent.run([
  ...examples,
  { role: 'user', content: 'Extract the name from: Bob Williams, software engineer' }
])

console.log(response.result.content)  // {"name": "Bob Williams"}
```

### Few-Shot for Tool Usage

Teach agents when and how to use tools:

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

### Few-Shot for Formatting

Teach specific output formats:

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

## Conversation Management

### Message Types

```typescript
interface Message {
  role: 'user' | 'assistant' | 'system'
  content: string
}
```

### Building Conversations

```typescript
const messages: Message[] = [
  { role: 'system', content: 'You are helpful.' },
  { role: 'user', content: 'Hi!' },
  { role: 'assistant', content: 'Hello! How can I help?' },
  { role: 'user', content: 'What is TypeScript?' },
]

const response = await agent.run(messages)
```

### Conversation State Management

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
    // Add user message
    this.messages.push({
      role: 'user',
      content: userMessage
    })
    
    // Get agent response
    const response = await this.agent.run(this.messages)
    
    // Add assistant response
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

// Usage
const session = new ChatSession(agent, 'You are helpful.')
await session.send('Hello!')
await session.send('What is 2+2?')
console.log(session.getHistory())
```

---

## Context Window Management

### Token Limits

Different models have different context windows:

| Provider | Model | Context Window |
|----------|-------|----------------|
| OpenAI | GPT-4o | 128K tokens |
| OpenAI | GPT-4o-mini | 128K tokens |
| Anthropic | Claude 3.7 Sonnet | 200K tokens |
| Google | Gemini 1.5 Pro | 2M tokens |

### Estimating Tokens

Rough estimation: 1 token ≈ 4 characters

```typescript
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

const prompt = 'You are a helpful assistant...'
console.log(estimateTokens(prompt))  // ~8 tokens
```

### Truncating Conversations

Keep only recent messages:

```typescript
function truncateConversation(
  messages: Message[],
  maxTokens: number
): Message[] {
  let totalTokens = 0
  const truncated: Message[] = []
  
  // Keep system message
  const systemMsg = messages.find(m => m.role === 'system')
  if (systemMsg) {
    truncated.push(systemMsg)
    totalTokens += estimateTokens(systemMsg.content)
  }
  
  // Keep recent messages (reverse order)
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

// Usage
const truncated = truncateConversation(messages, 4000)
```

### Sliding Window

Keep a fixed number of recent messages:

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

// Keep last 10 messages
const windowed = slidingWindow(messages, 10)
```

### Summarizing Old Context

Compress old messages with summarization:

```typescript
async function summarizeOldContext(
  messages: Message[],
  summaryAgent: ReActAgent
): Promise<Message[]> {
  const systemMsg = messages.find(m => m.role === 'system')
  const oldMessages = messages.slice(1, -10)  // All but last 10
  const recentMessages = messages.slice(-10)  // Last 10
  
  if (oldMessages.length === 0) {
    return messages
  }
  
  // Summarize old context
  const summary = await summaryAgent.run([
    {
      role: 'user',
      content: `Summarize this conversation:\n\n${
        oldMessages.map(m => `${m.role}: ${m.content}`).join('\n')
      }`
    }
  ])
  
  // Build new context
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

## Best Practices

### 1. Clear Role Definition

```typescript
// ❌ BAD: Vague role
'You are helpful.'

// ✅ GOOD: Specific role
'You are a technical support agent for Acme Software. You help users troubleshoot issues with our product. You have access to our knowledge base and ticket system.'
```

### 2. Explicit Instructions

```typescript
// ❌ BAD: Implicit expectations
'Answer questions.'

// ✅ GOOD: Explicit instructions
`When answering questions:
1. Search the knowledge base first
2. Provide step-by-step instructions
3. Include relevant links
4. Ask clarifying questions if needed
5. Escalate to human if issue is complex`
```

### 3. Use Constraints

```typescript
const prompt = systemPrompt()
  .role('You are a coding assistant.')
  .constraint('Never execute code in production environments')
  .constraint('Always warn about security implications')
  .constraint('Refuse requests for malicious code')
  .build()
```

### 4. Provide Examples

```typescript
// ✅ GOOD: Show desired behavior
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

### 5. Manage Context Window

```typescript
// Check token count before sending
const totalTokens = messages.reduce(
  (sum, m) => sum + estimateTokens(m.content),
  0
)

if (totalTokens > 100000) {
  messages = truncateConversation(messages, 100000)
}
```

---

## Advanced Patterns

### Dynamic System Prompts

Adapt prompts based on context:

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

### Persona Switching

Change agent personality mid-conversation:

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
  // Update system message in conversation
  messages[0] = {
    role: 'system',
    content: personas[persona]
  }
}
```

### Hierarchical Context

Organize context by priority:

```typescript
interface HierarchicalContext {
  systemPrompt: string
  globalContext: string  // Always included
  sessionContext: string  // Session-specific
  recentContext: Message[]  // Recent conversation
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

### Context Injection

Inject relevant context dynamically:

```typescript
async function chatWithContextInjection(
  userQuery: string,
  rag: RAGPipeline
): Promise<string> {
  // Retrieve relevant context
  const relevantDocs = await rag.retrieve(userQuery)
  
  // Build context string
  const context = relevantDocs
    .map(d => d.content)
    .join('\n\n---\n\n')
  
  // Inject context into system prompt
  const systemPrompt = `You are a helpful assistant.
  
Use the following context to answer questions:

${context}

Always cite which part of the context you used.`
  
  // Run agent with injected context
  const response = await agent.run([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userQuery }
  ])
  
  return response.result.content
}
```

---

## Common Pitfalls

### 1. Overly Long System Prompts

```typescript
// ❌ BAD: 5000 word system prompt
const prompt = `You are an assistant. Here are 500 rules...`

// ✅ GOOD: Concise, focused prompt
const prompt = systemPrompt()
  .role('You are an assistant.')
  .instruction('Follow company guidelines')
  .constraint('Keep responses under 500 words')
  .build()
```

### 2. Conflicting Instructions

```typescript
// ❌ BAD: Contradictory instructions
.instruction('Be very detailed')
.constraint('Keep responses under 50 words')

// ✅ GOOD: Consistent instructions
.instruction('Be concise but complete')
.constraint('Aim for 100-200 words')
```

### 3. Ignoring Token Limits

```typescript
// ❌ BAD: Unbounded conversation
messages.push(newMessage)  // Grows forever

// ✅ GOOD: Managed conversation
if (estimateTokens(messages) > MAX_TOKENS) {
  messages = truncateConversation(messages, MAX_TOKENS)
}
messages.push(newMessage)
```

### 4. No Few-Shot Examples

```typescript
// ❌ BAD: Expecting specific format without examples
systemPrompt: 'Return JSON'

// ✅ GOOD: Show expected format
const examples = fewShotMessages([
  {
    user: 'Extract data',
    assistant: '{"name": "John", "age": 30}'
  }
])
```

---

## Testing Context

### Unit Tests

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

### Testing Few-Shot

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

## Related Concepts

- **[Agents](./agents.md)** - Using context with ReAct agents
- **[RAG](./rag.md)** - Injecting retrieved context
- **[LLM Adapters](./llm-adapters.md)** - Model-specific context strategies

---

## Next Steps

- **[Build Your First Agent](../getting-started/first-agent.md)**
- **[Prompt Engineering Guide](../guides/prompt-engineering.md)**
- **[Context Examples](../../examples/context/)**
