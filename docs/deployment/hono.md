# Deploying Seashore with Hono on Node.js

This guide covers deploying Seashore applications using Hono web framework on Node.js servers, including PM2 process management and systemd service configuration.

## Why Hono + Node.js?

- **Full Node.js ecosystem** - Access to all npm packages
- **WebSocket support** - Real-time bidirectional communication
- **Database connections** - Native PostgreSQL, Redis, etc.
- **Flexible deployment** - VPS, bare metal, or container-based
- **Easy debugging** - Familiar Node.js tooling

## Prerequisites

- Node.js 20+ installed
- A server (VPS, EC2, DigitalOcean, etc.)
- Domain name (optional but recommended)
- SSL certificate (use Let's Encrypt)

---

## Quick Start

### 1. Create Your Hono Server

```typescript
// src/server.ts
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { createLLMAdapter } from '@seashore/core';
import { createReActAgent } from '@seashore/agent';

const app = new Hono();

// Middleware
app.use('*', logger());
app.use('*', cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true,
}));

// Health check
app.get('/health', (c) => {
  return c.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Create agent (singleton pattern)
const llm = createLLMAdapter({
  provider: 'openai',
  model: 'gpt-4o',
  apiKey: process.env.OPENAI_API_KEY!,
});

const agent = createReActAgent({
  llm,
  tools: [],
  maxIterations: 5,
});

// Chat endpoint
app.post('/api/chat', async (c) => {
  try {
    const { message, threadId } = await c.req.json();
    
    if (!message || typeof message !== 'string') {
      return c.json({ error: 'Message is required' }, 400);
    }
    
    const result = await agent.run({ 
      message, 
      threadId,
    });
    
    return c.json({
      message: result.message,
      threadId: result.threadId,
    });
  } catch (error) {
    console.error('Chat error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Streaming endpoint
app.post('/api/chat/stream', async (c) => {
  const { message, threadId } = await c.req.json();
  
  const stream = await agent.stream({ message, threadId });
  
  return c.newResponse(
    new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const data = `data: ${JSON.stringify(chunk)}\n\n`;
            controller.enqueue(new TextEncoder().encode(data));
          }
          controller.close();
        } catch (error) {
          controller.error(error);
        }
      },
    }),
    {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    }
  );
});

// Start server
const port = parseInt(process.env.PORT || '3000');
console.log(`Server starting on http://localhost:${port}`);

export default {
  port,
  fetch: app.fetch,
};
```

### 2. Add Start Script

```json
// package.json
{
  "name": "seashore-api",
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "build": "tsc",
    "start": "node dist/server.js"
  },
  "dependencies": {
    "@seashore/core": "^0.0.1",
    "@seashore/agent": "^0.0.1",
    "hono": "^4.6.14"
  },
  "devDependencies": {
    "@types/node": "^22.10.7",
    "tsx": "^4.19.0",
    "typescript": "^5.7.3"
  }
}
```

### 3. Build and Run

```bash
# Development
pnpm dev

# Production
pnpm build
pnpm start
```

---

## Production Deployment

### Option 1: PM2 Process Manager

PM2 provides process management, automatic restarts, and zero-downtime deploys.

#### Install PM2

```bash
npm install -g pm2
```

#### Create Ecosystem File

```javascript
// ecosystem.config.cjs
module.exports = {
  apps: [{
    name: 'seashore-api',
    script: './dist/server.js',
    instances: 'max',  // Use all CPU cores
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000,
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 3000,
    },
    max_memory_restart: '500M',
    error_file: './logs/error.log',
    out_file: './logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    autorestart: true,
    watch: false,
    max_restarts: 10,
    min_uptime: '10s',
  }],
};
```

#### Deploy with PM2

```bash
# Build
pnpm build

# Start with PM2
pm2 start ecosystem.config.cjs --env production

# Save PM2 config
pm2 save

# Setup PM2 startup script
pm2 startup systemd
# Run the command it outputs

# Useful PM2 commands
pm2 status           # View status
pm2 logs             # View logs
pm2 monit            # Monitor CPU/memory
pm2 restart all      # Restart all apps
pm2 reload all       # Zero-downtime reload
pm2 stop all         # Stop all apps
pm2 delete all       # Delete all apps
```

#### Zero-Downtime Deployments

```bash
# deployment script: deploy.sh
#!/bin/bash
set -e

echo "Pulling latest code..."
git pull origin main

echo "Installing dependencies..."
pnpm install --frozen-lockfile

echo "Building..."
pnpm build

echo "Reloading PM2 (zero downtime)..."
pm2 reload ecosystem.config.cjs --env production

