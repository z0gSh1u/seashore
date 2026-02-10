import { describe, it, expect } from 'vitest'
import { createToolkit } from './toolkit.js'

describe('createToolkit', () => {
  it('should combine tools into a toolkit', () => {
    const tool1 = { name: 'tool1' }
    const tool2 = { name: 'tool2' }
    const toolkit = createToolkit([tool1, tool2] as never[])
    expect(toolkit).toHaveLength(2)
    expect(toolkit[0]).toBe(tool1)
    expect(toolkit[1]).toBe(tool2)
  })

  it('should return empty array for empty input', () => {
    const toolkit = createToolkit([])
    expect(toolkit).toEqual([])
  })
})
