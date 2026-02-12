# Deployment Overview

This guide helps you choose the right deployment strategy for your Seashore application and understand the trade-offs between different options.

## Quick Decision Matrix

| Use Case | Recommended Deployment | Key Benefits |
|----------|------------------------|--------------|
| Simple API server | [Hono on Node.js](./hono.md) | Easy setup, full Node.js features |
| Production web service | [Docker](./docker.md) | Reproducible, scalable, portable |
| Low latency globally | [Cloudflare Workers](./cloudflare-workers.md) | Edge deployment, sub-50ms response |
| Variable workload | [AWS Lambda](./aws-lambda.md) | Pay per use, auto-scaling |
| High volume chat | Docker + Redis | Stateful conversations, horizontal scaling |
| Enterprise deployment | Docker + Kubernetes | Full orchestration, multi-region |

## Deployment Options

### 1. Hono on Node.js

**Best for:** Development, small to medium production services, full control over runtime

```typescript
import { Hono } from 'hono';
import { createReActAgent } from '@seashore/agent';

const app = new Hono();

app.post('/chat', async (c) => {
  const { message } = await c.req.json();
  const result = await agent.run({ message });
  return c.json(result);
});

export default app;
```

**Pros:**
- Full Node.js ecosystem access
- Easy debugging with familiar tools
- Support for all Seashore features
- Simple process management with PM2 or systemd

**Cons:**
- Requires server management
- Manual scaling configuration
- Higher baseline cost (always running)

**When to use:**
- You need database connections
- You're using RAG with pgvector
- You need WebSocket support
- You want maximum flexibility

[Read the full Hono deployment guide →](./hono.md)

---

### 2. Docker Containers

**Best for:** Production deployments, microservices, CI/CD pipelines

```dockerfile
FROM node:20-alpine AS base
WORKDIR /app

# Install dependencies
COPY package*.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install --frozen-lockfile

# Build
COPY . .
RUN pnpm build

# Production image
FROM node:20-alpine
WORKDIR /app
COPY --from=base /app/dist ./dist
COPY --from=base /app/node_modules ./node_modules

CMD ["node", "dist/server.js"]
```

**Pros:**
- Reproducible builds
- Easy CI/CD integration
- Works with any orchestrator (K8s, ECS, Docker Swarm)
- Isolated dependencies

**Cons:**
- Requires container registry
- More complex local development
- Image size considerations

**When to use:**
- You need consistent environments
- You're deploying to Kubernetes or AWS ECS
- You want zero-downtime deployments
- You have multiple services

[Read the full Docker guide →](./docker.md)

---

### 3. Cloudflare Workers

**Best for:** Edge deployment, global low latency, static agents without databases

```typescript
import { Hono } from 'hono';
import { createReActAgent } from '@seashore/agent';
import { createLLMAdapter } from '@seashore/core';

const app = new Hono();

app.post('/chat', async (c) => {
  const llm = createLLMAdapter({
    provider: 'openai',
    apiKey: c.env.OPENAI_API_KEY,
  });
  
  const agent = createReActAgent({ llm, tools: [] });
  const { message } = await c.req.json();
  const result = await agent.run({ message });
  
  return c.json(result);
});

export default app;
```

**Pros:**
- Sub-50ms global latency
- Auto-scaling to millions of requests
- Extremely low cost ($0 for low traffic)
- No infrastructure management

**Cons:**
- CPU time limits (50ms-30s depending on plan)
- No filesystem access
- Limited Node.js API support
- No native PostgreSQL connections (use HTTP-based DB)

**When to use:**
- You need global low latency
- You have simple stateless agents
- You want minimal operational overhead
- Your workload is spiky/unpredictable

[Read the full Cloudflare Workers guide →](./cloudflare-workers.md)

---

### 4. AWS Lambda

**Best for:** Event-driven workloads, cost optimization, AWS ecosystem integration

```typescript
import { APIGatewayProxyHandler } from 'aws-lambda';
import { createReActAgent } from '@seashore/agent';

export const handler: APIGatewayProxyHandler = async (event) => {
  const { message } = JSON.parse(event.body || '{}');
  
  const agent = createReActAgent({
    llm: createLLMAdapter({
      provider: 'openai',
      apiKey: process.env.OPENAI_API_KEY!,
    }),
    tools: [],
  });
  
  const result = await agent.run({ message });
  
  return {
    statusCode: 200,
    body: JSON.stringify(result),
  };
};
```

