# Frequently Asked Questions (FAQ)

Common questions about Seashore, organized by topic.

## General

### What is Seashore?

Seashore is a TypeScript-first framework for building production-ready AI agents. It provides:
- Type-safe LLM adapters (OpenAI, Anthropic, Google)
- ReAct agents with tool calling
- DAG-based workflow orchestration
- RAG pipelines with pgvector
- Deployment utilities (Hono, MCP, guardrails)

### How is Seashore different from LangChain/LlamaIndex?

**Seashore:**
- Pure TypeScript (not Python-first)
- Uses TanStack AI (not custom abstractions)
- Smaller bundle size (~300KB vs ~2MB)
- Designed for production from day one
- ESM-first, modern tooling

**LangChain/LlamaIndex:**
- Python-first with TS ports
- Larger ecosystems
- More integrations
- Established communities

See [Migration Guide](../migration/migration-guide.md) for detailed comparison.

### Is Seashore production-ready?

Yes! Seashore is designed for production:
- TypeScript strict mode
- Comprehensive error handling
- Battle-tested in production apps
- Monitoring & observability built-in
- Deployment guides for all major platforms

### What license is Seashore?

MIT License - free for commercial and personal use.

---

## Getting Started

### What do I need to get started?

**Minimum requirements:**
- Node.js 20+
- TypeScript 5.7+
- An LLM API key (OpenAI, Anthropic, or Google)

**Recommended:**
- pnpm (faster than npm)
- VSCode with TypeScript extension
- PostgreSQL (for RAG features)

### Can I use Seashore with JavaScript?

Yes, but TypeScript is **strongly recommended**. Seashore's APIs are designed with TypeScript in mind, and you'll lose:
- Type safety
- Autocomplete
- Inline documentation
- Compile-time error checking

### Which LLM providers are supported?

Currently supported:
- OpenAI (GPT-4o, GPT-4o-mini, etc.)
- Anthropic (Claude 3.5, Claude 3)
- Google (Gemini Pro, Gemini Ultra)

Coming soon:
- Cohere
- Mistral AI
- Local models (Ollama, LM Studio)

### Do I need all packages?

No! Use what you need:

| Package | When to use |
|---------|-------------|
| `@seashore/core` | Always (LLM adapters, tools, embeddings) |
| `@seashore/agent` | For agents and workflows |
| `@seashore/data` | For RAG, vector search, PostgreSQL |
| `@seashore/platform` | For MCP, guardrails, deployment |
| `@seashore/react` | For React frontends |

---

## Development

### Why do imports need .js extensions?

Seashore uses pure ESM. In ESM, relative imports **must** include file extensions.

```typescript
// ✅ Correct
import { createTool } from './utils.js'

// ❌ Wrong
import { createTool } from './utils'
```

TypeScript files compile to `.js`, so imports reference the output files.

### Can I use CommonJS?

No. Seashore is ESM-only. This provides:
- Better tree-shaking
- Faster builds
- Modern JavaScript standards
- Smaller bundle sizes

If you need CommonJS, you'll need to use a bundler like esbuild.

### How do I debug my agent?

```typescript
// 1. Enable debug mode
const agent = createReActAgent({
  llm,
  tools,
  debug: true,  // Logs each step
});

// 2. Use structured logging
import { logger } from './logger.js';

logger.debug('Agent input', { message });
const result = await agent.run({ message });
logger.debug('Agent output', { result });

// 3. Inspect tool calls
const tool = createTool({
  name: 'my_tool',
  // ...
  execute: async (params) => {
    console.log('Tool called with:', params);
    const result = await doWork(params);
    console.log('Tool returning:', result);
    return result;
  },
});
```

### How do I test agents?

```typescript
import { describe, it, expect } from 'vitest';
import { createReActAgent } from '@seashore/agent';

describe('Agent', () => {
  it('should use calculator tool', async () => {
    const agent = createReActAgent({
      llm: createLLMAdapter({
        provider: 'openai',
        apiKey: process.env.OPENAI_API_KEY,
      }),
      tools: [calculatorTool],
    });
    
    const result = await agent.run({
      message: 'What is 5 + 3?',
    });
    
    expect(result.message).toContain('8');
  });
  
  it('should handle errors gracefully', async () => {
    const agent = createReActAgent({
      llm,
      tools: [faultyTool],
    });
    
    await expect(
      agent.run({ message: 'test' })
    ).rejects.toThrow();
  });
});
```

For testing without hitting LLM APIs, mock the LLM adapter:

```typescript
import { vi } from 'vitest';

const mockLLM = {
  chat: vi.fn().mockResolvedValue({
    message: 'Mocked response',
    toolCalls: [],
  }),
};

const agent = createReActAgent({
  llm: mockLLM as any,
  tools: [],
});
```

---

## Agents & Tools

### My agent doesn't use the tool I created

**Common causes:**

1. **Tool description is unclear**
   ```typescript
   // ❌ Bad
   description: 'Does stuff'
   
   // ✅ Good
   description: 'Searches weather data for any city worldwide. Use this when user asks about weather, temperature, or forecast.'
   ```

