# 部署概览

本指南帮助您为 Seashore 应用选择合适的部署策略,并理解不同选项之间的权衡。

## 快速决策矩阵

| 使用场景 | 推荐部署方式 | 核心优势 |
|----------|--------------|----------|
| 简单 API 服务器 | [Hono on Node.js](./hono.md) | 易于设置,完整的 Node.js 功能 |
| 生产 Web 服务 | [Docker](./docker.md) | 可复现、可扩展、可移植 |
| 全球低延迟 | [Cloudflare Workers](./cloudflare-workers.md) | 边缘部署,低于 50ms 响应时间 |
| 可变工作负载 | [AWS Lambda](./aws-lambda.md) | 按使用付费,自动扩展 |
| 高并发聊天 | Docker + Redis | 有状态会话,水平扩展 |
| 企业部署 | Docker + Kubernetes | 完整编排,多区域 |

## 部署选项

### 1. Hono on Node.js

**最适合:** 开发环境、中小型生产服务、需要完全控制运行时

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

**优势:**
- 完整的 Node.js 生态系统访问
- 使用熟悉工具轻松调试
- 支持所有 Seashore 功能
- 使用 PM2 或 systemd 简单管理进程

**劣势:**
- 需要服务器管理
- 手动配置扩展
- 更高的基础成本(始终运行)

**适用场景:**
- 需要数据库连接
- 使用 pgvector 实现 RAG
- 需要 WebSocket 支持
- 需要最大灵活性

[阅读完整的 Hono 部署指南 →](./hono.md)

---

### 2. Docker 容器

**最适合:** 生产部署、微服务、CI/CD 流水线

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

**优势:**
- 可复现的构建
- 易于 CI/CD 集成
- 适用于任何编排器(K8s、ECS、Docker Swarm)
- 隔离的依赖

**劣势:**
- 需要容器镜像仓库
- 本地开发更复杂
- 镜像大小需要考虑

**适用场景:**
- 需要一致的环境
- 部署到 Kubernetes 或 AWS ECS
- 需要零停机部署
- 有多个服务

[阅读完整的 Docker 指南 →](./docker.md)

---

### 3. Cloudflare Workers

**最适合:** 边缘部署、全球低延迟、无数据库的静态 agent

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

**优势:**
- 全球低于 50ms 延迟
- 自动扩展到数百万请求
- 极低成本(低流量 $0)
- 无需基础设施管理

**劣势:**
- CPU 时间限制(根据计划 50ms-30s)
- 无文件系统访问
- 有限的 Node.js API 支持
- 无原生 PostgreSQL 连接(使用基于 HTTP 的数据库)

**适用场景:**
- 需要全球低延迟
- 简单的无状态 agent
- 需要最小运维开销
- 工作负载不稳定/不可预测

[阅读完整的 Cloudflare Workers 指南 →](./cloudflare-workers.md)

---

### 4. AWS Lambda

**最适合:** 事件驱动工作负载、成本优化、AWS 生态系统集成

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

**优势:**
- 仅按执行时间付费
- 包含自动扩展
- 深度 AWS 集成(DynamoDB、S3 等)
- 最长 15 分钟执行时间

**劣势:**
- 冷启动延迟(100ms-5s)
- 数据库需要复杂的 VPC 设置
- 特定于 Lambda 的部署流程

**适用场景:**
- 已在使用 AWS
- 需要 S3、DynamoDB 或 SQS 集成
- 工作负载可变
- 希望最小化低流量成本

[阅读完整的 AWS Lambda 指南 →](./aws-lambda.md)

---

## 架构模式

### 模式 1: 简单 API

单个 Hono 服务器处理所有请求。

```
┌─────────┐      ┌──────────────┐
│ Client  │─────▶│ Hono Server  │
└─────────┘      │   + Agent    │
                 └──────────────┘
```

**适用场景:**
- 刚开始
- 低到中等流量
- 简单需求

### 模式 2: 负载均衡 API

负载均衡器后的多个实例。

```
                 ┌──────────────┐
         ┌──────▶│ Hono Server 1│
┌─────┐  │       └──────────────┘
│ LB  │──┤       ┌──────────────┐
└─────┘  └──────▶│ Hono Server 2│
                 └──────────────┘
```

**适用场景:**
- 高流量
- 需要冗余
- 需要零停机部署

### 模式 3: 微服务

不同 agent 类型的独立服务。

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

**适用场景:**
- 每个 agent 有不同的扩展需求
- 多个团队
- 需要独立部署

### 模式 4: 事件驱动

由事件触发的 Lambda 函数。

```
┌─────────┐      ┌─────────┐      ┌──────────┐
│ S3      │─────▶│ Lambda  │─────▶│ DynamoDB │
└─────────┘      │ + Agent │      └──────────┘
                 └─────────┘
```

**适用场景:**
- 处理上传/文件
- 后台处理
- 异步工作流

### 模式 5: 边缘 + 源站

边缘用于路由,源站用于重度处理。

```
┌────────┐      ┌──────────────┐      ┌─────────┐
│ Client │─────▶│ CF Worker    │─────▶│ Origin  │
└────────┘      │ (Auth/Cache) │      │ (Agent) │
                └──────────────┘      └─────────┘
```

**适用场景:**
- 全球用户
- 需要缓存
- 希望最小化源站负载

---

## 资源需求

