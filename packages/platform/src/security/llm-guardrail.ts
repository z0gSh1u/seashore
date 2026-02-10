import { chat } from '@tanstack/ai'
import type { Guardrail, GuardrailResult } from './guardrail.js'

export interface LLMGuardrailConfig {
  name: string
  adapter: unknown // @tanstack/ai adapter
  prompt: string
  parseResult: (output: string) => GuardrailResult
}

export function createLLMGuardrail(config: LLMGuardrailConfig): Guardrail {
  return {
    name: config.name,
    async afterResponse(response: unknown): Promise<GuardrailResult> {
      const judgment = await chat({
        adapter: config.adapter as never,
        messages: [
          {
            role: 'user' as const,
            content: `${config.prompt}\n\nContent to evaluate:\n${String(response)}`,
          },
        ],
      })

      // Extract text from the stream
      let text = ''
      for await (const chunk of judgment as AsyncIterable<{ type: string; delta?: string }>) {
        if (chunk.type === 'content' && chunk.delta) {
          text += chunk.delta
        }
      }

      return config.parseResult(text)
    },
  }
}
