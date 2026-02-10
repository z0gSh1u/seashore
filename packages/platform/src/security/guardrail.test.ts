import { describe, it, expect, vi } from 'vitest'
import { createGuardrail } from './guardrail.js'
import { createLLMGuardrail } from './llm-guardrail.js'

describe('createGuardrail', () => {
  it('should create a guardrail with beforeRequest', async () => {
    const guard = createGuardrail({
      name: 'test-guard',
      beforeRequest: async (messages) => {
        return { blocked: false }
      },
    })
    expect(guard.name).toBe('test-guard')

    const result = await guard.beforeRequest!([])
    expect(result.blocked).toBe(false)
  })

  it('should block on beforeRequest', async () => {
    const guard = createGuardrail({
      name: 'block-guard',
      beforeRequest: async () => ({
        blocked: true,
        reason: 'Blocked for testing',
      }),
    })

    const result = await guard.beforeRequest!([])
    expect(result.blocked).toBe(true)
    expect(result.reason).toBe('Blocked for testing')
  })

  it('should support afterResponse', async () => {
    const guard = createGuardrail({
      name: 'response-guard',
      afterResponse: async (response) => ({
        blocked: String(response).includes('bad'),
        reason: 'Bad content detected',
      }),
    })

    const safe = await guard.afterResponse!('good content')
    expect(safe.blocked).toBe(false)

    const unsafe = await guard.afterResponse!('this is bad content')
    expect(unsafe.blocked).toBe(true)
  })
})

describe('createLLMGuardrail', () => {
  it('should create an LLM-based guardrail', () => {
    const guard = createLLMGuardrail({
      name: 'llm-guard',
      adapter: vi.fn() as never,
      prompt: 'Is this safe?',
      parseResult: (output) => ({
        blocked: String(output).includes('UNSAFE'),
      }),
    })

    expect(guard.name).toBe('llm-guard')
    expect(typeof guard.afterResponse).toBe('function')
  })
})
