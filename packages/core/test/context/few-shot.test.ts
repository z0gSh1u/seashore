import { describe, it, expect } from 'vitest'
import { fewShotMessages } from '../../src/context/few-shot.js'

describe('fewShotMessages', () => {
  it('should convert examples to message pairs', () => {
    const messages = fewShotMessages([
      { user: 'What is 2+2?', assistant: '4' },
    ])
    expect(messages).toHaveLength(2)
    expect(messages[0]).toEqual({ role: 'user', content: 'What is 2+2?' })
    expect(messages[1]).toEqual({ role: 'assistant', content: '4' })
  })

  it('should handle multiple examples', () => {
    const messages = fewShotMessages([
      { user: 'Q1', assistant: 'A1' },
      { user: 'Q2', assistant: 'A2' },
    ])
    expect(messages).toHaveLength(4)
  })

  it('should return empty array for empty input', () => {
    const messages = fewShotMessages([])
    expect(messages).toEqual([])
  })
})
