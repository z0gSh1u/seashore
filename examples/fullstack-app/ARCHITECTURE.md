# Architecture Overview

This document provides a detailed architecture overview of the full-stack Seashore chat application.

## System Architecture

```
┌───────────────────────────────────────────────────────────────────────────┐
│                         USER BROWSER (http://localhost:5173)               │
│                                                                            │
│  ┌──────────────────────────────────────────────────────────────────────┐ │
│  │                      React Application (Vite)                        │ │
│  │                                                                       │ │
│  │  ┌────────────────┐          ┌──────────────────────────────────┐  │ │
│  │  │   App.tsx      │          │         Chat.tsx                 │  │ │
│  │  │                │          │                                   │  │ │
│  │  │ - Sidebar      │◄────────►│  - useSeashoreChat hook         │  │ │
│  │  │ - Thread List  │          │  - Message Display               │  │ │
│  │  │ - Navigation   │          │  - Input Handling                │  │ │
│  │  │ - Welcome      │          │  - Streaming UI                  │  │ │
│  │  └────────┬───────┘          └────────────┬─────────────────────┘  │ │
│  │           │                                │                         │ │
│  │           │        useSeashoreChat(@seashore/react)                 │ │
│  │           │                                │                         │ │
│  └───────────┼────────────────────────────────┼─────────────────────────┘ │
│              │ HTTP                            │ SSE                      │
└──────────────┼────────────────────────────────┼─────────────────────────┘
               │                                 │
               │ Vite Dev Proxy (:5173 → :3001) │
               │                                 │
┌──────────────▼─────────────────────────────────▼─────────────────────────┐
│                   BACKEND SERVER (http://localhost:3001)                  │
│                                                                            │
│  ┌──────────────────────────────────────────────────────────────────────┐ │
│  │                    Hono Web Server (server.ts)                       │ │
│  │                                                                       │ │
│  │  ┌────────────────┐    ┌─────────────────────────────────────────┐ │ │
│  │  │  Middleware    │    │      seashoreMiddleware                 │ │ │
│  │  │                │    │      (@seashore/platform)               │ │ │
│  │  │  - CORS        │───►│                                         │ │ │
│  │  │  - Logger      │    │  Routes:                                │ │ │
│  │  │  - Error       │    │  • POST /api/chat (streaming)          │ │ │
│  │  │    Handler     │    │  • GET  /api/threads                   │ │ │
│  │  └────────────────┘    │  • POST /api/threads                   │ │ │
│  │                         │  • GET  /api/threads/:id/messages     │ │ │
│  │                         └────────────┬────────────────────────────┘ │ │
│  └──────────────────────────────────────┼────────────────────────────────┘ │
│                                          │                                  │
│         ┌────────────────────────────────┴──────────────────────┐          │
│         │                                                        │          │
│         ▼                                                        ▼          │
│  ┌──────────────────────┐                          ┌──────────────────┐   │
│  │   Deployable Agent   │                          │  Storage Service │   │
│  │   (wrapper)          │                          │  (@seashore/data)│   │
│  │                      │                          │                  │   │
│  │  - stream()          │                          │  - createThread()│   │
│  │  - run()             │                          │  - addMessage()  │   │
│  │                      │                          │  - getMessages() │   │
│  └──────────┬───────────┘                          └─────────┬────────┘   │
│             │                                                 │            │
│             ▼                                                 │            │
│  ┌──────────────────────────────────────────────────┐        │            │
│  │         ReAct Agent                              │        │            │
│  │         (@seashore/agent)                        │        │            │
│  │                                                   │        │            │
│  │  - System Prompt                                 │        │            │
│  │  - Max Iterations: 5                             │        │            │
│  │  - Tools:                                        │        │            │
│  │    • calculator                                  │        │            │
│  │    • get_current_time                           │        │            │
│  │    • random_number                              │        │            │
│  │                                                   │        │            │
│  └────────────────┬──────────────────┬──────────────┘        │            │
│                   │                  │                        │            │
│                   ▼                  ▼                        │            │
│  ┌────────────────────────┐  ┌──────────────────┐           │            │
│  │   LLM Adapter          │  │   Tool Execution │           │            │
│  │   (@seashore/core)     │  │                  │           │            │
│  │                        │  │  - Zod Schemas   │           │            │
│  │  - Provider: OpenAI    │  │  - Execute Logic │           │            │
│  │  - Model: gpt-4o-mini  │  │  - Return Results│           │            │
│  │  - Streaming: Yes      │  └──────────────────┘           │            │
│  └────────────┬───────────┘                                  │            │
│               │                                               │            │
│               ▼                                               ▼            │
└───────────────┼───────────────────────────────────────────────┼────────────┘
                │ HTTPS                                         │ TCP
                │                                               │
                ▼                                               ▼
   ┌────────────────────────┐                      ┌─────────────────────┐
   │   OpenAI API           │                      │   PostgreSQL DB     │
   │   api.openai.com       │                      │   localhost:5432    │
   │                        │                      │                     │
   │   - GPT-4 Turbo        │                      │   Tables:           │
   │   - Streaming          │                      │   • threads         │
   │   - Tool Calling       │                      │   • messages        │
   └────────────────────────┘                      │   • workflow_runs   │
                                                    └─────────────────────┘
```

