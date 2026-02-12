# Evaluation

Test and evaluate your agents with comprehensive metrics, datasets, LLM judges, A/B testing, and continuous evaluation pipelines.

## Overview

Evaluation is critical for building reliable agents. This guide covers systematic approaches to measuring agent performance, from unit tests through production monitoring.

**What you'll learn:**
- Evaluation metrics and frameworks
- Dataset creation and management
- LLM-as-a-judge patterns
- A/B testing strategies
- Continuous evaluation
- Regression detection

---

## Evaluation Framework

### Evaluation Dimensions

```
┌─────────────────────────────────────────┐
│                                         │
│  Correctness  │  How accurate?          │
│  Helpfulness  │  Does it solve the task?│
│  Safety       │  Any harmful outputs?   │
│  Performance  │  Speed, cost, tokens    │
│  Reliability  │  Consistent results?    │
│                                         │
└─────────────────────────────────────────┘
```

### Basic Evaluation

```typescript
import { evaluate } from '@seashore/platform'

const results = await evaluate({
  agent,
  testCases: [
    {
      input: 'What is the capital of France?',
      expectedOutput: 'Paris',
    },
    {
      input: 'Calculate 15 * 24',
      expectedOutput: '360',
    },
  ],
  metrics: ['accuracy', 'latency', 'cost'],
})

console.table(results.summary)
```

---

## Metrics

### Correctness Metrics

**Exact Match:**
```typescript
function exactMatch(predicted: string, expected: string): number {
  return predicted.trim().toLowerCase() === expected.trim().toLowerCase() 
    ? 1 
    : 0
}
```

**Fuzzy Match:**
```typescript
import { similarity } from 'string-similarity'

function fuzzyMatch(predicted: string, expected: string, threshold = 0.8): number {
  const score = similarity(predicted, expected)
  return score >= threshold ? 1 : 0
}
```

**Contains:**
```typescript
function contains(predicted: string, expected: string): number {
  return predicted.toLowerCase().includes(expected.toLowerCase()) 
    ? 1 
    : 0
}
```

**Semantic Similarity:**
```typescript
import { createEmbeddingAdapter } from '@seashore/core'

const embeddings = createEmbeddingAdapter({
  provider: 'openai',
  model: 'text-embedding-3-small',
  apiKey: process.env.OPENAI_API_KEY!,
})

async function semanticSimilarity(
  predicted: string,
  expected: string
): Promise<number> {
  const [predEmbedding, expEmbedding] = await embeddings.embedMany([
    predicted,
    expected,
  ])
  
  return cosineSimilarity(predEmbedding, expEmbedding)
}

function cosineSimilarity(a: number[], b: number[]): number {
  const dot = a.reduce((sum, val, i) => sum + val * b[i], 0)
  const normA = Math.sqrt(a.reduce((sum, val) => sum + val ** 2, 0))
  const normB = Math.sqrt(b.reduce((sum, val) => sum + val ** 2, 0))
  return dot / (normA * normB)
}
```

### Performance Metrics

```typescript
interface PerformanceMetrics {
  latency: number // ms
  tokenUsage: {
    input: number
    output: number
    total: number
  }
  cost: number // USD
  throughput: number // requests/second
}

function measurePerformance(
  startTime: number,
  endTime: number,
  tokenUsage: { input: number; output: number }
): PerformanceMetrics {
  const latency = endTime - startTime
  
  // Cost calculation (example for GPT-4)
  const inputCostPer1M = 30 // $30 per 1M input tokens
  const outputCostPer1M = 60 // $60 per 1M output tokens
  
  const cost =
    (tokenUsage.input / 1_000_000) * inputCostPer1M +
    (tokenUsage.output / 1_000_000) * outputCostPer1M
  
  return {
    latency,
    tokenUsage: {
      ...tokenUsage,
      total: tokenUsage.input + tokenUsage.output,
    },
    cost,
    throughput: 1000 / latency, // requests per second
  }
}
```

