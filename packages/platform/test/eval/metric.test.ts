import { describe, it, expect, vi } from 'vitest'
import { createMetric, createLLMJudgeMetric } from '../../src/eval/metric.js'

describe('createMetric', () => {
  it('should create a custom metric', async () => {
    const metric = createMetric({
      name: 'json-valid',
      evaluate: async ({ output }) => {
        try {
          JSON.parse(output)
          return 1.0
        } catch {
          return 0.0
        }
      },
    })

    expect(metric.name).toBe('json-valid')
    expect(await metric.evaluate({ input: '', output: '{"a":1}' })).toBe(1.0)
    expect(await metric.evaluate({ input: '', output: 'not json' })).toBe(0.0)
  })
})

describe('createLLMJudgeMetric', () => {
  it('should create an LLM judge metric', () => {
    const metric = createLLMJudgeMetric({
      name: 'helpfulness',
      adapter: vi.fn() as never,
      prompt: 'Rate helpfulness',
      parseScore: (text) => parseFloat(text) / 10,
    })

    expect(metric.name).toBe('helpfulness')
    expect(typeof metric.evaluate).toBe('function')
  })
})