## Data Flow

### 1. User Sends Message

```
User Input (Chat.tsx)
  └─► sendMessage() from useSeashoreChat
      └─► POST /api/chat
          ├─ messages: [{ role: 'user', content: '...' }]
          ├─ threadId: 'uuid'
          └─ stream: true
```

### 2. Backend Processes Request

```
Hono Server
  └─► seashoreMiddleware receives request
      ├─► Persist user message to DB (if threadId provided)
      ├─► Extract last message content
      └─► Call deployableAgent.stream(content, { messages })
          └─► ReAct Agent
              ├─► Apply beforeRequest guardrails
              ├─► Build chat options with tools
              ├─► Call LLM (OpenAI GPT-4)
              │   ├─► Agent reasons about task
              │   ├─► Decides to use tools (if needed)
              │   └─► Generates tool calls
              ├─► Execute tools (calculator, time, etc.)
              ├─► Feed tool results back to LLM
              ├─► LLM generates final response
              └─► Apply afterResponse guardrails
```

### 3. Streaming Response

```
Agent.stream() yields chunks
  └─► deployableAgent.stream() transforms chunks
      └─► seashoreMiddleware writes SSE
          ├─ event: 'message'
          ├─ data: { type: 'content', delta: '...' }
          └─► Browser receives SSE chunks
              └─► useSeashoreChat hook processes
                  └─► Updates message state
                      └─► Chat.tsx re-renders
                          └─► User sees streaming text
```

### 4. Thread Management

```
App.tsx on mount
  └─► fetch('/api/threads')
      └─► seashoreMiddleware
          └─► storage.listThreads()
              └─► PostgreSQL query
                  └─► Returns thread list
                      └─► Display in sidebar

User clicks "New Chat"
  └─► POST /api/threads
      └─► storage.createThread({ title: '...' })
          └─► INSERT INTO threads
              └─► Returns new thread
                  └─► Update UI, select thread
```

## Component Responsibilities

### Frontend

#### App.tsx
- **Purpose**: Application shell and navigation
- **State**: `threads`, `currentThreadId`, `isLoadingThreads`
- **Actions**: Load threads, create thread, select thread
- **API Calls**: `/api/threads` (GET, POST)

#### Chat.tsx
- **Purpose**: Chat interface for a specific thread
- **Hook**: `useSeashoreChat` from `@seashore/react`
- **State**: `messages`, `input`, `isStreaming`, `error`
- **Actions**: Send message, clear messages
- **API Calls**: `/api/chat` (POST with streaming)