### CPU 和内存

| 工作负载 | CPU | 内存 | 备注 |
|----------|-----|------|------|
| 简单聊天 | 1 vCPU | 512MB | 纯文本,无 RAG |
| 聊天 + 工具 | 2 vCPU | 1GB | API 调用、计算 |
| RAG 查询 | 2 vCPU | 2GB | 向量搜索开销 |
| 嵌入生成 | 4 vCPU | 2GB | CPU 密集型 |
| 工作流编排 | 2 vCPU | 1GB | DAG 执行 |

### 并发请求

基于响应时间估算:

```
最大并发 = (每秒请求数 × 平均响应时间)
```

示例:
- 100 req/sec × 2s 平均 = 200 并发连接
- 建议: 2 实例 × 2 vCPU = 总共 4 vCPU

### 数据库连接

PostgreSQL 连接池大小:

```typescript
// 单实例
const pool = {
  min: 2,
  max: 10,  // 每个实例
};

// 多实例
const pool = {
  min: 2,
  max: Math.ceil(postgres_max_connections / number_of_instances),
};
```

默认 PostgreSQL 最大连接数: 100

---

## 成本估算

### 每月成本示例(美元)

**场景 1: 小型项目(每天 1K 请求)**

| 平台 | 每月成本 |
|------|----------|
| 最小 VPS 上的 Hono | $5-10 |
| Cloudflare Workers | $0(免费层) |
| AWS Lambda | $0-1(免费层) |
| DigitalOcean 上的 Docker | $12(基础 droplet) |

**场景 2: 成长中的应用(每天 100K 请求)**

| 平台 | 每月成本 |
|------|----------|
| 中等 VPS 上的 Hono | $20-40 |
| Cloudflare Workers | $5 |
| AWS Lambda | $10-30 |
| ECS 上的 Docker | $50-100 |

**场景 3: 高流量(每天 1000 万请求)**

| 平台 | 每月成本 |
|------|----------|
| 负载均衡的 Hono | $500-1000 |
| Cloudflare Workers | $50-200 |
| AWS Lambda | $500-2000 |
| Kubernetes 集群 | $1000-3000 |

*成本为估算值,不包括 LLM API 成本,通常 LLM API 成本占总成本的主要部分*

---

## 安全考虑

### API 密钥

**永远不要硬编码 API 密钥:**

```typescript
// ❌ 错误
const llm = createLLMAdapter({
  provider: 'openai',
  apiKey: 'sk-...',  // 永远不要这样做!
});

// ✅ 正确
const llm = createLLMAdapter({
  provider: 'openai',
  apiKey: process.env.OPENAI_API_KEY!,
});
```

### 速率限制

保护您的部署免受滥用:

```typescript
import { rateLimiter } from 'hono-rate-limiter';

app.use('/chat', rateLimiter({
  windowMs: 15 * 60 * 1000, // 15 分钟
  max: 100, // 每个窗口 100 个请求
  message: 'Too many requests',
}));
```

### 身份验证

生产环境始终需要身份验证:

```typescript
import { jwt } from 'hono/jwt';

app.use('/chat/*', jwt({
  secret: process.env.JWT_SECRET!,
}));

app.post('/chat', async (c) => {
  const payload = c.get('jwtPayload');
  // 使用 payload.userId、payload.email 等
});
```

### 输入验证

验证所有输入:

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
  // 安全使用
});
```

---

## 监控和可观测性

每个部署都应该包括:

### 1. 健康检查

```typescript
app.get('/health', (c) => {
  return c.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});
```

### 2. 指标

跟踪关键指标:
- 请求速率
- 响应时间(p50、p95、p99)
- 错误率
- LLM token 使用量
- 数据库查询时间

### 3. 日志

结构化日志:

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

### 4. 告警

为以下情况设置告警:
- 错误率 > 5%
- 响应时间 p95 > 5s
- 健康检查失败
- 数据库连接池耗尽

[阅读完整的监控指南 →](./monitoring.md)

---

## 下一步

1. **根据上述决策矩阵选择您的部署平台**
2. **设置环境变量** - [环境指南 →](./environment.md)
3. **按照特定平台指南操作:**
   - [Hono on Node.js →](./hono.md)
   - [Docker →](./docker.md)
   - [Cloudflare Workers →](./cloudflare-workers.md)
   - [AWS Lambda →](./aws-lambda.md)
4. **配置监控** - [监控指南 →](./monitoring.md)
5. **测试您的部署** - 在生产前运行负载测试

## 常见问题

**问: 可以使用多种部署策略吗?**
可以!例如,使用 Cloudflare Workers 作为 API 网关,Hono on Node.js 用于重度 RAG 处理。

**问: 如何在生产环境处理数据库迁移?**
在部署新代码之前运行迁移。使用 `node-pg-migrate` 或 `drizzle-kit` 等工具。

**问: 应该使用 serverless 还是容器?**
如果工作负载不稳定且希望最小化运维,使用 serverless。如果需要完全控制且流量稳定,使用容器。

**问: WebSocket 支持怎么样?**
使用 Hono on Node.js 或 Docker。Lambda 和 Workers 不支持传统 WebSocket(尽管 Workers 支持 Durable Objects 用于有状态连接)。

**问: 如何本地测试?**
所有部署选项都支持本地开发。有关详细信息,请参阅每个平台指南。
