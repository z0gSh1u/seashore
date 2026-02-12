# 环境变量与配置

本指南介绍如何在不同环境中管理 Seashore 部署的环境变量、密钥和配置。

## 配置策略

### 十二要素应用

遵循这些原则：
1. **将配置存储在环境中** - 而非代码中
2. **严格分离** - 开发、预发布、生产配置
3. **永不提交密钥** - 使用密钥管理工具
4. **启动时验证** - 配置错误时快速失败

---

## 必需的环境变量

### 核心变量

```bash
# Node.js 环境
NODE_ENV=production              # production | development | staging

# 服务器配置
PORT=3000                        # 监听端口
HOST=0.0.0.0                     # 绑定主机

# LLM 提供商 API 密钥
OPENAI_API_KEY=sk-...           # OpenAI API 密钥
ANTHROPIC_API_KEY=sk-ant-...    # Anthropic API 密钥（可选）
GEMINI_API_KEY=...              # Google Gemini API 密钥（可选）

# 数据库（如果使用 @seashore/data）
DATABASE_URL=postgresql://user:password@host:5432/database

# Redis（可选，用于缓存）
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=secret            # 如果启用了身份验证

# 安全
JWT_SECRET=your-secret-key       # 用于 JWT 身份验证
API_KEY=your-api-key             # 用于 API 密钥身份验证

# CORS
ALLOWED_ORIGINS=https://example.com,https://app.example.com

# 日志
LOG_LEVEL=info                   # debug | info | warn | error
```

### 可选变量

```bash
# 速率限制
RATE_LIMIT_WINDOW_MS=900000     # 15 分钟（毫秒）
RATE_LIMIT_MAX=100              # 每个窗口的最大请求数

# 超时
AGENT_TIMEOUT_MS=30000          # 智能体执行超时
DATABASE_QUERY_TIMEOUT_MS=10000 # 数据库查询超时

# 功能
ENABLE_STREAMING=true           # 启用流式响应
ENABLE_TRACING=false            # 启用性能追踪

# 监控
SENTRY_DSN=https://...          # Sentry 错误追踪
DATADOG_API_KEY=...             # Datadog 监控
```

---

## 环境文件设置

### 开发环境 (.env)

```bash
# .env (仅用于本地开发)
NODE_ENV=development
PORT=3000

OPENAI_API_KEY=sk-...
DATABASE_URL=postgresql://localhost/seashore_dev

LOG_LEVEL=debug
ENABLE_TRACING=true

# 本地开发的宽松 CORS
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173
```

**重要：** 永远不要将 `.env` 提交到 git！

```gitignore
# .gitignore
.env
.env.*
!.env.example
```

### 示例模板 (.env.example)

```bash
# .env.example (提交到 git)
NODE_ENV=development
PORT=3000

# API 密钥（从提供商获取）
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
GEMINI_API_KEY=

# 数据库
DATABASE_URL=postgresql://localhost/seashore

# Redis（可选）
REDIS_URL=redis://localhost:6379

# 安全
JWT_SECRET=generate-a-secret-key
ALLOWED_ORIGINS=http://localhost:3000
```

### 加载环境变量

```typescript
// src/config.ts
import 'dotenv/config';
import { z } from 'zod';

// 定义类型安全配置的模式
const configSchema = z.object({
  nodeEnv: z.enum(['development', 'staging', 'production']),
  port: z.coerce.number().int().positive(),
  
  // LLM 提供商
  openaiApiKey: z.string().min(1),
  anthropicApiKey: z.string().optional(),
  
  // 数据库
  databaseUrl: z.string().url(),
  
  // 安全
  jwtSecret: z.string().min(32),
  allowedOrigins: z.string().transform(s => s.split(',')),
  
  // 可选
  logLevel: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  enableTracing: z.coerce.boolean().default(false),
});

// 解析和验证
const parseConfig = () => {
  try {
    return configSchema.parse({
      nodeEnv: process.env.NODE_ENV,
      port: process.env.PORT,
      openaiApiKey: process.env.OPENAI_API_KEY,
      anthropicApiKey: process.env.ANTHROPIC_API_KEY,
      databaseUrl: process.env.DATABASE_URL,
      jwtSecret: process.env.JWT_SECRET,
      allowedOrigins: process.env.ALLOWED_ORIGINS,
      logLevel: process.env.LOG_LEVEL,
      enableTracing: process.env.ENABLE_TRACING,
    });
  } catch (error) {
    console.error('Configuration error:', error);
    process.exit(1);
  }
};

export const config = parseConfig();

// Usage in code
console.log(`Starting server on port ${config.port}`);
```

