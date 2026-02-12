# MCP Integration Example

Complete guide to integrating **MCP (Model Context Protocol)** servers with Seashore agents. MCP allows agents to access external tools and resources through a standardized protocol.

## Features

- **🔌 MCP Client Integration** - Connect to any MCP-compatible server
- **🛠️ Tool Conversion** - Automatically convert MCP tools to Seashore format
- **🔄 Multiple Transports** - Support for stdio and SSE (HTTP) connections
- **🎯 Seamless Agent Integration** - Use MCP tools alongside native Seashore tools
- **📡 Standalone Server Example** - Sample MCP server implementation

## What is MCP?

MCP (Model Context Protocol) is an open standard that lets AI agents securely access external tools and data sources. Think of it as a universal adapter that lets your agent:

- Access file systems, databases, and APIs
- Use third-party tools without custom integrations
- Share tools across different AI frameworks
- Maintain security boundaries

```
┌─────────────────┐
│ Seashore Agent  │
└────────┬────────┘
         │ MCP Client
         ▼
┌─────────────────┐
│   MCP Server    │ (stdio/sse)
│  - File System  │
│  - Database     │
│  - API Tools    │
│  - Custom Tools │
└─────────────────┘
```

## Prerequisites

- Node.js 20+
- OpenAI API key (or other LLM provider)
- MCP server (included in example, or use external servers)

## Setup

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Configure Environment

Create `.env`:

```bash
cp .env.example .env
# Edit .env and add your OPENAI_API_KEY
```

## Usage

### Run the Main Example

```bash
pnpm start
```

This demonstrates:
1. Connecting to MCP servers (stdio and SSE)
2. Converting MCP tools to Seashore format
3. Using MCP tools in a ReAct agent

### Run the MCP Server

In a separate terminal:

```bash
pnpm run server
```

This starts a standalone MCP server with example tools (calculator, time, translation).

## Examples Explained

### Example 1: Connect via stdio

Connect to an MCP server running as a subprocess:

```typescript
import { connectMCP } from '@seashore/platform'

const tools = await connectMCP({
  transport: 'stdio',
  command: 'node',
  args: ['mcp-server.js'],
})

// tools are ready to use in your agent!
```

**Use Cases:**
- Local tools (file system, git, shell commands)
- Lightweight services
- Development and testing

### Example 2: Connect via SSE (HTTP)

Connect to an MCP server running on HTTP:

```typescript
const tools = await connectMCP({
  transport: 'sse',
  url: 'http://localhost:3000/mcp',
})
```

**Use Cases:**
- Remote services
- Shared tool servers
- Production deployments
- Services behind authentication

### Example 3: Manual Tool Conversion

Convert individual MCP tools for fine-grained control:

```typescript
import { convertMCPToolToTanstack } from '@seashore/platform'

// MCP tool definition
const mcpTool = {
  name: 'weather_lookup',
  description: 'Get weather information',
  inputSchema: { /* JSON Schema */ },
}

// Convert to Seashore format
const seashoreWeatherTool = convertMCPToolToTanstack(
  mcpTool,
  async (args) => {
    // Call the actual MCP tool
    const result = await client.callTool({ name: 'weather_lookup', arguments: args })
    return result.content
  }
)

// Use in agent
const agent = createReActAgent({
  llm,
  tools: [seashoreWeatherTool],
})
```

### Example 4: Agent with MCP Tools

Use MCP tools seamlessly with native Seashore tools:

```typescript
import { createLLMAdapter } from '@seashore/core'
import { createReActAgent } from '@seashore/agent'
import { connectMCP } from '@seashore/platform'
import { toolDefinition } from '@tanstack/ai'
import { z } from 'zod'

// Native Seashore tool
const nativeTool = toolDefinition({
  name: 'get_weather',
  description: 'Get weather (native)',
  inputSchema: z.object({
    city: z.string(),
  }),
}).server(async (input) => {
  return `Weather in ${input.city}: 20°C`
})

// MCP tools
const mcpTools = await connectMCP({
  transport: 'stdio',
  command: 'node',
  args: ['mcp-server.js'],
})

// Create agent with both
const agent = createReActAgent({
  llm: createLLMAdapter({ provider: 'openai', model: 'gpt-4o' }),
  tools: [...mcpTools, nativeTool],
})

// Agent can use both seamlessly!
const result = await agent.run({
  message: 'Calculate 15 * 23 and tell me the weather in Tokyo',
})
```

## Creating Your Own MCP Server

### Basic Server Structure

```typescript
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'

const server = new Server(
  { name: 'my-tools-server', version: '1.0.0' },
  { capabilities: { tools: {} } }
)

// List available tools
server.setRequestHandler('tools/list', async () => ({
  tools: [
    {
      name: 'my_tool',
      description: 'What the tool does',
      inputSchema: {
        type: 'object',
        properties: {
          param: { type: 'string', description: 'Parameter description' },
        },
        required: ['param'],
      },
    },
  ],
}))

// Handle tool calls
server.setRequestHandler('tools/call', async (request) => {
  const { name, arguments: args } = request.params

  if (name === 'my_tool') {
    const result = doSomething(args.param)
    return {
      content: [{ type: 'text', text: String(result) }],
    }
  }

  throw new Error(`Unknown tool: ${name}`)
})

// Start server
const transport = new StdioServerTransport()
await server.connect(transport)
```

