# Seashore Full-Stack Example - Backend

Production-ready Hono server with Seashore agent, streaming SSE, and PostgreSQL storage.

## Features

- **Streaming SSE Chat**: Real-time streaming responses using Server-Sent Events
- **Thread Management**: Persistent conversation threads with PostgreSQL
- **ReAct Agent**: AI agent with tool use (calculator, time, random numbers)
- **Production Ready**: CORS, error handling, health checks, graceful shutdown
- **Type Safety**: Full TypeScript with strict mode

## Prerequisites

- Node.js 20+
- PostgreSQL 14+ with pgvector extension
- OpenAI API key

## Setup

1. **Install dependencies:**
   ```bash
   pnpm install
   ```

2. **Set up PostgreSQL:**
   ```bash
   # Create database
   createdb seashore

   # Run migrations (from monorepo root)
   cd ../../packages/data
   pnpm drizzle-kit push
   ```

3. **Configure environment:**
   ```bash
   cp ../.env.example .env
   # Edit .env with your credentials
   ```

4. **Start development server:**
   ```bash
   pnpm dev
   ```

The server will start at `http://localhost:3001`

## API Endpoints

### Chat

**POST /api/chat**

Stream or non-stream chat with the agent.

```bash
# Streaming request
curl -X POST http://localhost:3001/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [{"role": "user", "content": "What is 42 * 17?"}],
    "stream": true
  }'

# Non-streaming request
curl -X POST http://localhost:3001/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [{"role": "user", "content": "Hello!"}],
    "stream": false
  }'
```

### Thread Management

**GET /api/threads**

List all conversation threads.

```bash
curl http://localhost:3001/api/threads?limit=10&offset=0
```

**POST /api/threads**

Create a new thread.

```bash
curl -X POST http://localhost:3001/api/threads \
  -H "Content-Type: application/json" \
  -d '{"title": "My Conversation"}'
```

**GET /api/threads/:id/messages**

Get messages in a thread.

```bash
curl http://localhost:3001/api/threads/{thread-id}/messages
```

### Health Check

**GET /health**

Check server status.

```bash
curl http://localhost:3001/health
```

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                   Hono Server                        │
│  ┌───────────────────────────────────────────────┐  │
│  │         seashoreMiddleware                    │  │
│  │  ┌─────────────────────────────────────────┐  │  │
│  │  │  POST /api/chat (SSE Streaming)         │  │  │
│  │  │  GET  /api/threads                       │  │  │
│  │  │  POST /api/threads                       │  │  │
│  │  │  GET  /api/threads/:id/messages         │  │  │
│  │  └─────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────┘  │
│                         │                            │
│         ┌───────────────┴───────────────┐           │
│         ▼                               ▼           │
│  ┌─────────────┐                ┌──────────────┐   │
│  │ ReAct Agent │                │   Storage    │   │
│  │  - GPT-4    │                │ (PostgreSQL) │   │
│  │  - Tools    │                └──────────────┘   │
│  └─────────────┘                                    │
└─────────────────────────────────────────────────────┘
```

## Tools

The agent has access to:

1. **calculator**: Basic arithmetic (add, subtract, multiply, divide)
2. **get_current_time**: Current date/time in any timezone
3. **random_number**: Generate random numbers in a range

## Error Handling

- **400 Bad Request**: Missing or invalid request data
- **404 Not Found**: Endpoint doesn't exist
- **500 Internal Server Error**: Server-side errors (logged to console)

All errors return JSON:
```json
{
  "error": "Error message",
  "timestamp": "2026-02-12T10:30:00.000Z"
}
```

## Production Deployment

1. **Build TypeScript:**
   ```bash
   pnpm build
   ```

2. **Set environment variables:**
   ```bash
   export DATABASE_URL=postgresql://...
   export OPENAI_API_KEY=sk-...
   export PORT=3001
   ```

3. **Run:**
   ```bash
   node dist/server.js
   ```

Or use a process manager like PM2:
```bash
pm2 start dist/server.js --name seashore-backend
```

## Customization

### Add New Tools

Edit `server.ts` and add to the `tools` array:

```typescript
const myTool = {
  name: 'my_tool',
  description: 'What this tool does',
  parameters: z.object({
    param: z.string(),
  }),
  execute: async ({ param }) => {
    // Implementation
    return { result: 'data' }
  },
}

const agent = createReActAgent({
  // ...
  tools: [calculatorTool, getTimeTool, randomNumberTool, myTool],
})
```

### Change LLM Provider

Replace `createLLMAdapter` with a different provider:

```typescript
const llmAdapter = createLLMAdapter({
  provider: 'anthropic', // or 'gemini'
  apiKey: process.env.ANTHROPIC_API_KEY,
  model: 'claude-3-5-sonnet-20241022',
})
```

### Add Guardrails

```typescript
import { createGuardrail } from '@seashore/platform'

const contentFilter = createGuardrail({
  name: 'content-filter',
  check: async (content) => {
    // Return true to allow, false to block
    return !content.includes('blocked-word')
  },
})

const agent = createReActAgent({
  // ...
  guardrails: [contentFilter],
})
```

## Troubleshooting

**Database connection fails:**
- Ensure PostgreSQL is running
- Check `DATABASE_URL` is correct
- Verify database exists: `psql -l`

**Agent not streaming:**
- Check frontend uses `stream: true`
- Verify SSE endpoint returns `text/event-stream`
- Check browser network tab for streaming events

**CORS errors:**
- Add your frontend origin to `cors()` middleware
- Ensure credentials are enabled if needed