---

## 平台特定配置

### Hono on Node.js

```bash
# 使用 dotenv
pnpm add dotenv

# 在 server.ts 中加载
import 'dotenv/config';
```

或使用 PM2：

```javascript
// ecosystem.config.cjs
module.exports = {
  apps: [{
    name: 'seashore-api',
    script: './dist/server.js',
    env_production: {
      NODE_ENV: 'production',
      PORT: 3000,
      OPENAI_API_KEY: 'sk-...',
      DATABASE_URL: 'postgresql://...',
    },
  }],
};
```

或使用 systemd：

```ini
# /etc/seashore-api/env
NODE_ENV=production
PORT=3000
OPENAI_API_KEY=sk-...
DATABASE_URL=postgresql://...
```

```ini
# /etc/systemd/system/seashore-api.service
[Service]
EnvironmentFile=/etc/seashore-api/env
```

---

### Docker

#### 选项 1：环境文件

```bash
# .env.production
NODE_ENV=production
PORT=3000
OPENAI_API_KEY=sk-...
DATABASE_URL=postgresql://postgres:5432/seashore
```

```bash
# 使用 env 文件运行
docker run --env-file .env.production seashore-api
```

```yaml
# docker-compose.yml
services:
  api:
    image: seashore-api
    env_file:
      - .env.production
```

#### 选项 2：Docker Compose

```yaml
# docker-compose.yml
services:
  api:
    image: seashore-api
    environment:
      - NODE_ENV=production
      - PORT=3000
      - OPENAI_API_KEY=${OPENAI_API_KEY}  # 从主机环境
      - DATABASE_URL=postgresql://postgres:5432/seashore
```

#### 选项 3：Docker Secrets (Swarm)

```bash
# 创建密钥
echo "sk-..." | docker secret create openai_api_key -

# 在服务中使用
docker service create \
  --name seashore-api \
  --secret openai_api_key \
  seashore-api
```

```typescript
// 在代码中读取密钥
import { readFileSync } from 'fs';

const apiKey = readFileSync('/run/secrets/openai_api_key', 'utf8').trim();
```

---

### Cloudflare Workers

```bash
# 添加密钥（在 wrangler.toml 中不可见）
wrangler secret put OPENAI_API_KEY
wrangler secret put JWT_SECRET

# 列出密钥
wrangler secret list
```

```toml
# wrangler.toml - 仅非敏感变量
[vars]
NODE_ENV = "production"
LOG_LEVEL = "info"
ALLOWED_ORIGINS = "https://example.com"
```

```typescript
// 在 worker 中访问
interface Env {
  NODE_ENV: string;
  OPENAI_API_KEY: string;  // From secret
  ALLOWED_ORIGINS: string;  // From vars
}

export default {
  async fetch(request: Request, env: Env) {
    const apiKey = env.OPENAI_API_KEY;
    // ...
  },
};
```

---

### AWS Lambda

#### 选项 1：环境变量

```yaml
# template.yaml
Resources:
  SeashoreFunction:
    Type: AWS::Serverless::Function
    Properties:
      Environment:
        Variables:
          NODE_ENV: production
          OPENAI_API_KEY: !Ref OpenAIApiKey

Parameters:
  OpenAIApiKey:
    Type: String
    NoEcho: true
```

```bash
# 使用参数部署
sam deploy --parameter-overrides OpenAIApiKey=sk-...
```

#### 选项 2：AWS Secrets Manager

