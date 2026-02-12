# Tutorial: Building a Complete AI Application

In this tutorial, you'll build a complete AI application with:
- A ReAct agent with custom tools
- RAG for document knowledge
- A web API with Hono
- A React frontend

**Time:** ~30 minutes  
**Level:** Beginner to Intermediate

## Prerequisites

- Node.js 18+
- pnpm installed
- An OpenAI API key
- PostgreSQL with pgvector (for RAG section)

## Part 1: Building a Research Assistant

Let's build an agent that can search the web and answer questions.

### Step 1: Setup Project

```bash
mkdir research-assistant
cd research-assistant
pnpm init
pnpm add @seashore/core @seashore/agent tsx typescript zod
```

### Step 2: Create a Web Search Tool

Create `tools.ts`:

```typescript
import { z } from 'zod';

// For this tutorial, we'll simulate web search
// In production, use an API like Serper, Brave Search, or Tavily
export const webSearchTool = {
  name: 'web_search',
  description: 'Search the web for current information. Use this when you need up-to-date facts.',
  parameters: z.object({
    query: z.string().describe('The search query'),
  }),
  execute: async ({ query }: { query: string }) => {
    // Simulated search results
    const mockResults = {
      'TypeScript': 'TypeScript is a strongly typed programming language that builds on JavaScript, developed by Microsoft.',
      'Seashore framework': 'Seashore is a TypeScript-first AI agent framework built on TanStack AI.',
      'default': `Search results for "${query}": [Various relevant articles and information]`,
    };
    
    for (const [key, value] of Object.entries(mockResults)) {
      if (query.toLowerCase().includes(key.toLowerCase())) {
        return value;
      }
    }
    
    return mockResults.default;
  },
};
```

### Step 3: Create the Agent

Create `agent.ts`:

```typescript
import { createLLMAdapter } from '@seashore/core';
import { createReActAgent } from '@seashore/agent';
import { webSearchTool } from './tools.js';

export function createResearchAgent() {
  const llm = createLLMAdapter({
    provider: 'openai',
    model: 'gpt-4o',
    apiKey: process.env.OPENAI_API_KEY!,
  });

  const agent = createReActAgent({
    llm,
    tools: [webSearchTool],
    systemPrompt: `You are a helpful research assistant. 
    Use the web_search tool to find current information when needed.
    Always cite your sources and be thorough in your responses.`,
    maxIterations: 5,
  });

  return agent;
}
```

### Step 4: Test the Agent

Create `index.ts`:

```typescript
import { createResearchAgent } from './agent.js';

async function main() {
  const agent = createResearchAgent();

  console.log('🔬 Research Assistant Ready!\n');

  // Test query
  const result = await agent.run({
    message: 'What is TypeScript and why is it useful?',
  });

  console.log('📝 Answer:', result.message);
  console.log('\n🔧 Tools used:', result.toolCalls?.length || 0);
}

main().catch(console.error);
```

Run it:
```bash
export OPENAI_API_KEY='sk-...'
tsx index.ts
```

## Part 2: Adding RAG for Document Knowledge

Now let's give the agent knowledge from documents.

### Step 1: Install Data Package

```bash
pnpm add @seashore/data drizzle-orm postgres
```

### Step 2: Setup Database

```bash
# Create database
createdb research_assistant

# Enable pgvector
psql research_assistant -c "CREATE EXTENSION IF NOT EXISTS vector;"
```

Set environment variable:
```bash
export DATABASE_URL="postgresql://localhost/research_assistant"
```

### Step 3: Create RAG Pipeline

Create `rag.ts`:

```typescript
import { createEmbeddingAdapter } from '@seashore/core';
import { createVectorDBService, createRAG } from '@seashore/data';

export async function setupRAG() {
  // Create embedder
  const embedder = createEmbeddingAdapter({
    provider: 'openai',
    model: 'text-embedding-3-small',
    apiKey: process.env.OPENAI_API_KEY!,
  });

  // Create vector database
  const vectorDB = await createVectorDBService({
    connectionString: process.env.DATABASE_URL!,
  });

  // Create RAG pipeline
  const rag = createRAG({
    embedder,
    vectorDB,
    chunkSize: 512,
    chunkOverlap: 50,
  });

  return { rag, vectorDB };
}
```

### Step 4: Index Documents

Create `indexDocs.ts`:

```typescript
import { setupRAG } from './rag.js';

async function indexDocuments() {
  const { rag } = await setupRAG();

  // Sample documents about Seashore
  const docs = [
    {
      id: '1',
      content: `Seashore is a TypeScript-first AI agent framework built on TanStack AI. 
      It provides modular packages for building production AI agents with workflow orchestration, 
      RAG capabilities, and deployment infrastructure.`,
      metadata: { source: 'docs', title: 'Introduction' },
    },
    {
      id: '2',
      content: `Seashore includes five packages: core (LLM adapters, tools), 
      agent (ReAct agents, workflows), data (PostgreSQL + pgvector), 
      platform (MCP, guardrails, evaluation), and react (React hooks).`,
      metadata: { source: 'docs', title: 'Packages' },
    },
    {
      id: '3',
      content: `ReAct agents in Seashore use the Reasoning + Acting pattern. 
      They can call tools, observe results, and iterate until completing the task.`,
      metadata: { source: 'docs', title: 'ReAct Pattern' },
    },
  ];

  await rag.indexDocuments(docs);
  console.log('✅ Indexed', docs.length, 'documents');
}

indexDocuments().catch(console.error);
```

Run it:
```bash
tsx indexDocs.ts
```

### Step 5: Create Knowledge Retrieval Tool

Update `tools.ts`:

```typescript
import { setupRAG } from './rag.js';

let ragInstance: Awaited<ReturnType<typeof setupRAG>> | null = null;

export async function getRAGTool() {
  if (!ragInstance) {
    ragInstance = await setupRAG();
  }

  return {
    name: 'search_knowledge',
    description: 'Search the knowledge base for information about Seashore framework',
    parameters: z.object({
      query: z.string().describe('What to search for'),
    }),
    execute: async ({ query }: { query: string }) => {
      const results = await ragInstance!.rag.retrieve({
        query,
        topK: 3,
        hybridAlpha: 0.5,
      });

      if (results.length === 0) {
        return 'No relevant information found.';
      }

      return results
        .map(r => `[${r.metadata.title}] ${r.content}`)
        .join('\n\n');
    },
  };
}
```

### Step 6: Update Agent with RAG

Update `agent.ts`:

```typescript
import { webSearchTool } from './tools.js';
import { getRAGTool } from './tools.js';

export async function createResearchAgent() {
  const llm = createLLMAdapter({
    provider: 'openai',
    model: 'gpt-4o',
    apiKey: process.env.OPENAI_API_KEY!,
  });

  const knowledgeTool = await getRAGTool();

  const agent = createReActAgent({
    llm,
    tools: [webSearchTool, knowledgeTool],
    systemPrompt: `You are a helpful research assistant.
    Use search_knowledge for questions about Seashore framework.
    Use web_search for general information.
    Always cite your sources.`,
    maxIterations: 5,
  });

  return agent;
}
```

Test it:
```typescript
const agent = await createResearchAgent();

const result = await agent.run({
  message: 'How many packages does Seashore have and what are they?',
});

console.log(result.message);
// Agent will use the knowledge base!
```

## Part 3: Building a Web API

Let's expose the agent as a web API.

### Step 1: Install Hono

```bash
pnpm add hono @hono/node-server
```

### Step 2: Create API

Create `server.ts`:

```typescript
import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { createResearchAgent } from './agent.js';

const app = new Hono();

app.get('/', (c) => {
  return c.json({ message: 'Research Assistant API' });
});

app.post('/chat', async (c) => {
  try {
    const { message, threadId } = await c.req.json();
    
    if (!message) {
      return c.json({ error: 'Message is required' }, 400);
    }

    const agent = await createResearchAgent();
    const result = await agent.run({ message, threadId });

    return c.json({
      message: result.message,
      threadId: result.threadId,
      toolCalls: result.toolCalls?.length || 0,
    });
  } catch (error) {
    console.error(error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

const port = 3000;
console.log(`🚀 Server running on http://localhost:${port}`);
serve({ fetch: app.fetch, port });
```

Run it:
```bash
tsx server.ts
```

Test:
```bash
curl -X POST http://localhost:3000/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "What is Seashore?"}'
```

## Part 4: Building a React Frontend

### Step 1: Create React App

```bash
pnpm create vite frontend --template react-ts
cd frontend
pnpm install
pnpm add @seashore/react
```

### Step 2: Create Chat Component

Create `src/Chat.tsx`:

```typescript
import { useState } from 'react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export function Chat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const sendMessage = async () => {
    if (!input.trim()) return;

    const userMessage = { role: 'user' as const, content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const response = await fetch('http://localhost:3000/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: input }),
      });

      const data = await response.json();
      
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: data.message },
      ]);
    } catch (error) {
      console.error(error);
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: 'Error: Could not get response' },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: 20 }}>
      <h1>🔬 Research Assistant</h1>
      
      <div style={{ border: '1px solid #ddd', borderRadius: 8, padding: 20, marginBottom: 20, height: 400, overflowY: 'auto' }}>
        {messages.map((msg, i) => (
          <div key={i} style={{ marginBottom: 15 }}>
            <strong>{msg.role === 'user' ? '🧑 You' : '🤖 Assistant'}:</strong>
            <div style={{ marginTop: 5 }}>{msg.content}</div>
          </div>
        ))}
        {loading && <div>⏳ Thinking...</div>}
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
          placeholder="Ask a question..."
          style={{ flex: 1, padding: 10, fontSize: 16, borderRadius: 4, border: '1px solid #ddd' }}
          disabled={loading}
        />
        <button
          onClick={sendMessage}
          disabled={loading || !input.trim()}
          style={{ padding: '10px 20px', fontSize: 16, borderRadius: 4, background: '#007bff', color: 'white', border: 'none', cursor: 'pointer' }}
        >
          Send
        </button>
      </div>
    </div>
  );
}
```

Update `src/App.tsx`:
```typescript
import { Chat } from './Chat';

function App() {
  return <Chat />;
}

export default App;
```

### Step 3: Run Frontend

```bash
pnpm dev
```

Visit `http://localhost:5173` and chat with your agent!

## Part 5: Adding Streaming

Let's make responses stream in real-time.

### Update Server

```typescript
app.post('/chat/stream', async (c) => {
  const { message } = await c.req.json();
  
  const agent = await createResearchAgent();
  const stream = await agent.stream({ message });

  return c.newResponse(
    new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            if (chunk.type === 'text') {
              controller.enqueue(new TextEncoder().encode(
                `data: ${JSON.stringify({ type: 'text', content: chunk.content })}\n\n`
              ));
            }
          }
          controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'));
          controller.close();
        } catch (error) {
          controller.error(error);
        }
      },
    }),
    {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    }
  );
});
```

## Summary

You've built:
✅ A ReAct agent with custom tools  
✅ RAG pipeline with pgvector  
✅ REST API with Hono  
✅ React frontend with chat interface  
✅ Streaming responses  

## Next Steps

- **Add Guardrails**: Prevent harmful outputs
- **Add Evaluation**: Test agent quality
- **Deploy**: Use Docker or serverless
- **Add MCP**: Connect to external tools

Check out the [Guides](../guides) for more advanced patterns!
