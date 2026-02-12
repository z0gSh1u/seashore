import 'dotenv/config'
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'

/**
 * Standalone MCP Server Example
 *
 * This is a sample MCP server that provides calculator, time, and translation tools.
 * Run this as a separate process: pnpm run server
 *
 * The server communicates via stdio transport, which can be consumed by MCP clients.
 */

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

// Register available tools
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
          from_lang: {
            type: 'string',
            description: 'Source language code (e.g., en, es, fr)',
          },
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
console.error('Available tools: calculator, get_time, translate_text')