```yaml
Resources:
  SeashoreFunction:
    Type: AWS::Serverless::Function
    Properties:
      Policies:
        - AWSSecretsManagerGetSecretValuePolicy:
            SecretArn: !Ref OpenAISecret
```

```typescript
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

const client = new SecretsManagerClient({});

const getSecret = async (secretId: string) => {
  const response = await client.send(
    new GetSecretValueCommand({ SecretId: secretId })
  );
  return JSON.parse(response.SecretString!);
};

// 缓存密钥以供容器重用
let cachedSecrets: any = null;

export const handler = async (event) => {
  if (!cachedSecrets) {
    cachedSecrets = await getSecret('prod/seashore/secrets');
  }
  
  const apiKey = cachedSecrets.OPENAI_API_KEY;
  // ...
};
```

#### 选项 3：Parameter Store

```typescript
import { SSMClient, GetParametersCommand } from '@aws-sdk/client-ssm';

const ssm = new SSMClient({});

const getParameters = async (names: string[]) => {
  const response = await ssm.send(
    new GetParametersCommand({
      Names: names,
      WithDecryption: true,
    })
  );
  
  return response.Parameters!.reduce((acc, param) => {
    acc[param.Name!] = param.Value!;
    return acc;
  }, {} as Record<string, string>);
};

// 使用
const params = await getParameters([
  '/seashore/prod/openai-api-key',
  '/seashore/prod/jwt-secret',
]);
```

---

## 密钥管理最佳实践

### 1. 永不硬编码密钥

```typescript
// ❌ 错误
const apiKey = 'sk-proj-abc123';

// ✅ 正确
const apiKey = process.env.OPENAI_API_KEY;

// ✅ 更好：验证
if (!process.env.OPENAI_API_KEY) {
  throw new Error('OPENAI_API_KEY is required');
}
```

### 2. 定期轮换密钥

```bash
# 生成新密钥
openssl rand -base64 32

# 在所有环境中更新
# - 开发
# - 预发布
# - 生产
```

### 3. 为每个环境使用不同的密钥

```bash
# 开发
OPENAI_API_KEY=sk-proj-dev-...
JWT_SECRET=dev-secret-key

# 生产
OPENAI_API_KEY=sk-proj-prod-...
JWT_SECRET=prod-secret-key-different
```

### 4. 限制密钥访问

- 开发：开发人员有访问权限
- 生产：仅 CI/CD 和运维团队
- 使用 IAM 角色/策略限制访问

### 5. 审计密钥使用

- 记录密钥访问时间（不记录值！）
- 监控异常访问模式
- 设置密钥更改的警报

---

## 密钥管理工具

### 1. Doppler

集中式密钥管理。

```bash
# 安装
brew install dopplerhq/cli/doppler

# 登录
doppler login

# 使用 Doppler 运行
doppler run -- pnpm start
```

### 2. HashiCorp Vault

企业密钥管理。

```typescript
import vault from 'node-vault';

const client = vault({
  endpoint: 'https://vault.example.com',
  token: process.env.VAULT_TOKEN,
});

const { data } = await client.read('secret/data/seashore/prod');
const apiKey = data.data.OPENAI_API_KEY;
```

### 3. AWS Secrets Manager

已在 Lambda 部分介绍。

### 4. Azure Key Vault

```typescript
import { SecretClient } from '@azure/keyvault-secrets';
import { DefaultAzureCredential } from '@azure/identity';

const client = new SecretClient(
  'https://your-vault.vault.azure.net',
  new DefaultAzureCredential()
);

const secret = await client.getSecret('OpenAIApiKey');
const apiKey = secret.value;
```

### 5. Google Secret Manager

```typescript
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';

const client = new SecretManagerServiceClient();

const [version] = await client.accessSecretVersion({
  name: 'projects/123/secrets/openai-api-key/versions/latest',
});

const apiKey = version.payload?.data?.toString();
```

---

## 配置模式

### 多租户配置

