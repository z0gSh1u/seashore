import type { ServerTool } from '@tanstack/ai'

export function createToolkit<T extends ServerTool[]>(tools: T): T {
  return tools
}
