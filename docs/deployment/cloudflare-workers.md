# Deploying Seashore to Cloudflare Workers

This guide covers deploying Seashore agents to Cloudflare Workers for edge deployment with global low latency and automatic scaling.

## Why Cloudflare Workers?

- **Global edge network** - Deploy to 300+ locations worldwide
- **Sub-50ms latency** - Serve from the nearest edge location
- **Auto-scaling** - Handle millions of requests automatically
- **Cost-effective** - Free tier: 100k requests/day
- **Zero infrastructure** - No servers to manage

## Limitations

- **CPU time limits** - 10ms (free), 50ms (paid), 30s (unbound workers)
- **No filesystem** - Ephemeral execution environment
- **Limited Node.js APIs** - Not all APIs available
- **No native PostgreSQL** - Use HTTP-based databases (Neon, Supabase)
- **Cold starts** - First request may be slower (~50-200ms)

---

## Prerequisites

- Cloudflare account
- Wrangler CLI installed
- Node.js 20+

```bash
# Install Wrangler
npm install -g wrangler

# Login to Cloudflare
wrangler login
```

---

## Quick Start

### 1. Create Project

```bash
# Create new project
mkdir seashore-worker
cd seashore-worker
npm init -y

# Install dependencies
pnpm add @seashore/core @seashore/agent hono
pnpm add -D wrangler @cloudflare/workers-types typescript
```

### 2. Configure TypeScript

```json
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "lib": ["ES2022"],
    "types": ["@cloudflare/workers-types"],
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "allowJs": true,
    "checkJs": false,
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "outDir": "./dist"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules"]
}
```

### 3. Create Worker

```typescript
// src/index.ts
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { createLLMAdapter } from '@seashore/core';
import { createReActAgent } from '@seashore/agent';

// Cloudflare Workers environment
interface Env {
  OPENAI_API_KEY: string;
  ANTHROPIC_API_KEY?: string;
  ENVIRONMENT: 'production' | 'development';
}

const app = new Hono<{ Bindings: Env }>();

// Middleware
app.use('*', cors());

// Health check
app.get('/health', (c) => {
  return c.json({ 
    status: 'ok',
    region: c.req.header('cf-ray')?.split('-')[1] || 'unknown',
    timestamp: new Date().toISOString(),
  });
});

// Chat endpoint
app.post('/api/chat', async (c) => {
  try {
    const { message, provider = 'openai' } = await c.req.json();
    
    if (!message) {
      return c.json({ error: 'Message is required' }, 400);
    }
    
    // Create LLM adapter (lightweight, per-request)
    const llm = createLLMAdapter({
      provider,
      apiKey: c.env.OPENAI_API_KEY,
    });
    
    // Create agent (per-request, stateless)
    const agent = createReActAgent({
      llm,
      tools: [],  // Add your tools here
      maxIterations: 3,  // Limit iterations for CPU time
    });
    
    // Run agent
    const result = await agent.run({ message });
    
    return c.json({
      message: result.message,
      region: c.req.header('cf-ray')?.split('-')[1],
    });
    
  } catch (error) {
    console.error('Chat error:', error);
    return c.json({ 
      error: error instanceof Error ? error.message : 'Internal error',
    }, 500);
  }
});

// Export for Cloudflare Workers
export default app;
```

### 4. Configure Wrangler

```toml
# wrangler.toml
name = "seashore-api"
main = "src/index.ts"
compatibility_date = "2024-01-01"

# Account ID (get from Cloudflare dashboard)
account_id = "your-account-id"

# Worker settings
workers_dev = true

[env.production]
name = "seashore-api"
routes = [
  { pattern = "api.example.com/*", zone_name = "example.com" }
]

# Environment variables (non-sensitive)
[vars]
ENVIRONMENT = "production"

# Secrets (add with: wrangler secret put <KEY>)
# OPENAI_API_KEY
# ANTHROPIC_API_KEY
```

### 5. Deploy