echo "Deployment complete!"
```

```bash
chmod +x deploy.sh
./deploy.sh
```

---

### Option 2: systemd Service

For more control and integration with Linux systems.

#### Create Service File

```ini
# /etc/systemd/system/seashore-api.service
[Unit]
Description=Seashore API Server
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/seashore-api
ExecStart=/usr/bin/node /var/www/seashore-api/dist/server.js
Restart=on-failure
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=seashore-api

# Environment
Environment=NODE_ENV=production
Environment=PORT=3000
EnvironmentFile=/etc/seashore-api/env

# Security
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/var/www/seashore-api/logs

[Install]
WantedBy=multi-user.target
```

#### Create Environment File

```bash
# /etc/seashore-api/env
NODE_ENV=production
PORT=3000
OPENAI_API_KEY=sk-...
DATABASE_URL=postgresql://user:pass@localhost/seashore
ALLOWED_ORIGINS=https://example.com,https://app.example.com
```

```bash
# Secure the environment file
sudo chmod 600 /etc/seashore-api/env
sudo chown www-data:www-data /etc/seashore-api/env
```

#### Enable and Start Service

```bash
# Reload systemd
sudo systemctl daemon-reload

# Enable service (start on boot)
sudo systemctl enable seashore-api

# Start service
sudo systemctl start seashore-api

# Check status
sudo systemctl status seashore-api

# View logs
sudo journalctl -u seashore-api -f

# Restart service
sudo systemctl restart seashore-api

# Stop service
sudo systemctl stop seashore-api
```

---

## Nginx Reverse Proxy

Put Nginx in front of your Node.js server for:
- SSL termination
- Load balancing
- Static file serving
- Rate limiting

### Basic Configuration

```nginx
# /etc/nginx/sites-available/seashore-api
server {
    listen 80;
    server_name api.example.com;
    
    # Redirect to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.example.com;
    
    # SSL certificates (use certbot)
    ssl_certificate /etc/letsencrypt/live/api.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.example.com/privkey.pem;
    
    # SSL security settings
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    
    # Logging
    access_log /var/log/nginx/seashore-api.access.log;
    error_log /var/log/nginx/seashore-api.error.log;
    
    # Proxy settings
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        
        # Headers
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
        
        # Disable buffering for streaming
        proxy_buffering off;
        proxy_cache off;
    }
    
    # Health check endpoint
    location /health {
        proxy_pass http://localhost:3000/health;
        access_log off;
    }
}
```

### Enable Site

```bash
# Create symlink
sudo ln -s /etc/nginx/sites-available/seashore-api /etc/nginx/sites-enabled/

# Test configuration
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx
```

### SSL with Let's Encrypt

```bash
# Install certbot
sudo apt install certbot python3-certbot-nginx

# Get certificate
sudo certbot --nginx -d api.example.com

# Auto-renewal (runs twice daily)
sudo systemctl enable certbot.timer
sudo systemctl start certbot.timer
```

---

## Load Balancing Multiple Instances

### Nginx Upstream

```nginx
upstream seashore_backend {
    least_conn;  # Load balancing method
    
    server localhost:3000 max_fails=3 fail_timeout=30s;
    server localhost:3001 max_fails=3 fail_timeout=30s;
    server localhost:3002 max_fails=3 fail_timeout=30s;
    
    keepalive 32;
}

server {
    listen 443 ssl http2;
    server_name api.example.com;
    
    # ... SSL config ...
    
    location / {
        proxy_pass http://seashore_backend;
        
        # ... proxy settings ...
    }
}
```

### PM2 Cluster Mode

```javascript
// ecosystem.config.cjs
module.exports = {
  apps: [{
    name: 'seashore-api',
    script: './dist/server.js',
    instances: 4,  // Or 'max' for all CPU cores
    exec_mode: 'cluster',
    
    // Cluster-specific settings
    instance_var: 'INSTANCE_ID',
    
    // ... other settings ...
  }],
};
```

**Note:** Cluster mode requires stateless servers or session affinity.

---

## Database Connection Pooling

### PostgreSQL with pg

```typescript
import { Pool } from 'pg';

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  
  // Connection pool settings
  min: 2,
  max: 10,  // Adjust based on number of instances
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Handle pool errors
pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

// Use in your agent
import { createRAGPipeline } from '@seashore/data';

const ragPipeline = createRAGPipeline({
  pool,
  collectionName: 'documents',
});
```

### Graceful Shutdown

```typescript
// src/server.ts
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, closing server...');
  
  // Stop accepting new requests
  server.close(() => {
    console.log('Server closed');
  });
  
  // Close database connections
  await pool.end();
  
  // Exit
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, closing server...');
  await pool.end();
  process.exit(0);
});
```

---

## Monitoring with PM2

### PM2 Plus (Cloud Monitoring)

```bash
# Link PM2 to PM2 Plus
pm2 link <secret_key> <public_key>