```typescript
// 每个租户不同的配置
const getTenantConfig = (tenantId: string) => {
  const configs = {
    'tenant-a': {
      openaiApiKey: process.env.TENANT_A_OPENAI_KEY,
      model: 'gpt-4o',
      maxTokens: 1000,
    },
    'tenant-b': {
      openaiApiKey: process.env.TENANT_B_OPENAI_KEY,
      model: 'gpt-4o-mini',
      maxTokens: 500,
    },
  };
  
  return configs[tenantId];
};

// 使用
const config = getTenantConfig(request.headers['x-tenant-id']);
const llm = createLLMAdapter(config);
```

### 功能标志

```typescript
const features = {
  streaming: process.env.ENABLE_STREAMING === 'true',
  rag: process.env.ENABLE_RAG === 'true',
  analytics: process.env.ENABLE_ANALYTICS === 'true',
};

// 使用
if (features.streaming) {
  return await agent.stream({ message });
} else {
  return await agent.run({ message });
}
```

### 基于环境的行为

```typescript
const isDevelopment = process.env.NODE_ENV === 'development';
const isProduction = process.env.NODE_ENV === 'production';

if (isDevelopment) {
  // 启用详细日志
  // 模拟外部服务
  // 使用测试 API 密钥
}

if (isProduction) {
  // 启用监控
  // 使用生产 API 密钥
  // 严格错误处理
}
```

---

## 验证与类型安全

### 运行时验证

```typescript
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'staging', 'production']),
  PORT: z.coerce.number().int().min(1).max(65535),
  
  // 生产环境必需
  OPENAI_API_KEY: z.string().min(1),
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  
  // 可选
  REDIS_URL: z.string().url().optional(),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});

export const env = envSchema.parse(process.env);

// 现在 env 是类型安全的！
// env.PORT 是 number
// env.LOG_LEVEL 是 'debug' | 'info' | 'warn' | 'error'
```

### 条件验证

```typescript
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'staging', 'production']),
  
  // JWT_SECRET 仅在生产环境必需
  JWT_SECRET: z.string().min(32).optional(),
}).refine(
  (data) => {
    if (data.NODE_ENV === 'production' && !data.JWT_SECRET) {
      return false;
    }
    return true;
  },
  {
    message: 'JWT_SECRET is required in production',
  }
);
```

---

## 调试配置问题

### 1. 启动时打印配置

```typescript
// 仅在开发环境！
if (process.env.NODE_ENV === 'development') {
  console.log('Configuration:', {
    nodeEnv: process.env.NODE_ENV,
    port: process.env.PORT,
    databaseUrl: process.env.DATABASE_URL?.replace(/:[^:@]+@/, ':***@'),  // 屏蔽密码
    openaiApiKey: process.env.OPENAI_API_KEY ? '***' : undefined,  // 不记录实际密钥
  });
}
```

### 2. 验证错误

```typescript
try {
  const config = configSchema.parse(process.env);
} catch (error) {
  if (error instanceof z.ZodError) {
    console.error('Configuration validation failed:');
    error.errors.forEach(err => {
      console.error(`  ${err.path.join('.')}: ${err.message}`);
    });
    process.exit(1);
  }
}
```

### 3. 缺失变量

```bash
# 检查可用的变量
env | grep -E '(OPENAI|DATABASE|JWT)'

# 在 Docker 容器中
docker exec <container> env | grep OPENAI
```

---

## 安全检查清单

- [ ] 代码中无密钥
- [ ] git 中无密钥
- [ ] 每个环境使用不同的密钥
- [ ] 定期轮换密钥
- [ ] 最小访问原则
- [ ] 启用审计日志
- [ ] 静态加密密钥
- [ ] 传输加密密钥
- [ ] 启动时验证环境
- [ ] 清理敏感日志

---

## 下一步

- [监控设置 →](./monitoring.md)
- [Docker 部署 →](./docker.md)
- [AWS Lambda →](./aws-lambda.md)

## 其他资源

- [12-Factor App Config](https://12factor.net/config)
- [OWASP Secrets Management](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html)