### Quality Metrics

```typescript
interface QualityMetrics {
  coherence: number // 0-1
  relevance: number // 0-1
  completeness: number // 0-1
  fluency: number // 0-1
}

async function assessQuality(
  response: string,
  query: string,
  context: string[]
): Promise<QualityMetrics> {
  // Use LLM as judge
  const assessment = await llm('gpt-4o').chat([
    {
      role: 'system',
      content: `Rate the response on these dimensions (0-1):
- Coherence: Is it logical and well-structured?
- Relevance: Does it address the query?
- Completeness: Does it fully answer the question?
- Fluency: Is it well-written?

Respond in JSON format.`,
    },
    {
      role: 'user',
      content: `Query: ${query}\n\nContext: ${context.join('\n')}\n\nResponse: ${response}`,
    },
  ])
  
  return JSON.parse(assessment.content)
}
```

---

## Test Datasets

### Dataset Structure

```typescript
interface TestCase {
  id: string
  input: {
    query: string
    context?: Record<string, any>
  }
  expectedOutput: {
    content?: string
    toolCalls?: string[]
    metadata?: Record<string, any>
  }
  category: string
  difficulty: 'easy' | 'medium' | 'hard'
}

const testDataset: TestCase[] = [
  {
    id: 'qa-001',
    input: {
      query: 'What is the capital of France?',
    },
    expectedOutput: {
      content: 'Paris',
    },
    category: 'factual',
    difficulty: 'easy',
  },
  {
    id: 'tool-001',
    input: {
      query: 'Search for the latest news about AI',
    },
    expectedOutput: {
      toolCalls: ['search_web'],
    },
    category: 'tool-use',
    difficulty: 'medium',
  },
  {
    id: 'reasoning-001',
    input: {
      query: 'If a train leaves NYC at 2pm traveling 60mph, and another leaves Chicago at 3pm traveling 70mph, when do they meet?',
    },
    expectedOutput: {
      toolCalls: ['calculator'],
    },
    category: 'reasoning',
    difficulty: 'hard',
  },
]
```

### Dataset Generation

```typescript
async function generateTestCases(
  domain: string,
  count: number
): Promise<TestCase[]> {
  const cases: TestCase[] = []
  
  for (let i = 0; i < count; i++) {
    const generated = await llm('gpt-4o').chat([
      {
        role: 'system',
        content: `Generate a test case for a ${domain} agent.
Include:
- A realistic user query
- Expected output or behavior
- Category and difficulty

Respond in JSON format.`,
      },
      {
        role: 'user',
        content: `Generate test case ${i + 1} of ${count}`,
      },
    ])
    
    const testCase = JSON.parse(generated.content)
    cases.push({
      id: `gen-${i + 1}`,
      ...testCase,
    })
  }
  
  return cases
}
```

### Dataset Management

```typescript
class TestDatasetManager {
  private dataset: TestCase[] = []
  
  async load(path: string): Promise<void> {
    const data = await fs.readFile(path, 'utf-8')
    this.dataset = JSON.parse(data)
  }
  
  async save(path: string): Promise<void> {
    await fs.writeFile(
      path,
      JSON.stringify(this.dataset, null, 2),
      'utf-8'
    )
  }
  
  add(testCase: TestCase): void {
    this.dataset.push(testCase)
  }
  
  filter(criteria: Partial<TestCase>): TestCase[] {
    return this.dataset.filter(tc => {
      return Object.entries(criteria).every(
        ([key, value]) => tc[key] === value
      )
    })
  }
  
  sample(count: number, category?: string): TestCase[] {
    let pool = category
      ? this.filter({ category } as any)
      : this.dataset
    
    return pool.sort(() => Math.random() - 0.5).slice(0, count)
  }
  
  getStats() {
    return {
      total: this.dataset.length,
      byCategory: this.groupBy('category'),
      byDifficulty: this.groupBy('difficulty'),
    }
  }
  
  private groupBy(key: keyof TestCase) {
    return this.dataset.reduce((acc, tc) => {
      const value = tc[key] as string
      acc[value] = (acc[value] || 0) + 1
      return acc
    }, {} as Record<string, number>)
  }
}
```

