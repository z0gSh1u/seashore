# 安装

本指南将帮助你安装 Seashore 并设置开发环境。

## 前置要求

在安装 Seashore 之前，请确保你已安装：

- **Node.js** 18+ ([下载](https://nodejs.org/))
- **pnpm** 9+（推荐）或 npm/yarn
- **TypeScript** 5.7+（可选，但推荐）
- **PostgreSQL** 15+（仅在使用 `@seashore/data` 时需要）

### 安装 pnpm

```bash
# 使用 npm
npm install -g pnpm

# 使用 Homebrew (macOS)
brew install pnpm

# 使用 Corepack (Node.js 16.13+)
corepack enable
corepack prepare pnpm@latest --activate
```

## 包安装

Seashore 采用模块化设计。仅安装你需要的部分：

### 核心智能体功能

用于基本的智能体能力，包括 LLM 和工具调用：

```bash
pnpm add @seashore/core @seashore/agent
```

这将为你提供：
- LLM 适配器（OpenAI、Anthropic、Gemini）
- 嵌入适配器
- 工具创建和管理
- ReAct 智能体
- 工作流编排

### 添加 RAG 能力

用于文档索引和检索：

```bash
pnpm add @seashore/data
```

这将添加：
- PostgreSQL + pgvector 集成
- 向量数据库操作
- RAG 管道
- 混合搜索（语义 + BM25）

**需要额外设置：** 你需要安装带有 pgvector 扩展的 PostgreSQL。

### 添加平台功能

用于生产环境功能，如 MCP、防护栏和部署：

```bash
pnpm add @seashore/platform
```

这将添加：
- Model Context Protocol (MCP) 客户端
- 防护栏（自定义 + 基于 LLM）
- 评估框架
- Hono 部署中间件

### 添加 React 集成

用于 React 前端：

```bash
pnpm add @seashore/react
```

这将添加：
- `useSeashorChat` hook
- 流式聊天支持
- 会话管理

## 完整安装

一次性安装所有包：

```bash
pnpm add @seashore/core @seashore/agent @seashore/data @seashore/platform @seashore/react
```

## 数据库设置（可选）

如果你使用 `@seashore/data`，你需要安装带有 pgvector 的 PostgreSQL：

### 1. 安装 PostgreSQL

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

### 2. 安装 pgvector 扩展

**macOS:**
```bash
brew install pgvector
```

**Ubuntu/Debian:**
```bash
sudo apt install postgresql-15-pgvector
```

**从源代码安装:**
```bash
git clone https://github.com/pgvector/pgvector.git
cd pgvector
make
sudo make install
```

### 3. 在数据库中启用 pgvector

```sql
CREATE DATABASE seashore;
\c seashore
CREATE EXTENSION IF NOT EXISTS vector;
```

### 4. 设置环境变量

```bash
export DATABASE_URL="postgresql://user:password@localhost:5432/seashore"
```

## 验证安装

创建一个测试文件来验证一切正常：

```typescript
// test.ts
import { createLLMAdapter } from '@seashore/core';
import { createReActAgent } from '@seashore/agent';

const llm = createLLMAdapter({
  provider: 'openai',
  model: 'gpt-4o',
  apiKey: process.env.OPENAI_API_KEY!,
});

console.log('✓ Seashore 安装成功！');
```

运行它：
```bash
export OPENAI_API_KEY='your-key'
tsx test.ts
```

## TypeScript 配置

Seashore 仅支持 ESM。你的 `tsconfig.json` 应该包含：

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

## 环境变量

Seashore 使用环境变量来配置 API 密钥和其他设置：

```bash
# LLM API 密钥
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_API_KEY=...

# 数据库（如果使用 @seashore/data）
DATABASE_URL=postgresql://user:password@localhost:5432/seashore

# 可选：自定义端点
OPENAI_BASE_URL=https://api.openai.com/v1
```

在项目根目录创建 `.env` 文件并使用以下方式加载：

```bash
pnpm add dotenv
```

```typescript
import 'dotenv/config';
```

## 包管理器兼容性

虽然我们推荐使用 **pnpm**，但 Seashore 支持所有包管理器：

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

## 下一步

- [快速开始](./quickstart.md) - 构建你的第一个智能体
- [教程](./tutorial.md) - 完整的演练指南
- [核心概念](../core-concepts/architecture.md) - 学习基础知识

## 故障排除

**问题："Cannot find module" 错误**

确保你使用 ESM 语法并在导入中使用 `.js` 扩展名：
```typescript
// ✅ 正确
import { createTool } from '@seashore/core';

// ❌ 错误
const { createTool } = require('@seashore/core');
```

**问题："Package not found"**

清除包管理器缓存并重新安装：
```bash
# pnpm
pnpm store prune
pnpm install

# npm
npm cache clean --force
npm install
```

**问题：找不到 pgvector 扩展**

确保你已安装 pgvector 并在数据库中启用它：
```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

如需更多帮助，请参见[故障排除](../troubleshooting/common-issues.md)。
