# 模型上下文协议(MCP)

集成模型上下文协议服务器,通过标准化的工具、资源和提示来扩展智能体能力。

## 概述

模型上下文协议(MCP)是一个用于连接 AI 系统与外部数据源和工具的开放标准。Seashore 通过 `@seashore/platform` 提供一流的 MCP 支持。

**你将学到:**
- MCP 架构和概念
- 连接 MCP 服务器
- 在智能体中使用 MCP 工具
- 构建自定义 MCP 服务器
- 安全和认证
- 生产部署

---

## MCP 架构

### 组件

```
┌──────────────┐         ┌──────────────┐
│  MCP 客户端  │◄───────►│  MCP 服务器  │
│  (Seashore)  │         │              │
└──────────────┘         └──────┬───────┘
                                │
                    ┌───────────┼───────────┐
                    │           │           │
                    ▼           ▼           ▼
              ┌─────────┐ ┌─────────┐ ┌─────────┐
              │  工具   │ │  资源   │ │  提示   │
              └─────────┘ └─────────┘ └─────────┘
```

**MCP 提供:**
- **工具**: 智能体可以调用的函数
- **资源**: 智能体可以读取的数据源
- **提示**: 可重用的提示模板

---

## 连接 MCP 服务器

### 基本连接

```typescript
import { createMCPClient } from '@seashore/platform'

const mcpClient = await createMCPClient({
  command: 'node',
  args: ['path/to/mcp-server.js'],
  env: {
    API_KEY: process.env.EXTERNAL_API_KEY,
  },
})

// 列出可用工具
const tools = await mcpClient.listTools()
console.log('Available tools:', tools.map(t => t.name))

// 列出可用资源
const resources = await mcpClient.listResources()
console.log('Available resources:', resources.map(r => r.uri))
```

### 多个 MCP 服务器

```typescript
// 文件系统服务器
const fileServer = await createMCPClient({
  command: 'npx',
  args: ['-y', '@modelcontextprotocol/server-filesystem', '/path/to/files'],
})

// GitHub 服务器
const githubServer = await createMCPClient({
  command: 'npx',
  args: ['-y', '@modelcontextprotocol/server-github'],
  env: {
    GITHUB_TOKEN: process.env.GITHUB_TOKEN,
  },
})

// 数据库服务器
const dbServer = await createMCPClient({
  command: 'node',
  args: ['./mcp-servers/database-server.js'],
  env: {
    DATABASE_URL: process.env.DATABASE_URL,
  },
})

// 合并所有服务器的工具
const allTools = [
  ...(await fileServer.listTools()),
  ...(await githubServer.listTools()),
  ...(await dbServer.listTools()),
]
```

### 与智能体一起使用

```typescript
import { createReActAgent } from '@seashore/agent'
import { createLLMAdapter } from '@seashore/core'

const llm = createLLMAdapter({
  provider: 'openai',
  apiKey: process.env.OPENAI_API_KEY!,
})

// 获取 MCP 工具
const mcpTools = await mcpClient.getTools()

// 使用 MCP 工具创建智能体
const agent = createReActAgent({
  model: () => llm('gpt-4o'),
  systemPrompt: `You are a helpful assistant with access to:
  - File system operations
  - GitHub repository access
  - Database queries
  
  Use these tools to help users accomplish tasks.`,
  tools: mcpTools, // MCP 工具无缝工作
  maxIterations: 10,
})

// 使用智能体
const response = await agent.run([
  { role: 'user', content: 'Read the README.md file and create a GitHub issue summarizing it' }
])
```

---

## MCP 工具

### 调用 MCP 工具

```typescript
// 直接工具调用
const result = await mcpClient.callTool({
  name: 'read_file',
  arguments: {
    path: '/path/to/file.txt',
  },
})

console.log(result.content)
```

### 工具发现

```typescript
// 列出所有工具
const tools = await mcpClient.listTools()

tools.forEach(tool => {
  console.log(`Tool: ${tool.name}`)
  console.log(`Description: ${tool.description}`)
  console.log(`Parameters:`, tool.inputSchema)
  console.log('---')
})

// 示例输出:
// Tool: read_file
// Description: Read contents of a file
// Parameters: { type: 'object', properties: { path: { type: 'string' } } }
```

### 过滤工具

```typescript
// 仅使用特定工具
const selectedTools = (await mcpClient.getTools()).filter(tool =>
  ['read_file', 'write_file', 'list_directory'].includes(tool.name)
)

const agent = createReActAgent({
  model: () => llm('gpt-4o'),
  systemPrompt: 'You can read and write files',
  tools: selectedTools,
})
```

