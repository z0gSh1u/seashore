import { describe, it, expect } from 'vitest'
import { systemPrompt } from '../../src/context/system-prompt.js'

describe('systemPrompt', () => {
  it('should build a basic system prompt with role', () => {
    const prompt = systemPrompt().role('You are a helpful assistant').build()
    expect(prompt).toContain('You are a helpful assistant')
  })

  it('should include instructions', () => {
    const prompt = systemPrompt()
      .role('Assistant')
      .instruction('Always be concise')
      .instruction('Use bullet points')
      .build()
    expect(prompt).toContain('Always be concise')
    expect(prompt).toContain('Use bullet points')
  })

  it('should include constraints', () => {
    const prompt = systemPrompt()
      .role('Assistant')
      .constraint('Do not make up data')
      .build()
    expect(prompt).toContain('Do not make up data')
  })

  it('should include examples', () => {
    const prompt = systemPrompt()
      .role('Assistant')
      .example({ input: 'Hello', output: 'Hi there!' })
      .build()
    expect(prompt).toContain('Hello')
    expect(prompt).toContain('Hi there!')
  })

  it('should include output format', () => {
    const prompt = systemPrompt()
      .role('Code generator')
      .outputFormat('json')
      .build()
    expect(prompt).toContain('JSON')
  })

  it('should include code output format with language', () => {
    const prompt = systemPrompt()
      .role('Code generator')
      .outputFormat('code', { language: 'typescript' })
      .build()
    expect(prompt).toContain('typescript')
  })

  it('should chain all methods fluently', () => {
    const prompt = systemPrompt()
      .role('Data analyst')
      .instruction('Be precise')
      .constraint('No fabrication')
      .example({ input: 'Q', output: 'A' })
      .outputFormat('json')
      .build()

    expect(typeof prompt).toBe('string')
    expect(prompt.length).toBeGreaterThan(0)
  })
})
