# Agents

**ReAct agents** are intelligent actors that can **reason** about tasks and **act** using tools to accomplish goals. They iterate through observation-action cycles until completing tasks or reaching maximum iterations.

## Overview

Seashore implements the **ReAct (Reasoning + Acting)** pattern, where agents:

1. **Reason** - Analyze the user's request and current context
2. **Act** - Call tools to gather information or perform actions
3. **Observe** - Process tool results and update understanding
4. **Repeat** - Continue until task completion or max iterations

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

## Creating a ReAct Agent

### Basic Agent

```typescript
import { createReActAgent } from '@seashore/agent'
import { createLLMAdapter } from '@seashore/core'
import { z } from 'zod'

// 1. Create LLM adapter
const llm = createLLMAdapter({
  provider: 'openai',
  apiKey: process.env.OPENAI_API_KEY!,
})

// 2. Define tools
const searchTool = {
  name: 'search',
  description: 'Search the web for information',
  parameters: z.object({
    query: z.string().describe('Search query'),
  }),
  execute: async ({ query }) => {
    // Call search API
    return { results: [...] }
  },
}

// 3. Create agent
const agent = createReActAgent({
  model: () => llm('gpt-4o'),
  systemPrompt: 'You are a helpful research assistant.',
  tools: [searchTool],
  maxIterations: 5,
})

// 4. Run agent
const response = await agent.run([
  { role: 'user', content: 'What is the capital of France?' }
])

console.log(response.result.content)
// "The capital of France is Paris."
```

---

## Agent Configuration

### ReActAgentConfig

```typescript
interface ReActAgentConfig {
  /** Model function that returns a TanStack AI model */
  model: () => any

  /** System prompt defining agent behavior */
  systemPrompt: string

  /** Tools available to the agent */
  tools?: Tool[]

  /** Maximum iterations before stopping (default: 10) */
  maxIterations?: number

  /** Guardrails for filtering requests/responses */
  guardrails?: Guardrail[]

  /** Output schema for structured responses */
  outputSchema?: z.ZodType<any>
}
```

### Configuration Examples

**With multiple tools:**
```typescript
const agent = createReActAgent({
  model: () => llm('gpt-4o'),
  systemPrompt: 'You are a helpful assistant.',
  tools: [searchTool, calculatorTool, weatherTool],
  maxIterations: 10,
})
```

**With guardrails:**
```typescript
import { createGuardrail } from '@seashore/platform'

const moderationGuardrail = createGuardrail({
  beforeRequest: async (messages) => {
    // Filter harmful content
    return messages.filter(m => !containsHarmful(m.content))
  },
  afterResponse: async (result) => {
    // Validate response
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

**With structured output:**
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

// response.result is type-safe
console.log(response.result.answer)      // "Alexander Graham Bell"
console.log(response.result.confidence)  // 0.95
console.log(response.result.sources)     // ["https://..."]
```

---

## Message Flow

### Message Types

```typescript
interface Message {
  role: 'user' | 'assistant' | 'system'
  content: string
}
```

**Roles:**
- `system` - Instructions for the agent (injected automatically)
- `user` - User input or questions
- `assistant` - Agent responses

### Conversation History

Agents accept an array of messages, maintaining conversation context:

```typescript
const messages: Message[] = [
  { role: 'user', content: 'What is 2+2?' },
]

const response1 = await agent.run(messages)
console.log(response1.result.content)  // "4"

// Continue conversation
messages.push(
  { role: 'assistant', content: response1.result.content },
  { role: 'user', content: 'What about 5+5?' }
)

const response2 = await agent.run(messages)
console.log(response2.result.content)  // "10"
```

### Message Transformation

**System prompt injection:**
```typescript
// User provides:
[
  { role: 'user', content: 'Hello!' }
]

// Agent internally sends:
[
  { role: 'system', content: 'You are a helpful assistant.' },
  { role: 'user', content: 'Hello!' }
]
```

**Tool call messages:**
```typescript
// When agent calls a tool:
[
  { role: 'system', content: '...' },
  { role: 'user', content: 'Search for cats' },
  { role: 'assistant', content: '', toolCalls: [{...}] },
  { role: 'tool', content: 'Search results: ...' },
  { role: 'assistant', content: 'I found information about cats...' }
]
```

---

## Tool Calling

### Tool Interface

```typescript
interface Tool {
  name: string
  description: string
  parameters: z.ZodType<any>
  execute: (args: any) => Promise<any> | any
}
```

### Tool Execution Flow