---

## LLM-as-a-Judge

### Basic Judge

```typescript
async function llmJudge(
  query: string,
  response: string,
  criteria: string
): Promise<{ score: number; reasoning: string }> {
  const judgment = await llm('gpt-4o').chat([
    {
      role: 'system',
      content: `You are an expert evaluator. Rate the response on a scale of 1-10 based on: ${criteria}

Provide your rating and reasoning in JSON format:
{
  "score": <1-10>,
  "reasoning": "<explanation>"
}`,
    },
    {
      role: 'user',
      content: `Query: ${query}\n\nResponse: ${response}`,
    },
  ])
  
  return JSON.parse(judgment.content)
}
```

### Multi-Criteria Judge

```typescript
interface JudgmentCriteria {
  name: string
  description: string
  weight: number
}

async function multiCriteriaJudge(
  query: string,
  response: string,
  criteria: JudgmentCriteria[]
): Promise<{ overallScore: number; breakdown: Record<string, any> }> {
  const assessments = await Promise.all(
    criteria.map(async (criterion) => {
      const result = await llmJudge(query, response, criterion.description)
      return {
        criterion: criterion.name,
        score: result.score,
        reasoning: result.reasoning,
        weight: criterion.weight,
      }
    })
  )
  
  const weightedScore = assessments.reduce(
    (sum, a) => sum + (a.score / 10) * a.weight,
    0
  )
  
  const totalWeight = criteria.reduce((sum, c) => sum + c.weight, 0)
  
  return {
    overallScore: weightedScore / totalWeight,
    breakdown: assessments,
  }
}

// Usage
const criteria: JudgmentCriteria[] = [
  {
    name: 'accuracy',
    description: 'Is the information factually correct?',
    weight: 0.4,
  },
  {
    name: 'helpfulness',
    description: 'Does it fully address the user query?',
    weight: 0.3,
  },
  {
    name: 'clarity',
    description: 'Is it clear and easy to understand?',
    weight: 0.3,
  },
]

const result = await multiCriteriaJudge(query, response, criteria)
```

### Pairwise Comparison

```typescript
async function pairwiseCompare(
  query: string,
  responseA: string,
  responseB: string
): Promise<'A' | 'B' | 'tie'> {
  const comparison = await llm('gpt-4o').chat([
    {
      role: 'system',
      content: `Compare two responses to the same query. Which is better overall?
Respond with: A, B, or tie`,
    },
    {
      role: 'user',
      content: `Query: ${query}\n\nResponse A: ${responseA}\n\nResponse B: ${responseB}`,
    },
  ])
  
  const result = comparison.content.trim().toUpperCase()
  return result === 'TIE' ? 'tie' : (result as 'A' | 'B')
}
```

---

## Running Evaluations

### Basic Evaluation Loop

```typescript
async function evaluateAgent(
  agent: ReActAgent,
  testCases: TestCase[]
): Promise<EvaluationResults> {
  const results: TestResult[] = []
  
  for (const testCase of testCases) {
    const startTime = Date.now()
    
    try {
      const response = await agent.run([
        { role: 'user', content: testCase.input.query },
      ])
      
      const endTime = Date.now()
      
      // Measure metrics
      const accuracy = await semanticSimilarity(
        response.result.content,
        testCase.expectedOutput.content || ''
      )
      
      const quality = await assessQuality(
        response.result.content,
        testCase.input.query,
        []
      )
      
      results.push({
        testCaseId: testCase.id,
        passed: accuracy > 0.8,
        metrics: {
          accuracy,
          latency: endTime - startTime,
          ...quality,
        },
        output: response.result.content,
      })
    } catch (error) {
      results.push({
        testCaseId: testCase.id,
        passed: false,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }
  
  return aggregateResults(results)
}

function aggregateResults(results: TestResult[]): EvaluationResults {
  const passed = results.filter(r => r.passed).length
  
  return {
    totalTests: results.length,
    passed,
    failed: results.length - passed,
    passRate: passed / results.length,
    averageLatency: average(results.map(r => r.metrics?.latency || 0)),
    results,
  }
}
```

