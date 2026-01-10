# Creating Your First Agent

An agent is defined by its **name**, **model**, and **system prompt**. These three elements determine how the agent behaves and responds.

## Agent Configuration

```typescript
import { createAgent } from '@seashore/agent'
import { openaiText } from '@seashore/llm'

const agent = createAgent({
  name: 'my-agent',           // Identifies the agent
  model: openaiText('gpt-4o'), // The language model to use
  systemPrompt: 'You are...',  // Instructions for behavior
})
```

Let's explore each option.

## Name

The name identifies your agent. It's used for:
- Logging and debugging
- Tracking usage in observability tools
- Identifying the agent in multi-agent systems

```typescript
const agent = createAgent({
  name: 'customer-support-agent',
  model: openaiText('gpt-4o'),
  systemPrompt: 'You are a customer support representative...',
})
```

Choose names that are:
- Descriptive (what does the agent do?)
- Unique (no conflicts in your system)
- kebab-case (standard convention)

## Model

The model determines the agent's capabilities. Seashore supports multiple providers:

```typescript
import { openaiText, anthropicText, geminiText } from '@seashore/llm'

// OpenAI
const gpt4o = openaiText('gpt-4o')

// Anthropic
const claude = anthropicText('claude-sonnet-3-5')

// Gemini
const gemini = geminiText('gemini-2.0-flash-exp')

const agent = createAgent({
  name: 'my-agent',
  model: gpt4o,  // Use any adapter
  systemPrompt: '...',
})
```

**Choosing a model:**
- **GPT-4o** — Best overall, great for reasoning
- **GPT-4o-mini** — Faster, cheaper, good for simple tasks
- **Claude 3.5 Sonnet** — Excellent for coding and analysis
- **Gemini Flash** — Fast and cost-effective

## System Prompt

The system prompt defines the agent's behavior, personality, and constraints. This is where you shape how the agent responds.

```typescript
const agent = createAgent({
  name: 'therapist-bot',
  model: openaiText('gpt-4o'),
  systemPrompt: `
    You are a compassionate therapist.
    - Listen actively and empathetically
    - Ask thoughtful follow-up questions
    - Do not give medical advice
    - Keep responses brief (2-3 sentences)
    - Use warm, professional language
  `,
})
```

**Effective system prompts:**
- Define the agent's role clearly
- Set specific behavioral guidelines
- Include constraints and boundaries
- Specify output format (if needed)
- Keep them focused and concise

## Running the Agent

Once created, use `agent.run()` to get a response:

```typescript
const agent = createAgent({
  name: 'joke-bot',
  model: openaiText('gpt-4o'),
  systemPrompt: 'You are a comedian. Tell short, funny jokes.',
})

const result = await agent.run('Tell me a joke about programming')
console.log(result.content)
// Output: "Why do programmers prefer dark mode?
//          Because light attracts bugs!"
```

### Result Structure

The `AgentResult` contains:

```typescript
{
  content: string,       // The agent's response text
  toolCalls: ToolCall[], // Tools used during execution
  usage: {
    promptTokens: number,
    completionTokens: number,
    totalTokens: number,
  },
}
```

### Simplified Input

You can pass a string instead of a full message array:

```typescript
// Both are equivalent
await agent.run('Hello')
await agent.run({ messages: [{ role: 'user', content: 'Hello' }] })
```

## Common Patterns

### Task-Specific Agents

Create focused agents for specific tasks:

```typescript
const summarizer = createAgent({
  name: 'summarizer',
  model: openaiText('gpt-4o'),
  systemPrompt: `
    You are a text summarizer.
    Summarize the input in 2-3 sentences.
    Focus on key information and action items.
  `,
})

const translator = createAgent({
  name: 'translator',
  model: openaiText('gpt-4o'),
  systemPrompt: `
    You are a professional translator.
    Translate the input to {target_language}.
    Preserve tone and meaning.
  `,
})
```

### Persona-Based Agents

Give your agent a distinct personality:

```typescript
const pirateBot = createAgent({
  name: 'pirate',
  model: openaiText('gpt-4o'),
  systemPrompt: `
    You are a friendly pirate from the 1700s.
    - Speak in pirate slang (arr, matey, shiver me timbers)
    - Be enthusiastic and helpful
    - Reference sailing and treasure hunting
    - Keep responses fun but useful
  `,
})
```

### Format-Controlled Agents

Require specific output formats:

```typescript
const jsonBot = createAgent({
  name: 'json-output',
  model: openaiText('gpt-4o'),
  systemPrompt: `
    You are a data extractor.
    Extract information from the input and return ONLY valid JSON.
    No explanations, no markdown formatting, just JSON.

    Output format:
    {
      "entities": [{ "name": string, "type": string }],
      "sentiment": "positive" | "negative" | "neutral"
    }
  `,
})
```

## Next Steps

Now that you can create agents:

- [Adding Tools](./tools.md) — Give agents real capabilities
- [Streaming Responses](./streaming.md) — Build real-time experiences
- [Multi-turn Conversations](./conversations.md) — Maintain context
