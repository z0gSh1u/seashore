# 监控、日志和可观测性

关于监控 Seashore 部署、跟踪性能、调试问题和维护生产可靠性的综合指南。

## 为什么要监控？

- **及早发现问题** - 在用户投诉之前
- **了解性能** - 基于数据进行优化
- **跟踪成本** - LLM 令牌使用、基础设施
- **调试生产问题** - 根本原因分析
- **容量规划** - 主动扩展

---

## 可观测性的三大支柱

### 1. 日志

**发生了什么？** 带有上下文的离散事件。

### 2. 指标

**多少/多少？** 随时间变化的数值测量。

### 3. 追踪

**时间花在哪里？** 通过系统的请求流。

---

## 结构化日志

### 基础设置

```typescript
// src/logger.ts
import { z } from 'zod';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  [key: string]: any;
}

class Logger {
  constructor(private readonly service: string) {}
  
  private log(level: LogLevel, message: string, meta: Record<string, any> = {}) {
    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      service: this.service,
      ...meta,
    };
    
    // 在生产环境中，发送到日志服务
    // 在开发环境中，美化打印
    if (process.env.NODE_ENV === 'development') {
      console.log(`[${entry.level.toUpperCase()}] ${entry.message}`, meta);
    } else {
      console.log(JSON.stringify(entry));
    }
  }
  
  debug(message: string, meta?: Record<string, any>) {
    this.log('debug', message, meta);
  }
  
  info(message: string, meta?: Record<string, any>) {
    this.log('info', message, meta);
  }
  
  warn(message: string, meta?: Record<string, any>) {
    this.log('warn', message, meta);
  }
  
  error(message: string, error?: Error, meta?: Record<string, any>) {
    this.log('error', message, {
      ...meta,
      error: error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
      } : undefined,
    });
  }
}

export const logger = new Logger('seashore-api');
```

### 在处理程序中使用

```typescript
import { logger } from './logger.js';

app.post('/api/chat', async (c) => {
  const startTime = Date.now();
  const requestId = crypto.randomUUID();
  
  logger.info('Chat request received', {
    requestId,
    ip: c.req.header('CF-Connecting-IP'),
  });
  
  try {
    const { message } = await c.req.json();
    
    const result = await agent.run({ message });
    
    const duration = Date.now() - startTime;
    
    logger.info('Chat request completed', {
      requestId,
      duration,
      tokensUsed: result.tokensUsed,
    });
    
    return c.json(result);
    
  } catch (error) {
    const duration = Date.now() - startTime;
    
    logger.error('Chat request failed', error as Error, {
      requestId,
      duration,
    });
    
    return c.json({ error: 'Internal server error' }, 500);
  }
});
```

### 日志级别

| 级别 | 何时使用 | 示例 |
|-------|-------------|----------|
| `debug` | 开发细节 | 变量值、函数调用 |
| `info` | 正常操作 | 收到请求、任务完成 |
| `warn` | 潜在问题 | 使用了已弃用的 API、慢查询 |
| `error` | 失败 | 异常、请求失败 |

---

## 需要跟踪的关键指标

### 1. 请求指标

```typescript
interface RequestMetrics {
  // 吞吐量
  requestsPerSecond: number;
  requestsTotal: number;
  
  // 延迟
  responseTimeP50: number;  // 中位数
  responseTimeP95: number;  // 95 百分位
  responseTimeP99: number;  // 99 百分位
  
  // 错误
  errorRate: number;        // 百分比
  errorCount: number;
  
  // 按状态码
  status2xx: number;
  status4xx: number;
  status5xx: number;
}
```

### 2. 智能体指标

```typescript
interface AgentMetrics {
  // 性能
  agentExecutionTime: number;
  toolCallCount: number;
  iterationCount: number;
  
  // LLM 使用
  tokensPrompt: number;
  tokensCompletion: number;
  tokensTotal: number;
  llmCost: number;
  
  // 成功/失败
  completionRate: number;
  timeoutRate: number;
  maxIterationsReached: number;
}
```

### 3. 系统指标

```typescript
interface SystemMetrics {
  // 资源
  cpuUsage: number;           // 百分比
  memoryUsage: number;        // MB
  memoryPercentage: number;   // 百分比
  
  // 数据库
  dbConnectionsActive: number;
  dbConnectionsIdle: number;
  dbQueryTime: number;
  
  // 外部 API
  externalApiLatency: number;
  externalApiErrors: number;
}
```

