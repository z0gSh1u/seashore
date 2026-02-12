# Model Context Protocol (MCP)

Integrate Model Context Protocol servers to extend agent capabilities with standardized tools, resources, and prompts.

## Overview

Model Context Protocol (MCP) is an open standard for connecting AI systems with external data sources and tools. Seashore provides first-class MCP support through `@seashore/platform`.

**What you'll learn:**
- MCP architecture and concepts
- Connecting to MCP servers
- Using MCP tools in agents
- Building custom MCP servers
- Security and authentication
- Production deployment

---

## MCP Architecture

### Components

```
┌──────────────┐         ┌──────────────┐
│  MCP Client  │◄───────►│  MCP Server  │
│  (Seashore)  │         │              │
└──────────────┘         └──────┬───────┘
                                │
                    ┌───────────┼───────────┐
                    │           │           │
                    ▼           ▼           ▼
              ┌─────────┐ ┌─────────┐ ┌─────────┐
              │  Tools  │ │Resources│ │ Prompts │
              └─────────┘ └─────────┘ └─────────┘
```

**MCP Provides:**
- **Tools**: Functions agents can call
- **Resources**: Data sources agents can read
- **Prompts**: Reusable prompt templates

---

## Connecting MCP Servers

### Basic Connection

```typescript
import { createMCPClient } from '@seashore/platform'

const mcpClient = await createMCPClient({
  command: 'node',
  args: ['path/to/mcp-server.js'],
  env: {
    API_KEY: process.env.EXTERNAL_API_KEY,
  },
})

// List available tools
const tools = await mcpClient.listTools()
console.log('Available tools:', tools.map(t => t.name))

// List available resources
const resources = await mcpClient.listResources()
console.log('Available resources:', resources.map(r => r.uri))
```

### Multiple MCP Servers

```typescript
// File system server
const fileServer = await createMCPClient({
  command: 'npx',
  args: ['-y', '@modelcontextprotocol/server-filesystem', '/path/to/files'],
})

// GitHub server
const githubServer = await createMCPClient({
  command: 'npx',
  args: ['-y', '@modelcontextprotocol/server-github'],
  env: {
    GITHUB_TOKEN: process.env.GITHUB_TOKEN,
  },
})

// Database server
const dbServer = await createMCPClient({
  command: 'node',
  args: ['./mcp-servers/database-server.js'],
  env: {
    DATABASE_URL: process.env.DATABASE_URL,
  },
})

// Combine tools from all servers
const allTools = [
  ...(await fileServer.listTools()),
  ...(await githubServer.listTools()),
  ...(await dbServer.listTools()),
]
```

### Using with Agents

```typescript
import { createReActAgent } from '@seashore/agent'
import { createLLMAdapter } from '@seashore/core'

const llm = createLLMAdapter({
  provider: 'openai',
  apiKey: process.env.OPENAI_API_KEY!,
})

// Get MCP tools
const mcpTools = await mcpClient.getTools()

// Create agent with MCP tools
const agent = createReActAgent({
  model: () => llm('gpt-4o'),
  systemPrompt: `You are a helpful assistant with access to:
  - File system operations
  - GitHub repository access
  - Database queries
  
  Use these tools to help users accomplish tasks.`,
  tools: mcpTools, // MCP tools work seamlessly
  maxIterations: 10,
})

// Use agent
const response = await agent.run([
  { role: 'user', content: 'Read the README.md file and create a GitHub issue summarizing it' }
])
```

---

## MCP Tools

### Calling MCP Tools

```typescript
// Direct tool call
const result = await mcpClient.callTool({
  name: 'read_file',
  arguments: {
    path: '/path/to/file.txt',
  },
})

console.log(result.content)
```

### Tool Discovery

```typescript
// List all tools
const tools = await mcpClient.listTools()

tools.forEach(tool => {
  console.log(`Tool: ${tool.name}`)
  console.log(`Description: ${tool.description}`)
  console.log(`Parameters:`, tool.inputSchema)
  console.log('---')
})

// Example output:
// Tool: read_file
// Description: Read contents of a file
// Parameters: { type: 'object', properties: { path: { type: 'string' } } }
```

### Filtering Tools

```typescript
// Only use specific tools
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

## MCP Resources

### Reading Resources

```typescript
// List available resources
const resources = await mcpClient.listResources()

// Read a specific resource
const content = await mcpClient.readResource({
  uri: 'file:///path/to/document.txt',
})

console.log(content)
```

### Resource Templates

```typescript
// Resources can have URI templates
const templates = resources.filter(r => r.uriTemplate)

templates.forEach(template => {
  console.log(`Template: ${template.uriTemplate}`)
  console.log(`Example: ${template.example}`)
})

// Example:
// Template: github:///{owner}/{repo}/issues/{issue_number}
// Example: github:///octocat/Hello-World/issues/1

// Use template
const issue = await mcpClient.readResource({
  uri: 'github:///myorg/myrepo/issues/42',
})
```

### Using Resources in Context

```typescript
// Fetch resource content
const docs = await mcpClient.readResource({
  uri: 'file:///docs/api.md',
})

// Use in agent system prompt
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

## MCP Prompts

### Listing Prompts

```typescript
// Get available prompts
const prompts = await mcpClient.listPrompts()

prompts.forEach(prompt => {
  console.log(`Prompt: ${prompt.name}`)
  console.log(`Description: ${prompt.description}`)
  console.log(`Arguments:`, prompt.arguments)
})
```

### Using Prompts

```typescript
// Get a prompt with arguments
const prompt = await mcpClient.getPrompt({
  name: 'code_review',
  arguments: {
    language: 'typescript',
    style: 'comprehensive',
  },
})

// Use prompt in agent
const agent = createReActAgent({
  model: () => llm('gpt-4o'),
  systemPrompt: prompt.messages[0].content,
  tools: [],
})
```