#### useSeashoreChat Hook
- **Purpose**: Manage chat state and SSE connection
- **Returns**: `{ messages, sendMessage, isStreaming, error, clearMessages }`
- **Handles**: SSE parsing, message accumulation, error handling

### Backend

#### server.ts
- **Purpose**: Main server entrypoint
- **Setup**: Database, storage, agent, middleware
- **Exports**: Hono app with all routes

#### seashoreMiddleware
- **Purpose**: Standardized API for Seashore agents
- **Routes**: `/chat`, `/threads`, `/threads/:id/messages`
- **Handles**: Request validation, streaming, persistence

#### deployableAgent Wrapper
- **Purpose**: Adapt ReAct agent to middleware interface
- **Methods**: `stream()`, `run()`
- **Transforms**: TanStack AI chunks → SSE format

#### ReAct Agent
- **Purpose**: Reasoning and acting agent
- **Components**: LLM adapter, tools, guardrails
- **Process**: Iterative reasoning with tool use

#### Storage Service
- **Purpose**: Database persistence layer
- **ORM**: Drizzle
- **Tables**: threads, messages, workflow_runs

## Technology Stack Summary

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| **UI Framework** | React | 18.3 | User interface |
| **Build Tool** | Vite | 6.0 | Frontend bundling & dev server |
| **Web Framework** | Hono | 4.6 | HTTP server |
| **Agent** | @seashore/agent | 0.0.1 | ReAct agent |
| **LLM** | @seashore/core | 0.0.1 | OpenAI adapter |
| **Storage** | @seashore/data | 0.0.1 | PostgreSQL persistence |
| **Platform** | @seashore/platform | 0.0.1 | Middleware & deployment |
| **React Hooks** | @seashore/react | 0.0.1 | Frontend integration |
| **Database** | PostgreSQL | 14+ | Data persistence |
| **ORM** | Drizzle | 0.38 | Type-safe queries |
| **Schema** | Zod | 3.24 | Runtime validation |
| **AI SDK** | TanStack AI | 0.4 | LLM orchestration |
| **TypeScript** | TypeScript | 5.7 | Type safety |

## Key Design Decisions

### 1. Pure ESM
- All packages use ES modules (`.js` extensions)
- Better tree-shaking and modern bundler support

### 2. Streaming-First
- SSE for real-time response streaming
- Better UX than polling or waiting for complete response

### 3. Separation of Concerns
- Backend: Agent logic, tools, persistence
- Frontend: UI, state management, user interaction
- Middleware: Protocol adapter (ReAct ↔ HTTP/SSE)

### 4. Type Safety
- End-to-end TypeScript
- Zod schemas for runtime validation
- Drizzle ORM for type-safe queries

### 5. Monorepo Structure
- Shared packages via workspace protocol
- Single source of truth for types
- Easy cross-package refactoring

### 6. Production-Ready
- Error handling at every layer
- Graceful shutdown
- CORS configuration
- Health checks
- Logging

## Scalability Considerations

### Current Architecture
- Single backend server
- Direct PostgreSQL connection
- In-memory agent state

### For Production Scale
1. **Horizontal Scaling**: Load balancer + multiple Hono instances
2. **Database**: Connection pooling (pgBouncer)
3. **Caching**: Redis for session/thread metadata
4. **Queue**: Background job processing for long-running agents
5. **Observability**: OpenTelemetry for tracing
6. **Rate Limiting**: Per-user API limits

## Security Notes

- CORS configured for specific origins
- Environment variables for secrets
- SQL injection protection via ORM
- Input validation with Zod
- Optional guardrails for content filtering

## Performance Characteristics

- **First Byte Time**: ~100-300ms (depending on LLM)
- **Streaming Latency**: ~50-100ms per chunk
- **Database Queries**: <10ms (indexed)
- **Concurrent SSE Connections**: 1000+ (Hono)

---

This architecture balances simplicity (easy to understand), production-readiness (error handling, types), and extensibility (easy to add tools, change LLMs, scale).