---

## 实现指标

### 简单的内存指标

```typescript
// src/metrics.ts
class MetricsCollector {
  private metrics: Map<string, number[]> = new Map();
  
  record(name: string, value: number) {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }
    this.metrics.get(name)!.push(value);
    
    // 保留最后 1000 个值
    const values = this.metrics.get(name)!;
    if (values.length > 1000) {
      values.shift();
    }
  }
  
  increment(name: string, by: number = 1) {
    const current = this.metrics.get(name)?.[0] || 0;
    this.metrics.set(name, [current + by]);
  }
  
  percentile(name: string, p: number): number {
    const values = this.metrics.get(name) || [];
    if (values.length === 0) return 0;
    
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[index];
  }
  
  average(name: string): number {
    const values = this.metrics.get(name) || [];
    if (values.length === 0) return 0;
    
    return values.reduce((a, b) => a + b, 0) / values.length;
  }
  
  getAll() {
    const result: Record<string, any> = {};
    
    for (const [name, values] of this.metrics.entries()) {
      if (name.includes('time') || name.includes('duration')) {
        result[name] = {
          avg: this.average(name),
          p50: this.percentile(name, 50),
          p95: this.percentile(name, 95),
          p99: this.percentile(name, 99),
        };
      } else {
        result[name] = values[values.length - 1];
      }
    }
    
    return result;
  }
}

export const metrics = new MetricsCollector();
```

### 使用

```typescript
import { metrics } from './metrics.js';

app.post('/api/chat', async (c) => {
  const start = Date.now();
  
  try {
    const result = await agent.run({ message });
    
    // 记录指标
    metrics.record('request_duration', Date.now() - start);
    metrics.increment('requests_total');
    metrics.increment('requests_success');
    metrics.record('tokens_used', result.tokensUsed);
    
    return c.json(result);
    
  } catch (error) {
    metrics.increment('requests_error');
    throw error;
  }
});

// 指标端点
app.get('/metrics', (c) => {
  return c.json(metrics.getAll());
});
```

---

## 监控解决方案

### 1. Prometheus + Grafana

行业标准指标。

```bash
# 安装 prom-client
pnpm add prom-client
```

```typescript
import { register, Counter, Histogram, Gauge } from 'prom-client';

// 定义指标
const requestCounter = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'path', 'status'],
});

const requestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'path'],
  buckets: [0.1, 0.5, 1, 2, 5, 10],
});

const tokensUsed = new Counter({
  name: 'agent_tokens_total',
  help: 'Total LLM tokens used',
  labelNames: ['provider', 'model'],
});

// 中间件
app.use('*', async (c, next) => {
  const start = Date.now();
  
  await next();
  
  const duration = (Date.now() - start) / 1000;
  
  requestCounter.inc({
    method: c.req.method,
    path: c.req.path,
    status: c.res.status,
  });
  
  requestDuration.observe(
    { method: c.req.method, path: c.req.path },
    duration
  );
});

// 指标端点（用于 Prometheus 抓取）
app.get('/metrics', async (c) => {
  const metrics = await register.metrics();
  return c.text(metrics, 200, {
    'Content-Type': register.contentType,
  });
});
```

**Prometheus 配置：**

```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'seashore-api'
    scrape_interval: 15s
    static_configs:
      - targets: ['localhost:3000']
```

**Grafana 仪表板：**

```json
{
  "dashboard": {
    "title": "Seashore API",
    "panels": [
      {
        "title": "Request Rate",
        "targets": [
          {
            "expr": "rate(http_requests_total[5m])"
          }
        ]
      },
      {
        "title": "Response Time (p95)",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, http_request_duration_seconds_bucket)"
          }
        ]
      }
    ]
  }
}
```

---

### 2. Datadog

一体化监控平台。

```bash
pnpm add dd-trace
```

```typescript
// src/server.ts
import tracer from 'dd-trace';

tracer.init({
  service: 'seashore-api',
  env: process.env.NODE_ENV,
  version: '1.0.0',
  logInjection: true,
});

// 指标
import { metrics } from 'datadog-metrics';

metrics.init({
  apiKey: process.env.DATADOG_API_KEY,
  host: 'seashore-api',
  prefix: 'seashore.',
});

// 使用
app.post('/api/chat', async (c) => {
  const start = Date.now();
  
  try {
    const result = await agent.run({ message });
    
    metrics.increment('requests.success');
    metrics.histogram('request.duration', Date.now() - start);
    metrics.gauge('tokens.used', result.tokensUsed);
    
    return c.json(result);
  } catch (error) {
    metrics.increment('requests.error');
    throw error;
  }
});
```

