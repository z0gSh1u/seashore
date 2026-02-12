# 将 Seashore 部署到 Cloudflare Workers

本指南介绍如何将 Seashore 代理部署到 Cloudflare Workers 以实现边缘部署，提供全球低延迟和自动扩展。

## 为什么选择 Cloudflare Workers？

- **全球边缘网络** - 部署到全球 300 多个位置
- **亚 50ms 延迟** - 从最近的边缘位置提供服务
- **自动扩展** - 自动处理数百万请求
- **经济实惠** - 免费套餐：每天 10 万次请求
- **零基础设施** - 无需管理服务器

## 限制

- **CPU 时间限制** - 10ms（免费）、50ms（付费）、30s（无界 Workers）
- **无文件系统** - 临时执行环境
- **有限的 Node.js API** - 并非所有 API 都可用
- **无原生 PostgreSQL** - 使用基于 HTTP 的数据库（Neon、Supabase）
- **冷启动** - 首次请求可能较慢（约 50-200ms）

---

## 前置要求

- Cloudflare 账号
- 已安装 Wrangler CLI
- Node.js 20+

```bash
# Install Wrangler
npm install -g wrangler

# Login to Cloudflare
wrangler login
```

---

## 快速开始

### 1. 创建项目

```bash
# Create new project
mkdir seashore-worker
cd seashore-worker
npm init -y

# Install dependencies
pnpm add @seashore/core @seashore/agent hono
pnpm add -D wrangler @cloudflare/workers-types typescript
```

### 2. 配置 TypeScript

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

### 3. 创建 Worker

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

### 4. 配置 Wrangler

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

### 5. 部署

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

## 无状态代理模式

Workers 是临时的 - 请求之间不保留状态。

```typescript
// ✅ 好：按请求创建
app.post('/api/chat', async (c) => {
  const llm = createLLMAdapter({
    provider: 'openai',
    apiKey: c.env.OPENAI_API_KEY,
  });
  
  const agent = createReActAgent({ llm, tools: [] });
  const result = await agent.run({ message: '...' });
  return c.json(result);
});

// ❌ 差：不要在模块级别创建
const agent = createReActAgent({...});  // This won't work reliably

app.post('/api/chat', async (c) => {
  // agent might not be initialized
});
```

---

## 使用 KV 保存对话状态

使用 Cloudflare KV 保存对话历史：

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

### KV 定价

- **免费套餐** - 每天 10 万次读取、1 千次写入
- **付费** - 每百万次读取 $0.50、每百万次写入 $5
- **存储** - 每月每 GB $0.50

---

## 数据库集成

### 方案 1：Neon（Serverless Postgres）

Neon 提供基于 HTTP 的 PostgreSQL 访问。

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

### 方案 2：Cloudflare D1（SQL 数据库）

内置 SQLite 数据库。

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

### 方案 3：Supabase

基于 HTTP 的 PostgreSQL + 存储。

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

## 向量存储集成

### Cloudflare Vectorize

原生向量搜索（测试版）。

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

## 流式响应

流式传输代理响应以提供更好的用户体验：

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

## 自定义域名

### 添加域名

```bash
# Add custom domain
wrangler domains add api.example.com
```

或通过 wrangler.toml：

```toml
[env.production]
routes = [
  { pattern = "api.example.com/*", zone_name = "example.com" }
]
```

### DNS 设置

添加 CNAME 记录：
```
api.example.com CNAME seashore-api.<subdomain>.workers.dev
```

SSL 通过 Cloudflare 自动配置。

---

## 环境特定配置

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

部署到特定环境：

```bash
wrangler deploy --env dev
wrangler deploy --env staging
wrangler deploy --env production
```

---

## 限流

保护您的 API 免受滥用：

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

## 缓存

缓存响应以加快后续请求：

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

## 监控

### Logpush

将日志发送到外部服务：

```bash
# Setup logpush to S3, Datadog, etc.
wrangler logpush create
```

### Analytics Engine

跟踪自定义指标：

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

### Sentry 集成

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

## 使用 GitHub Actions 进行 CI/CD

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

## 本地开发

```bash
# Start local dev server
wrangler dev

# With live reload
wrangler dev --live-reload

# Access at http://localhost:8787
```

### 本地测试

```bash
# Tail production logs
wrangler tail

# Tail specific environment
wrangler tail --env production
```

---

## 成本估算

### 免费套餐
- 每天 10 万次请求
- 每次请求 10ms CPU 时间
- 适用于：小型项目、原型

### 付费计划（每月 $5）
- 包含每月 1000 万次请求
- 每增加一百万次请求 $0.50
- 每次请求 50ms CPU 时间
- 适用于：生产应用

### 无界 Workers（每月 $5 + 使用量）
- 每次请求 30s CPU 时间
- 每百万 GB 秒 $0.15
- 适用于：长时间运行的任务

**成本示例：**
- 每月 100 万次请求：$0（免费套餐）
- 每月 5000 万次请求：约 $25
- 每月 5 亿次请求：约 $250

*LLM API 成本通常占总成本的主要部分*

---

## 故障排除

### CPU 时间超限

```
Error: Script exceeded CPU time limit
```

**解决方案：**
- 减少代理配置中的 `maxIterations`
- 升级到付费计划（50ms）或无界（30s）
- 优化工具执行
- 缓存昂贵的操作

### 找不到模块

```
Error: Cannot find module 'fs'
```

**解决方案：** Workers 不支持 `fs` 等 Node.js API。使用与 Worker 兼容的替代方案。

### KV 未更新

KV 最终一致。全球传播最多需要 60 秒。

### 冷启动延迟

不活动后的首次请求：约 50-200ms

**解决方案：**
- 接受它（仍然比 Lambda 快）
- 对有状态应用使用 Durable Objects
- 通过健康检查保持 Worker 温暖

---

## 下一步

- [环境变量 →](./environment.md)
- [监控设置 →](./monitoring.md)
- [AWS Lambda 比较 →](./aws-lambda.md)

## 其他资源

- [Cloudflare Workers 文档](https://developers.cloudflare.com/workers/)
- [Wrangler CLI 文档](https://developers.cloudflare.com/workers/wrangler/)
- [Vectorize 文档](https://developers.cloudflare.com/vectorize/)
- [D1 数据库文档](https://developers.cloudflare.com/d1/)