2. **System prompt conflicts**
   ```typescript
   // ❌ Prevents tool use
   systemPrompt: 'Answer directly without external tools'
   
   // ✅ Encourages tool use
   systemPrompt: 'Use available tools to provide accurate information'
   ```

3. **Wrong model** - Some models don't support tool calling. Use GPT-4o, Claude 3, or Gemini Pro.

### How many tools should an agent have?

**Recommendation:** 3-10 tools per agent.

**Too few (<3):** Agent might not be able to handle diverse tasks.

**Too many (>15):** LLM gets confused about which tool to use.

**Best practice:** Create specialized agents with focused tool sets.

```typescript
// ❌ One agent with 20 tools
const agent = createReActAgent({
  llm,
  tools: [...20 tools],
});

// ✅ Multiple specialized agents
const weatherAgent = createReActAgent({
  llm,
  tools: [getWeather, getForecast],
});

const financeAgent = createReActAgent({
  llm,
  tools: [getStockPrice, getExchangeRate],
});
```

### Can tools call other tools?

Not directly, but you can:

1. **Use workflows** to chain tool executions
2. **Call agent from tool** (for complex logic)

```typescript
const complexTool = createTool({
  name: 'complex_analysis',
  description: 'Performs complex multi-step analysis',
  parameters: z.object({ query: z.string() }),
  execute: async ({ query }) => {
    // Use a sub-agent
    const analyst = createReActAgent({
      llm,
      tools: [toolA, toolB, toolC],
    });
    
    const result = await analyst.run({ message: query });
    return result.message;
  },
});
```

### How do I handle tool errors?

```typescript
const tool = createTool({
  name: 'api_call',
  description: 'Calls external API',
  parameters: z.object({ query: z.string() }),
  execute: async ({ query }) => {
    try {
      const response = await fetch(`https://api.example.com?q=${query}`);
      
      if (!response.ok) {
        // Return error message (agent will see it)
        return `API returned error: ${response.status}`;
      }
      
      const data = await response.json();
      return JSON.stringify(data);
      
    } catch (error) {
      // Return error message
      return `Failed to call API: ${error.message}`;
    }
  },
});
```

The agent will see the error message and can decide how to proceed (retry, use different tool, inform user, etc.).

---

## RAG & Vector Search

### Do I need pgvector?

Only if you're building RAG (Retrieval-Augmented Generation) applications. If you're just using basic chat agents, you don't need it.

### Can I use a different vector database?

Currently, Seashore has built-in support for pgvector (PostgreSQL). For other databases:

```typescript
// You can implement your own adapter
import { createEmbeddingAdapter } from '@seashore/core';

const embedder = createEmbeddingAdapter({
  provider: 'openai',
  apiKey: process.env.OPENAI_API_KEY,
});

// Use with Pinecone, Weaviate, etc.
const embedding = await embedder.embed(text);
await pinecone.upsert([{ id: '1', values: embedding }]);
```

We're working on official adapters for:
- Pinecone
- Weaviate
- Qdrant
- ChromaDB

### How do I choose chunk size for RAG?

**General guidelines:**

| Use Case | Chunk Size | Overlap |
|----------|------------|---------|
| Short Q&A | 200-400 chars | 50-100 |
| General docs | 500-1000 chars | 100-200 |
| Long-form content | 1000-2000 chars | 200-400 |

```typescript
const chunks = chunkText(document, {
  size: 500,      // characters per chunk
  overlap: 100,   // overlap between chunks
});

for (const chunk of chunks) {
  await rag.addDocument(chunk, metadata);
}
```

**Test and iterate** - optimal size depends on your content and use case.

### Why is vector search slow?

**Common causes:**

1. **No index** - Create an IVFFlat or HNSW index:
   ```sql
   CREATE INDEX ON documents 
   USING ivfflat (embedding vector_cosine_ops) 
   WITH (lists = 100);
   ```

2. **Too many dimensions** - Use smaller embedding models or PCA reduction

3. **Scanning entire table** - Add filters to narrow search:
   ```typescript
   const results = await rag.query('question', {
     limit: 5,
     filter: { category: 'technical' },  // Reduces search space
   });
   ```

---

## Deployment

### Which deployment platform should I use?

Depends on your needs:

| Priority | Recommended Platform |
|----------|---------------------|
| Fastest to deploy | Cloudflare Workers |
| Lowest cost (low traffic) | AWS Lambda or Workers |
| Need PostgreSQL | Hono on VPS or Docker |
| Maximum control | Docker + Kubernetes |
| Existing AWS setup | AWS Lambda + ECS |

See [Deployment Overview](../deployment/overview.md) for detailed comparison.

### Can I deploy Seashore to Vercel?

Yes, but with limitations:

- **Vercel Functions:** Similar to AWS Lambda
- **Edge Runtime:** Similar to Cloudflare Workers (limited Node.js APIs)
- **No long-running processes:** Max 60s execution time

```typescript
// api/chat.ts
import { createReActAgent } from '@seashore/agent';

export const config = {
  runtime: 'nodejs',  // or 'edge'
};