### Parallel Evaluation

```typescript
async function evaluateParallel(
  agent: ReActAgent,
  testCases: TestCase[],
  concurrency = 5
): Promise<EvaluationResults> {
  const results: TestResult[] = []
  
  // Process in batches
  for (let i = 0; i < testCases.length; i += concurrency) {
    const batch = testCases.slice(i, i + concurrency)
    
    const batchResults = await Promise.all(
      batch.map(testCase => evaluateSingleCase(agent, testCase))
    )
    
    results.push(...batchResults)
    
    console.log(`Progress: ${results.length}/${testCases.length}`)
  }
  
  return aggregateResults(results)
}
```

---

## A/B Testing

### Experiment Setup

```typescript
interface Experiment {
  id: string
  variants: {
    name: string
    agent: ReActAgent
    weight: number
  }[]
  metrics: string[]
  duration: number // hours
}

class ABTester {
  private results = new Map<string, TestResult[]>()
  
  async run(experiment: Experiment, testCases: TestCase[]): Promise<ABTestResults> {
    console.log(`Starting A/B test: ${experiment.id}`)
    
    for (const variant of experiment.variants) {
      console.log(`Testing variant: ${variant.name}`)
      
      const results = await evaluateAgent(variant.agent, testCases)
      this.results.set(variant.name, results.results)
    }
    
    return this.analyze(experiment)
  }
  
  private analyze(experiment: Experiment): ABTestResults {
    const variantStats = experiment.variants.map(variant => {
      const results = this.results.get(variant.name)!
      
      return {
        variant: variant.name,
        passRate: results.filter(r => r.passed).length / results.length,
        avgLatency: average(results.map(r => r.metrics?.latency || 0)),
        avgAccuracy: average(results.map(r => r.metrics?.accuracy || 0)),
      }
    })
    
    // Statistical significance
    const baseline = variantStats[0]
    const comparisons = variantStats.slice(1).map(variant => ({
      variant: variant.name,
      passRateDelta: variant.passRate - baseline.passRate,
      latencyDelta: variant.avgLatency - baseline.avgLatency,
      significant: this.isSignificant(baseline, variant),
    }))
    
    return {
      experimentId: experiment.id,
      variantStats,
      comparisons,
      winner: this.selectWinner(variantStats),
    }
  }
  
  private isSignificant(baseline: any, variant: any): boolean {
    // Simplified significance test
    const delta = Math.abs(variant.passRate - baseline.passRate)
    return delta > 0.05 // 5% improvement threshold
  }
  
  private selectWinner(stats: any[]): string {
    return stats.reduce((best, current) =>
      current.passRate > best.passRate ? current : best
    ).variant
  }
}
```

### Running A/B Tests

```typescript
// Setup variants
const baselineAgent = createReActAgent({
  model: () => llm('gpt-4o'),
  systemPrompt: 'You are helpful.',
  tools: [searchTool],
})

const experimentalAgent = createReActAgent({
  model: () => llm('gpt-4o'),
  systemPrompt: 'You are helpful. Always verify facts before responding.',
  tools: [searchTool, factCheckTool],
  maxIterations: 15,
})

// Run experiment
const tester = new ABTester()
const results = await tester.run(
  {
    id: 'fact-checking-experiment',
    variants: [
      { name: 'baseline', agent: baselineAgent, weight: 0.5 },
      { name: 'with-fact-check', agent: experimentalAgent, weight: 0.5 },
    ],
    metrics: ['accuracy', 'latency', 'cost'],
    duration: 24,
  },
  testDataset
)

console.table(results.variantStats)
console.log('Winner:', results.winner)
```

