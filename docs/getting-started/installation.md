# Installation

This guide will help you install Seashore and set up your development environment.

## Prerequisites

Before installing Seashore, ensure you have:

- **Node.js** 18+ ([Download](https://nodejs.org/))
- **pnpm** 9+ (recommended) or npm/yarn
- **TypeScript** 5.7+ (optional, but recommended)
- **PostgreSQL** 15+ (only if using `@seashore/data`)

### Installing pnpm

```bash
# Using npm
npm install -g pnpm

# Using Homebrew (macOS)
brew install pnpm

# Using Corepack (Node.js 16.13+)
corepack enable
corepack prepare pnpm@latest --activate
```

## Package Installation

Seashore is modular. Install only what you need:

### Core Agent Functionality

For basic agent capabilities with LLM and tool calling:

```bash
pnpm add @seashore/core @seashore/agent
```

This gives you:
- LLM adapters (OpenAI, Anthropic, Gemini)
- Embedding adapters
- Tool creation and management
- ReAct agents
- Workflow orchestration

### Add RAG Capabilities

For document indexing and retrieval:

```bash
pnpm add @seashore/data
```

This adds:
- PostgreSQL + pgvector integration
- Vector database operations
- RAG pipeline
- Hybrid search (semantic + BM25)

**Additional setup required:** You'll need PostgreSQL with the pgvector extension installed.

### Add Platform Features

For production features like MCP, guardrails, and deployment:

```bash
pnpm add @seashore/platform
```

This adds:
- Model Context Protocol (MCP) client
- Guardrails (custom + LLM-based)
- Evaluation framework
- Hono deployment middleware

### Add React Integration

For React frontends:

```bash
pnpm add @seashore/react
```

This adds:
- `useSeashorChat` hook
- Streaming chat support
- Thread management

## Complete Installation

To install all packages at once:

```bash
pnpm add @seashore/core @seashore/agent @seashore/data @seashore/platform @seashore/react
```

## Database Setup (Optional)

If you're using `@seashore/data`, you'll need PostgreSQL with pgvector:

### 1. Install PostgreSQL

**macOS:**
```bash
brew install postgresql@15
brew services start postgresql@15
```

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install postgresql-15 postgresql-contrib-15
sudo systemctl start postgresql
```

**Docker:**
```bash
docker run -d \
  --name seashore-postgres \
  -e POSTGRES_PASSWORD=password \
  -p 5432:5432 \
  postgres:15
```

### 2. Install pgvector Extension

**macOS:**
```bash
brew install pgvector
```

**Ubuntu/Debian:**
```bash
sudo apt install postgresql-15-pgvector
```

**From source:**
```bash
git clone https://github.com/pgvector/pgvector.git
cd pgvector
make
sudo make install
```

### 3. Enable pgvector in Your Database

```sql
CREATE DATABASE seashore;
\c seashore
CREATE EXTENSION IF NOT EXISTS vector;
```

### 4. Set Environment Variable

```bash
export DATABASE_URL="postgresql://user:password@localhost:5432/seashore"
```

## Verify Installation

Create a test file to verify everything works:

```typescript
// test.ts
import { createLLMAdapter } from '@seashore/core';
import { createReActAgent } from '@seashore/agent';

const llm = createLLMAdapter({
  provider: 'openai',
  model: 'gpt-4o',
  apiKey: process.env.OPENAI_API_KEY!,
});

console.log('✓ Seashore installed successfully!');
```

Run it:
```bash
export OPENAI_API_KEY='your-key'
tsx test.ts
```

## TypeScript Configuration

Seashore is ESM-only. Your `tsconfig.json` should include:

```json
{
  "compilerOptions": {
    "module": "ESNext",
    "moduleResolution": "bundler",
    "target": "ES2022",
    "lib": ["ES2023"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true
  }
}
```

## Environment Variables

Seashore uses environment variables for API keys and configuration:

```bash
# LLM API Keys
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_API_KEY=...

# Database (if using @seashore/data)
DATABASE_URL=postgresql://user:password@localhost:5432/seashore

# Optional: Custom endpoints
OPENAI_BASE_URL=https://api.openai.com/v1
```

Create a `.env` file in your project root and load it with:

```bash
pnpm add dotenv
```

```typescript
import 'dotenv/config';
```

## Package Manager Compatibility

While we recommend **pnpm**, Seashore works with all package managers:

**npm:**
```bash
npm install @seashore/core @seashore/agent
```

**yarn:**
```bash
yarn add @seashore/core @seashore/agent
```

**bun:**
```bash
bun add @seashore/core @seashore/agent
```

## Next Steps

- [Quick Start](./quickstart.md) - Build your first agent
- [Tutorial](./tutorial.md) - Complete walkthrough
- [Core Concepts](../core-concepts/architecture.md) - Learn the fundamentals

## Troubleshooting

**Issue: "Cannot find module" errors**

Make sure you're using ESM syntax and `.js` extensions in imports:
```typescript
// ✅ Correct
import { createTool } from '@seashore/core';

// ❌ Wrong
const { createTool } = require('@seashore/core');
```

**Issue: "Package not found"**

Clear your package manager cache and reinstall:
```bash
# pnpm
pnpm store prune
pnpm install

# npm
npm cache clean --force
npm install
```

**Issue: pgvector extension not found**

Make sure you've installed pgvector and enabled it in your database:
```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

For more help, see [Troubleshooting](../troubleshooting/common-issues.md).
