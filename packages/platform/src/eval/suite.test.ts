import { describe, it, expect, vi } from 'vitest'
import { createEvalSuite } from './suite.js'
import { createMetric } from './metric.js'

describe('createEvalSuite', () => {
  it('should run metrics against dataset', async () => {
    const lengthMetric = createMetric({
      name: 'length-check',
      evaluate: async ({ output }) => (output.length > 5 ? 1.0 : 0.0),
    })

    const suite = createEvalSuite({
      name: 'test-suite',
      dataset: [{ input: 'Hello', expected: 'World' }],
      metrics: [lengthMetric],
    })

    const mockAgent = {
      run: vi.fn().mockResolvedValue('Hello World'),
    }

    const results = await suite.run(mockAgent as never)
    expect(results.overall).toBeDefined()
    expect(results.metrics['length-check']).toBe(1.0)
  })

  it('should average scores across dataset entries', async () => {
    const exactMatch = createMetric({
      name: 'exact-match',
      evaluate: async ({ output, expected }) => (output === expected ? 1.0 : 0.0),
    })

    const suite = createEvalSuite({
      name: 'test-suite',
      dataset: [
        { input: 'Q1', expected: 'A1' },
        { input: 'Q2', expected: 'A2' },
      ],
      metrics: [exactMatch],
    })

    const mockAgent = {
      run: vi.fn().mockResolvedValueOnce('A1').mockResolvedValueOnce('WRONG'),
    }

    const results = await suite.run(mockAgent as never)
    expect(results.metrics['exact-match']).toBe(0.5)
  })
})