# View in dashboard: https://app.pm2.io/
```

Features:
- Real-time monitoring
- Exception tracking
- Custom metrics
- Deployment tracking

### Custom Metrics

```typescript
import pm2 from 'pm2';

// Track custom metric
pm2.connect((err) => {
  if (err) {
    console.error(err);
    return;
  }
  
  const metric = pm2.probe.metric({
    name: 'Agent Requests',
    unit: 'req/min',
  });
  
  // Increment on each request
  app.post('/api/chat', async (c) => {
    metric.mark();
    // ... handle request ...
  });
});
```

---

## Environment Variables

### Using dotenv

```bash
# .env (for development only)
NODE_ENV=development
PORT=3000
OPENAI_API_KEY=sk-...
DATABASE_URL=postgresql://localhost/seashore
```

```typescript
// src/server.ts
import 'dotenv/config';  // Load .env file

// Now process.env.* variables are available
```

**Never commit .env to git:**
```gitignore
# .gitignore
.env
.env.*
!.env.example
```

### Production Environment Variables

Set via:
- systemd `EnvironmentFile`
- PM2 ecosystem config `env` section
- Docker environment variables
- Cloud provider secrets (AWS Secrets Manager, etc.)

---

## Security Hardening

### Rate Limiting

```typescript
import { rateLimiter } from 'hono-rate-limiter';

app.use('/api/*', rateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window per IP
  message: 'Too many requests, please try again later',
}));
```

### Authentication

```typescript
import { jwt } from 'hono/jwt';

const jwtMiddleware = jwt({
  secret: process.env.JWT_SECRET!,
});

app.use('/api/chat/*', jwtMiddleware);

app.post('/api/chat', async (c) => {
  const payload = c.get('jwtPayload');
  const userId = payload.sub;
  
  // Use userId for scoping queries, etc.
});
```

### Input Validation

```typescript
import { z } from 'zod';

const chatRequestSchema = z.object({
  message: z.string().min(1).max(10000),
  threadId: z.string().uuid().optional(),
});

app.post('/api/chat', async (c) => {
  const body = await c.req.json();
  const result = chatRequestSchema.safeParse(body);
  
  if (!result.success) {
    return c.json({ 
      error: 'Invalid request', 
      details: result.error.issues,
    }, 400);
  }
  
  const { message, threadId } = result.data;
  // ... safe to use ...
});
```

### CORS Configuration

```typescript
import { cors } from 'hono/cors';

app.use('*', cors({
  origin: (origin) => {
    // Allow specific origins
    const allowed = [
      'https://example.com',
      'https://app.example.com',
    ];
    
    if (allowed.includes(origin)) {
      return origin;
    }
    
    return null;  // Reject
  },
  credentials: true,
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  maxAge: 600,
}));
```

---

## Troubleshooting

### Port Already in Use

```bash
# Find process using port 3000
sudo lsof -i :3000

# Kill process
kill -9 <PID>
```

### PM2 Process Crashing

```bash
# View error logs
pm2 logs seashore-api --err

# Increase max restarts
pm2 restart seashore-api --max-restarts 20
```

### High Memory Usage

Check for memory leaks:

```javascript
// ecosystem.config.cjs
module.exports = {
  apps: [{
    // ... other config ...
    max_memory_restart: '500M',  // Restart if exceeds 500MB
  }],
};
```

Monitor memory:
```bash
pm2 monit
```

### Database Connection Errors

```typescript
// Add retry logic
const connectWithRetry = async () => {
  let retries = 5;
  
  while (retries > 0) {
    try {
      await pool.query('SELECT 1');
      console.log('Database connected');
      return;
    } catch (error) {
      console.error('Database connection failed, retrying...', error);
      retries--;
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
  
  throw new Error('Failed to connect to database');
};

await connectWithRetry();
```

---

## Performance Tuning

### Node.js Flags

```bash
# Increase memory limit
node --max-old-space-size=4096 dist/server.js

# Enable performance optimizations
node --max-http-header-size=16384 dist/server.js
```

### Compression

```typescript
import { compress } from 'hono/compress';

app.use('*', compress());
```

### Caching

```typescript
import { cache } from 'hono/cache';

app.get('/api/models', cache({
  cacheName: 'api-models',
  cacheControl: 'max-age=3600',  // 1 hour
}), async (c) => {
  // ... fetch models ...
});
```

---

## Next Steps

- [Set up monitoring →](./monitoring.md)
- [Configure environment variables →](./environment.md)
- [Docker deployment →](./docker.md)

## Additional Resources

- [Hono Documentation](https://hono.dev/)
- [PM2 Documentation](https://pm2.keymetrics.io/)
- [Nginx Documentation](https://nginx.org/en/docs/)
- [Let's Encrypt](https://letsencrypt.org/)