**Pros:**
- Pay only for execution time
- Auto-scaling included
- Deep AWS integration (DynamoDB, S3, etc.)
- 15-minute maximum execution time

**Cons:**
- Cold start latency (100ms-5s)
- Complex VPC setup for databases
- Lambda-specific deployment process

**When to use:**
- You're already on AWS
- You need S3, DynamoDB, or SQS integration
- You have variable workload
- You want to minimize costs for low traffic

[Read the full AWS Lambda guide →](./aws-lambda.md)

---

## Architecture Patterns

### Pattern 1: Simple API

Single Hono server handling all requests.

```
┌─────────┐      ┌──────────────┐
│ Client  │─────▶│ Hono Server  │
└─────────┘      │   + Agent    │
                 └──────────────┘
```

**Use when:**
- Getting started
- Low to medium traffic
- Simple requirements

### Pattern 2: Load Balanced API

Multiple instances behind a load balancer.

```
                 ┌──────────────┐
         ┌──────▶│ Hono Server 1│
┌─────┐  │       └──────────────┘
│ LB  │──┤       ┌──────────────┐
└─────┘  └──────▶│ Hono Server 2│
                 └──────────────┘
```

**Use when:**
- High traffic
- Need redundancy
- Want zero-downtime deploys

### Pattern 3: Microservices

Separate services for different agent types.

```
┌─────────┐      ┌─────────────────┐
│ API GW  │─────▶│ Chat Agent API  │
│         │      └─────────────────┘
│         │      ┌─────────────────┐
│         │─────▶│ RAG Agent API   │
│         │      └─────────────────┘
│         │      ┌─────────────────┐
│         │─────▶│ Tool Agent API  │
└─────────┘      └─────────────────┘
```

**Use when:**
- Different scaling needs per agent
- Multiple teams
- Need to deploy independently

### Pattern 4: Event-Driven

Lambda functions triggered by events.

```
┌─────────┐      ┌─────────┐      ┌──────────┐
│ S3      │─────▶│ Lambda  │─────▶│ DynamoDB │
└─────────┘      │ + Agent │      └──────────┘
                 └─────────┘
```

**Use when:**
- Processing uploads/files
- Background processing
- Async workflows

### Pattern 5: Edge + Origin

Edge for routing, origin for heavy processing.

```
┌────────┐      ┌──────────────┐      ┌─────────┐
│ Client │─────▶│ CF Worker    │─────▶│ Origin  │
└────────┘      │ (Auth/Cache) │      │ (Agent) │
                └──────────────┘      └─────────┘
```

**Use when:**
- Global users
- Need caching
- Want to minimize origin load

---

## Resource Requirements

### CPU & Memory

| Workload | CPU | Memory | Notes |
|----------|-----|--------|-------|
| Simple chat | 1 vCPU | 512MB | Text-only, no RAG |
| Chat + tools | 2 vCPU | 1GB | API calls, calculations |
| RAG queries | 2 vCPU | 2GB | Vector search overhead |
| Embedding generation | 4 vCPU | 2GB | CPU-intensive |
| Workflow orchestration | 2 vCPU | 1GB | DAG execution |

### Concurrent Requests

Estimate based on response time:

```
Max concurrent = (Requests per second × Average response time)
```

Example:
- 100 req/sec × 2s average = 200 concurrent connections
- Recommend: 2 instances × 2 vCPU = 4 vCPU total

### Database Connections

PostgreSQL connection pool sizing:

```typescript
// For single instance
const pool = {
  min: 2,
  max: 10,  // per instance
};

// For multiple instances
const pool = {
  min: 2,
  max: Math.ceil(postgres_max_connections / number_of_instances),
};
```

Default PostgreSQL max connections: 100

---

## Cost Estimation

### Monthly Cost Examples (USD)

**Scenario 1: Small project (1K requests/day)**

| Platform | Monthly Cost |
|----------|--------------|
| Hono on smallest VPS | $5-10 |
| Cloudflare Workers | $0 (free tier) |
| AWS Lambda | $0-1 (free tier) |
| Docker on DigitalOcean | $12 (basic droplet) |

