# MCP Client

The Model Context Protocol (MCP) lets you connect agents to external tools and data sources through a standardized protocol.

## What is MCP?

MCP is a protocol for:
- **Tool Discovery** — Automatically discover available tools
- **Tool Execution** — Call tools with type-safe parameters
- **Resource Access** — Access external data sources
- **Prompt Templates** — Share prompt templates

## Connecting to MCP Servers

```typescript
import { createMCPClient } from '@seashore/mcp'

// Connect to an MCP server via stdio
const client = await createMCPClient({
  name: 'filesystem',
  transport: {
    type: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-filesystem', '/allowed/path'],
  },
})

// Connect via SSE
const sseClient = await createMCPClient({
  name: 'remote-tools',
  transport: {
    type: 'sse',
    url: 'https://api.example.com/mcp',
  },
})

// Connect via WebSocket
const wsClient = await createMCPClient({
  name: 'realtime-tools',
  transport: {
    type: 'websocket',
    url: 'wss://api.example.com/mcp',
  },
})
```

## Listing Available Tools

```typescript
// Discover available tools
const tools = await client.listTools()

console.log(tools)
// [
//   { name: 'read_file', description: 'Read a file', inputSchema: {...} },
//   { name: 'write_file', description: 'Write a file', inputSchema: {...} },
//   { name: 'list_directory', description: 'List directory contents', ... },
// ]
```

## Converting MCP Tools to Seashore Tools

```typescript
import { convertMCPTool } from '@seashore/mcp'

const mcpTools = await client.listTools()

// Convert MCP tools to Seashore tools
const seashoreTools = await Promise.all(
  mcpTools.map(async (mcpTool) => {
    return await convertMCPTool(client, mcpTool)
  })
)

// Use with agents
const agent = createAgent({
  name: 'file-assistant',
  model: openaiText('gpt-4o'),
  tools: seashoreTools,
})

const result = await agent.run('Read the file config.json')
```

## Calling MCP Tools Directly

```typescript
// Call a tool
const result = await client.callTool('read_file', {
  path: '/path/to/file.txt',
})

console.log(result)
// { content: 'File contents...', metadata: {...} }
```

## Accessing Resources

```typescript
// List available resources
const resources = await client.listResources()

// Read a resource
const resource = await client.readResource('file:///config.json')

console.log(resource.contents)
```

## Prompt Templates

```typescript
// List available prompts
const prompts = await client.listPrompts()

// Get a prompt template
const prompt = await client.getPrompt('summarize', {
  length: 'short',
  style: 'professional',
})

console.log(prompt.messages)
// [
//   { role: 'system', content: 'You are a summarizer...' },
//   { role: 'user', content: 'Summarize briefly...' },
// ]
```

## Multi-Server Setup

Connect to multiple MCP servers:

```typescript
import { createMCPServerBridge } from '@seashore/mcp'

const bridge = createMCPServerBridge()

// Add multiple servers
await bridge.addServer({
  name: 'filesystem',
  transport: { type: 'stdio', command: 'mcp-server-filesystem', args: ['/path'] },
})

await bridge.addServer({
  name: 'github',
  transport: { type: 'stdio', command: 'mcp-server-github' },
})

await bridge.addServer({
  name: 'database',
  transport: { type: 'sse', url: 'https://api.example.com/mcp' },
})

// Get all tools from all servers
const allTools = await bridge.getAllTools()

// Create agent with all tools
const agent = createAgent({
  name: 'multi-source-assistant',
  model: openaiText('gpt-4o'),
  tools: await Promise.all(
    allTools.map(tool => convertMCPTool(bridge, tool))
  ),
})
```

## Common MCP Servers

### Filesystem Server

```typescript
await client.addServer({
  name: 'filesystem',
  transport: {
    type: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-filesystem', '/allowed/path'],
  },
})
```

### GitHub Server

```typescript
await client.addServer({
  name: 'github',
  transport: {
    type: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-github'],
  },
  env: {
    GITHUB_TOKEN: process.env.GITHUB_TOKEN,
  },
})
```

### Database Server

```typescript
await client.addServer({
  name: 'postgres',
  transport: {
    type: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-postgres'],
  },
  env: {
    POSTGRES_CONNECTION_STRING: process.env.DATABASE_URL,
  },
})
```

## Best Practices

1. **Sandboxing** — Run MCP servers in isolated environments
2. **Authentication** — Use secure transport for production
3. **Error Handling** — Handle server disconnections gracefully
4. **Tool Validation** — Validate tool inputs before sending
5. **Rate Limiting** — Limit calls to external MCP servers

## Next Steps

- [Deployment](./deploy.md) — Deploy agents with MCP tools
- [Tools](../tools/index.md) — Custom tool definitions
