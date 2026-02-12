# Docker Deployment Guide

This guide covers containerizing your Seashore application with Docker, using multi-stage builds for optimization, docker-compose for local development, and production deployment strategies.

## Why Docker?

- **Reproducible builds** - Same environment everywhere
- **Easy CI/CD** - Build once, deploy anywhere
- **Isolation** - Dependencies don't conflict
- **Scalability** - Horizontal scaling with orchestrators
- **Version control** - Infrastructure as code

## Prerequisites

- Docker 20.10+
- Docker Compose 2.0+
- Basic understanding of containers

---

## Quick Start

### Basic Dockerfile

```dockerfile
# Dockerfile
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install pnpm and dependencies
RUN npm install -g pnpm && \
    pnpm install --frozen-lockfile

# Copy source
COPY . .

# Build TypeScript
RUN pnpm build

# Expose port
EXPOSE 3000

# Start server
CMD ["node", "dist/server.js"]
```

### Build and Run

```bash
# Build image
docker build -t seashore-api:latest .

# Run container
docker run -p 3000:3000 \
  -e OPENAI_API_KEY=sk-... \
  seashore-api:latest

# Test
curl http://localhost:3000/health
```

---

## Multi-Stage Build (Recommended)

Multi-stage builds create smaller, more secure production images.

```dockerfile
# Dockerfile
# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@9.15.4

# Copy package files
COPY package.json pnpm-lock.yaml ./
COPY pnpm-workspace.yaml ./
COPY packages ./packages

# Install dependencies
RUN pnpm install --frozen-lockfile

# Build all packages
RUN pnpm build

# Stage 2: Production dependencies
FROM node:20-alpine AS deps

WORKDIR /app

RUN npm install -g pnpm@9.15.4

COPY package.json pnpm-lock.yaml ./
COPY pnpm-workspace.yaml ./
COPY packages/*/package.json ./packages/

# Install production dependencies only
RUN pnpm install --frozen-lockfile --prod

# Stage 3: Production image
FROM node:20-alpine AS production

# Add security: non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

WORKDIR /app

# Copy built files from builder
COPY --from=builder --chown=nodejs:nodejs /app/packages/*/dist ./packages/
COPY --from=builder --chown=nodejs:nodejs /app/package.json ./

# Copy production dependencies
COPY --from=deps --chown=nodejs:nodejs /app/node_modules ./node_modules

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start server
CMD ["node", "packages/platform/dist/server.js"]
```

### Benefits of Multi-Stage Build

| Metric | Single Stage | Multi-Stage |
|--------|--------------|-------------|
| Image size | ~800MB | ~150MB |
| Build time | Same | Same |
| Security | Includes dev tools | Production only |
| Attack surface | Large | Minimal |

---

## docker-compose for Development

### Basic Setup

```yaml
# docker-compose.yml
version: '3.9'

services:
  # API server
  api:
    build:
      context: .
      dockerfile: Dockerfile
      target: builder  # Use builder stage for dev
    ports:
      - "3000:3000"
    volumes:
      - .:/app
      - /app/node_modules
    environment:
      - NODE_ENV=development
      - PORT=3000
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - DATABASE_URL=postgresql://seashore:secret@postgres:5432/seashore
      - REDIS_URL=redis://redis:6379
    depends_on:
      - postgres
      - redis
    command: pnpm dev
    restart: unless-stopped

  # PostgreSQL with pgvector
  postgres:
    image: pgvector/pgvector:pg16
    ports:
      - "5432:5432"
    environment:
      - POSTGRES_USER=seashore
      - POSTGRES_PASSWORD=secret
      - POSTGRES_DB=seashore
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./scripts/init.sql:/docker-entrypoint-initdb.d/init.sql
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U seashore"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped

  # Redis for caching/sessions
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 3s
      retries: 5
    restart: unless-stopped

volumes:
  postgres_data:
  redis_data:
```

### Usage

```bash
# Start all services
docker-compose up

# Start in background
docker-compose up -d

# View logs
docker-compose logs -f api

# Stop all services
docker-compose down

# Stop and remove volumes (deletes data!)
docker-compose down -v

# Rebuild after code changes
docker-compose up --build
```

---

## Production docker-compose