---

### 3. New Relic

应用性能监控。

```bash
pnpm add newrelic
```

```javascript
// newrelic.js
exports.config = {
  app_name: ['Seashore API'],
  license_key: process.env.NEW_RELIC_LICENSE_KEY,
  logging: {
    level: 'info',
  },
  distributed_tracing: {
    enabled: true,
  },
};
```

```typescript
// src/server.ts
import 'newrelic';  // 必须是第一个导入

// 自定义指标
import newrelic from 'newrelic';

app.post('/api/chat', async (c) => {
  const result = await agent.run({ message });
  
  newrelic.recordMetric('Custom/TokensUsed', result.tokensUsed);
  newrelic.recordMetric('Custom/AgentIterations', result.iterations);
  
  return c.json(result);
});
```

---

### 4. Sentry

错误跟踪和性能监控。

```bash
pnpm add @sentry/node @sentry/profiling-node
```

```typescript
import * as Sentry from '@sentry/node';
import { ProfilingIntegration } from '@sentry/profiling-node';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 1.0,
  profilesSampleRate: 1.0,
  integrations: [
    new ProfilingIntegration(),
  ],
});

// 错误处理
app.onError((err, c) => {
  Sentry.captureException(err);
  return c.json({ error: 'Internal server error' }, 500);
});

// 性能监控
app.post('/api/chat', async (c) => {
  const transaction = Sentry.startTransaction({
    op: 'http.server',
    name: 'POST /api/chat',
  });
  
  try {
    const span = transaction.startChild({
      op: 'agent.run',
      description: 'Run agent',
    });
    
    const result = await agent.run({ message });
    
    span.finish();
    transaction.finish();
    
    return c.json(result);
  } catch (error) {
    transaction.setStatus('internal_error');
    transaction.finish();
    throw error;
  }
});
```

---

## 分布式追踪

跨服务跟踪请求。

### OpenTelemetry

```bash
pnpm add @opentelemetry/sdk-node @opentelemetry/auto-instrumentations-node
```

```typescript
// src/tracing.ts
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';

const sdk = new NodeSDK({
  traceExporter: new OTLPTraceExporter({
    url: 'http://localhost:4318/v1/traces',
  }),
  instrumentations: [getNodeAutoInstrumentations()],
});

sdk.start();

process.on('SIGTERM', () => {
  sdk.shutdown().then(() => process.exit(0));
});
```

```typescript
// src/server.ts
import './tracing.js';  // 首先初始化追踪

// 现在所有 HTTP 请求、数据库查询等都会自动追踪
```

---

## 成本监控

跟踪 LLM API 成本。

```typescript
// src/cost-tracker.ts
const PRICING = {
  'gpt-4o': {
    input: 0.005 / 1000,   // 每 1K 输入令牌 $0.005
    output: 0.015 / 1000,  // 每 1K 输出令牌 $0.015
  },
  'gpt-4o-mini': {
    input: 0.00015 / 1000,
    output: 0.0006 / 1000,
  },
  'claude-3-5-sonnet': {
    input: 0.003 / 1000,
    output: 0.015 / 1000,
  },
};

export const calculateCost = (
  model: string,
  tokensInput: number,
  tokensOutput: number
): number => {
  const pricing = PRICING[model];
  if (!pricing) return 0;
  
  return (
    tokensInput * pricing.input +
    tokensOutput * pricing.output
  );
};

// 跟踪成本
let totalCost = 0;

app.post('/api/chat', async (c) => {
  const result = await agent.run({ message });
  
  const cost = calculateCost(
    'gpt-4o',
    result.tokensPrompt,
    result.tokensCompletion
  );
  
  totalCost += cost;
  
  logger.info('Request cost', {
    cost,
    totalCost,
    tokensPrompt: result.tokensPrompt,
    tokensCompletion: result.tokensCompletion,
  });
  
  return c.json(result);
});

// 成本端点
app.get('/admin/costs', (c) => {
  return c.json({
    totalCost,
    currency: 'USD',
  });
});
```

