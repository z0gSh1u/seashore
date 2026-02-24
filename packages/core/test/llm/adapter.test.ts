import { describe, it, expect } from 'vitest'
import { createLLMAdapter } from '../../src/llm/adapter.js'

describe('createLLMAdapter', () => {
  it('should create an OpenAI adapter', () => {
    const adapter = createLLMAdapter({
      provider: 'openai',
      apiKey: 'test-key',
    })
    expect(adapter).toBeDefined()
    expect(typeof adapter).toBe('function')
  })

  it('should create an Anthropic adapter', () => {
    const adapter = createLLMAdapter({
      provider: 'anthropic',
      apiKey: 'test-key',
    })
    expect(adapter).toBeDefined()
    expect(typeof adapter).toBe('function')
  })

  it('should create a Gemini adapter', () => {
    const adapter = createLLMAdapter({
      provider: 'gemini',
      apiKey: 'test-key',
    })
    expect(adapter).toBeDefined()
    expect(typeof adapter).toBe('function')
  })

  it('should throw on invalid provider', () => {
    expect(() =>
      createLLMAdapter({
        provider: 'invalid' as never,
        apiKey: 'test-key',
      })
    ).toThrow('Unsupported provider')
  })

  it('should accept custom baseURL', () => {
    const adapter = createLLMAdapter({
      provider: 'openai',
      apiKey: 'test-key',
      baseURL: 'https://custom.api.com/v1',
    })
    expect(adapter).toBeDefined()
  })
})
