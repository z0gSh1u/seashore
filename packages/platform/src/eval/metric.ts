import { chat } from '@tanstack/ai'
import type { EvalMetric } from './types.js'

export interface MetricConfig {
  name: string
  evaluate: (params: {
    input: string
    output: string
    expected?: string
    context?: string[]
  }) => Promise<number>
}

export function createMetric(config: MetricConfig): EvalMetric {
  return {
    name: config.name,
    evaluate: config.evaluate,
  }
}

export interface LLMJudgeMetricConfig {
  name: string
  adapter: unknown // @tanstack/ai adapter
  prompt: string
  parseScore: (output: string) => number
}

export function createLLMJudgeMetric(config: LLMJudgeMetricConfig): EvalMetric {
  return {
    name: config.name,
    async evaluate(params) {
      const judgePrompt = [
        config.prompt,
        `\nInput: ${params.input}`,
        `Output: ${params.output}`,
        params.expected ? `Expected: ${params.expected}` : '',
      ]
        .filter(Boolean)
        .join('\n')

      const stream = chat({
        adapter: config.adapter as never,
        messages: [{ role: 'user' as const, content: judgePrompt }],
      })

      let text = ''
      for await (const chunk of stream as AsyncIterable<{ type: string; delta?: string }>) {
        if (chunk.type === 'content' && chunk.delta) {
          text += chunk.delta
        }
      }

      const score = config.parseScore(text)
      return Math.max(0, Math.min(1, score)) // Clamp 0-1
    },
  }
}