1. **Agent decides** to call a tool based on reasoning
2. **LLM generates** tool call with structured arguments
3. **Seashore validates** arguments against Zod schema
4. **Tool executes** and returns result
5. **Agent observes** result and continues reasoning

```typescript
// Tool definition
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

// Tool call example
const response = await agent.run([
  { role: 'user', content: 'What is the weather in Tokyo?' }
])

// Agent internally:
// 1. Decides to call get_weather
// 2. Generates: { location: 'Tokyo', units: 'celsius' }
// 3. Executes: weatherTool.execute({ location: 'Tokyo', units: 'celsius' })
// 4. Observes: "22°C, sunny"
// 5. Responds: "The weather in Tokyo is currently 22°C and sunny."
```

### Multiple Tool Calls

Agents can make multiple sequential tool calls:

```typescript
const response = await agent.run([
  { role: 'user', content: 'Compare weather in Tokyo and London' }
])

// Agent execution:
// Iteration 1: Call get_weather({ location: 'Tokyo' })
// Iteration 2: Call get_weather({ location: 'London' })
// Iteration 3: Synthesize comparison response
```

### Tool Call Inspection

```typescript
const response = await agent.run(messages)

// Inspect tool calls made
response.result.toolCalls.forEach(call => {
  console.log(`Tool: ${call.name}`)
  console.log(`Arguments: ${JSON.stringify(call.arguments)}`)
})
```

---

## Iteration Management

### Max Iterations

Agents stop after reaching `maxIterations` to prevent infinite loops:

```typescript
const agent = createReActAgent({
  model: () => llm('gpt-4o'),
  systemPrompt: 'You are helpful.',
  tools: [complexTool],
  maxIterations: 3,  // Stop after 3 tool calls
})
```

**Iteration examples:**

```typescript
// Simple query (1 iteration)
await agent.run([
  { role: 'user', content: 'What is 2+2?' }
])
// Iterations: 1 (direct answer, no tools)

// Single tool call (2 iterations)
await agent.run([
  { role: 'user', content: 'Search for cats' }
])
// Iteration 1: Call search tool
// Iteration 2: Synthesize response

// Multiple tool calls (4 iterations)
await agent.run([
  { role: 'user', content: 'Compare prices of iPhone in US and UK' }
])
// Iteration 1: Call price_lookup({ product: 'iPhone', country: 'US' })
// Iteration 2: Call price_lookup({ product: 'iPhone', country: 'UK' })
// Iteration 3: Call currency_convert({ from: 'GBP', to: 'USD' })
// Iteration 4: Synthesize comparison response
```

### TanStack AI Integration

Seashore uses TanStack AI's `maxSteps`:

```typescript
import { chat, maxIterations } from '@tanstack/ai'

// Internal implementation
const response = await chat({
  model: model(),
  messages: [...],
  maxSteps: maxIterations(config.maxIterations),
  tools: config.tools,
})
```

---

## Running Agents

### Synchronous Execution

```typescript
const response = await agent.run(messages, options?)
```

**Returns `AgentResponse`:**
```typescript
interface AgentResponse {
  messages: Message[]       // Full conversation including tool calls
  result: AgentResult       // Final result
}

interface AgentResult {
  content: string           // Agent's response text
  toolCalls: ToolCall[]     // All tool calls made
}
```

**Example:**
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

### Streaming Execution

```typescript
const response = await agent.stream(messages, options?)
```

**Returns `StreamingAgentResponse`:**
```typescript
interface StreamingAgentResponse extends AgentResponse {
  stream: AsyncIterable<any>  // Token stream
}
```

**Example:**
```typescript
const response = await agent.stream([
  { role: 'user', content: 'Tell me about Seashore' }
])

// Stream tokens in real-time
for await (const chunk of response.stream) {
  process.stdout.write(chunk.content)
}

// After streaming completes
console.log(response.result.content)  // Full response
console.log(response.messages)        // Complete history
```

### Run Options

```typescript
interface RunOptions {
  abortSignal?: AbortSignal
}
```

**Abort execution:**
```typescript
const controller = new AbortController()

// Start agent
const promise = agent.run(messages, {
  abortSignal: controller.signal
})

// Abort after 5 seconds
setTimeout(() => controller.abort(), 5000)

try {
  await promise
} catch (err) {
  console.error('Agent aborted:', err)
}
```

---

## Guardrails

Guardrails provide **safety and filtering** for agent inputs and outputs.

### Guardrail Interface