---

## Building MCP Servers

### Server Structure

```typescript
// mcp-server.ts
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'

// Create server
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

// Define tools
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

// Handle tool calls
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

// Start server
async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error('MCP Server running on stdio')
}

main().catch(console.error)
```

### Adding Resources

```typescript
import { ListResourcesRequestSchema, ReadResourceRequestSchema } from '@modelcontextprotocol/sdk/types.js'

// List resources
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

// Read resource
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

### Adding Prompts

```typescript
import { ListPromptsRequestSchema, GetPromptRequestSchema } from '@modelcontextprotocol/sdk/types.js'

// List prompts
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

// Get prompt
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

## Authentication

### API Key Authentication

```typescript
// Server with API key
const server = await createMCPClient({
  command: 'node',
  args: ['./mcp-server.js'],
  env: {
    API_KEY: process.env.SERVICE_API_KEY,
  },
})

// Server validates API key
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const apiKey = process.env.API_KEY
  
  if (!apiKey || apiKey !== 'expected-key') {
    throw new Error('Unauthorized')
  }
  
  // Process request
  return handleToolCall(request)
})
```

### OAuth Integration

```typescript
// MCP server with OAuth
const server = await createMCPClient({
  command: 'node',
  args: ['./oauth-mcp-server.js'],
  env: {
    OAUTH_CLIENT_ID: process.env.OAUTH_CLIENT_ID,
    OAUTH_CLIENT_SECRET: process.env.OAUTH_CLIENT_SECRET,
    OAUTH_REFRESH_TOKEN: process.env.OAUTH_REFRESH_TOKEN,
  },
})

// Server implementation
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  // Refresh access token
  const accessToken = await refreshAccessToken({
    clientId: process.env.OAUTH_CLIENT_ID!,
    clientSecret: process.env.OAUTH_CLIENT_SECRET!,
    refreshToken: process.env.OAUTH_REFRESH_TOKEN!,
  })
  
  // Use access token in API calls
  const response = await fetch('https://api.example.com/data', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })
  
  return { content: await response.json() }
})
```

---

## Production Patterns

### Connection Pooling

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

// Reuse connections
const client1 = await pool.getClient({ command: 'node', args: ['server.js'] })
const client2 = await pool.getClient({ command: 'node', args: ['server.js'] }) // Same instance
```

### Health Checks

```typescript
async function healthCheckMCP(client: MCPClient): Promise<boolean> {
  try {
    // Try listing tools as health check
    await client.listTools()
    return true
  } catch (error) {
    console.error('MCP health check failed:', error)
    return false
  }
}

// Monitor health
setInterval(async () => {
  const healthy = await healthCheckMCP(mcpClient)
  
  if (!healthy) {
    console.error('MCP server unhealthy, reconnecting...')
    mcpClient = await createMCPClient(mcpConfig)
  }
}, 30000) // Check every 30s
```

### Error Handling

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

## Example: GitHub MCP Server

```typescript
// Connect to GitHub MCP server
const githubServer = await createMCPClient({
  command: 'npx',
  args: ['-y', '@modelcontextprotocol/server-github'],
  env: {
    GITHUB_TOKEN: process.env.GITHUB_TOKEN,
  },
})

// Create agent with GitHub tools
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

// Use the agent
const response = await githubAgent.run([
  {
    role: 'user',
    content: 'Find the most popular TypeScript web frameworks on GitHub',
  },
])

console.log(response.result.content)
```

---

## Example: Custom Database MCP Server

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

// Start
const transport = new StdioServerTransport()
await server.connect(transport)
```

---

## Best Practices

### Security
- [ ] Validate all MCP tool inputs
- [ ] Use environment variables for secrets
- [ ] Implement rate limiting
- [ ] Audit tool calls
- [ ] Restrict file system access

### Performance
- [ ] Reuse MCP client connections
- [ ] Cache tool/resource listings
- [ ] Use async operations
- [ ] Implement timeouts
- [ ] Monitor latency

### Reliability
- [ ] Health check MCP servers
- [ ] Retry transient failures
- [ ] Handle server restarts
- [ ] Log errors with context
- [ ] Validate responses

### Development
- [ ] Document tool parameters clearly
- [ ] Provide meaningful error messages
- [ ] Test tools thoroughly
- [ ] Version your MCP servers
- [ ] Follow MCP specification

---

## Troubleshooting

### Server Not Starting

```typescript
// Check server logs
const client = await createMCPClient({
  command: 'node',
  args: ['server.js'],
  env: { DEBUG: '1' },
})

// Server should log to stderr
```

### Tool Calls Failing

```typescript
// Validate tool exists
const tools = await client.listTools()
console.log('Available tools:', tools.map(t => t.name))

// Check tool schema
const tool = tools.find(t => t.name === 'my_tool')
console.log('Tool schema:', JSON.stringify(tool.inputSchema, null, 2))

// Validate arguments match schema
```

### Connection Issues

```typescript
// Test basic connectivity
try {
  await client.listTools()
  console.log('Connection OK')
} catch (error) {
  console.error('Connection failed:', error)
  
  // Try recreating client
  client = await createMCPClient(config)
}
```

---

## Next Steps

- **[Building Agents](./building-agents.md)** - Use MCP tools in agents
- **[Tool Development](./tool-development.md)** - Compare with native tools
- **[Performance](./performance.md)** - Optimize MCP integration

---

## Additional Resources

- **[MCP Specification](https://modelcontextprotocol.io/specification)** - Official spec
- **[MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)** - SDK docs
- **[API Reference](/docs/api/platform.md#mcp)** - Seashore MCP API
- **[Examples](https://github.com/modelcontextprotocol/servers)** - Official MCP servers