---

## MCP 资源

### 读取资源

```typescript
// 列出可用资源
const resources = await mcpClient.listResources()

// 读取特定资源
const content = await mcpClient.readResource({
  uri: 'file:///path/to/document.txt',
})

console.log(content)
```

### 资源模板

```typescript
// 资源可以有 URI 模板
const templates = resources.filter(r => r.uriTemplate)

templates.forEach(template => {
  console.log(`Template: ${template.uriTemplate}`)
  console.log(`Example: ${template.example}`)
})

// 示例:
// Template: github:///{owner}/{repo}/issues/{issue_number}
// Example: github:///octocat/Hello-World/issues/1

// 使用模板
const issue = await mcpClient.readResource({
  uri: 'github:///myorg/myrepo/issues/42',
})
```

### 在上下文中使用资源

```typescript
// 获取资源内容
const docs = await mcpClient.readResource({
  uri: 'file:///docs/api.md',
})

// 在智能体系统提示中使用
const agent = createReActAgent({
  model: () => llm('gpt-4o'),
  systemPrompt: `You are an API support agent.

Here is the API documentation:
${docs.content}

Use this documentation to answer user questions accurately.`,
  tools: [],
})
```

---

## MCP 提示

### 列出提示

```typescript
// 获取可用提示
const prompts = await mcpClient.listPrompts()

prompts.forEach(prompt => {
  console.log(`Prompt: ${prompt.name}`)
  console.log(`Description: ${prompt.description}`)
  console.log(`Arguments:`, prompt.arguments)
})
```

### 使用提示

```typescript
// 使用参数获取提示
const prompt = await mcpClient.getPrompt({
  name: 'code_review',
  arguments: {
    language: 'typescript',
    style: 'comprehensive',
  },
})

// 在智能体中使用提示
const agent = createReActAgent({
  model: () => llm('gpt-4o'),
  systemPrompt: prompt.messages[0].content,
  tools: [],
})
```

---

## 构建 MCP 服务器

### 服务器结构

```typescript
// mcp-server.ts
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'

// 创建服务器
const server = new Server(
  {
    name: 'my-mcp-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
)

// 定义工具
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'get_user',
        description: 'Fetch user information by ID',
        inputSchema: {
          type: 'object',
          properties: {
            userId: {
              type: 'string',
              description: 'User ID',
            },
          },
          required: ['userId'],
        },
      },
      {
        name: 'list_users',
        description: 'List all users',
        inputSchema: {
          type: 'object',
          properties: {
            limit: {
              type: 'number',
              description: 'Maximum number of users to return',
              default: 10,
            },
          },
        },
      },
    ],
  }
})

// 处理工具调用
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params

  switch (name) {
    case 'get_user': {
      const user = await db.user.findUnique({
        where: { id: args.userId },
      })
      
      if (!user) {
        return {
          content: [
            {
              type: 'text',
              text: `User ${args.userId} not found`,
            },
          ],
        }
      }
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(user, null, 2),
          },
        ],
      }
    }

    case 'list_users': {
      const users = await db.user.findMany({
        take: args.limit || 10,
      })
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(users, null, 2),
          },
        ],
      }
    }

    default:
      throw new Error(`Unknown tool: ${name}`)
  }
})

// 启动服务器
async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error('MCP Server running on stdio')
}

main().catch(console.error)
```

### 添加资源

```typescript
import { ListResourcesRequestSchema, ReadResourceRequestSchema } from '@modelcontextprotocol/sdk/types.js'

// 列出资源
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  return {
    resources: [
      {
        uri: 'db://users',
        name: 'Users Database',
        description: 'All user records',
        mimeType: 'application/json',
      },
      {
        uri: 'db://products',
        name: 'Products Database',
        description: 'All product records',
        mimeType: 'application/json',
      },
    ],
  }
})

// 读取资源
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const { uri } = request.params

  if (uri === 'db://users') {
    const users = await db.user.findMany()
    return {
      contents: [
        {
          uri,
          mimeType: 'application/json',
          text: JSON.stringify(users, null, 2),
        },
      ],
    }
  }

  if (uri === 'db://products') {
    const products = await db.product.findMany()
    return {
      contents: [
        {
          uri,
          mimeType: 'application/json',
          text: JSON.stringify(products, null, 2),
        },
      ],
    }
  }

  throw new Error(`Unknown resource: ${uri}`)
})
```

### 添加提示

