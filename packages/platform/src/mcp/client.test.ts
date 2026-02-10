import { describe, it, expect, vi } from 'vitest'
import { convertMCPToolToTanstack } from './client.js'

describe('convertMCPToolToTanstack', () => {
  it('should convert an MCP tool definition to @tanstack/ai format', () => {
    const mcpTool = {
      name: 'test_tool',
      description: 'A test tool',
      inputSchema: {
        type: 'object' as const,
        properties: {
          query: { type: 'string' as const, description: 'The query' },
        },
        required: ['query'],
      },
    }

    const converted = convertMCPToolToTanstack(mcpTool, vi.fn())
    expect(converted).toBeDefined()
    expect(converted.name).toBe('test_tool')
  })
})