---

## Continuous Evaluation

### Monitoring Pipeline

```typescript
class ContinuousEvaluator {
  private testSuite: TestCase[]
  private schedule: NodeJS.Timer | null = null
  
  constructor(testSuite: TestCase[]) {
    this.testSuite = testSuite
  }
  
  start(intervalMs: number, agent: ReActAgent): void {
    console.log('Starting continuous evaluation...')
    
    this.schedule = setInterval(async () => {
      try {
        const results = await evaluateAgent(agent, this.testSuite)
        
        // Log results
        await this.logResults(results)
        
        // Check for regressions
        const regressions = await this.detectRegressions(results)
        
        if (regressions.length > 0) {
          await this.alertRegression(regressions)
        }
      } catch (error) {
        console.error('Evaluation failed:', error)
      }
    }, intervalMs)
  }
  
  stop(): void {
    if (this.schedule) {
      clearInterval(this.schedule)
      this.schedule = null
    }
  }
  
  private async logResults(results: EvaluationResults): Promise<void> {
    await db.evaluations.create({
      data: {
        timestamp: new Date(),
        passRate: results.passRate,
        averageLatency: results.averageLatency,
        results: results.results,
      },
    })
  }
  
  private async detectRegressions(
    current: EvaluationResults
  ): Promise<Regression[]> {
    // Get historical baseline
    const baseline = await db.evaluations.findFirst({
      where: {
        timestamp: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      },
      orderBy: { passRate: 'desc' },
    })
    
    if (!baseline) return []
    
    const regressions: Regression[] = []
    
    // Check pass rate regression
    if (current.passRate < baseline.passRate - 0.1) {
      regressions.push({
        metric: 'passRate',
        current: current.passRate,
        baseline: baseline.passRate,
        delta: current.passRate - baseline.passRate,
      })
    }
    
    // Check latency regression
    if (current.averageLatency > baseline.averageLatency * 1.5) {
      regressions.push({
        metric: 'latency',
        current: current.averageLatency,
        baseline: baseline.averageLatency,
        delta: current.averageLatency - baseline.averageLatency,
      })
    }
    
    return regressions
  }
  
  private async alertRegression(regressions: Regression[]): Promise<void> {
    console.error('🚨 Regressions detected:', regressions)
    
    // Send alert (email, Slack, etc.)
    await notificationService.send({
      title: 'Agent Performance Regression',
      message: `Detected ${regressions.length} performance regressions`,
      details: regressions,
    })
  }
}

// Usage
const evaluator = new ContinuousEvaluator(testDataset)
evaluator.start(60 * 60 * 1000, agent) // Run every hour
```

---

## Best Practices

### Test Coverage
- [ ] Cover common use cases (80%)
- [ ] Include edge cases (15%)
- [ ] Test failure modes (5%)
- [ ] Balance difficulties

### Metrics
- [ ] Use multiple metrics
- [ ] Measure what matters to users
- [ ] Track over time
- [ ] Set thresholds for alerts

### LLM Judges
- [ ] Use powerful models (GPT-4+)
- [ ] Provide clear criteria
- [ ] Validate judges with human labels
- [ ] Use multiple judges for important tests

### Continuous Evaluation
- [ ] Run regularly (hourly/daily)
- [ ] Monitor trends
- [ ] Alert on regressions
- [ ] Version test datasets

---

## Next Steps

- **[Testing Guide](./testing.md)** - Unit and integration testing
- **[Performance Guide](./performance.md)** - Optimize agent performance
- **[Building Agents](./building-agents.md)** - Apply evaluation insights

---

## Additional Resources

- **[API Reference](/docs/api/platform.md#evaluation)** - Evaluation API
- **[Examples](/examples/)** - Evaluation examples
- **[Best Practices](/docs/best-practices)** - More guidelines