```yaml
# docker-compose.prod.yml
version: '3.9'

services:
  # Nginx reverse proxy
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/conf.d:/etc/nginx/conf.d:ro
      - ./certbot/conf:/etc/letsencrypt:ro
      - ./certbot/www:/var/www/certbot:ro
    depends_on:
      - api
    restart: unless-stopped

  # API server (multiple instances)
  api:
    build:
      context: .
      dockerfile: Dockerfile
      target: production
    expose:
      - "3000"
    environment:
      - NODE_ENV=production
      - PORT=3000
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - DATABASE_URL=${DATABASE_URL}
      - REDIS_URL=redis://redis:6379
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    deploy:
      replicas: 3
      restart_policy:
        condition: on-failure
        delay: 5s
        max_attempts: 3
      resources:
        limits:
          cpus: '1'
          memory: 1G
        reservations:
          cpus: '0.5'
          memory: 512M
    restart: unless-stopped

  postgres:
    image: pgvector/pgvector:pg16
    expose:
      - "5432"
    environment:
      - POSTGRES_USER=${DB_USER}
      - POSTGRES_PASSWORD=${DB_PASSWORD}
      - POSTGRES_DB=${DB_NAME}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./backups:/backups
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USER}"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    expose:
      - "6379"
    command: redis-server --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 3s
      retries: 5
    restart: unless-stopped

  # Database backups
  backup:
    image: postgres:16-alpine
    environment:
      - PGHOST=postgres
      - PGUSER=${DB_USER}
      - PGPASSWORD=${DB_PASSWORD}
      - PGDATABASE=${DB_NAME}
    volumes:
      - ./backups:/backups
    command: >
      sh -c "
      while true; do
        pg_dump -Fc > /backups/backup_$$(date +%Y%m%d_%H%M%S).dump
        find /backups -name '*.dump' -mtime +7 -delete
        sleep 86400
      done
      "
    depends_on:
      - postgres
    restart: unless-stopped

volumes:
  postgres_data:
  redis_data:
```

### Nginx Configuration

```nginx
# nginx/conf.d/seashore.conf
upstream api_backend {
    least_conn;
    server api:3000 max_fails=3 fail_timeout=30s;
}

server {
    listen 80;
    server_name api.example.com;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 301 https://$server_name$request_uri;
    }
}

server {
    listen 443 ssl http2;
    server_name api.example.com;

    ssl_certificate /etc/letsencrypt/live/api.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.example.com/privkey.pem;

    location / {
        proxy_pass http://api_backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
        
        # Streaming support
        proxy_buffering off;
    }
}
```

### Deploy Production

```bash
# Create .env file
cat > .env <<EOF
OPENAI_API_KEY=sk-...
DATABASE_URL=postgresql://seashore:secret@postgres:5432/seashore
DB_USER=seashore
DB_PASSWORD=secret
DB_NAME=seashore
REDIS_PASSWORD=secret
EOF

# Start production stack
docker-compose -f docker-compose.prod.yml up -d

# Scale API instances
docker-compose -f docker-compose.prod.yml up -d --scale api=5

# View logs
docker-compose -f docker-compose.prod.yml logs -f api
```

---

## .dockerignore

Reduce build context size and speed up builds:

```
# .dockerignore
node_modules
dist
.git
.github
.env*
!.env.example
*.md
!README.md
.vscode
.idea
coverage
*.log
.DS_Store
docs
examples
scripts
*.test.ts
*.spec.ts
```

---

## Container Registry

### Docker Hub

```bash
# Login
docker login

# Tag image
docker tag seashore-api:latest username/seashore-api:latest
docker tag seashore-api:latest username/seashore-api:v1.0.0

# Push
docker push username/seashore-api:latest
docker push username/seashore-api:v1.0.0

# Pull on server
docker pull username/seashore-api:latest
```

### GitHub Container Registry (GHCR)

```bash
# Login
echo $GITHUB_TOKEN | docker login ghcr.io -u USERNAME --password-stdin

# Tag
docker tag seashore-api:latest ghcr.io/username/seashore-api:latest

# Push
docker push ghcr.io/username/seashore-api:latest
```

### AWS ECR

```bash
# Login
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin 123456789.dkr.ecr.us-east-1.amazonaws.com

# Tag
docker tag seashore-api:latest 123456789.dkr.ecr.us-east-1.amazonaws.com/seashore-api:latest

# Push
docker push 123456789.dkr.ecr.us-east-1.amazonaws.com/seashore-api:latest
```

---

## CI/CD with GitHub Actions

```yaml
# .github/workflows/docker-publish.yml
name: Docker Build and Push

on:
  push:
    branches: [main]
    tags: ['v*']
  pull_request:
    branches: [main]

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  build:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Log in to Container Registry
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Extract metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}
          tags: |
            type=ref,event=branch
            type=ref,event=pr
            type=semver,pattern={{version}}
            type=semver,pattern={{major}}.{{minor}}
            type=sha

      - name: Build and push
        uses: docker/build-push-action@v5
        with:
          context: .
          push: ${{ github.event_name != 'pull_request' }}
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
          target: production
```

---

## Kubernetes Deployment

### Deployment Manifest