---

## 健康检查

### 基础健康检查

```typescript
app.get('/health', (c) => {
  return c.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});
```

### 详细健康检查

```typescript
app.get('/health', async (c) => {
  const health = {
    status: 'ok' as 'ok' | 'degraded' | 'error',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    checks: {
      database: 'unknown' as 'ok' | 'error',
      redis: 'unknown' as 'ok' | 'error',
      llm: 'unknown' as 'ok' | 'error',
    },
  };
  
  // 检查数据库
  try {
    await pool.query('SELECT 1');
    health.checks.database = 'ok';
  } catch (error) {
    health.checks.database = 'error';
    health.status = 'error';
  }
  
  // 检查 Redis
  try {
    await redis.ping();
    health.checks.redis = 'ok';
  } catch (error) {
    health.checks.redis = 'error';
    health.status = 'degraded';
  }
  
  // 检查 LLM API
  try {
    await fetch('https://api.openai.com/v1/models', {
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    });
    health.checks.llm = 'ok';
  } catch (error) {
    health.checks.llm = 'error';
    health.status = 'degraded';
  }
  
  const statusCode = health.status === 'ok' ? 200 : 503;
  return c.json(health, statusCode);
});
```

---

## 告警

### 设置告警

**关键告警：**
- 错误率 > 5%
- 响应时间 p95 > 5s
- 健康检查失败
- 数据库连接池耗尽

**警告告警：**
- 错误率 > 1%
- 响应时间 p95 > 2s
- 内存使用率高 (>80%)
- CPU 使用率高 (>80%)

### 示例：Slack 告警

```typescript
const sendAlert = async (message: string, severity: 'warning' | 'critical') => {
  await fetch(process.env.SLACK_WEBHOOK_URL!, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: `[${severity.toUpperCase()}] ${message}`,
      channel: '#alerts',
    }),
  });
};

// 监控错误率
setInterval(() => {
  const errorRate = metrics.get('requests_error') / metrics.get('requests_total');
  
  if (errorRate > 0.05) {
    sendAlert(`Error rate is ${(errorRate * 100).toFixed(2)}%`, 'critical');
  } else if (errorRate > 0.01) {
    sendAlert(`Error rate is ${(errorRate * 100).toFixed(2)}%`, 'warning');
  }
}, 60000);  // 每分钟检查一次
```

---

## 仪表板示例

### 简单的 Express 仪表板

```typescript
app.get('/admin/dashboard', (c) => {
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Seashore API Dashboard</title>
        <meta http-equiv="refresh" content="5">
      </head>
      <body>
        <h1>Seashore API Dashboard</h1>
        <h2>Requests</h2>
        <p>Total: ${metrics.get('requests_total')}</p>
        <p>Success: ${metrics.get('requests_success')}</p>
        <p>Error: ${metrics.get('requests_error')}</p>
        <h2>Performance</h2>
        <p>Avg Response Time: ${metrics.average('request_duration').toFixed(0)}ms</p>
        <p>P95 Response Time: ${metrics.percentile('request_duration', 95).toFixed(0)}ms</p>
        <h2>Costs</h2>
        <p>Total Tokens: ${metrics.get('tokens_total')}</p>
        <p>Estimated Cost: $${metrics.get('cost_total').toFixed(4)}</p>
      </body>
    </html>
  `;
  
  return c.html(html);
});
```

---

## 最佳实践

1. **记录结构化数据** - 使用 JSON，而非纯文本
2. **包含上下文** - 请求 ID、用户 ID、时间戳
3. **不要记录密钥** - 屏蔽 API 密钥、密码
4. **采样追踪** - 不是每个请求（使用 1-10%）
5. **设置告警** - 不要等待用户报告问题
6. **监控成本** - LLM API 可能很昂贵
7. **使用仪表板** - 可视化趋势随时间变化
8. **测试监控** - 验证告警正确触发

---

## 下一步

- [故障排除指南 →](../troubleshooting/common-issues.md)
- [环境变量 →](./environment.md)
- [部署概述 →](./overview.md)

## 其他资源

- [Prometheus 文档](https://prometheus.io/docs/)
- [Grafana 仪表板](https://grafana.com/grafana/dashboards/)
- [OpenTelemetry](https://opentelemetry.io/)
