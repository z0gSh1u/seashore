import { describe, it, expect } from 'vitest'
import { threads, messages, workflowRuns } from './schema.js'

describe('Storage Schema', () => {
  it('should export threads table', () => {
    expect(threads).toBeDefined()
    // Drizzle tables have a Symbol for the table name
    expect(typeof threads).toBe('object')
  })

  it('should export messages table', () => {
    expect(messages).toBeDefined()
  })

  it('should export workflowRuns table', () => {
    expect(workflowRuns).toBeDefined()
  })
})
