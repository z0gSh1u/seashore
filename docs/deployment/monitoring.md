# Monitoring, Logging, and Observability

Comprehensive guide to monitoring Seashore deployments, tracking performance, debugging issues, and maintaining production reliability.

## Why Monitor?

- **Detect issues early** - Before users complain
- **Understand performance** - Optimize based on data
- **Track costs** - LLM token usage, infrastructure
- **Debug production** - Root cause analysis
- **Capacity planning** - Scale proactively

---

## The Three Pillars of Observability

### 1. Logs

**What happened?** Discrete events with context.

### 2. Metrics

**How much/many?** Numerical measurements over time.

### 3. Traces

**Where did time go?** Request flow through system.

---

## Structured Logging

### Basic Setup

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
    
    // In production, send to logging service
    // In development, pretty print
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

### Usage in Handlers

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

### Log Levels

| Level | When to Use | Examples |
|-------|-------------|----------|
| `debug` | Development details | Variable values, function calls |
| `info` | Normal operations | Request received, task completed |
| `warn` | Potential issues | Deprecated API used, slow query |
| `error` | Failures | Exceptions, failed requests |

---

## Key Metrics to Track

### 1. Request Metrics

```typescript
interface RequestMetrics {
  // Throughput
  requestsPerSecond: number;
  requestsTotal: number;
  
  // Latency
  responseTimeP50: number;  // Median
  responseTimeP95: number;  // 95th percentile
  responseTimeP99: number;  // 99th percentile
  
  // Errors
  errorRate: number;        // Percentage
  errorCount: number;
  
  // By status code
  status2xx: number;
  status4xx: number;
  status5xx: number;
}
```

### 2. Agent Metrics

```typescript
interface AgentMetrics {
  // Performance
  agentExecutionTime: number;
  toolCallCount: number;
  iterationCount: number;
  
  // LLM Usage
  tokensPrompt: number;
  tokensCompletion: number;
  tokensTotal: number;
  llmCost: number;
  
  // Success/Failure
  completionRate: number;
  timeoutRate: number;
  maxIterationsReached: number;
}
```

### 3. System Metrics

```typescript
interface SystemMetrics {
  // Resources
  cpuUsage: number;           // Percentage
  memoryUsage: number;        // MB
  memoryPercentage: number;   // Percentage
  
  // Database
  dbConnectionsActive: number;
  dbConnectionsIdle: number;
  dbQueryTime: number;
  
  // External APIs
  externalApiLatency: number;
  externalApiErrors: number;
}
```

---

## Implementing Metrics

### Simple In-Memory Metrics

```typescript
// src/metrics.ts
class MetricsCollector {
  private metrics: Map<string, number[]> = new Map();
  
  record(name: string, value: number) {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }
    this.metrics.get(name)!.push(value);
    
    // Keep last 1000 values
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

### Usage

```typescript
import { metrics } from './metrics.js';

app.post('/api/chat', async (c) => {
  const start = Date.now();
  
  try {
    const result = await agent.run({ message });
    
    // Record metrics
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

// Metrics endpoint
app.get('/metrics', (c) => {
  return c.json(metrics.getAll());
});
```

---

## Monitoring Solutions

### 1. Prometheus + Grafana

Industry standard for metrics.

```bash
# Install prom-client
pnpm add prom-client
```

```typescript
import { register, Counter, Histogram, Gauge } from 'prom-client';

// Define metrics
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

// Middleware
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

// Metrics endpoint (for Prometheus scraping)
app.get('/metrics', async (c) => {
  const metrics = await register.metrics();
  return c.text(metrics, 200, {
    'Content-Type': register.contentType,
  });
});
```

**Prometheus config:**

```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'seashore-api'
    scrape_interval: 15s
    static_configs:
      - targets: ['localhost:3000']
```

**Grafana dashboard:**

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

All-in-one monitoring platform.

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

// Metrics
import { metrics } from 'datadog-metrics';

metrics.init({
  apiKey: process.env.DATADOG_API_KEY,
  host: 'seashore-api',
  prefix: 'seashore.',
});

// Usage
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

Application performance monitoring.

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
import 'newrelic';  // Must be first import

// Custom metrics
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

Error tracking and performance monitoring.

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

// Error handling
app.onError((err, c) => {
  Sentry.captureException(err);
  return c.json({ error: 'Internal server error' }, 500);
});

// Performance monitoring
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

## Distributed Tracing

Track requests across services.

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
import './tracing.js';  // Initialize tracing first

// Now all HTTP requests, database queries, etc. are traced automatically
```

---

## Cost Monitoring

Track LLM API costs.

```typescript
// src/cost-tracker.ts
const PRICING = {
  'gpt-4o': {
    input: 0.005 / 1000,   // $0.005 per 1K input tokens
    output: 0.015 / 1000,  // $0.015 per 1K output tokens
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

// Track costs
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

// Cost endpoint
app.get('/admin/costs', (c) => {
  return c.json({
    totalCost,
    currency: 'USD',
  });
});
```

---

## Health Checks

### Basic Health Check

```typescript
app.get('/health', (c) => {
  return c.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});
```

### Detailed Health Check

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
  
  // Check database
  try {
    await pool.query('SELECT 1');
    health.checks.database = 'ok';
  } catch (error) {
    health.checks.database = 'error';
    health.status = 'error';
  }
  
  // Check Redis
  try {
    await redis.ping();
    health.checks.redis = 'ok';
  } catch (error) {
    health.checks.redis = 'error';
    health.status = 'degraded';
  }
  
  // Check LLM API
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

## Alerting

### Set Up Alerts

**Critical alerts:**
- Error rate > 5%
- Response time p95 > 5s
- Health check failures
- Database connection pool exhausted

**Warning alerts:**
- Error rate > 1%
- Response time p95 > 2s
- High memory usage (>80%)
- High CPU usage (>80%)

### Example: Slack Alerts

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

// Monitor error rate
setInterval(() => {
  const errorRate = metrics.get('requests_error') / metrics.get('requests_total');
  
  if (errorRate > 0.05) {
    sendAlert(`Error rate is ${(errorRate * 100).toFixed(2)}%`, 'critical');
  } else if (errorRate > 0.01) {
    sendAlert(`Error rate is ${(errorRate * 100).toFixed(2)}%`, 'warning');
  }
}, 60000);  // Check every minute
```

---

## Dashboard Examples

### Simple Express Dashboard

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

## Best Practices

1. **Log structured data** - Use JSON, not plain text
2. **Include context** - Request ID, user ID, timestamps
3. **Don't log secrets** - Mask API keys, passwords
4. **Sample traces** - Not every request (use 1-10%)
5. **Set up alerts** - Don't wait for users to report issues
6. **Monitor costs** - LLM APIs can get expensive
7. **Use dashboards** - Visualize trends over time
8. **Test monitoring** - Verify alerts fire correctly

---

## Next Steps

- [Troubleshooting guide →](../troubleshooting/common-issues.md)
- [Environment variables →](./environment.md)
- [Deployment overview →](./overview.md)

## Additional Resources

- [Prometheus Documentation](https://prometheus.io/docs/)
- [Grafana Dashboards](https://grafana.com/grafana/dashboards/)
- [OpenTelemetry](https://opentelemetry.io/)