```typescript
interface Guardrail {
  beforeRequest?: BeforeRequestHook
  afterResponse?: AfterResponseHook
}

type BeforeRequestHook = (messages: Message[]) => Message[] | Promise<Message[]>
type AfterResponseHook = (result: AgentResult) => AgentResult | Promise<AgentResult>
```

### Before Request Hooks

Filter or modify messages **before** sending to LLM:

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

### After Response Hooks

Filter or modify results **after** receiving from LLM:

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

### Multiple Guardrails

Guardrails are applied in order:

```typescript
const agent = createReActAgent({
  model: () => llm('gpt-4o'),
  systemPrompt: 'You are helpful.',
  guardrails: [
    piiFilterGuardrail,      // 1st: Remove PII
    moderationGuardrail,     // 2nd: Check content safety
    complianceGuardrail,     // 3rd: Ensure compliance
  ],
})
```

### LLM-Based Guardrails

Use LLMs to validate content:

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

## Advanced Patterns

### Multi-Turn Conversations

Build stateful chat applications:

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

// Usage
const session = new ChatSession(agent)
await session.send('Hello!')
await session.send('What is the weather?')
await session.send('Thanks!')
session.reset()
```

### Agent Composition

Chain multiple specialized agents:

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
  // Research phase
  const research = await researchAgent.run([
    { role: 'user', content: `Research ${topic}` }
  ])

  // Writing phase
  const article = await writingAgent.run([
    { role: 'user', content: `Write an article based on: ${research.result.content}` }
  ])

  return article.result.content
}
```

### Dynamic Tool Selection

Provide different tools based on context:

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

### Error Handling

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

## Best Practices

### 1. Clear System Prompts

```typescript
// ❌ BAD: Vague prompt
systemPrompt: 'You are helpful.'

// ✅ GOOD: Specific instructions
systemPrompt: `You are a customer support assistant for Acme Corp.

When answering:
- Be polite and professional
- Use search tool to find accurate information
- If you cannot help, escalate to human support
- Always verify user identity before sharing sensitive data`
```

### 2. Descriptive Tool Names

```typescript
// ❌ BAD: Generic name
name: 'search'

// ✅ GOOD: Specific name
name: 'search_company_knowledge_base'
```

### 3. Detailed Tool Descriptions

```typescript
// ❌ BAD: Minimal description
description: 'Search'

// ✅ GOOD: Clear description
description: 'Search the company knowledge base for articles, policies, and FAQs. Use when user asks about company procedures or policies.'
```

### 4. Appropriate Max Iterations

```typescript
// Simple Q&A agent
maxIterations: 3

// Research agent with multiple tools
maxIterations: 10

// Complex workflow agent
maxIterations: 20
```

### 5. Validate Tool Results

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

### 6. Monitor Tool Usage

```typescript
const agent = createReActAgent({
  model: () => llm('gpt-4o'),
  systemPrompt: 'You are helpful.',
  tools: [searchTool],
})

const response = await agent.run(messages)

// Log tool usage for monitoring
console.log('Tools used:', response.result.toolCalls.length)
response.result.toolCalls.forEach(call => {
  console.log(`- ${call.name}:`, call.arguments)
})
```

---

## Common Pitfalls

### 1. Infinite Loops

**Problem:** Agent keeps calling tools without making progress.

**Solution:** Set appropriate `maxIterations` and ensure tools return useful results.

### 2. Tool Result Overload

**Problem:** Tool returns too much data, overwhelming context window.

**Solution:** Summarize or truncate tool results.

```typescript
execute: async ({ query }) => {
  const results = await search(query)
  // Truncate to top 3 results
  return results.slice(0, 3).map(r => ({
    title: r.title,
    snippet: r.snippet.slice(0, 200)
  }))
}
```

### 3. Ambiguous Tool Descriptions

**Problem:** Agent uses wrong tool because descriptions overlap.

**Solution:** Make tool descriptions specific and non-overlapping.

### 4. Ignoring Tool Errors

**Problem:** Tool fails silently, agent continues with bad data.

**Solution:** Return error messages that guide agent.

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

## Related Concepts

- **[Workflows](./workflows.md)** - Orchestrate multiple agents in DAG
- **[Tools](./tools.md)** - Learn tool creation in depth
- **[Context](./context.md)** - Optimize system prompts
- **[Guardrails](../guides/guardrails.md)** - Advanced safety patterns

---

## Next Steps

- **[Build Your First Agent](../getting-started/first-agent.md)**
- **[Tool Creation Guide](./tools.md)**
- **[Agent Examples](../../examples/)**
