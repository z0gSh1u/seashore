import type { EvalSuiteConfig, EvalResults, RunnableAgent } from './types.js'

export function createEvalSuite(config: EvalSuiteConfig) {
  return {
    name: config.name,

    async run(agent: RunnableAgent): Promise<EvalResults> {
      const details: EvalResults['details'] = []
      const metricTotals: Record<string, number> = {}
      const metricCounts: Record<string, number> = {}

      for (const metric of config.metrics) {
        metricTotals[metric.name] = 0
        metricCounts[metric.name] = 0
      }

      for (const entry of config.dataset) {
        const rawOutput = await agent.run(entry.input)
        const output = typeof rawOutput === 'string' ? rawOutput : JSON.stringify(rawOutput)

        const scores: Record<string, number> = {}

        for (const metric of config.metrics) {
          const score = await metric.evaluate({
            input: entry.input,
            output,
            expected: entry.expected,
            context: entry.context,
          })
          scores[metric.name] = score
          metricTotals[metric.name] = (metricTotals[metric.name] ?? 0) + score
          metricCounts[metric.name] = (metricCounts[metric.name] ?? 0) + 1
        }

        details.push({ input: entry.input, output, scores })
      }

      const metrics: Record<string, number> = {}
      let overallTotal = 0
      let overallCount = 0

      for (const [name, total] of Object.entries(metricTotals)) {
        const count = metricCounts[name] ?? 1
        const avg = total / count
        metrics[name] = avg
        overallTotal += avg
        overallCount++
      }

      return {
        overall: overallCount > 0 ? overallTotal / overallCount : 0,
        metrics,
        details,
      }
    },
  }
}
