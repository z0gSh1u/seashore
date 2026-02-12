import 'dotenv/config'
import { createLLMAdapter } from '@seashore/core'
import { createReActAgent } from '@seashore/agent'
import { connectMCP, convertMCPToolToTanstack } from '@seashore/platform'
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { toolDefinition } from '@tanstack/ai'
import { z } from 'zod'

/**
 * MCP Integration Example
 *
 * This example demonstrates:
 * 1. Creating a standalone MCP server with custom tools
 * 2. Connecting to an MCP server from a Seashore agent
 * 3. Converting MCP tools to Seashore-compatible tools
 * 4. Using MCP tools seamlessly in a ReAct agent
 *
 * Architecture:
 * ┌─────────────────┐
 * │ Seashore Agent  │
 * └────────┬────────┘
 *          │ MCP Client
 *          ▼
 * ┌─────────────────┐
 * │   MCP Server    │ (stdio/sse transport)
 * │  - Calculator   │
 * │  - File System  │
 * │  - Custom Tools │
 * └─────────────────┘
 */

// ============================================================
// Part 1: Sample Standalone MCP Server
// ============================================================
// This would typically run as a separate process (node mcp-server-example.ts)
// For this example, we'll demonstrate the server code separately

/**
 * Creates a standalone MCP server with custom tools.
 * Run this separately: pnpm run server
 */
export async function createMCPServer() {
  const server = new Server(
    {
      name: 'example-tools-server',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
    },
  )

  // Register calculator tool
  server.setRequestHandler('tools/list', async () => ({
    tools: [
      {
        name: 'calculator',
        description: 'Perform arithmetic operations (add, subtract, multiply, divide)',
        inputSchema: {
          type: 'object',
          properties: {
            operation: {
              type: 'string',
              enum: ['add', 'subtract', 'multiply', 'divide'],
              description: 'The arithmetic operation to perform',
            },
            a: { type: 'number', description: 'First number' },
            b: { type: 'number', description: 'Second number' },
          },
          required: ['operation', 'a', 'b'],
        },
      },
      {
        name: 'get_time',
        description: 'Get the current time in a specified timezone',
        inputSchema: {
          type: 'object',
          properties: {
            timezone: {
              type: 'string',
              description: 'IANA timezone (e.g., America/New_York, Europe/London)',
              default: 'UTC',
            },
          },
        },
      },
      {
        name: 'translate_text',
        description: 'Translate text between languages (mock implementation)',
        inputSchema: {
          type: 'object',
          properties: {
            text: { type: 'string', description: 'Text to translate' },
            from_lang: { type: 'string', description: 'Source language code (e.g., en, es, fr)' },
            to_lang: { type: 'string', description: 'Target language code' },
          },
          required: ['text', 'to_lang'],
        },
      },
    ],
  }))

  // Handle tool execution
  server.setRequestHandler('tools/call', async (request) => {
    const { name, arguments: args } = request.params as {
      name: string
      arguments: Record<string, unknown>
    }

    try {
      if (name === 'calculator') {
        const { operation, a, b } = args as { operation: string; a: number; b: number }
        let result: number | string

        switch (operation) {
          case 'add':
            result = a + b
            break
          case 'subtract':
            result = a - b
            break
          case 'multiply':
            result = a * b
            break
          case 'divide':
            result = b !== 0 ? a / b : 'Error: Division by zero'
            break
          default:
            throw new Error(`Unknown operation: ${operation}`)
        }

        return {
          content: [{ type: 'text', text: String(result) }],
        }
      }

      if (name === 'get_time') {
        const { timezone = 'UTC' } = args as { timezone?: string }
        const now = new Date()
        const timeString = now.toLocaleString('en-US', { timeZone: timezone })

        return {
          content: [{ type: 'text', text: `Current time in ${timezone}: ${timeString}` }],
        }
      }

      if (name === 'translate_text') {
        const { text, from_lang = 'auto', to_lang } = args as {
          text: string
          from_lang?: string
          to_lang: string
        }

        // Mock translation (in production, call a real translation API)
        const mockTranslation = `[Translated from ${from_lang} to ${to_lang}]: ${text}`

        return {
          content: [{ type: 'text', text: mockTranslation }],
        }
      }

      throw new Error(`Unknown tool: ${name}`)
    } catch (error) {
      return {
        content: [{ type: 'text', text: `Error: ${String(error)}` }],
        isError: true,
      }
    }
  })

  // Start server with stdio transport
  const transport = new StdioServerTransport()
  await server.connect(transport)

  console.error('MCP Server started on stdio') // Use stderr for logging (stdout is for protocol)
  return server
}

// ============================================================
// Part 2: Connecting to MCP Server from Agent
// ============================================================

/**
 * Example 1: Connect to MCP server via stdio
 */
async function example1_ConnectViaStdio() {
  console.log('\n=== Example 1: Connect to MCP Server via stdio ===\n')

  try {
    // Connect to MCP server running as a subprocess
    const mcpTools = await connectMCP({
      transport: 'stdio',
      command: 'node',
      args: ['mcp-server-example.ts'], // This would be the compiled server
    })

    console.log(`✓ Connected to MCP server, discovered ${mcpTools.length} tools:`)
    // Note: The tools are already converted to Seashore-compatible format
    mcpTools.forEach((tool) => {
      console.log(`  - ${tool.name}`)
    })

    return mcpTools
  } catch (error) {
    console.error('✗ Failed to connect to MCP server:', error)
    console.log('  To run this example:')
    console.log('  1. Build the server: pnpm run server')
    console.log('  2. Run this example in a way that can spawn the server process')
    return []
  }
}

/**
 * Example 2: Connect to MCP server via SSE (HTTP)
 */