```typescript
import { ListPromptsRequestSchema, GetPromptRequestSchema } from '@modelcontextprotocol/sdk/types.js'

// 列出提示
server.setRequestHandler(ListPromptsRequestSchema, async () => {
  return {
    prompts: [
      {
        name: 'analyze_data',
        description: 'Analyze data and provide insights',
        arguments: [
          {
            name: 'dataType',
            description: 'Type of data to analyze',
            required: true,
          },
        ],
      },
    ],
  }
})

// 获取提示
server.setRequestHandler(GetPromptRequestSchema, async (request) => {
  const { name, arguments: args } = request.params

  if (name === 'analyze_data') {
    return {
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `Analyze the following ${args?.dataType} data and provide insights:\n\n` +
                  `1. Identify key patterns\n` +
                  `2. Note any anomalies\n` +
                  `3. Suggest actionable recommendations`,
          },
        },
      ],
    }
  }

  throw new Error(`Unknown prompt: ${name}`)
})
```

---

## 认证

### API 密钥认证

```typescript
// 带 API 密钥的服务器
const server = await createMCPClient({
  command: 'node',
  args: ['./mcp-server.js'],
  env: {
    API_KEY: process.env.SERVICE_API_KEY,
  },
})

// 服务器验证 API 密钥
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const apiKey = process.env.API_KEY
  
  if (!apiKey || apiKey !== 'expected-key') {
    throw new Error('Unauthorized')
  }
  
  // 处理请求
  return handleToolCall(request)
})
```

### OAuth 集成

```typescript
// 带 OAuth 的 MCP 服务器
const server = await createMCPClient({
  command: 'node',
  args: ['./oauth-mcp-server.js'],
  env: {
    OAUTH_CLIENT_ID: process.env.OAUTH_CLIENT_ID,
    OAUTH_CLIENT_SECRET: process.env.OAUTH_CLIENT_SECRET,
    OAUTH_REFRESH_TOKEN: process.env.OAUTH_REFRESH_TOKEN,
  },
})

// 服务器实现
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  // 刷新访问令牌
  const accessToken = await refreshAccessToken({
    clientId: process.env.OAUTH_CLIENT_ID!,
    clientSecret: process.env.OAUTH_CLIENT_SECRET!,
    refreshToken: process.env.OAUTH_REFRESH_TOKEN!,
  })
  
  // 在 API 调用中使用访问令牌
  const response = await fetch('https://api.example.com/data', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })
  
  return { content: await response.json() }
})
```

---

## 生产模式

### 连接池

```typescript
class MCPConnectionPool {
  private clients: Map<string, MCPClient> = new Map()
  
  async getClient(config: MCPConfig): Promise<MCPClient> {
    const key = JSON.stringify(config)
    
    if (!this.clients.has(key)) {
      const client = await createMCPClient(config)
      this.clients.set(key, client)
    }
    
    return this.clients.get(key)!
  }
  
  async closeAll() {
    for (const client of this.clients.values()) {
      await client.close()
    }
    this.clients.clear()
  }
}

const pool = new MCPConnectionPool()

// 重用连接
const client1 = await pool.getClient({ command: 'node', args: ['server.js'] })
const client2 = await pool.getClient({ command: 'node', args: ['server.js'] }) // 同一实例
```

### 健康检查

```typescript
async function healthCheckMCP(client: MCPClient): Promise<boolean> {
  try {
    // 尝试列出工具作为健康检查
    await client.listTools()
    return true
  } catch (error) {
    console.error('MCP health check failed:', error)
    return false
  }
}

// 监控健康状态
setInterval(async () => {
  const healthy = await healthCheckMCP(mcpClient)
  
  if (!healthy) {
    console.error('MCP server unhealthy, reconnecting...')
    mcpClient = await createMCPClient(mcpConfig)
  }
}, 30000) // 每 30 秒检查一次
```

### 错误处理

```typescript
async function robustMCPCall(
  client: MCPClient,
  toolName: string,
  args: any
): Promise<any> {
  const maxRetries = 3
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await client.callTool({ name: toolName, arguments: args })
    } catch (error) {
      if (attempt === maxRetries - 1) throw error
      
      console.warn(`MCP call failed (attempt ${attempt + 1}), retrying...`)
      await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)))
    }
  }
}
```

---

## 示例: GitHub MCP 服务器

