# 🌊 Seashore Full-Stack Chat Application

A complete, production-ready full-stack AI chat application built with Seashore, demonstrating streaming chat, thread management, and ReAct agents with tools.

![Full-Stack Architecture](https://img.shields.io/badge/Stack-React%20%2B%20Hono%20%2B%20PostgreSQL-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue)
![License](https://img.shields.io/badge/License-MIT-green)

## Features

### 🤖 AI Agent
- **ReAct Agent** with tool use (calculator, time, random numbers)
- **Streaming Responses** via Server-Sent Events (SSE)
- **GPT-4** powered (configurable for other LLMs)
- **Guardrails** support for input/output filtering

### 💾 Persistent Storage
- **PostgreSQL** with thread management
- **Conversation History** across sessions
- **Message Persistence** with metadata
- **Drizzle ORM** for type-safe queries

### ⚡ Modern Stack
- **Backend**: Hono (lightweight, fast web framework)
- **Frontend**: React 18 + Vite
- **Type Safety**: Full TypeScript with strict mode
- **Hooks**: `useSeashoreChat` for seamless integration

### 🎨 User Experience
- **Real-time Streaming**: See responses as they're generated
- **Thread Switching**: Multiple conversations
- **Responsive Design**: Works on desktop and mobile
- **Clean UI**: Modern, professional design

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                    Full-Stack Application                     │
│                                                                │
│  ┌──────────────────┐              ┌────────────────────┐    │
│  │   Frontend       │              │     Backend        │    │
│  │   (React)        │◄────SSE─────►│     (Hono)         │    │
│  │                  │              │                     │    │
│  │  - App.tsx       │              │  - seashoreMiddleware│  │
│  │  - Chat.tsx      │              │  - ReAct Agent      │  │
│  │  - useSeashoreChat│             │  - Tools            │  │
│  └──────────────────┘              └──────┬─────────────┘    │
│         │                                  │                  │
│         │ HTTP/SSE                         │                  │
│         │ localhost:5173                   │ localhost:3001   │
│         │                                  │                  │
│         └──────────Vite Proxy─────────────┘                  │
│                                             │                  │
│                                             ▼                  │
│                                    ┌─────────────────┐        │
│                                    │   PostgreSQL    │        │
│                                    │   - Threads     │        │
│                                    │   - Messages    │        │
│                                    └─────────────────┘        │
└──────────────────────────────────────────────────────────────┘
```

## Quick Start

### Prerequisites

- **Node.js** 20+
- **pnpm** 9+
- **PostgreSQL** 14+ with pgvector
- **OpenAI API Key**

### 1. Clone and Install

```bash
cd examples/fullstack-app
pnpm install
```

### 2. Set Up Database

```bash
# Create database
createdb seashore

# Run migrations (from monorepo root)
cd ../../packages/data
pnpm drizzle-kit push
```

### 3. Configure Environment

```bash
cp .env.example .env
# Edit .env with your credentials
```

Required variables:
```bash
DATABASE_URL=postgresql://localhost:5432/seashore
OPENAI_API_KEY=sk-...
```

### 4. Start Development Servers

#### Option A: Both servers simultaneously
```bash
pnpm dev
```

#### Option B: Separate terminals
```bash
# Terminal 1: Backend
pnpm dev:backend

# Terminal 2: Frontend
pnpm dev:frontend
```

### 5. Open Your Browser

Navigate to **http://localhost:5173**

## Project Structure

```
fullstack-app/
├── backend/                 # Hono server
│   ├── server.ts           # Main server with agent & middleware
│   ├── package.json        # Backend dependencies
│   ├── tsconfig.json       # TypeScript config
│   └── README.md           # Backend documentation
│
├── frontend/               # React app
│   ├── src/
│   │   ├── App.tsx        # Main app with sidebar
│   │   ├── Chat.tsx       # Chat component
│   │   ├── main.tsx       # React entry point
│   │   └── *.css          # Styling
│   ├── index.html         # HTML template
│   ├── vite.config.ts     # Vite configuration
│   ├── package.json       # Frontend dependencies
│   └── README.md          # Frontend documentation
│
├── package.json            # Root workspace config
├── .env.example            # Environment template
└── README.md               # This file
```

## API Endpoints

### Chat
- **POST** `/api/chat` - Send message and receive streaming response
  ```bash
  curl -X POST http://localhost:3001/api/chat \
    -H "Content-Type: application/json" \
    -d '{"messages": [{"role": "user", "content": "Hello!"}], "stream": true}'
  ```

### Threads
- **GET** `/api/threads` - List all threads
- **POST** `/api/threads` - Create new thread
- **GET** `/api/threads/:id/messages` - Get thread messages

### Health
- **GET** `/health` - Server health check

See `backend/README.md` for detailed API documentation.

## Key Technologies

| Component | Technology | Purpose |
|-----------|-----------|---------|
| **Agent** | `@seashore/agent` | ReAct agent with tool use |
| **LLM** | `@seashore/core` | OpenAI GPT-4 adapter |
| **Storage** | `@seashore/data` | PostgreSQL + Drizzle ORM |
| **Deployment** | `@seashore/platform` | Hono middleware |
| **Frontend** | `@seashore/react` | React hooks |
| **Server** | Hono | Lightweight web framework |
| **UI** | React 18 | User interface |
| **Build** | Vite | Frontend bundler |
| **Database** | PostgreSQL | Persistent storage |

## Available Tools

The agent has access to these tools:

### 🔢 Calculator
Perform arithmetic operations (add, subtract, multiply, divide)

**Example:**
> "What is 42 * 17?"

### 🕐 Current Time
Get current date/time in any timezone

**Example:**
> "What time is it in Tokyo?"

### 🎲 Random Number
Generate random numbers within a range

**Example:**
> "Give me a random number between 1 and 100"

## Customization

### Add New Tools

Edit `backend/server.ts`:

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

Replace the LLM adapter in `backend/server.ts`:

```typescript
const llmAdapter = createLLMAdapter({
  provider: 'anthropic', // or 'gemini'
  apiKey: process.env.ANTHROPIC_API_KEY,
  model: 'claude-3-5-sonnet-20241022',
})
```

### Customize UI

Modify CSS variables in `frontend/src/App.css`:

```css
:root {
  --primary: #2563eb;      /* Change primary color */
  --background: #ffffff;   /* Background color */
  /* ... */
}
```

### Add Guardrails

```typescript
import { createGuardrail } from '@seashore/platform'

const contentFilter = createGuardrail({
  name: 'content-filter',
  check: async (content) => !content.includes('blocked-word'),
})

const agent = createReActAgent({
  // ...
  guardrails: [contentFilter],
})
```

## Production Deployment

### Backend

1. **Build:**
   ```bash
   cd backend
   pnpm build
   ```

2. **Deploy to:**
   - **Railway**: `railway up`
   - **Render**: Connect repo, set build command
   - **Fly.io**: `fly deploy`
   - **Docker**: See `backend/Dockerfile` (create as needed)

3. **Set environment variables** in your hosting platform.

### Frontend

1. **Build:**
   ```bash
   cd frontend
   pnpm build
   ```

2. **Deploy to:**
   - **Vercel**: `vercel deploy`
   - **Netlify**: `netlify deploy --prod --dir=dist`
   - **Cloudflare Pages**: Connect repo

3. **Update API endpoint** to production backend URL.

### Database

Use a managed PostgreSQL service:
- **Neon**: Serverless Postgres with pgvector
- **Supabase**: Postgres with built-in features
- **Railway**: Managed Postgres
- **AWS RDS**: Enterprise option

## Development

### Type Checking

```bash
pnpm typecheck
```

### Build All

```bash
pnpm build
```

### Watch Mode

Backend has hot reload with `tsx watch`:
```bash
pnpm dev:backend
```

Frontend has Vite HMR:
```bash
pnpm dev:frontend
```

## Troubleshooting

### Database Connection Fails
- Ensure PostgreSQL is running: `pg_isready`
- Check `DATABASE_URL` is correct
- Verify database exists: `psql -l`

### CORS Errors
- Add your frontend origin to backend CORS config
- Check both ports are correct (3001 backend, 5173 frontend)

### Streaming Not Working
- Verify browser supports SSE (all modern browsers)
- Check network tab shows `text/event-stream`
- Ensure no proxy is buffering responses

### Build Errors
- Build Seashore packages first from monorepo root: `pnpm build`
- Clear node_modules and reinstall: `rm -rf node_modules && pnpm install`

## Testing

### Backend
```bash
cd backend
curl http://localhost:3001/health
curl -X POST http://localhost:3001/api/chat \
  -H "Content-Type: application/json" \
  -d '{"messages": [{"role": "user", "content": "Test"}], "stream": false}'
```

### Frontend
1. Open http://localhost:5173
2. Click "New Chat"
3. Send a test message
4. Verify streaming response appears

## Performance

- **Backend**: Handles 1000+ concurrent SSE connections with Hono
- **Frontend**: Optimized with React 18 concurrent features
- **Database**: Indexed queries for fast thread/message retrieval
- **Streaming**: Low latency with chunked transfer encoding

## Security

- **Input Validation**: Zod schemas for all API inputs
- **Guardrails**: Optional content filtering
- **CORS**: Configured for specific origins
- **Environment Variables**: Secrets not committed to Git
- **SQL Injection**: Protected by Drizzle ORM

## License

MIT - See monorepo root LICENSE file

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## Support

- **Documentation**: See individual READMEs in `backend/` and `frontend/`
- **Issues**: Open GitHub issues for bugs
- **Discussions**: Use GitHub Discussions for questions

## Roadmap

Future enhancements:
- [ ] Multi-modal support (images, files)
- [ ] RAG integration with vector search
- [ ] User authentication
- [ ] Message reactions and threading
- [ ] Export conversations
- [ ] Voice input/output
- [ ] Dark mode
- [ ] Mobile app (React Native)

## Acknowledgments

Built with:
- [Seashore](https://github.com/seashore/seashore) - AI agent framework
- [Hono](https://hono.dev) - Web framework
- [React](https://react.dev) - UI library
- [Vite](https://vitejs.dev) - Build tool
- [PostgreSQL](https://postgresql.org) - Database
- [Drizzle ORM](https://orm.drizzle.team) - Type-safe ORM

---

**Happy Building!** 🌊
