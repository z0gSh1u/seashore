# Environment Variables & Configuration

This guide covers managing environment variables, secrets, and configuration for Seashore deployments across different environments.

## Configuration Strategy

### The 12-Factor App

Follow these principles:
1. **Store config in environment** - Not in code
2. **Strict separation** - Dev, staging, production configs
3. **Never commit secrets** - Use secret management tools
4. **Validate on startup** - Fail fast if misconfigured

---

## Required Environment Variables

### Core Variables

```bash
# Node.js Environment
NODE_ENV=production              # production | development | staging

# Server Configuration
PORT=3000                        # Port to listen on
HOST=0.0.0.0                     # Host to bind to

# LLM Provider API Keys
OPENAI_API_KEY=sk-...           # OpenAI API key
ANTHROPIC_API_KEY=sk-ant-...    # Anthropic API key (optional)
GEMINI_API_KEY=...              # Google Gemini API key (optional)

# Database (if using @seashore/data)
DATABASE_URL=postgresql://user:password@host:5432/database

# Redis (optional, for caching)
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=secret            # If authentication enabled

# Security
JWT_SECRET=your-secret-key       # For JWT authentication
API_KEY=your-api-key             # For API key authentication

# CORS
ALLOWED_ORIGINS=https://example.com,https://app.example.com

# Logging
LOG_LEVEL=info                   # debug | info | warn | error
```

### Optional Variables

```bash
# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000     # 15 minutes in ms
RATE_LIMIT_MAX=100              # Max requests per window

# Timeouts
AGENT_TIMEOUT_MS=30000          # Agent execution timeout
DATABASE_QUERY_TIMEOUT_MS=10000 # Database query timeout

# Features
ENABLE_STREAMING=true           # Enable streaming responses
ENABLE_TRACING=false            # Enable performance tracing

# Monitoring
SENTRY_DSN=https://...          # Sentry error tracking
DATADOG_API_KEY=...             # Datadog monitoring
```

---

## Environment File Setup

### Development (.env)

```bash
# .env (local development only)
NODE_ENV=development
PORT=3000

OPENAI_API_KEY=sk-...
DATABASE_URL=postgresql://localhost/seashore_dev

LOG_LEVEL=debug
ENABLE_TRACING=true

# Relaxed CORS for local development
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173
```

**Important:** Never commit `.env` to git!

```gitignore
# .gitignore
.env
.env.*
!.env.example
```

### Example Template (.env.example)

```bash
# .env.example (committed to git)
NODE_ENV=development
PORT=3000

# API Keys (get from providers)
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
GEMINI_API_KEY=

# Database
DATABASE_URL=postgresql://localhost/seashore

# Redis (optional)
REDIS_URL=redis://localhost:6379

# Security
JWT_SECRET=generate-a-secret-key
ALLOWED_ORIGINS=http://localhost:3000
```

### Loading Environment Variables

```typescript
// src/config.ts
import 'dotenv/config';
import { z } from 'zod';

// Define schema for type-safe configuration
const configSchema = z.object({
  nodeEnv: z.enum(['development', 'staging', 'production']),
  port: z.coerce.number().int().positive(),
  
  // LLM Providers
  openaiApiKey: z.string().min(1),
  anthropicApiKey: z.string().optional(),
  
  // Database
  databaseUrl: z.string().url(),
  
  // Security
  jwtSecret: z.string().min(32),
  allowedOrigins: z.string().transform(s => s.split(',')),
  
  // Optional
  logLevel: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  enableTracing: z.coerce.boolean().default(false),
});

// Parse and validate
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

## Platform-Specific Configuration

### Hono on Node.js

```bash
# Use dotenv
pnpm add dotenv

# Load in server.ts
import 'dotenv/config';
```

Or with PM2:

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

Or with systemd:

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

#### Option 1: Environment File

```bash
# .env.production
NODE_ENV=production
PORT=3000
OPENAI_API_KEY=sk-...
DATABASE_URL=postgresql://postgres:5432/seashore
```

```bash
# Run with env file
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

#### Option 2: Docker Compose

```yaml
# docker-compose.yml
services:
  api:
    image: seashore-api
    environment:
      - NODE_ENV=production
      - PORT=3000
      - OPENAI_API_KEY=${OPENAI_API_KEY}  # From host env
      - DATABASE_URL=postgresql://postgres:5432/seashore
```

#### Option 3: Docker Secrets (Swarm)

```bash
# Create secret
echo "sk-..." | docker secret create openai_api_key -

# Use in service
docker service create \
  --name seashore-api \
  --secret openai_api_key \
  seashore-api
```

```typescript
// Read secret in code
import { readFileSync } from 'fs';

const apiKey = readFileSync('/run/secrets/openai_api_key', 'utf8').trim();
```

---

### Cloudflare Workers

```bash
# Add secrets (not visible in wrangler.toml)
wrangler secret put OPENAI_API_KEY
wrangler secret put JWT_SECRET

# List secrets
wrangler secret list
```

```toml
# wrangler.toml - Non-sensitive vars only
[vars]
NODE_ENV = "production"
LOG_LEVEL = "info"
ALLOWED_ORIGINS = "https://example.com"
```

