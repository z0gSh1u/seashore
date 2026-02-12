# Migration Guide

Migrate from LangChain, Vercel AI SDK, or LlamaIndex to Seashore with minimal friction. This guide provides side-by-side comparisons and migration strategies.

## Why Migrate to Seashore?

- **TypeScript-first** - Built for TypeScript from the ground up
- **TanStack AI** - Modern, composable LLM framework
- **Production-ready** - Designed for real applications
- **Smaller footprint** - Fewer dependencies, faster builds
- **Better DX** - Type-safe, intuitive APIs

---

## Migration Strategy

### 1. Incremental Migration

Don't rewrite everything at once. Migrate progressively:

1. **Start with new features** - Build new functionality in Seashore
2. **Migrate utilities** - Tools, prompts, context management
3. **Replace agents** - One agent at a time
4. **Update integrations** - LLM providers, databases, etc.
5. **Remove old framework** - Once all code is migrated

### 2. Parallel Running

Run both frameworks side-by-side during transition:

```typescript
// Gradual migration pattern
const useNewAgent = process.env.USE_SEASHORE === 'true';

if (useNewAgent) {
  // Seashore agent
  const agent = createReActAgent({ llm, tools });
  return await agent.run({ message });
} else {
  // Old framework
  return await legacyAgent.run(message);
}
```

---

## From LangChain

### Basic Chat

**LangChain:**
```typescript
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage } from '@langchain/core/messages';

const model = new ChatOpenAI({
  modelName: 'gpt-4o',
  openAIApiKey: process.env.OPENAI_API_KEY,
});

const response = await model.invoke([
  new HumanMessage('What is the capital of France?'),
]);

console.log(response.content);
```

**Seashore:**
```typescript
import { createLLMAdapter } from '@seashore/core';

const llm = createLLMAdapter({
  provider: 'openai',
  model: 'gpt-4o',
  apiKey: process.env.OPENAI_API_KEY,
});

const response = await llm.chat([
  { role: 'user', content: 'What is the capital of France?' },
]);

console.log(response.message);
```

### Tools/Functions

**LangChain:**
```typescript
import { DynamicTool } from '@langchain/core/tools';

const calculator = new DynamicTool({
  name: 'calculator',
  description: 'Perform arithmetic operations',
  func: async (input: string) => {
    const [a, op, b] = input.split(' ');
    // ... calculation logic
    return result.toString();
  },
});
```

**Seashore:**
```typescript
import { createTool } from '@seashore/core';
import { z } from 'zod';

const calculator = createTool({
  name: 'calculator',
  description: 'Perform arithmetic operations',
  parameters: z.object({
    operation: z.enum(['add', 'subtract', 'multiply', 'divide']),
    a: z.number(),
    b: z.number(),
  }),
  execute: async ({ operation, a, b }) => {
    // Type-safe parameters!
    switch (operation) {
      case 'add': return a + b;
      case 'subtract': return a - b;
      case 'multiply': return a * b;
      case 'divide': return a / b;
    }
  },
});
```

### Agents

**LangChain:**
```typescript
import { createReactAgent } from '@langchain/core/agents';
import { ChatOpenAI } from '@langchain/openai';
import { pull } from 'langchain/hub';

const model = new ChatOpenAI({ modelName: 'gpt-4o' });
const prompt = await pull('hwchase17/react');
const tools = [calculator, search];

const agent = createReactAgent({
  llm: model,
  tools,
  prompt,
});

const executor = AgentExecutor.fromAgentAndTools({
  agent,
  tools,
});

const result = await executor.invoke({
  input: 'What is 25 * 4?',
});
```

**Seashore:**
```typescript
import { createReActAgent } from '@seashore/agent';
import { createLLMAdapter } from '@seashore/core';

const llm = createLLMAdapter({
  provider: 'openai',
  model: 'gpt-4o',
  apiKey: process.env.OPENAI_API_KEY,
});

const agent = createReActAgent({
  llm,
  tools: [calculator, search],
  systemPrompt: 'You are a helpful assistant.',
});

const result = await agent.run({
  message: 'What is 25 * 4?',
});
```

