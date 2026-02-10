export interface EvalMetric {
  name: string
  evaluate(params: {
    input: string
    output: string
    expected?: string
    context?: string[]
  }): Promise<number>
}

export interface DatasetEntry {
  input: string
  expected?: string
  context?: string[]
}

export interface EvalSuiteConfig {
  name: string
  dataset: DatasetEntry[]
  metrics: EvalMetric[]
}

export interface EvalResults {
  overall: number
  metrics: Record<string, number>
  details: Array<{
    input: string
    output: string
    scores: Record<string, number>
  }>
}

export interface RunnableAgent {
  run(input: string): Promise<unknown>
}