**Scenario 2: Growing app (100K requests/day)**

| Platform | Monthly Cost |
|----------|--------------|
| Hono on medium VPS | $20-40 |
| Cloudflare Workers | $5 |
| AWS Lambda | $10-30 |
| Docker on ECS | $50-100 |

**Scenario 3: High traffic (10M requests/day)**

| Platform | Monthly Cost |
|----------|--------------|
| Hono on load balanced | $500-1000 |
| Cloudflare Workers | $50-200 |
| AWS Lambda | $500-2000 |
| Kubernetes cluster | $1000-3000 |

*Costs are estimates and don't include LLM API costs, which typically dominate total cost*

---

## Security Considerations

### API Keys

**Never hardcode API keys:**

```typescript
// ❌ WRONG
const llm = createLLMAdapter({
  provider: 'openai',
  apiKey: 'sk-...',  // Never do this!
});

// ✅ CORRECT
const llm = createLLMAdapter({
  provider: 'openai',
  apiKey: process.env.OPENAI_API_KEY!,
});
```

### Rate Limiting

Protect your deployment from abuse:

```typescript
import { rateLimiter } from 'hono-rate-limiter';

app.use('/chat', rateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  message: 'Too many requests',
}));
```

### Authentication

Always require authentication for production:

```typescript
import { jwt } from 'hono/jwt';

app.use('/chat/*', jwt({
  secret: process.env.JWT_SECRET!,
}));

app.post('/chat', async (c) => {
  const payload = c.get('jwtPayload');
  // Use payload.userId, payload.email, etc.
});
```

### Input Validation

Validate all inputs:

```typescript
import { z } from 'zod';

const chatRequestSchema = z.object({
  message: z.string().min(1).max(10000),
  threadId: z.string().uuid().optional(),
});

app.post('/chat', async (c) => {
  const body = await c.req.json();
  const parsed = chatRequestSchema.safeParse(body);
  
  if (!parsed.success) {
    return c.json({ error: 'Invalid request' }, 400);
  }
  
  const { message, threadId } = parsed.data;
  // Safe to use
});
```

---

## Monitoring & Observability

Every deployment should include:

### 1. Health Checks

```typescript
app.get('/health', (c) => {
  return c.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});
```

### 2. Metrics

Track key metrics:
- Request rate
- Response time (p50, p95, p99)
- Error rate
- LLM token usage
- Database query time

### 3. Logging

Structure your logs:

```typescript
const logger = {
  info: (msg: string, meta: object) => {
    console.log(JSON.stringify({ level: 'info', msg, ...meta, timestamp: new Date() }));
  },
  error: (msg: string, error: Error, meta: object = {}) => {
    console.error(JSON.stringify({
      level: 'error',
      msg,
      error: error.message,
      stack: error.stack,
      ...meta,
      timestamp: new Date(),
    }));
  },
};
```

### 4. Alerting

Set up alerts for:
- Error rate > 5%
- Response time p95 > 5s
- Health check failures
- Database connection pool exhaustion

[Read the full monitoring guide →](./monitoring.md)

---

## Next Steps

1. **Choose your deployment platform** based on the decision matrix above
2. **Set up environment variables** - [Environment Guide →](./environment.md)
3. **Follow the platform-specific guide:**
   - [Hono on Node.js →](./hono.md)
   - [Docker →](./docker.md)
   - [Cloudflare Workers →](./cloudflare-workers.md)
   - [AWS Lambda →](./aws-lambda.md)
4. **Configure monitoring** - [Monitoring Guide →](./monitoring.md)
5. **Test your deployment** - Run load tests before production

## Common Questions

**Q: Can I use multiple deployment strategies?**
Yes! For example, use Cloudflare Workers for API gateway and Hono on Node.js for heavy RAG processing.

**Q: How do I handle database migrations in production?**
Run migrations before deploying new code. Use tools like `node-pg-migrate` or `drizzle-kit`.

**Q: Should I use serverless or containers?**
If workload is spiky and you want minimal ops, use serverless. If you need full control and have steady traffic, use containers.

**Q: What about WebSocket support?**
Use Hono on Node.js or Docker. Lambda and Workers don't support traditional WebSockets (though Workers support Durable Objects for stateful connections).

**Q: How do I test locally?**
All deployment options support local development. See each platform guide for details.