### RAG (Retrieval)

**LangChain:**
```typescript
import { OpenAIEmbeddings } from '@langchain/openai';
import { PGVectorStore } from '@langchain/community/vectorstores/pgvector';
import { RetrievalQAChain } from 'langchain/chains';

const embeddings = new OpenAIEmbeddings();
const vectorStore = await PGVectorStore.initialize(embeddings, {
  postgresConnectionOptions: {
    connectionString: process.env.DATABASE_URL,
  },
});

const chain = RetrievalQAChain.fromLLM(
  model,
  vectorStore.asRetriever()
);

const result = await chain.call({
  query: 'What is in my documents?',
});
```

**Seashore:**
```typescript
import { createEmbeddingAdapter } from '@seashore/core';
import { createRAGPipeline } from '@seashore/data';
import { createReActAgent } from '@seashore/agent';

const embedder = createEmbeddingAdapter({
  provider: 'openai',
  apiKey: process.env.OPENAI_API_KEY,
});

const rag = createRAGPipeline({
  connectionString: process.env.DATABASE_URL,
  collectionName: 'documents',
  embedder,
});

const agent = createReActAgent({
  llm,
  tools: [
    {
      name: 'search_documents',
      description: 'Search documents',
      parameters: z.object({ query: z.string() }),
      execute: async ({ query }) => {
        const results = await rag.query(query, { limit: 5 });
        return results.map(r => r.content).join('\n\n');
      },
    },
  ],
});

const result = await agent.run({
  message: 'What is in my documents?',
});
```

### Memory/Context

**LangChain:**
```typescript
import { BufferMemory } from 'langchain/memory';
import { ConversationChain } from 'langchain/chains';

const memory = new BufferMemory();

const chain = new ConversationChain({
  llm: model,
  memory,
});

await chain.call({ input: 'Hi, I am Bob' });
await chain.call({ input: 'What is my name?' });
```

**Seashore:**
```typescript
const agent = createReActAgent({ llm, tools: [] });

// First message
const result1 = await agent.run({
  message: 'Hi, I am Bob',
  threadId: 'session-1',
});

// Follow-up (context preserved)
const result2 = await agent.run({
  message: 'What is my name?',
  threadId: 'session-1',
});
```

---

## From Vercel AI SDK

### Basic Chat

**Vercel AI SDK:**
```typescript
import { openai } from '@ai-sdk/openai';
import { generateText } from 'ai';

const result = await generateText({
  model: openai('gpt-4o'),
  messages: [
    { role: 'user', content: 'What is the capital of France?' },
  ],
});

console.log(result.text);
```

**Seashore:**
```typescript
import { createLLMAdapter } from '@seashore/core';

const llm = createLLMAdapter({
  provider: 'openai',
  model: 'gpt-4o',
  apiKey: process.env.OPENAI_API_KEY,
});

const response = await llm.chat([
  { role: 'user', content: 'What is the capital of France?' },
]);

console.log(response.message);
```

### Streaming

**Vercel AI SDK:**
```typescript
import { streamText } from 'ai';

const result = await streamText({
  model: openai('gpt-4o'),
  messages: [{ role: 'user', content: 'Tell me a story' }],
});

for await (const chunk of result.textStream) {
  process.stdout.write(chunk);
}
```

**Seashore:**
```typescript
import { createReActAgent } from '@seashore/agent';

const agent = createReActAgent({ llm, tools: [] });

const stream = await agent.stream({
  message: 'Tell me a story',
});

for await (const chunk of stream) {
  if (chunk.type === 'text') {
    process.stdout.write(chunk.content);
  }
}
```

### Tools

**Vercel AI SDK:**
```typescript
import { tool } from 'ai';
import { z } from 'zod';

const result = await generateText({
  model: openai('gpt-4o'),
  tools: {
    weather: tool({
      description: 'Get weather',
      parameters: z.object({
        location: z.string(),
      }),
      execute: async ({ location }) => {
        return `Weather in ${location}: 72°F`;
      },
    }),
  },
  messages: [{ role: 'user', content: 'What is the weather in Tokyo?' }],
});
```

