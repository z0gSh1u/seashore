# Common Issues and Solutions

Troubleshooting guide for common problems when developing and deploying Seashore applications.

## Table of Contents

- [Installation Issues](#installation-issues)
- [Build & TypeScript Errors](#build--typescript-errors)
- [Runtime Errors](#runtime-errors)
- [Agent Issues](#agent-issues)
- [Database & RAG Issues](#database--rag-issues)
- [Deployment Issues](#deployment-issues)
- [Performance Issues](#performance-issues)

---

## Installation Issues

### Error: Cannot find module '@seashore/core'

**Symptoms:**
```
Error: Cannot find module '@seashore/core' or its corresponding type declarations.
```

**Causes:**
- Package not installed
- Wrong Node.js version
- Corrupted node_modules

**Solutions:**

```bash
# 1. Install packages
pnpm install

# 2. Check Node.js version (requires 20+)
node --version

# 3. Clear cache and reinstall
rm -rf node_modules pnpm-lock.yaml
pnpm install

# 4. If using workspace, build packages first
pnpm build
```

### pnpm install fails

**Symptoms:**
```
ERR_PNPM_PEER_DEP_ISSUES  Unmet peer dependencies
```

**Solutions:**

```bash
# Force install (use cautiously)
pnpm install --force

# Or use strict peer dependencies
pnpm install --strict-peer-dependencies=false

# Update pnpm to latest
npm install -g pnpm@latest
```

---

## Build & TypeScript Errors

### Error: Import paths must use .js extension

**Symptoms:**
```
TS2835: Relative import paths need explicit file extensions
```

**Cause:** Seashore uses ESM with explicit `.js` extensions.

**Solution:**

```typescript
// ❌ Wrong
import { createTool } from './tools'
import { createTool } from './tools.ts'

// ✅ Correct
import { createTool } from './tools.js'
```

**Why `.js` not `.ts`?** TypeScript transpiles `.ts` to `.js`, so imports reference the output files.

### Error: Module not found in rootDir

**Symptoms:**
```
File is not under 'rootDir'. 'rootDir' is expected to contain all source files.
```

**Cause:** Importing across package boundaries incorrectly.

**Solution:**

```typescript
// ❌ Wrong (importing from src directly)
import { createTool } from '@seashore/core/src/tool/toolkit.js'

// ✅ Correct (use package exports)
import { createTool } from '@seashore/core'
```

### Error: Cannot use import statement outside module

**Symptoms:**
```
SyntaxError: Cannot use import statement outside a module
```

**Cause:** Missing `"type": "module"` in package.json.

**Solution:**

```json
{
  "type": "module",
  "scripts": {
    "start": "node dist/server.js"
  }
}
```

### TypeScript compile errors after update

**Symptoms:**
```
error TS2322: Type 'X' is not assignable to type 'Y'
```

**Solutions:**

```bash
# 1. Clean build
rm -rf dist
pnpm build

# 2. Clear TypeScript cache
rm -rf node_modules/.cache

# 3. Restart TypeScript server (in VSCode)
# Cmd+Shift+P -> "TypeScript: Restart TS Server"

# 4. Check TypeScript version (requires 5.7+)
pnpm list typescript
```

---

## Runtime Errors

### Error: API key not found

**Symptoms:**
```
Error: OPENAI_API_KEY is required
```

**Causes:**
- Environment variable not set
- `.env` file not loaded
- Wrong variable name

**Solutions:**

```bash
# 1. Check environment variables
env | grep OPENAI

# 2. Set the variable
export OPENAI_API_KEY='sk-...'

# 3. Load .env file
# Add to your entry file:
import 'dotenv/config';

# 4. Check variable name matches
# OPENAI_API_KEY (not OPENAI_KEY)
```

### Error: fetch is not defined

**Symptoms:**
```
ReferenceError: fetch is not defined
```

**Cause:** Node.js < 18 or fetch not available.

**Solutions:**

```bash
# 1. Update Node.js to 20+
nvm install 20
nvm use 20

# 2. Or install fetch polyfill
pnpm add node-fetch
```

```typescript
// If polyfill needed
import fetch from 'node-fetch';
globalThis.fetch = fetch as any;
```

### Error: Connection refused (database)

**Symptoms:**
```
Error: connect ECONNREFUSED 127.0.0.1:5432
```

**Causes:**
- PostgreSQL not running
- Wrong connection string
- Firewall blocking connection

**Solutions:**

```bash
# 1. Check PostgreSQL is running
pg_isready
# or
docker ps | grep postgres

# 2. Test connection
psql postgresql://localhost/mydb

# 3. Check DATABASE_URL format
# postgresql://user:password@host:port/database
echo $DATABASE_URL

# 4. Start PostgreSQL
# macOS
brew services start postgresql

# Docker
docker-compose up postgres
```

---

## Agent Issues

### Agent doesn't use tools

**Symptoms:**
- Agent responds without calling tools
- Tools are available but ignored

**Causes:**
- Tool description unclear
- System prompt conflicts
- Wrong model (some models don't support tools)

**Solutions:**

```typescript
// 1. Improve tool descriptions
const tool = createTool({
  name: 'weather',
  // ❌ Vague
  description: 'Get weather',
  
  // ✅ Clear and specific
  description: 'Get current weather conditions for any city. Use this when the user asks about weather, temperature, or forecast.',
  
  parameters: z.object({
    location: z.string().describe('City name (e.g., "Tokyo", "New York")'),
  }),
  execute: async ({ location }) => {
    // ...
  },
});

// 2. Check system prompt doesn't conflict
const agent = createReActAgent({
  llm,
  tools: [weatherTool],
  // ❌ This might prevent tool use
  systemPrompt: 'Answer questions directly without using tools.',
  
  // ✅ Encourage tool use
  systemPrompt: 'You are a helpful assistant. Use available tools to provide accurate information.',
});

// 3. Verify model supports tools
const llm = createLLMAdapter({
  provider: 'openai',
  model: 'gpt-4o',  // ✅ Supports tools
  // model: 'gpt-3.5-turbo-instruct',  // ❌ Doesn't support tools
});
```

### Agent hits max iterations

**Symptoms:**
```
Error: Max iterations (5) reached
```

**Causes:**
- Tool returns unclear results
- Agent stuck in loop
- Task too complex

**Solutions:**

```typescript
// 1. Increase max iterations
const agent = createReActAgent({
  llm,
  tools,
  maxIterations: 10,  // Default is 5
});

// 2. Improve tool responses
execute: async ({ query }) => {
  const results = await search(query);
  
  // ❌ Unclear response
  return results;
  
  // ✅ Clear, structured response
  if (results.length === 0) {
    return 'No results found.';
  }
  
  return `Found ${results.length} results:\n${
    results.map(r => `- ${r.title}: ${r.snippet}`).join('\n')
  }`;
}

// 3. Break down complex tasks
// Instead of one complex agent, use workflows:
const workflow = createWorkflow({
  steps: [
    { id: 'search', fn: searchStep },
    { id: 'analyze', fn: analyzeStep, deps: ['search'] },
    { id: 'summarize', fn: summarizeStep, deps: ['analyze'] },
  ],
});
```

### Agent responses are slow

**Symptoms:**
- Responses take 10+ seconds
- Timeouts in production

**Causes:**
- Too many tool calls
- Slow external APIs
- Large context

**Solutions:**

```typescript
// 1. Set timeouts
const agent = createReActAgent({
  llm,
  tools,
  timeout: 30000,  // 30 seconds
});

// 2. Optimize tool execution
execute: async ({ query }) => {
  // ❌ Sequential calls
  const results1 = await api1.search(query);
  const results2 = await api2.search(query);
  
  // ✅ Parallel calls
  const [results1, results2] = await Promise.all([
    api1.search(query),
    api2.search(query),
  ]);
  
  return results1.concat(results2);
}

// 3. Use streaming for better UX
const stream = await agent.stream({ message });
for await (const chunk of stream) {
  // Show progress to user immediately
  process.stdout.write(chunk.content);
}

// 4. Reduce context size
// Summarize long histories
const agent = createReActAgent({
  llm,
  tools,
  maxHistoryLength: 10,  // Keep last 10 messages
});
```

---

## Database & RAG Issues

### pgvector extension not found

**Symptoms:**
```
Error: extension "vector" does not exist
```

**Cause:** pgvector extension not installed.

**Solutions:**

```sql
-- 1. Install extension
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Verify installation
SELECT * FROM pg_extension WHERE extname = 'vector';

-- 3. If using Docker, use pgvector image
docker run -d \
  --name postgres \
  -e POSTGRES_PASSWORD=secret \
  pgvector/pgvector:pg16
```

### Vector search returns no results

**Symptoms:**
- RAG query returns empty array
- Embeddings exist but not found

**Causes:**
- Wrong similarity threshold
- Embeddings dimension mismatch
- Index not created

**Solutions:**

```typescript
// 1. Adjust similarity threshold
const results = await rag.query('my question', {
  limit: 5,
  threshold: 0.8,  // ❌ Too strict
});

const results = await rag.query('my question', {
  limit: 5,
  threshold: 0.5,  // ✅ More lenient
});

// 2. Check embeddings dimension
// OpenAI: 1536, Cohere: 1024, etc.
// Ensure all embeddings use same model

// 3. Create index for better performance
await pool.query(`
  CREATE INDEX IF NOT EXISTS embeddings_idx
  ON documents USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);
`);

// 4. Debug: check what's in database
const { rows } = await pool.query(`
  SELECT id, content, embedding <=> $1 as distance
  FROM documents
  ORDER BY embedding <=> $1
  LIMIT 5
`, [embedding]);
console.log('Top results:', rows);
```

### Database connection pool exhausted

**Symptoms:**
```
Error: Connection pool exhausted
TimeoutError: Waiting for available connection
```

**Causes:**
- Too many concurrent requests
- Connections not released
- Pool too small

**Solutions:**

```typescript
// 1. Increase pool size
const pool = new Pool({
  max: 20,  // Increase from default 10
  min: 2,
  idleTimeoutMillis: 30000,
});

// 2. Always release connections
try {
  const client = await pool.connect();
  try {
    const result = await client.query('SELECT * FROM documents');
    return result.rows;
  } finally {
    client.release();  // ✅ Always release!
  }
} catch (error) {
  console.error(error);
}

// 3. Use pool.query() instead (auto-releases)
const result = await pool.query('SELECT * FROM documents');

// 4. Monitor pool metrics
pool.on('error', (err) => {
  console.error('Pool error:', err);
});

setInterval(() => {
  console.log('Pool:', {
    total: pool.totalCount,
    idle: pool.idleCount,
    waiting: pool.waitingCount,
  });
}, 10000);
```

---

## Deployment Issues

### Docker build fails

**Symptoms:**
```
Error: Cannot find module in container
Failed to build image
```

**Solutions:**

```dockerfile
# 1. Check .dockerignore doesn't exclude needed files
# .dockerignore
node_modules
dist
.git
# Don't exclude: package.json, pnpm-lock.yaml, src/

# 2. Verify multi-stage build copying
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install
COPY . .
RUN pnpm build

FROM node:20-alpine AS production
WORKDIR /app
# ✅ Copy built files
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

# 3. Check Node.js version matches
FROM node:20-alpine  # Must match local Node.js major version
```

### Environment variables not available in container

**Symptoms:**
```
Error: OPENAI_API_KEY is required
(but it's set in .env)
```

**Solutions:**

```bash
# 1. Pass env file to Docker
docker run --env-file .env seashore-api

# 2. Or in docker-compose.yml
services:
  api:
    env_file:
      - .env

# 3. Or set directly
docker run -e OPENAI_API_KEY=sk-... seashore-api

# 4. Debug: check what's available in container
docker exec <container> env | grep OPENAI
```

### Lambda timeout errors

**Symptoms:**
```
Task timed out after 3.00 seconds
```

**Solutions:**

```bash
# 1. Increase Lambda timeout
aws lambda update-function-configuration \
  --function-name seashore-agent \
  --timeout 60  # Up to 900 seconds (15 min)

# 2. Or in SAM template
Resources:
  SeashoreFunction:
    Type: AWS::Serverless::Function
    Properties:
      Timeout: 60

# 3. Optimize cold starts
# - Reduce package size
# - Use provisioned concurrency
# - Use ARM architecture
```

### Cloudflare Workers CPU time exceeded

**Symptoms:**
```
Error: Script exceeded CPU time limit
```

**Solutions:**

```typescript
// 1. Reduce agent iterations
const agent = createReActAgent({
  llm,
  tools,
  maxIterations: 3,  // Lower for Workers
});

// 2. Upgrade to paid plan (50ms CPU time)
// Or Unbound Workers (30s CPU time)

// 3. Offload heavy processing
// Use Workers as API gateway, forward to origin for heavy work

// 4. Optimize tools
execute: async ({ query }) => {
  // ❌ Heavy processing
  const results = await expensiveOperation();
  
  // ✅ Cache results
  const cached = await cache.get(query);
  if (cached) return cached;
  
  const results = await expensiveOperation();
  await cache.put(query, results);
  return results;
}
```

---

## Performance Issues

### High memory usage

**Symptoms:**
- Process memory growing over time
- Out of memory errors

**Causes:**
- Memory leaks
- Large context accumulation
- Caching without limits

**Solutions:**

```typescript
// 1. Limit conversation history
const agent = createReActAgent({
  llm,
  tools,
  maxHistoryLength: 20,  // Keep last 20 messages
});

// 2. Implement cache eviction
class LRUCache<T> {
  private cache = new Map<string, T>();
  private maxSize = 1000;
  
  set(key: string, value: T) {
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(key, value);
  }
}

// 3. Monitor memory
setInterval(() => {
  const used = process.memoryUsage();
  console.log('Memory:', {
    rss: `${Math.round(used.rss / 1024 / 1024)}MB`,
    heapUsed: `${Math.round(used.heapUsed / 1024 / 1024)}MB`,
  });
  
  if (used.heapUsed > 500 * 1024 * 1024) {  // 500MB
    console.warn('High memory usage!');
  }
}, 60000);

// 4. Restart periodically (PM2)
// ecosystem.config.cjs
module.exports = {
  apps: [{
    max_memory_restart: '500M',
  }],
};
```

### Slow API responses

**Symptoms:**
- Response time > 5 seconds
- Users complaining about speed

**Solutions:**

```typescript
// 1. Use streaming for better perceived performance
app.post('/api/chat/stream', async (c) => {
  const stream = await agent.stream({ message });
  // User sees response immediately
  return streamResponse(stream);
});

// 2. Cache LLM responses
const cache = new Map<string, any>();

app.post('/api/chat', async (c) => {
  const { message } = await c.req.json();
  const cacheKey = `chat:${message}`;
  
  const cached = cache.get(cacheKey);
  if (cached) {
    return c.json(cached);  // Instant response
  }
  
  const result = await agent.run({ message });
  cache.set(cacheKey, result);
  
  return c.json(result);
});

// 3. Optimize tool execution
// Use Promise.all() for parallel calls
// Add timeouts to external APIs
// Cache tool results

// 4. Monitor and profile
import { performance } from 'perf_hooks';

const start = performance.now();
const result = await agent.run({ message });
const duration = performance.now() - start;

logger.info('Agent execution', { duration });
```

---

## Debug Mode

Enable verbose logging for troubleshooting:

```typescript
// Set log level
process.env.LOG_LEVEL = 'debug';

// Enable agent debug mode
const agent = createReActAgent({
  llm,
  tools,
  debug: true,  // Logs each step
});

// Log all LLM requests/responses
const llm = createLLMAdapter({
  provider: 'openai',
  apiKey: process.env.OPENAI_API_KEY,
  debug: true,
});
```

---

## Getting Help

If you're still stuck:

1. **Search GitHub Issues**: [github.com/seashore/seashore/issues](https://github.com/seashore/seashore/issues)
2. **Check FAQ**: [FAQ →](./faq.md)
3. **Ask on Discord**: [discord.gg/seashore](https://discord.gg/seashore)
4. **Create an Issue**: Include:
   - Seashore version
   - Node.js version
   - Minimal reproduction code
   - Error messages
   - What you've tried

---

## Next Steps

- [FAQ →](./faq.md)
- [Migration Guide →](../migration/migration-guide.md)
- [Monitoring →](../deployment/monitoring.md)
