# Streaming Responses

Streaming allows you to display agent responses as they're generated, creating a more responsive and engaging user experience.

## Why Stream?

**Blocking calls** wait for the complete response:
```typescript
const result = await agent.run('Tell me a story')
// ... wait 5 seconds ...
console.log(result.content) // All at once
```

**Streaming** shows progress in real-time:
```typescript
for await (const chunk of agent.stream('Tell me a story')) {
  process.stdout.write(chunk.delta)
  // "Once" -> " upon" -> " a" -> " time" ...
}
```

Benefits:
- **Better UX** — Users see progress immediately
- **Lower perceived latency** — 5 seconds feels like 2 when streaming
- **Early termination** — Stop streaming if user changes their mind

## Stream Methods

Seashore provides two streaming methods:

### agent.stream()

Returns an async iterable of stream chunks:

```typescript
for await (const chunk of agent.stream('Hello')) {
  if (chunk.type === 'content') {
    process.stdout.write(chunk.delta)
  }
}
```

### agent.chat()

Returns an async iterable, accepts full message history:

```typescript
const messages = [
  { role: 'user' as const, content: 'Hello' },
  { role: 'assistant' as const, content: 'Hi there!' },
  { role: 'user' as const, content: 'Tell me about yourself' },
]

for await (const chunk of agent.chat(messages)) {
  if (chunk.type === 'content') {
    process.stdout.write(chunk.delta)
  }
}
```

## Stream Chunks

Each chunk has a `type` that indicates its content:

| Type | Description |
|------|-------------|
| `content` | Text delta being generated |
| `tool_call` | Tool being executed |
| `tool_result` | Tool execution result |
| `error` | An error occurred |

```typescript
for await (const chunk of agent.stream('What is the weather in Tokyo?')) {
  switch (chunk.type) {
    case 'content':
      process.stdout.write(chunk.delta)
      break
    case 'tool_call':
      console.log(`\n[Calling tool: ${chunk.name}]`)
      break
    case 'tool_result':
      console.log(`[Tool result: ${JSON.stringify(chunk.result)}]`)
      break
  }
}
```

## Collecting Content

Use `collectContent()` helper to gather all text:

```typescript
import { collectContent } from '@seashore/agent'

const stream = agent.stream('Tell me a story')
const fullContent = await collectContent(stream)
console.log(fullContent)
```

## Streaming to HTTP

For web APIs, use Server-Sent Events (SSE):

```typescript
import { toSSEStream } from '@seashore/llm'

app.post('/chat', async (c) => {
  const stream = agent.stream(c.req.query('message'))

  return new Response(toSSEStream(stream), {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
    },
  })
})
```

## Streaming with Tools

When using tools, you can see when tools are called:

```typescript
const agent = createAgent({
  name: 'assistant',
  model: openaiText('gpt-4o'),
  tools: [weatherTool],
})

for await (const chunk of agent.stream('What is the weather in Tokyo?')) {
  switch (chunk.type) {
    case 'content':
      process.stdout.write(chunk.delta)
      break
    case 'tool_call':
      console.log(`\n🔧 Calling ${chunk.name} with:`, chunk.arguments)
      break
    case 'tool_result':
      console.log(`\n✅ Got result:`, chunk.result)
      break
  }
}
```

Output:
```
🔧 Calling get_weather with: { city: "Tokyo" }
✅ Got result: { temperature: 22, condition: "sunny" }

The weather in Tokyo is 22°C and sunny.
```

## Abort Control

Stop streaming at any time:

```typescript
const controller = new AbortController()

const streamPromise = (async () => {
  for await (const chunk of agent.stream('Tell me a long story', {
    signal: controller.signal
  })) {
    process.stdout.write(chunk.delta)
  }
})()

// Abort after 2 seconds
setTimeout(() => controller.abort(), 2000)

await streamPromise
```

## React Integration

For React applications, use the streaming response:

```typescript
function ChatComponent() {
  const [response, setResponse] = useState('')
  const [loading, setLoading] = useState(false)

  const sendMessage = async (message: string) => {
    setLoading(true)
    setResponse('')

    for await (const chunk of agent.stream(message)) {
      if (chunk.type === 'content') {
        setResponse((prev) => prev + chunk.delta)
      }
    }

    setLoading(false)
  }

  return (
    <div>
      <button onClick={() => sendMessage('Hello')}>
        Send
      </button>
      {loading && <div>{response}</div>}
    </div>
  )
}
```

## Next Steps

- [Multi-turn Conversations](./conversations.md) — Maintain context
- [Deployment](../integrations/deploy.md) — Deploy streaming agents