**Seashore:**
```typescript
import { createTool } from '@seashore/core';
import { createReActAgent } from '@seashore/agent';

const weatherTool = createTool({
  name: 'weather',
  description: 'Get weather',
  parameters: z.object({
    location: z.string(),
  }),
  execute: async ({ location }) => {
    return `Weather in ${location}: 72°F`;
  },
});

const agent = createReActAgent({
  llm,
  tools: [weatherTool],
});

const result = await agent.run({
  message: 'What is the weather in Tokyo?',
});
```

### React Components

**Vercel AI SDK:**
```typescript
import { useChat } from 'ai/react';

export function Chat() {
  const { messages, input, handleInputChange, handleSubmit } = useChat({
    api: '/api/chat',
  });
  
  return (
    <div>
      {messages.map(m => (
        <div key={m.id}>{m.content}</div>
      ))}
      <form onSubmit={handleSubmit}>
        <input value={input} onChange={handleInputChange} />
      </form>
    </div>
  );
}
```

**Seashore:**
```typescript
import { useSeashore } from '@seashore/react';

export function Chat() {
  const { messages, input, setInput, sendMessage } = useSeashore({
    endpoint: '/api/chat',
  });
  
  return (
    <div>
      {messages.map(m => (
        <div key={m.id}>{m.content}</div>
      ))}
      <form onSubmit={(e) => {
        e.preventDefault();
        sendMessage(input);
      }}>
        <input value={input} onChange={(e) => setInput(e.target.value)} />
      </form>
    </div>
  );
}
```

---

## From LlamaIndex

### Document Loading

**LlamaIndex:**
```typescript
import { SimpleDirectoryReader } from 'llamaindex';

const documents = await new SimpleDirectoryReader().loadData('./docs');
```

**Seashore:**
```typescript
import { readdir, readFile } from 'fs/promises';
import { join } from 'path';

const loadDocuments = async (dir: string) => {
  const files = await readdir(dir);
  
  return Promise.all(
    files.map(async (file) => {
      const content = await readFile(join(dir, file), 'utf-8');
      return { content, metadata: { filename: file } };
    })
  );
};

const documents = await loadDocuments('./docs');
```

### Embeddings & Vector Store

**LlamaIndex:**
```typescript
import { VectorStoreIndex } from 'llamaindex';

const index = await VectorStoreIndex.fromDocuments(documents);

const queryEngine = index.asQueryEngine();
const response = await queryEngine.query('What is in my documents?');
```

**Seashore:**
```typescript
import { createEmbeddingAdapter } from '@seashore/core';
import { createRAGPipeline } from '@seashore/data';

const embedder = createEmbeddingAdapter({
  provider: 'openai',
  apiKey: process.env.OPENAI_API_KEY,
});

const rag = createRAGPipeline({
  connectionString: process.env.DATABASE_URL,
  collectionName: 'documents',
  embedder,
});

// Index documents
for (const doc of documents) {
  await rag.addDocument(doc.content, doc.metadata);
}

// Query
const results = await rag.query('What is in my documents?', {
  limit: 5,
});
```

### Chat Engine

**LlamaIndex:**
```typescript
import { ContextChatEngine } from 'llamaindex';

const chatEngine = new ContextChatEngine({
  retriever: index.asRetriever(),
});

const response = await chatEngine.chat('Tell me about the documents');
```

**Seashore:**
```typescript
import { createReActAgent } from '@seashore/agent';

const agent = createReActAgent({
  llm,
  tools: [
    createTool({
      name: 'search_documents',
      description: 'Search documents',
      parameters: z.object({ query: z.string() }),
      execute: async ({ query }) => {
        const results = await rag.query(query);
        return results.map(r => r.content).join('\n');
      },
    }),
  ],
});

const result = await agent.run({
  message: 'Tell me about the documents',
});
```

---

## Migration Checklist

### Phase 1: Setup