export default async function handler(req, res) {
  const { message } = req.body;
  
  const agent = createReActAgent({
    llm: createLLMAdapter({
      provider: 'openai',
      apiKey: process.env.OPENAI_API_KEY,
    }),
    tools: [],
  });
  
  const result = await agent.run({ message });
  res.json(result);
}
```

### How do I handle secrets in production?

**Never:**
- Hardcode secrets
- Commit secrets to git
- Log secret values

**Do:**
- Use environment variables
- Use secret management (AWS Secrets Manager, etc.)
- Rotate secrets regularly

See [Environment Variables Guide](../deployment/environment.md).

### How much does it cost to run Seashore?

**Main cost: LLM API calls** (typically 90%+ of total cost)

**Example costs:**

| Scenario | LLM Cost/mo | Infrastructure | Total |
|----------|-------------|----------------|-------|
| 1K requests | $5 | $0 (free tier) | $5 |
| 100K requests | $500 | $5-50 | $505-550 |
| 1M requests | $5,000 | $50-500 | $5,050-5,500 |

**Tips to reduce costs:**
- Use cheaper models (GPT-4o-mini vs GPT-4o)
- Cache common queries
- Optimize prompts to use fewer tokens
- Set max token limits

---

## Monitoring & Debugging

### How do I track LLM costs?

```typescript
const PRICING = {
  'gpt-4o': { input: 0.005 / 1000, output: 0.015 / 1000 },
  'gpt-4o-mini': { input: 0.00015 / 1000, output: 0.0006 / 1000 },
};

let totalCost = 0;

app.post('/api/chat', async (c) => {
  const result = await agent.run({ message });
  
  const cost = 
    result.tokensPrompt * PRICING['gpt-4o'].input +
    result.tokensCompletion * PRICING['gpt-4o'].output;
  
  totalCost += cost;
  
  logger.info('Request cost', { cost, totalCost });
  
  return c.json(result);
});
```

See [Monitoring Guide](../deployment/monitoring.md) for comprehensive cost tracking.

### What metrics should I monitor?

**Essential:**
- Error rate
- Response time (p50, p95, p99)
- LLM token usage & cost
- Request volume

**Important:**
- Tool call frequency
- Agent iteration count
- Database query time
- Memory usage

**Nice to have:**
- User satisfaction (feedback)
- Tool success rate
- Conversation length

See [Monitoring Guide](../deployment/monitoring.md) for implementation.

### How do I debug production issues?

1. **Structured logging**
   ```typescript
   logger.error('Agent failed', error, {
     requestId: req.id,
     userId: user.id,
     message: req.body.message,
   });
   ```

2. **Request tracing**
   ```typescript
   const requestId = crypto.randomUUID();
   logger.info('Request started', { requestId });
   // ... handle request
   logger.info('Request completed', { requestId, duration });
   ```

3. **Error tracking** (Sentry, Datadog, etc.)

4. **Monitoring dashboard** (Grafana, Datadog, etc.)

---

## Performance

### How can I make my agent faster?

1. **Use streaming**
   ```typescript
   const stream = await agent.stream({ message });
   // User sees response immediately
   ```

2. **Reduce max iterations**
   ```typescript
   const agent = createReActAgent({
     llm,
     tools,
     maxIterations: 3,  // Instead of 5
   });
   ```

3. **Optimize tools**
   - Parallel API calls
   - Cache results
   - Add timeouts

4. **Use faster models**
   - GPT-4o-mini instead of GPT-4o
   - Claude Haiku instead of Sonnet

5. **Reduce context**
   ```typescript
   const agent = createReActAgent({
     llm,
     tools,
     maxHistoryLength: 10,  // Keep last 10 messages only
   });
   ```

### Why is my first request slow?

**Cold start** - happens when:
- Lambda function starts
- Cloudflare Worker initializes
- Docker container starts

**Solutions:**
- Accept it (usually <1s)
- Use provisioned concurrency (Lambda)
- Keep services warm with health checks
- Use Hono on persistent servers (no cold starts)

---

## Community

### How do I get help?

1. **Search docs** - Check [documentation](../README.md)
2. **Search issues** - [GitHub Issues](https://github.com/seashore/seashore/issues)
3. **Check FAQ** - You're here!
4. **Ask on Discord** - [discord.gg/seashore](https://discord.gg/seashore)
5. **Create an issue** - For bugs or feature requests

### How can I contribute?

See [Contributing Guide](../../CONTRIBUTING.md).

Ways to contribute:
- Report bugs
- Suggest features
- Improve documentation
- Submit pull requests
- Help others on Discord
- Share your projects

### Where can I find examples?

- [Examples directory](../../examples/)
- [GitHub Discussions](https://github.com/seashore/seashore/discussions)
- [Community showcase](https://github.com/seashore/seashore/discussions/categories/show-and-tell)

---

## Troubleshooting

**Still have questions?**

- [Common Issues →](./common-issues.md)
- [Migration Guide →](../migration/migration-guide.md)
- [GitHub Discussions](https://github.com/seashore/seashore/discussions)
- [Discord Community](https://discord.gg/seashore)
