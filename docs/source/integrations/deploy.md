# Deployment

Deploy your Seashore agents as production-ready APIs with built-in streaming, error handling, and CORS support.

## Quick Start

Create a simple API server:

```typescript
import { createServer } from '@seashore/deploy'
import { createAgent } from '@seashore/agent'
import { openaiText } from '@seashore/llm'

// Create agent
const agent = createAgent({
  name: 'assistant',
  model: openaiText('gpt-4o'),
  systemPrompt: 'You are a helpful assistant.',
})

// Create server
const server = createServer({
  agents: {
    assistant: agent,
  },
})

// Start with Node.js
import { serve } from '@hono/node-server'

serve({
  fetch: server.app.fetch,
  port: 3000,
})
```

## Server Options

```typescript
const server = createServer({
  agents: {
    chat: agent1,
    support: agent2,
  },
  cors: {
    origin: ['https://example.com', 'https://app.example.com'],
    methods: ['GET', 'POST', 'OPTIONS'],
    credentials: true,
  },
  rateLimit: {
    requests: 60,
    window: '1m',
  },
  errorHandler: async (error, c) => {
    console.error('Server error:', error)
    return c.json({ error: 'Internal server error' }, 500)
  },
})
```

## API Endpoints

### Health Check

```bash
GET /health
```

Response:
```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### List Agents

```bash
GET /v1/agents
```

Response:
```json
{
  "agents": [
    { "name": "assistant", "description": "General assistant" },
    { "name": "support", "description": "Customer support" }
  ]
}
```

### Run Agent (Non-streaming)

```bash
POST /v1/agents/{agentName}/run
```

Request:
```json
{
  "input": "Hello!",
  "threadId": "optional-thread-id",
  "metadata": {}
}
```

Response:
```json
{
  "content": "Hi! How can I help you today?",
  "toolCalls": [],
  "usage": {
    "promptTokens": 10,
    "completionTokens": 20,
    "totalTokens": 30
  }
}
```

### Run Agent (Streaming)

```bash
POST /v1/agents/{agentName}/stream
```

Returns Server-Sent Events (SSE):
```
data: {"type":"content","delta":"Hi!"}
data: {"type":"content","delta":" How"}
data: {"type":"content","delta":" can"}
data: {"type":"done"}
```

### Chat API (OpenAI-compatible)

```bash
POST /v1/chat
```

Request:
```json
{
  "model": "assistant",
  "messages": [
    { "role": "user", "content": "Hello!" }
  ],
  "stream": false
}
```

## Deploy to Cloudflare Workers

```typescript
// worker.ts
import { cloudflareAdapter } from '@seashore/deploy'
import { createAgent } from '@seashore/agent'
import { openaiText } from '@seashore/llm'

const agent = createAgent({
  name: 'worker-agent',
  model: openaiText('gpt-4o', {
    apiKey: env.OPENAI_API_KEY,
  }),
})

const server = createServer({
  agents: { bot: agent },
})

export default {
  async fetch(request: Request, env: Env) {
    return cloudflareAdapter(server).fetch(request)
  },
}
```

`wrangler.toml`:
```toml
name = "seashore-agent"
main = "worker.ts"
compatibility_date = "2024-01-01"

[vars]
ENVIRONMENT = "production"

[[secrets]]
OPENAI_API_KEY = "your-api-key"
```

## Deploy to Node.js

```typescript
// server.ts
import { createServer } from '@seashore/deploy'
import { serve } from '@hono/node-server'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'

const app = createServer({
  agents: { assistant: myAgent },
})

// Add middleware
app.app.use('*', logger())
app.app.use('*', cors())

serve({
  fetch: app.app.fetch,
  port: parseInt(process.env.PORT || '3000'),
})
```

## Deployment with Docker

```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 3000

CMD ["node", "dist/server.js"]
```

## Environment Variables

```bash
# Required
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...

# Optional
PORT=3000
ENVIRONMENT=production
LOG_LEVEL=info

# Rate limiting
RATE_LIMIT_REQUESTS=100
RATE_LIMIT_WINDOW=1m

# CORS
CORS_ORIGIN=*
```

## Authentication

Add API key authentication:

```typescript
import { createServer } from '@seashore/deploy'
import { verifyAuth } from '@seashore/deploy'

const server = createServer({
  agents: { assistant: agent },
  middleware: [
    async (c, next) => {
      const apiKey = c.req.header('Authorization')?.replace('Bearer ', '')

      if (apiKey !== process.env.API_KEY) {
        return c.json({ error: 'Unauthorized' }, 401)
      }

      await next()
    },
  ],
})
```

## Best Practices

1. **API Keys** — Never commit keys, use environment variables
2. **Rate Limiting** — Protect against abuse
3. **CORS** — Configure properly for your domain
4. **Error Handling** — Log errors, return safe messages
5. **Monitoring** — Track usage and performance
6. **Streaming** — Use streaming for better UX

## Next Steps

- [Observability](./observability.md) — Add tracing and monitoring
- [Security](../security/index.md) — Add guardrails and filtering