```yaml
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: seashore-api
  labels:
    app: seashore-api
spec:
  replicas: 3
  selector:
    matchLabels:
      app: seashore-api
  template:
    metadata:
      labels:
        app: seashore-api
    spec:
      containers:
      - name: api
        image: ghcr.io/username/seashore-api:latest
        ports:
        - containerPort: 3000
          name: http
        env:
        - name: NODE_ENV
          value: "production"
        - name: PORT
          value: "3000"
        - name: OPENAI_API_KEY
          valueFrom:
            secretKeyRef:
              name: seashore-secrets
              key: openai-api-key
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: seashore-secrets
              key: database-url
        resources:
          requests:
            memory: "512Mi"
            cpu: "500m"
          limits:
            memory: "1Gi"
            cpu: "1000m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
          timeoutSeconds: 5
          failureThreshold: 3
        readinessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
          timeoutSeconds: 3
          failureThreshold: 3
---
apiVersion: v1
kind: Service
metadata:
  name: seashore-api
spec:
  selector:
    app: seashore-api
  ports:
  - protocol: TCP
    port: 80
    targetPort: 3000
  type: LoadBalancer
---
apiVersion: v1
kind: Secret
metadata:
  name: seashore-secrets
type: Opaque
stringData:
  openai-api-key: "sk-..."
  database-url: "postgresql://..."
```

### Deploy to Kubernetes

```bash
# Apply manifests
kubectl apply -f k8s/deployment.yaml

# Check status
kubectl get pods
kubectl get services

# View logs
kubectl logs -f deployment/seashore-api

# Scale
kubectl scale deployment/seashore-api --replicas=5

# Rolling update
kubectl set image deployment/seashore-api api=ghcr.io/username/seashore-api:v1.1.0

# Rollback
kubectl rollout undo deployment/seashore-api
```

---

## AWS ECS Deployment

### Task Definition

```json
{
  "family": "seashore-api",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "512",
  "memory": "1024",
  "containerDefinitions": [
    {
      "name": "api",
      "image": "123456789.dkr.ecr.us-east-1.amazonaws.com/seashore-api:latest",
      "portMappings": [
        {
          "containerPort": 3000,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {
          "name": "NODE_ENV",
          "value": "production"
        },
        {
          "name": "PORT",
          "value": "3000"
        }
      ],
      "secrets": [
        {
          "name": "OPENAI_API_KEY",
          "valueFrom": "arn:aws:secretsmanager:us-east-1:123456789:secret:openai-key"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/seashore-api",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "ecs"
        }
      },
      "healthCheck": {
        "command": ["CMD-SHELL", "curl -f http://localhost:3000/health || exit 1"],
        "interval": 30,
        "timeout": 5,
        "retries": 3,
        "startPeriod": 60
      }
    }
  ]
}
```

### Deploy to ECS

```bash
# Register task definition
aws ecs register-task-definition --cli-input-json file://task-definition.json

# Create or update service
aws ecs create-service \
  --cluster seashore-cluster \
  --service-name seashore-api \
  --task-definition seashore-api \
  --desired-count 3 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[subnet-xxx],securityGroups=[sg-xxx],assignPublicIp=ENABLED}"
```

---

## Optimization Tips

### 1. Layer Caching

Put frequently changing files last:

```dockerfile
# ✅ GOOD: Dependencies cached separately
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

# ❌ BAD: Reinstalls on any file change
COPY . .
RUN pnpm install && pnpm build
```

### 2. Smaller Base Images

```dockerfile
# 🐘 node:20 = ~1GB
# 🪶 node:20-slim = ~250MB
# 🦋 node:20-alpine = ~120MB

FROM node:20-alpine  # Use Alpine
```

### 3. Remove Dev Dependencies

```bash
pnpm install --prod  # Production only
```

### 4. Use BuildKit

```bash
# Enable BuildKit
export DOCKER_BUILDKIT=1
docker build .

# Or in docker-compose
COMPOSE_DOCKER_CLI_BUILD=1 DOCKER_BUILDKIT=1 docker-compose build
```

### 5. Multi-Platform Builds

```bash
# Build for multiple architectures
docker buildx build --platform linux/amd64,linux/arm64 -t seashore-api .
```

---

## Troubleshooting

### Container Exits Immediately

```bash
# Check logs
docker logs <container_id>

# Run interactively
docker run -it seashore-api sh

# Override entrypoint
docker run -it --entrypoint sh seashore-api
```

### Port Not Accessible

```bash
# Check port mapping
docker ps

# Verify container is listening
docker exec <container_id> netstat -tuln

# Check firewall
sudo ufw status
```

### Out of Memory

```bash
# Check container stats
docker stats

# Set memory limit
docker run -m 1g seashore-api
```

### Database Connection Refused

```yaml
# Use service name, not localhost
DATABASE_URL: postgresql://user:pass@postgres:5432/db
#                                      ^^^^^^^^
#                                    Service name
```

---

## Next Steps

- [Environment variables →](./environment.md)
- [Monitoring →](./monitoring.md)
- [AWS Lambda deployment →](./aws-lambda.md)

## Additional Resources

- [Docker Best Practices](https://docs.docker.com/develop/dev-best-practices/)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [Kubernetes Documentation](https://kubernetes.io/docs/)
