# 常见问题和解决方案

开发和部署 Seashore 应用时常见问题的故障排除指南。

## 目录

- [安装问题](#安装问题)
- [构建和 TypeScript 错误](#构建和-typescript-错误)
- [运行时错误](#运行时错误)
- [Agent 问题](#agent-问题)
- [数据库和 RAG 问题](#数据库和-rag-问题)
- [部署问题](#部署问题)
- [性能问题](#性能问题)

---

## 安装问题

### 错误: 找不到模块 '@seashore/core'

**症状:**
```
Error: Cannot find module '@seashore/core' or its corresponding type declarations.
```

**原因:**
- 包未安装
- Node.js 版本错误
- node_modules 损坏

**解决方案:**

```bash
# 1. 安装包
pnpm install

# 2. 检查 Node.js 版本(需要 20+)
node --version

# 3. 清除缓存并重新安装
rm -rf node_modules pnpm-lock.yaml
pnpm install

# 4. 如果使用 workspace,先构建包
pnpm build
```

### pnpm install 失败

**症状:**
```
ERR_PNPM_PEER_DEP_ISSUES  Unmet peer dependencies
```

**解决方案:**

```bash
# 强制安装(谨慎使用)
pnpm install --force

# 或使用严格的对等依赖
pnpm install --strict-peer-dependencies=false

# 更新 pnpm 到最新版本
npm install -g pnpm@latest
```

---

## 构建和 TypeScript 错误

### 错误: 导入路径必须使用 .js 扩展名

**症状:**
```
TS2835: Relative import paths need explicit file extensions
```

**原因:** Seashore 使用带显式 `.js` 扩展名的 ESM。

**解决方案:**

```typescript
// ❌ 错误
import { createTool } from './tools'
import { createTool } from './tools.ts'

// ✅ 正确
import { createTool } from './tools.js'
```

**为什么是 `.js` 而不是 `.ts`?** TypeScript 将 `.ts` 转译为 `.js`,所以导入引用输出文件。

### 错误: 模块不在 rootDir 中

**症状:**
```
File is not under 'rootDir'. 'rootDir' is expected to contain all source files.
```

**原因:** 不正确地跨包边界导入。

**解决方案:**

```typescript
// ❌ 错误(直接从 src 导入)
import { createTool } from '@seashore/core/src/tool/toolkit.js'

// ✅ 正确(使用包导出)
import { createTool } from '@seashore/core'
```

### 错误: 不能在模块外使用 import 语句

**症状:**
```
SyntaxError: Cannot use import statement outside a module
```

**原因:** package.json 中缺少 `"type": "module"`。

**解决方案:**

```json
{
  "type": "module",
  "scripts": {
    "start": "node dist/server.js"
  }
}
```

### 更新后的 TypeScript 编译错误

**症状:**
```
error TS2322: Type 'X' is not assignable to type 'Y'
```

**解决方案:**

```bash
# 1. 清理构建
rm -rf dist
pnpm build

# 2. 清除 TypeScript 缓存
rm -rf node_modules/.cache

# 3. 重启 TypeScript 服务器(在 VSCode 中)
# Cmd+Shift+P -> "TypeScript: Restart TS Server"

# 4. 检查 TypeScript 版本(需要 5.7+)
pnpm list typescript
```

---

## 运行时错误

### 错误: 未找到 API 密钥

**症状:**
```
Error: OPENAI_API_KEY is required
```

**原因:**
- 未设置环境变量
- `.env` 文件未加载
- 变量名错误

**解决方案:**

```bash
# 1. 检查环境变量
env | grep OPENAI

# 2. 设置变量
export OPENAI_API_KEY='sk-...'

# 3. 加载 .env 文件
# 在入口文件中添加:
import 'dotenv/config';

# 4. 检查变量名匹配
# OPENAI_API_KEY (不是 OPENAI_KEY)
```

### 错误: fetch is not defined

**症状:**
```
ReferenceError: fetch is not defined
```

**原因:** Node.js < 18 或 fetch 不可用。

**解决方案:**

```bash
# 1. 更新 Node.js 到 20+
nvm install 20
nvm use 20

# 2. 或安装 fetch polyfill
pnpm add node-fetch
```

```typescript
// 如果需要 polyfill
import fetch from 'node-fetch';
globalThis.fetch = fetch as any;
```

### 错误: 连接被拒绝(数据库)

**症状:**
```
Error: connect ECONNREFUSED 127.0.0.1:5432
```

**原因:**
- PostgreSQL 未运行
- 连接字符串错误
- 防火墙阻止连接

**解决方案:**

```bash
# 1. 检查 PostgreSQL 是否运行
pg_isready
# 或
docker ps | grep postgres

# 2. 测试连接
psql postgresql://localhost/mydb

# 3. 检查 DATABASE_URL 格式
# postgresql://user:password@host:port/database
echo $DATABASE_URL

# 4. 启动 PostgreSQL
# macOS
brew services start postgresql

# Docker
docker-compose up postgres
```

---

## Agent 问题

### Agent 不使用工具

**症状:**
- Agent 在不调用工具的情况下响应
- 工具可用但被忽略

**原因:**
- 工具描述不清楚
- 系统提示冲突
- 错误的模型(某些模型不支持工具)

**解决方案:**

```typescript
// 1. 改进工具描述
const tool = createTool({
  name: 'weather',
  // ❌ 模糊
  description: 'Get weather',
  
  // ✅ 清晰具体
  description: 'Get current weather conditions for any city. Use this when the user asks about weather, temperature, or forecast.',
  
  parameters: z.object({
    location: z.string().describe('City name (e.g., "Tokyo", "New York")'),
  }),
  execute: async ({ location }) => {
    // ...
  },
});

// 2. 检查系统提示不冲突
const agent = createReActAgent({
  llm,
  tools: [weatherTool],
  // ❌ 这可能阻止工具使用
  systemPrompt: 'Answer questions directly without using tools.',
  
  // ✅ 鼓励工具使用
  systemPrompt: 'You are a helpful assistant. Use available tools to provide accurate information.',
});

// 3. 验证模型支持工具
const llm = createLLMAdapter({
  provider: 'openai',
  model: 'gpt-4o',  // ✅ 支持工具
  // model: 'gpt-3.5-turbo-instruct',  // ❌ 不支持工具
});
```

### Agent 达到最大迭代次数

**症状:**
```
Error: Max iterations (5) reached
```

**原因:**
- 工具返回不清楚的结果
- Agent 陷入循环
- 任务太复杂

**解决方案:**

```typescript
// 1. 增加最大迭代次数
const agent = createReActAgent({
  llm,
  tools,
  maxIterations: 10,  // 默认是 5
});

// 2. 改进工具响应
execute: async ({ query }) => {
  const results = await search(query);
  
  // ❌ 不清楚的响应
  return results;
  
  // ✅ 清晰、结构化的响应
  if (results.length === 0) {
    return 'No results found.';
  }
  
  return `Found ${results.length} results:\n${
    results.map(r => `- ${r.title}: ${r.snippet}`).join('\n')
  }`;
}

// 3. 分解复杂任务
// 而不是一个复杂的 agent,使用工作流:
const workflow = createWorkflow({
  steps: [
    { id: 'search', fn: searchStep },
    { id: 'analyze', fn: analyzeStep, deps: ['search'] },
    { id: 'summarize', fn: summarizeStep, deps: ['analyze'] },
  ],
});
```

### Agent 响应很慢

**症状:**
- 响应时间超过 10 秒
- 生产环境超时

**原因:**
- 工具调用太多
- 外部 API 慢
- 上下文过大

**解决方案:**

```typescript
// 1. 设置超时
const agent = createReActAgent({
  llm,
  tools,
  timeout: 30000,  // 30 秒
});

// 2. 优化工具执行
execute: async ({ query }) => {
  // ❌ 顺序调用
  const results1 = await api1.search(query);
  const results2 = await api2.search(query);
  
  // ✅ 并行调用
  const [results1, results2] = await Promise.all([
    api1.search(query),
    api2.search(query),
  ]);
  
  return results1.concat(results2);
}

// 3. 使用流式传输获得更好的用户体验
const stream = await agent.stream({ message });
for await (const chunk of stream) {
  // 立即向用户显示进度
  process.stdout.write(chunk.content);
}

// 4. 减少上下文大小
// 总结长历史记录
const agent = createReActAgent({
  llm,
  tools,
  maxHistoryLength: 10,  // 保留最后 10 条消息
});
```

---

## 数据库和 RAG 问题

### 未找到 pgvector 扩展

**症状:**
```
Error: extension "vector" does not exist
```

**原因:** 未安装 pgvector 扩展。

**解决方案:**

```sql
-- 1. 安装扩展
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. 验证安装
SELECT * FROM pg_extension WHERE extname = 'vector';

-- 3. 如果使用 Docker,使用 pgvector 镜像
docker run -d \
  --name postgres \
  -e POSTGRES_PASSWORD=secret \
  pgvector/pgvector:pg16
```

### 向量搜索未返回结果

**症状:**
- RAG 查询返回空数组
- 嵌入存在但未找到

**原因:**
- 相似度阈值错误
- 嵌入维度不匹配
- 未创建索引

**解决方案:**

```typescript
// 1. 调整相似度阈值
const results = await rag.query('my question', {
  limit: 5,
  threshold: 0.8,  // ❌ 太严格
});

const results = await rag.query('my question', {
  limit: 5,
  threshold: 0.5,  // ✅ 更宽松
});

// 2. 检查嵌入维度
// OpenAI: 1536, Cohere: 1024 等
// 确保所有嵌入使用相同模型

// 3. 为更好的性能创建索引
await pool.query(`
  CREATE INDEX IF NOT EXISTS embeddings_idx
  ON documents USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);
`);

// 4. 调试: 检查数据库中的内容
const { rows } = await pool.query(`
  SELECT id, content, embedding <=> $1 as distance
  FROM documents
  ORDER BY embedding <=> $1
  LIMIT 5
`, [embedding]);
console.log('Top results:', rows);
```

### 数据库连接池耗尽

**症状:**
```
Error: Connection pool exhausted
TimeoutError: Waiting for available connection
```

**原因:**
- 并发请求太多
- 连接未释放
- 池太小

**解决方案:**

```typescript
// 1. 增加池大小
const pool = new Pool({
  max: 20,  // 从默认的 10 增加
  min: 2,
  idleTimeoutMillis: 30000,
});

// 2. 始终释放连接
try {
  const client = await pool.connect();
  try {
    const result = await client.query('SELECT * FROM documents');
    return result.rows;
  } finally {
    client.release();  // ✅ 始终释放!
  }
} catch (error) {
  console.error(error);
}

// 3. 使用 pool.query() 代替(自动释放)
const result = await pool.query('SELECT * FROM documents');

// 4. 监控池指标
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

## 部署问题

### Docker 构建失败

**症状:**
```
Error: Cannot find module in container
Failed to build image
```

**解决方案:**

```dockerfile
# 1. 检查 .dockerignore 不排除需要的文件
# .dockerignore
node_modules
dist
.git
# 不要排除: package.json, pnpm-lock.yaml, src/

# 2. 验证多阶段构建复制
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install
COPY . .
RUN pnpm build

FROM node:20-alpine AS production
WORKDIR /app
# ✅ 复制构建文件
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

# 3. 检查 Node.js 版本匹配
FROM node:20-alpine  # 必须匹配本地 Node.js 主版本
```

### 容器中环境变量不可用

**症状:**
```
Error: OPENAI_API_KEY is required
(但在 .env 中设置了)
```

**解决方案:**

```bash
# 1. 将 env 文件传递给 Docker
docker run --env-file .env seashore-api

# 2. 或在 docker-compose.yml 中
services:
  api:
    env_file:
      - .env

# 3. 或直接设置
docker run -e OPENAI_API_KEY=sk-... seashore-api

# 4. 调试: 检查容器中可用的内容
docker exec <container> env | grep OPENAI
```

### Lambda 超时错误

**症状:**
```
Task timed out after 3.00 seconds
```

**解决方案:**

```bash
# 1. 增加 Lambda 超时
aws lambda update-function-configuration \
  --function-name seashore-agent \
  --timeout 60  # 最多 900 秒(15 分钟)

# 2. 或在 SAM 模板中
Resources:
  SeashoreFunction:
    Type: AWS::Serverless::Function
    Properties:
      Timeout: 60

# 3. 优化冷启动
# - 减少包大小
# - 使用预配置并发
# - 使用 ARM 架构
```

### Cloudflare Workers CPU 时间超限

**症状:**
```
Error: Script exceeded CPU time limit
```

**解决方案:**

```typescript
// 1. 减少 agent 迭代次数
const agent = createReActAgent({
  llm,
  tools,
  maxIterations: 3,  // Workers 降低
});

// 2. 升级到付费计划(50ms CPU 时间)
// 或 Unbound Workers(30s CPU 时间)

// 3. 卸载重度处理
// 使用 Workers 作为 API 网关,转发到源站进行重度工作

// 4. 优化工具
execute: async ({ query }) => {
  // ❌ 重度处理
  const results = await expensiveOperation();
  
  // ✅ 缓存结果
  const cached = await cache.get(query);
  if (cached) return cached;
  
  const results = await expensiveOperation();
  await cache.put(query, results);
  return results;
}
```

---

## 性能问题

### 内存使用率高

**症状:**
- 进程内存随时间增长
- 内存不足错误

**原因:**
- 内存泄漏
- 大型上下文累积
- 无限制缓存

**解决方案:**

```typescript
// 1. 限制对话历史
const agent = createReActAgent({
  llm,
  tools,
  maxHistoryLength: 20,  // 保留最后 20 条消息
});

// 2. 实现缓存驱逐
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

// 3. 监控内存
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

// 4. 定期重启(PM2)
// ecosystem.config.cjs
module.exports = {
  apps: [{
    max_memory_restart: '500M',
  }],
};
```

### API 响应慢

**症状:**
- 响应时间 > 5 秒
- 用户抱怨速度

**解决方案:**

```typescript
// 1. 使用流式传输获得更好的感知性能
app.post('/api/chat/stream', async (c) => {
  const stream = await agent.stream({ message });
  // 用户立即看到响应
  return streamResponse(stream);
});

// 2. 缓存 LLM 响应
const cache = new Map<string, any>();

app.post('/api/chat', async (c) => {
  const { message } = await c.req.json();
  const cacheKey = `chat:${message}`;
  
  const cached = cache.get(cacheKey);
  if (cached) {
    return c.json(cached);  // 即时响应
  }
  
  const result = await agent.run({ message });
  cache.set(cacheKey, result);
  
  return c.json(result);
});

// 3. 优化工具执行
// 使用 Promise.all() 进行并行调用
// 为外部 API 添加超时
// 缓存工具结果

// 4. 监控和分析
import { performance } from 'perf_hooks';

const start = performance.now();
const result = await agent.run({ message });
const duration = performance.now() - start;

logger.info('Agent execution', { duration });
```

---

## 调试模式

为故障排除启用详细日志:

```typescript
// 设置日志级别
process.env.LOG_LEVEL = 'debug';

// 启用 agent 调试模式
const agent = createReActAgent({
  llm,
  tools,
  debug: true,  // 记录每一步
});

// 记录所有 LLM 请求/响应
const llm = createLLMAdapter({
  provider: 'openai',
  apiKey: process.env.OPENAI_API_KEY,
  debug: true,
});
```

---

## 获取帮助

如果仍然遇到问题:

1. **搜索 GitHub Issues**: [github.com/seashore/seashore/issues](https://github.com/seashore/seashore/issues)
2. **查看 FAQ**: [FAQ →](./faq.md)
3. **在 Discord 上提问**: [discord.gg/seashore](https://discord.gg/seashore)
4. **创建 Issue**: 包含:
   - Seashore 版本
   - Node.js 版本
   - 最小复现代码
   - 错误消息
   - 您尝试过的方法

---

## 下一步

- [FAQ →](./faq.md)
- [迁移指南 →](../migration/migration-guide.md)
- [监控 →](../deployment/monitoring.md)