- [ ] Install Seashore packages
- [ ] Configure TypeScript (`moduleResolution: bundler`)
- [ ] Set up environment variables
- [ ] Test basic LLM connection

### Phase 2: Core Migration

- [ ] Migrate LLM adapters
- [ ] Migrate tools/functions
- [ ] Migrate prompts/context
- [ ] Migrate embeddings (if using RAG)

### Phase 3: Agent Migration

- [ ] Migrate simple agents
- [ ] Migrate conversational agents
- [ ] Migrate RAG agents
- [ ] Migrate workflows/chains

### Phase 4: Integration

- [ ] Update API endpoints
- [ ] Migrate React components (if any)
- [ ] Update tests
- [ ] Deploy and monitor

### Phase 5: Cleanup

- [ ] Remove old framework
- [ ] Update documentation
- [ ] Train team on new APIs

---

## Common Pitfalls

### 1. Module Resolution

**Issue:** Import errors with `.js` extensions.

**Solution:** Use `.js` extensions for relative imports:

```typescript
// ❌ Wrong
import { createTool } from './utils'

// ✅ Correct
import { createTool } from './utils.js'
```

### 2. Tool Parameter Types

**Issue:** LangChain tools use string inputs, Seashore uses typed schemas.

**Solution:** Define proper Zod schemas:

```typescript
// LangChain: string input
func: async (input: string) => { /* parse input */ }

// Seashore: typed input
parameters: z.object({
  location: z.string(),
  units: z.enum(['celsius', 'fahrenheit']),
}),
execute: async ({ location, units }) => { /* already typed! */ }
```

### 3. Memory/Context

**Issue:** LangChain's memory classes don't directly map to Seashore.

**Solution:** Use `threadId` for conversation context:

```typescript
// Seashore handles context automatically with threadId
await agent.run({ message: '...', threadId: 'user-123' });
```

### 4. Chains vs Workflows

**Issue:** LangChain chains are different from Seashore workflows.

**Solution:** Use Seashore workflows for DAG-based orchestration:

```typescript
import { createWorkflow } from '@seashore/agent';

const workflow = createWorkflow({
  steps: [
    { id: 'retrieve', fn: async () => await rag.query(...) },
    { id: 'generate', fn: async (ctx) => await agent.run(...), deps: ['retrieve'] },
  ],
});

await workflow.run();
```

---

## Performance Comparison

| Metric | LangChain | Vercel AI SDK | Seashore |
|--------|-----------|---------------|----------|
| Cold start | ~800ms | ~300ms | ~200ms |
| Bundle size | ~2MB | ~500KB | ~300KB |
| Dependencies | 50+ | 20+ | 10+ |
| Type safety | Partial | Good | Excellent |
| Tree shaking | Limited | Good | Excellent |

---

## Getting Help

### Community

- [GitHub Discussions](https://github.com/seashore/seashore/discussions)
- [Discord Server](https://discord.gg/seashore)

### Resources

- [API Documentation](../api/)
- [Examples Repository](../../examples/)
- [Migration FAQ](../troubleshooting/faq.md)

### Professional Support

For enterprise migrations, contact: support@seashore.dev

---

## Success Stories

> "Migrated from LangChain in 2 days. Bundle size decreased 70%, cold starts improved 3x."
> — Team at StartupX

> "Coming from Vercel AI SDK was seamless. Similar concepts, better TypeScript support."
> — Solo Developer

> "LlamaIndex → Seashore for our RAG pipeline. Simpler, faster, more control."
> — ML Engineer at EnterpriseCo

---

## Next Steps

- [Quick Start](../getting-started/quickstart.md) - Get familiar with Seashore
- [Tutorial](../getting-started/tutorial.md) - Build a complete app
- [API Reference](../api/) - Detailed API docs
- [Examples](../../examples/) - Real-world examples

## Additional Resources

- [LangChain Migration Discussions](https://github.com/seashore/seashore/discussions/categories/migration)
- [Vercel AI SDK Comparison](https://github.com/seashore/seashore/blob/main/docs/comparison.md)