### Adding Custom Tools

Edit `mcp-server-example.ts` to add your own tools:

1. **Add tool definition** in `tools/list` handler
2. **Implement tool logic** in `tools/call` handler
3. **Restart the server**

Example - Add a "reverse string" tool:

```typescript
// In tools/list
{
  name: 'reverse_string',
  description: 'Reverse a string',
  inputSchema: {
    type: 'object',
    properties: {
      text: { type: 'string', description: 'Text to reverse' },
    },
    required: ['text'],
  },
}

// In tools/call
if (name === 'reverse_string') {
  const { text } = args as { text: string }
  return {
    content: [{ type: 'text', text: text.split('').reverse().join('') }],
  }
}
```

## Real-World MCP Servers

### File System Server

```typescript
const fsTools = await connectMCP({
  transport: 'stdio',
  command: 'npx',
  args: ['-y', '@modelcontextprotocol/server-filesystem', '/path/to/workspace'],
})
```

**Provides:** Read/write files, list directories, search files

### GitHub Server

```typescript
const githubTools = await connectMCP({
  transport: 'stdio',
  command: 'npx',
  args: ['-y', '@modelcontextprotocol/server-github'],
  env: { GITHUB_TOKEN: process.env.GITHUB_TOKEN },
})
```

**Provides:** Create issues, PRs, search repos, manage files

### PostgreSQL Server

```typescript
const dbTools = await connectMCP({
  transport: 'stdio',
  command: 'npx',
  args: ['-y', '@modelcontextprotocol/server-postgres'],
  env: { DATABASE_URL: process.env.DATABASE_URL },
})
```

**Provides:** Query database, insert/update records, schema inspection

## Production Considerations

### 1. Error Handling

Always wrap MCP connections in try-catch:

```typescript
try {
  const tools = await connectMCP({ ... })
} catch (error) {
  console.error('Failed to connect to MCP server:', error)
  // Fallback to native tools or error handling
}
```

### 2. Timeouts

MCP calls can hang. Set timeouts:

```typescript
const timeout = setTimeout(() => {
  throw new Error('MCP connection timeout')
}, 30000) // 30 seconds

try {
  const tools = await connectMCP({ ... })
} finally {
  clearTimeout(timeout)
}
```

### 3. Connection Pooling

For SSE (HTTP) connections, reuse the connection:

```typescript
// Connect once
const tools = await connectMCP({ transport: 'sse', url: '...' })

// Use tools in multiple agents
const agent1 = createReActAgent({ llm, tools })
const agent2 = createReActAgent({ llm, tools })
```

### 4. Security

- **Validate inputs** before sending to MCP servers
- **Sanitize outputs** from untrusted MCP servers
- **Use guardrails** (see guardrails example)
- **Limit tool access** based on user permissions

### 5. Monitoring

Log MCP tool usage:

```typescript
const wrappedTools = tools.map(tool => ({
  ...tool,
  server: async (input) => {
    console.log(`[MCP] Calling ${tool.name}:`, input)
    const result = await tool.server(input)
    console.log(`[MCP] Result from ${tool.name}:`, result)
    return result
  }
}))
```

## Troubleshooting

### "Failed to connect to MCP server"

**Cause:** Server not running or incorrect connection config

**Fix:**
1. Check server is running: `pnpm run server`
2. Verify command/url in `connectMCP()` config
3. Check server logs for errors

### "Tool not found"

**Cause:** MCP server doesn't provide the requested tool

**Fix:**
1. List available tools: check `tools/list` response
2. Verify tool name matches exactly
3. Restart server after adding new tools

### "Invalid input schema"

**Cause:** MCP tool expects different parameters

**Fix:**
1. Check tool's `inputSchema` in MCP server
2. Ensure JSON Schema → Zod conversion is correct
3. Use manual conversion for complex schemas

### "Permission denied"

**Cause:** MCP server lacks permissions (file access, API keys)

**Fix:**
1. Check server has required environment variables
2. Verify file/directory permissions
3. Ensure API keys are valid

## Next Steps

1. **Explore Official MCP Servers:** https://modelcontextprotocol.org/servers
2. **Build Custom Tools:** Extend `mcp-server-example.ts`
3. **Combine with Guardrails:** See `/examples/guardrails`
4. **Production Deployment:** Use SSE transport with authentication

## Learn More

- [MCP Specification](https://modelcontextprotocol.org/spec)
- [MCP SDK Documentation](https://github.com/modelcontextprotocol/sdk)
- [Seashore Platform API](/docs/api/platform.md)
- [Official MCP Servers](https://modelcontextprotocol.org/servers)

## Files

- `index.ts` - Main examples and agent integration
- `mcp-server-example.ts` - Standalone MCP server
- `package.json` - Dependencies and scripts
- `README.md` - This file
- `.env.example` - Environment configuration template