async function example2_ConnectViaSSE() {
  console.log('\n=== Example 2: Connect to MCP Server via SSE ===\n')

  try {
    // For SSE transport, you'd have an MCP server running on HTTP
    const mcpTools = await connectMCP({
      transport: 'sse',
      url: 'http://localhost:3000/mcp',
    })

    console.log(`✓ Connected to MCP server via SSE, discovered ${mcpTools.length} tools`)
    return mcpTools
  } catch (error) {
    console.error('✗ SSE connection not available (server not running)')
    console.log('  This example requires an MCP server running on http://localhost:3000/mcp')
    return []
  }
}

/**
 * Example 3: Manually convert individual MCP tools
 */
async function example3_ManualConversion() {
  console.log('\n=== Example 3: Manual MCP Tool Conversion ===\n')

  // Simulate an MCP tool definition (what you'd get from client.listTools())
  const mcpToolDefinition = {
    name: 'weather_lookup',
    description: 'Get weather information for a location',
    inputSchema: {
      type: 'object',
      properties: {
        location: { type: 'string', description: 'City name' },
        units: { type: 'string', enum: ['celsius', 'fahrenheit'], default: 'celsius' },
      },
      required: ['location'],
    },
  }

  // Mock MCP tool call function
  async function callMCPTool(args: Record<string, unknown>) {
    // In real usage, this would call client.callTool()
    const { location, units = 'celsius' } = args
    return {
      content: [
        {
          type: 'text',
          text: `Weather in ${location}: 22°${units === 'celsius' ? 'C' : 'F'}, sunny`,
        },
      ],
    }
  }

  // Convert to Seashore-compatible tool
  const seashoreWeatherTool = convertMCPToolToTanstack(mcpToolDefinition, async (args) => {
    const result = await callMCPTool(args)
    return result.content
  })

  console.log('✓ Manually converted MCP tool:', mcpToolDefinition.name)
  console.log('  Can now be used in Seashore agents!')

  return seashoreWeatherTool
}

/**
 * Example 4: Using MCP tools in a ReAct agent
 */
async function example4_AgentWithMCPTools() {
  console.log('\n=== Example 4: Agent with MCP Tools ===\n')

  // Create native Seashore tools
  const nativeWeatherTool = toolDefinition({
    name: 'get_weather',
    description: 'Get current weather for a city (native Seashore tool)',
    inputSchema: z.object({
      city: z.string().describe('City name'),
    }),
  }).server(async (input) => {
    return `Weather in ${input.city}: 20°C, partly cloudy (via native tool)`
  })

  // Create mock MCP tool for demonstration (since we can't spawn subprocess here)
  const mcpCalculatorTool = toolDefinition({
    name: 'calculator',
    description: 'Perform arithmetic operations (via MCP)',
    inputSchema: z.object({
      operation: z.enum(['add', 'subtract', 'multiply', 'divide']),
      a: z.number(),
      b: z.number(),
    }),
  }).server(async (input) => {
    // This simulates calling through MCP
    const { operation, a, b } = input
    let result: number | string

    switch (operation) {
      case 'add':
        result = a + b
        break
      case 'subtract':
        result = a - b
        break
      case 'multiply':
        result = a * b
        break
      case 'divide':
        result = b !== 0 ? a / b : 'Error: Division by zero'
        break
      default:
        const _exhaustive: never = operation
        throw new Error(`Unknown operation: ${String(_exhaustive)}`)
    }

    return `[MCP Calculator] Result: ${result}`
  })

  // Create LLM adapter
  const llm = createLLMAdapter({
    provider: 'openai',
    model: 'gpt-4o',
    apiKey: process.env.OPENAI_API_KEY || 'your-api-key-here',
  })

  // Create agent with both native and MCP tools
  const agent = createReActAgent({
    llm,
    tools: [nativeWeatherTool, mcpCalculatorTool],
    systemPrompt: `You are a helpful assistant with access to weather information and a calculator.
The calculator tool is provided via MCP (Model Context Protocol).
Always explain which tool you're using.`,
    maxIterations: 5,
  })

  // Test query 1: Use native tool
  console.log('Query: What is the weather in Tokyo?')
  const result1 = await agent.run({
    message: 'What is the weather in Tokyo?',
  })
  console.log('Agent:', result1.message)
  console.log()

  // Test query 2: Use MCP tool
  console.log('Query: Calculate 156 multiplied by 23')
  const result2 = await agent.run({
    message: 'Calculate 156 multiplied by 23',
  })
  console.log('Agent:', result2.message)
  console.log()

  // Test query 3: Use both tools
  console.log('Query: If temperature in Paris is 18°C and in London is 15°C, what is average?')
  const result3 = await agent.run({
    message:
      'If the temperature in Paris is 18°C and in London is 15°C, what is the average temperature?',
  })
  console.log('Agent:', result3.message)
}

// ============================================================
// Main Execution
// ============================================================

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗')
  console.log('║         Seashore MCP Integration Examples                 ║')
  console.log('╚════════════════════════════════════════════════════════════╝')

  // Example 1: stdio connection (will fail gracefully in this demo)
  await example1_ConnectViaStdio()

  // Example 2: SSE connection (will fail gracefully in this demo)
  await example2_ConnectViaSSE()

  // Example 3: Manual tool conversion
  await example3_ManualConversion()

  // Example 4: Agent with MCP tools (works with mock tools)
  await example4_AgentWithMCPTools()

  console.log('\n✓ All examples completed!')
  console.log('\nNext Steps:')
  console.log('1. Run the MCP server: pnpm run server (in separate terminal)')
  console.log('2. Modify mcp-server-example.ts to add your own tools')
  console.log('3. Connect to external MCP servers (file systems, databases, APIs)')
  console.log('4. Use MCP to extend agent capabilities without changing agent code')
}

main().catch(console.error)