```bash
# Add secrets
wrangler secret put OPENAI_API_KEY
# Paste your API key when prompted

# Deploy to production
wrangler deploy

# Your worker is now live at:
# https://seashore-api.<subdomain>.workers.dev
```

---

## Stateless Agent Pattern

Workers are ephemeral - no state persists between requests.

```typescript
// ✅ GOOD: Create per-request
app.post('/api/chat', async (c) => {
  const llm = createLLMAdapter({
    provider: 'openai',
    apiKey: c.env.OPENAI_API_KEY,
  });
  
  const agent = createReActAgent({ llm, tools: [] });
  const result = await agent.run({ message: '...' });
  return c.json(result);
});

// ❌ BAD: Don't create at module level
const agent = createReActAgent({...});  // This won't work reliably

app.post('/api/chat', async (c) => {
  // agent might not be initialized
});
```

---

## Conversation State with KV

Use Cloudflare KV for conversation history:

```toml
# wrangler.toml
[[kv_namespaces]]
binding = "CONVERSATIONS"
id = "your-kv-namespace-id"
```

```typescript
interface Env {
  OPENAI_API_KEY: string;
  CONVERSATIONS: KVNamespace;
}

app.post('/api/chat', async (c) => {
  const { message, threadId } = await c.req.json();
  
  // Retrieve conversation history
  const historyJson = await c.env.CONVERSATIONS.get(threadId);
  const history = historyJson ? JSON.parse(historyJson) : [];
  
  // Create agent with history
  const agent = createReActAgent({
    llm: createLLMAdapter({
      provider: 'openai',
      apiKey: c.env.OPENAI_API_KEY,
    }),
    tools: [],
  });
  
  // Run agent
  const result = await agent.run({ 
    message,
    history,  // Pass previous messages
  });
  
  // Save updated history
  history.push(
    { role: 'user', content: message },
    { role: 'assistant', content: result.message }
  );
  
  await c.env.CONVERSATIONS.put(
    threadId,
    JSON.stringify(history),
    { expirationTtl: 86400 }  // 24 hours
  );
  
  return c.json({ message: result.message, threadId });
});
```

### KV Pricing

- **Free tier** - 100k reads/day, 1k writes/day
- **Paid** - $0.50/million reads, $5/million writes
- **Storage** - $0.50/GB/month

---

## Database Integration

### Option 1: Neon (Serverless Postgres)

Neon provides HTTP-based PostgreSQL access.

```bash
pnpm add @neondatabase/serverless
```

```typescript
import { neon } from '@neondatabase/serverless';

interface Env {
  DATABASE_URL: string;
}

app.post('/api/query', async (c) => {
  const sql = neon(c.env.DATABASE_URL);
  
  const result = await sql`
    SELECT * FROM documents 
    WHERE embedding <-> ${embedding} < 0.5
    ORDER BY embedding <-> ${embedding}
    LIMIT 5
  `;
  
  return c.json({ results: result });
});
```

### Option 2: Cloudflare D1 (SQL Database)

Built-in SQLite database.

```toml
# wrangler.toml
[[d1_databases]]
binding = "DB"
database_name = "seashore-db"
database_id = "your-database-id"
```

```typescript
interface Env {
  DB: D1Database;
}

app.post('/api/documents', async (c) => {
  const { content } = await c.req.json();
  
  await c.env.DB.prepare(
    'INSERT INTO documents (content) VALUES (?)'
  ).bind(content).run();
  
  return c.json({ success: true });
});
```

### Option 3: Supabase

HTTP-based PostgreSQL + storage.

```typescript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  c.env.SUPABASE_URL,
  c.env.SUPABASE_KEY
);

const { data, error } = await supabase
  .from('documents')
  .select('*')
  .textSearch('content', query);
```

---

## Vectorstore Integration

### Cloudflare Vectorize

Native vector search (beta).

```toml
# wrangler.toml
[[vectorize]]
binding = "VECTORIZE"
index_name = "seashore-embeddings"
```