```typescript
// Access in worker
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

#### Option 1: Environment Variables

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
# Deploy with parameters
sam deploy --parameter-overrides OpenAIApiKey=sk-...
```

#### Option 2: AWS Secrets Manager

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

// Cache secret for container reuse
let cachedSecrets: any = null;

export const handler = async (event) => {
  if (!cachedSecrets) {
    cachedSecrets = await getSecret('prod/seashore/secrets');
  }
  
  const apiKey = cachedSecrets.OPENAI_API_KEY;
  // ...
};
```

#### Option 3: Parameter Store

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

// Usage
const params = await getParameters([
  '/seashore/prod/openai-api-key',
  '/seashore/prod/jwt-secret',
]);
```

---

## Secrets Management Best Practices

### 1. Never Hardcode Secrets

```typescript
// ❌ WRONG
const apiKey = 'sk-proj-abc123';

// ✅ CORRECT
const apiKey = process.env.OPENAI_API_KEY;

// ✅ BETTER: Validate
if (!process.env.OPENAI_API_KEY) {
  throw new Error('OPENAI_API_KEY is required');
}
```

### 2. Rotate Secrets Regularly

```bash
# Generate new secret
openssl rand -base64 32

# Update in all environments
# - Development
# - Staging
# - Production
```

### 3. Use Different Secrets Per Environment

```bash
# Development
OPENAI_API_KEY=sk-proj-dev-...
JWT_SECRET=dev-secret-key

# Production
OPENAI_API_KEY=sk-proj-prod-...
JWT_SECRET=prod-secret-key-different
```

### 4. Limit Secret Access

- Development: Developers have access
- Production: Only CI/CD and ops team
- Use IAM roles/policies to restrict access

### 5. Audit Secret Usage

- Log when secrets are accessed (not the values!)
- Monitor for unusual access patterns
- Set up alerts for secret changes

---

## Secret Management Tools

### 1. Doppler

Centralized secret management.

```bash
# Install
brew install dopplerhq/cli/doppler

# Login
doppler login

# Run with Doppler
doppler run -- pnpm start
```

### 2. HashiCorp Vault

Enterprise secret management.

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

Already covered in Lambda section.

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

## Configuration Patterns

### Multi-Tenant Configuration

```typescript
// Different config per tenant
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

// Usage
const config = getTenantConfig(request.headers['x-tenant-id']);
const llm = createLLMAdapter(config);
```

### Feature Flags

```typescript
const features = {
  streaming: process.env.ENABLE_STREAMING === 'true',
  rag: process.env.ENABLE_RAG === 'true',
  analytics: process.env.ENABLE_ANALYTICS === 'true',
};

// Usage
if (features.streaming) {
  return await agent.stream({ message });
} else {
  return await agent.run({ message });
}
```

### Environment-Based Behavior

```typescript
const isDevelopment = process.env.NODE_ENV === 'development';
const isProduction = process.env.NODE_ENV === 'production';

if (isDevelopment) {
  // Enable verbose logging
  // Mock external services
  // Use test API keys
}

if (isProduction) {
  // Enable monitoring
  // Use production API keys
  // Strict error handling
}
```

---

## Validation & Type Safety

### Runtime Validation

```typescript
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'staging', 'production']),
  PORT: z.coerce.number().int().min(1).max(65535),
  
  // Required in production
  OPENAI_API_KEY: z.string().min(1),
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  
  // Optional
  REDIS_URL: z.string().url().optional(),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});

export const env = envSchema.parse(process.env);

// Now env is type-safe!
// env.PORT is number
// env.LOG_LEVEL is 'debug' | 'info' | 'warn' | 'error'
```

### Conditional Validation

```typescript
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'staging', 'production']),
  
  // JWT_SECRET required in production only
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

## Debugging Configuration Issues

### 1. Print Configuration on Startup

```typescript
// Only in development!
if (process.env.NODE_ENV === 'development') {
  console.log('Configuration:', {
    nodeEnv: process.env.NODE_ENV,
    port: process.env.PORT,
    databaseUrl: process.env.DATABASE_URL?.replace(/:[^:@]+@/, ':***@'),  // Mask password
    openaiApiKey: process.env.OPENAI_API_KEY ? '***' : undefined,  // Don't log actual key
  });
}
```

### 2. Validation Errors

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

### 3. Missing Variables

```bash
# Check what's available
env | grep -E '(OPENAI|DATABASE|JWT)'

# In Docker container
docker exec <container> env | grep OPENAI
```

---

## Security Checklist

- [ ] No secrets in code
- [ ] No secrets in git
- [ ] Different secrets per environment
- [ ] Secrets rotated regularly
- [ ] Minimum access principle
- [ ] Audit logs enabled
- [ ] Secrets encrypted at rest
- [ ] Secrets encrypted in transit
- [ ] Environment validated on startup
- [ ] Sensitive logs sanitized

---

## Next Steps

- [Monitoring setup →](./monitoring.md)
- [Docker deployment →](./docker.md)
- [AWS Lambda →](./aws-lambda.md)

## Additional Resources

- [12-Factor App Config](https://12factor.net/config)
- [OWASP Secrets Management](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html)
