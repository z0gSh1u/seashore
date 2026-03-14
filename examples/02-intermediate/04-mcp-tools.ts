/**
 * Example: MCP Tools
 *
 * Purpose: Demonstrates Model Context Protocol (MCP) server integration.
 *          Shows how to connect to MCP servers and use their tools.
 *
 * Prerequisites:
 * - OPENAI_API_KEY in .env file
 * - FILESYSTEM_MCP_SERVER configured in .env (optional)
 *
 * Learning Objectives:
 * 1. How to connect to an MCP server with connectMCP()
 * 2. How to convert MCP tools to TanStack AI format
 * 3. How to use MCP tools in a ReAct agent
 * 4. How to manage MCP connections
 *
 * Expected Output:
 * ```
 * 🔌 MCP Tools Example
 *
 * Connecting to MCP server...
 * ✓ Connected to filesystem MCP server
 *
 * Available Tools:
 *  - read_file: Read contents of a file
 *  - list_directory: List files in a directory
 *  - search_files: Search for files by pattern
 *
 * Using MCP tools in agent...
 * 🔧 Tool called: list_directory
 * 🔧 Tool called: read_file
 *
 * 🤖 Agent Response:
 * I found 5 files in the directory. The main file is README.md which contains...
 *
 * Disconnecting from MCP server...
 * ✓ Disconnected successfully
 *
 * ✅ Example completed successfully!
 * ```
 */

import { createLLMAdapter } from '@seashore/core.js'
import { createReActAgent, type Message } from '@seashore/agent.js'
import { connectMCP, convertMCPToolToTanstack } from '@seashore/platform.js'

// Validate environment variables
const apiKey = process.env.OPENAI_API_KEY
const baseURL = process.env.OPENAI_BASE_URL
const mcpServerCommand = process.env.FILESYSTEM_MCP_SERVER || 'npx -y @modelcontextprotocol/server-filesystem /tmp'

if (!apiKey) {
  console.error('❌ Error: OPENAI_API_KEY is required')
  console.error('Please copy .env.example to .env and add your OpenAI API key')
  process.exit(1)
}

async function main(): Promise<void> {
  console.log('🔌 MCP Tools Example\n')

  // Step 1: Connect to MCP server
  console.log('Connecting to MCP server...')
  console.log(`Command: ${mcpServerCommand}\n`)

  let mcpConnection

  try {
    mcpConnection = await connectMCP({
      command: mcpServerCommand,
      timeout: 30000, // 30 second timeout
    })

    console.log('✓ Connected to MCP server\n')
  } catch (error) {
    console.error('❌ Failed to connect to MCP server')
    console.error('This example requires an MCP server to be available.')
    console.error('\nTroubleshooting:')
    console.error('1. Ensure npx is installed: npm install -g npx')
    console.error('2. Check that the MCP server command is correct')
    console.error('3. Verify network access for downloading MCP packages')
    console.error('\nAlternatively, set FILESYSTEM_MCP_SERVER in your .env file')
    process.exit(1)
  }

  try {
    // Step 2: List available tools from MCP server
    console.log('Discovering tools...')

    const mcpTools = await mcpConnection.listTools()
    console.log(`✓ Found ${mcpTools.length} tools\n`)

    console.log('Available MCP Tools:')
    for (const tool of mcpTools) {
      console.log(`  - ${tool.name}: ${tool.description?.substring(0, 60)}...`)
    }
    console.log()

    // Step 3: Convert MCP tools to TanStack AI format
    console.log('Converting tools...')

    const tools = mcpTools.map((mcpTool) =>
      convertMCPToolToTanstack(mcpTool, {
        execute: async (args: Record<string, unknown>) => {
          console.log(`  🔧 MCP Tool: ${mcpTool.name}(${JSON.stringify(args)})`)
          const result = await mcpConnection.callTool(mcpTool.name, args)
          console.log(`     Result: ${JSON.stringify(result).substring(0, 100)}...`)
          return result
        },
      })
    )

    console.log(`✓ Converted ${tools.length} tools\n`)

    // Step 4: Create agent with MCP tools
    const adapter = createLLMAdapter({
      provider: 'openai',
      apiKey,
      baseURL,
    })

    const agent = createReActAgent({
      model: () => adapter('gpt-4o-mini'),
      systemPrompt:
        'You are a helpful assistant with access to filesystem tools. ' +
        'You can read files, list directories, and search for files. ' +
        'Always use the appropriate tool when the user asks about files.',
      tools,
      maxIterations: 10,
    })

    console.log('✓ Agent created with MCP tools\n')

    // Step 5: Test the agent with a filesystem query
    const userQuery = 'List the files in /tmp and tell me what you find'
    console.log(`💬 User: "${userQuery}"\n`)

    console.log('🤖 Agent is processing...\n')

    const response = await agent.run([
      { role: 'user', content: userQuery },
    ])

    // Display tool calls
    if (response.result.toolCalls.length > 0) {
      console.log('\n📋 MCP Tool Calls:')
      for (const tc of response.result.toolCalls) {
        console.log(`  - ${tc.name}`)
      }
    }

    // Display response
    console.log('\n🤖 Agent Response:')
    console.log(response.result.content)

    // Step 6: Demonstrate another query with file reading
    console.log('\n\n---\n')
    const secondQuery = 'Read the first text file you can find and summarize its contents'
    console.log(`💬 User: "${secondQuery}"\n`)

    console.log('🤖 Agent is processing...\n')

    const secondResponse = await agent.run([
      { role: 'user', content: userQuery },
      { role: 'assistant', content: response.result.content },
      { role: 'user', content: secondQuery },
    ])

    if (secondResponse.result.toolCalls.length > 0) {
      console.log('\n📋 MCP Tool Calls:')
      for (const tc of secondResponse.result.toolCalls) {
        console.log(`  - ${tc.name}`)
      }
    }

    console.log('\n🤖 Agent Response:')
    console.log(secondResponse.result.content)

    console.log('\n\n✅ Example completed successfully!')
  } catch (error) {
    console.error('\n❌ Error:', error)
    throw error
  } finally {
    // Step 7: Always disconnect from MCP server
    console.log('\n\nDisconnecting from MCP server...')
    if (mcpConnection) {
      await mcpConnection.disconnect()
      console.log('✓ Disconnected successfully')
    }
  }
}

// Run with error handling
main().catch((error: Error) => {
  console.error('\n💥 Fatal error:', error.message)
  process.exit(1)
})