```typescript
import { createEmbeddingAdapter } from '@seashore/core';

interface Env {
  VECTORIZE: VectorizeIndex;
  OPENAI_API_KEY: string;
}

app.post('/api/search', async (c) => {
  const { query } = await c.req.json();
  
  // Generate embedding
  const embedder = createEmbeddingAdapter({
    provider: 'openai',
    apiKey: c.env.OPENAI_API_KEY,
  });
  
  const embedding = await embedder.embed(query);
  
  // Search vectors
  const results = await c.env.VECTORIZE.query(
    embedding,
    { topK: 5 }
  );
  
  return c.json({ results: results.matches });
});

// Insert vectors
app.post('/api/documents', async (c) => {
  const { text, metadata } = await c.req.json();
  
  const embedder = createEmbeddingAdapter({
    provider: 'openai',
    apiKey: c.env.OPENAI_API_KEY,
  });
  
  const embedding = await embedder.embed(text);
  
  await c.env.VECTORIZE.upsert([{
    id: crypto.randomUUID(),
    values: embedding,
    metadata: { text, ...metadata },
  }]);
  
  return c.json({ success: true });
});
```

---

## Streaming Responses

Stream agent responses for better UX:

```typescript
app.post('/api/chat/stream', async (c) => {
  const { message } = await c.req.json();
  
  const agent = createReActAgent({
    llm: createLLMAdapter({
      provider: 'openai',
      apiKey: c.env.OPENAI_API_KEY,
    }),
    tools: [],
  });
  
  const stream = await agent.stream({ message });
  
  // Transform to SSE format
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  
  (async () => {
    try {
      for await (const chunk of stream) {
        await writer.write(
          new TextEncoder().encode(
            `data: ${JSON.stringify(chunk)}\n\n`
          )
        );
      }
      await writer.close();
    } catch (error) {
      await writer.abort(error);
    }
  })();
  
  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
});
```

---

## Custom Domains

### Add Domain

```bash
# Add custom domain
wrangler domains add api.example.com
```

Or via wrangler.toml:

```toml
[env.production]
routes = [
  { pattern = "api.example.com/*", zone_name = "example.com" }
]
```

### DNS Setup

Add CNAME record:
```
api.example.com CNAME seashore-api.<subdomain>.workers.dev
```

SSL is automatic via Cloudflare.

---

## Environment-Specific Configs

```toml
# wrangler.toml

# Development
[env.dev]
name = "seashore-api-dev"
vars = { ENVIRONMENT = "development" }

# Staging
[env.staging]
name = "seashore-api-staging"
vars = { ENVIRONMENT = "staging" }
routes = [
  { pattern = "api-staging.example.com/*", zone_name = "example.com" }
]

# Production
[env.production]
name = "seashore-api"
vars = { ENVIRONMENT = "production" }
routes = [
  { pattern = "api.example.com/*", zone_name = "example.com" }
]
```

Deploy to specific environment:

```bash
wrangler deploy --env dev
wrangler deploy --env staging
wrangler deploy --env production
```

---

## Rate Limiting

Protect your API from abuse:

```typescript
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis/cloudflare';

interface Env {
  UPSTASH_REDIS_REST_URL: string;
  UPSTASH_REDIS_REST_TOKEN: string;
}

const ratelimit = (env: Env) => new Ratelimit({
  redis: Redis.fromEnv(env),
  limiter: Ratelimit.slidingWindow(10, '10 s'),
});

app.post('/api/chat', async (c) => {
  const ip = c.req.header('CF-Connecting-IP') || 'unknown';
  
  const { success } = await ratelimit(c.env).limit(ip);
  
  if (!success) {
    return c.json({ error: 'Rate limit exceeded' }, 429);
  }
  
  // ... handle request ...
});
```

---

## Caching

Cache responses for faster subsequent requests:

```typescript
app.get('/api/models', async (c) => {
  const cacheKey = new Request(c.req.url);
  const cache = caches.default;
  
  // Check cache
  let response = await cache.match(cacheKey);
  
  if (!response) {
    // Fetch data
    const models = await fetchModels();
    
    response = new Response(JSON.stringify(models), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=3600',  // 1 hour
      },
    });
    
    // Store in cache
    await cache.put(cacheKey, response.clone());
  }
  
  return response;
});
```

---

## Monitoring

### Logpush

Send logs to external service:

```bash
# Setup logpush to S3, Datadog, etc.
wrangler logpush create
```

### Analytics Engine

Track custom metrics:

```toml
# wrangler.toml
[[analytics_engine_datasets]]
binding = "ANALYTICS"
```

```typescript
interface Env {
  ANALYTICS: AnalyticsEngineDataset;
}

app.post('/api/chat', async (c) => {
  const start = Date.now();
  
  // ... process request ...
  
  const duration = Date.now() - start;
  
  c.env.ANALYTICS.writeDataPoint({
    indexes: ['chat'],
    blobs: [c.req.header('CF-Connecting-IP') || 'unknown'],
    doubles: [duration],
  });
  
  return c.json({ ... });
});
```

### Sentry Integration

```bash
pnpm add @sentry/cloudflare
```

```typescript
import * as Sentry from '@sentry/cloudflare';

Sentry.init({
  dsn: 'your-sentry-dsn',
  tracesSampleRate: 1.0,
});

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return Sentry.withScope(async (scope) => {
      scope.setContext('environment', { worker: env.ENVIRONMENT });
      
      try {
        return await app.fetch(request, env);
      } catch (error) {
        Sentry.captureException(error);
        throw error;
      }
    });
  },
};
```

---

## CI/CD with GitHub Actions

```yaml
# .github/workflows/deploy.yml
name: Deploy to Cloudflare Workers

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
      
      - name: Install pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 9
      
      - name: Install dependencies
        run: pnpm install --frozen-lockfile
      
      - name: Deploy to Cloudflare Workers
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          command: deploy --env production
```

---

## Local Development

```bash
# Start local dev server
wrangler dev

# With live reload
wrangler dev --live-reload

# Access at http://localhost:8787
```

### Local Testing

```bash
# Tail production logs
wrangler tail

# Tail specific environment
wrangler tail --env production
```

---

## Cost Estimation

### Free Tier
- 100k requests/day
- 10ms CPU time per request
- Good for: Small projects, prototypes

### Paid Plan ($5/month)
- 10 million requests/month included
- $0.50 per additional million
- 50ms CPU time per request
- Good for: Production apps

### Unbound Workers ($5/month + usage)
- 30s CPU time per request
- $0.15 per million GB-seconds
- Good for: Long-running tasks

**Example costs:**
- 1 million requests/month: $0 (free tier)
- 50 million requests/month: ~$25
- 500 million requests/month: ~$250

*LLM API costs typically dominate total cost*

---

## Troubleshooting

### CPU Time Exceeded

```
Error: Script exceeded CPU time limit
```

**Solutions:**
- Reduce `maxIterations` in agent config
- Upgrade to paid plan (50ms) or Unbound (30s)
- Optimize tool execution
- Cache expensive operations

### Module Not Found

```
Error: Cannot find module 'fs'
```

**Solution:** Workers don't support Node.js APIs like `fs`. Use Worker-compatible alternatives.

### KV Not Updated

KV is eventually consistent. Allow up to 60 seconds for global propagation.

### Cold Start Latency

First request after inactivity: ~50-200ms

**Solutions:**
- Accept it (still faster than Lambda)
- Use Durable Objects for stateful apps
- Keep worker warm with health checks

---

## Next Steps

- [Environment variables →](./environment.md)
- [Monitoring setup →](./monitoring.md)
- [AWS Lambda comparison →](./aws-lambda.md)

## Additional Resources

- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- [Wrangler CLI Docs](https://developers.cloudflare.com/workers/wrangler/)
- [Vectorize Docs](https://developers.cloudflare.com/vectorize/)
- [D1 Database Docs](https://developers.cloudflare.com/d1/)