```typescript
// 连接到 GitHub MCP 服务器
const githubServer = await createMCPClient({
  command: 'npx',
  args: ['-y', '@modelcontextprotocol/server-github'],
  env: {
    GITHUB_TOKEN: process.env.GITHUB_TOKEN,
  },
})

// 使用 GitHub 工具创建智能体
const githubAgent = createReActAgent({
  model: () => llm('gpt-4o'),
  systemPrompt: `You are a GitHub assistant that can:
  - Search repositories
  - Read files from repositories
  - Create issues
  - List pull requests
  - Get issue details
  
  Use these tools to help users with GitHub-related tasks.`,
  tools: await githubServer.getTools(),
  maxIterations: 10,
})

// 使用智能体
const response = await githubAgent.run([
  {
    role: 'user',
    content: 'Find the most popular TypeScript web frameworks on GitHub',
  },
])

console.log(response.result.content)
```

---

## 示例: 自定义数据库 MCP 服务器

```typescript
// database-mcp-server.ts
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()
const server = new Server(
  { name: 'database-server', version: '1.0.0' },
  { capabilities: { tools: {} } }
)

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'query_users',
      description: 'Query users with filters',
      inputSchema: {
        type: 'object',
        properties: {
          email: { type: 'string' },
          role: { type: 'string', enum: ['user', 'admin'] },
          limit: { type: 'number', default: 10 },
        },
      },
    },
    {
      name: 'create_user',
      description: 'Create a new user',
      inputSchema: {
        type: 'object',
        properties: {
          email: { type: 'string' },
          name: { type: 'string' },
          role: { type: 'string', enum: ['user', 'admin'], default: 'user' },
        },
        required: ['email', 'name'],
      },
    },
  ],
}))

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params

  switch (name) {
    case 'query_users': {
      const users = await db.user.findMany({
        where: {
          email: args.email,
          role: args.role,
        },
        take: args.limit || 10,
      })
      
      return {
        content: [{ type: 'text', text: JSON.stringify(users, null, 2) }],
      }
    }

    case 'create_user': {
      const user = await db.user.create({
        data: {
          email: args.email,
          name: args.name,
          role: args.role || 'user',
        },
      })
      
      return {
        content: [{ type: 'text', text: `User created: ${user.id}` }],
      }
    }

    default:
      throw new Error(`Unknown tool: ${name}`)
  }
})

// 启动
const transport = new StdioServerTransport()
await server.connect(transport)
```

---

## 最佳实践

### 安全
- [ ] 验证所有 MCP 工具输入
- [ ] 对密钥使用环境变量
- [ ] 实施速率限制
- [ ] 审计工具调用
- [ ] 限制文件系统访问

### 性能
- [ ] 重用 MCP 客户端连接
- [ ] 缓存工具/资源列表
- [ ] 使用异步操作
- [ ] 实施超时
- [ ] 监控延迟

### 可靠性
- [ ] 健康检查 MCP 服务器
- [ ] 重试瞬时故障
- [ ] 处理服务器重启
- [ ] 带上下文记录错误
- [ ] 验证响应

### 开发
- [ ] 清楚地记录工具参数
- [ ] 提供有意义的错误消息
- [ ] 彻底测试工具
- [ ] 版本化 MCP 服务器
- [ ] 遵循 MCP 规范

---

## 故障排除

### 服务器未启动

```typescript
// 检查服务器日志
const client = await createMCPClient({
  command: 'node',
  args: ['server.js'],
  env: { DEBUG: '1' },
})

// 服务器应该记录到 stderr
```

### 工具调用失败

```typescript
// 验证工具存在
const tools = await client.listTools()
console.log('Available tools:', tools.map(t => t.name))

// 检查工具模式
const tool = tools.find(t => t.name === 'my_tool')
console.log('Tool schema:', JSON.stringify(tool.inputSchema, null, 2))

// 验证参数与模式匹配
```

### 连接问题

```typescript
// 测试基本连接性
try {
  await client.listTools()
  console.log('Connection OK')
} catch (error) {
  console.error('Connection failed:', error)
  
  // 尝试重新创建客户端
  client = await createMCPClient(config)
}
```

---

## 下一步

- **[构建智能体](./building-agents.md)** - 在智能体中使用 MCP 工具
- **[工具开发](./tool-development.md)** - 与原生工具比较
- **[性能](./performance.md)** - 优化 MCP 集成

---

## 其他资源

- **[MCP 规范](https://modelcontextprotocol.io/specification)** - 官方规范
- **[MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)** - SDK 文档
- **[API 参考](/docs/api/platform.md#mcp)** - Seashore MCP API
- **[示例](https://github.com/modelcontextprotocol/servers)** - 官方 MCP 服务器
