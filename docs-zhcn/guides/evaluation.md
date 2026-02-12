# 评估

使用全面的指标、数据集、LLM 评判、A/B 测试和持续评估管道来测试和评估您的智能体。

## 概述

评估对于构建可靠的智能体至关重要。本指南涵盖了从单元测试到生产监控的系统化方法来衡量智能体性能。

**您将学到：**
- 评估指标和框架
- 数据集创建和管理
- LLM 作为评判的模式
- A/B 测试策略
- 持续评估
- 回归检测

---

## 评估框架

### 评估维度

```
┌─────────────────────────────────────────┐
│                                         │
│  Correctness  │  准确度如何？            │
│  Helpfulness  │  是否解决了任务？        │
│  Safety       │  是否有有害输出？        │
│  Performance  │  速度、成本、令牌数      │
│  Reliability  │  结果是否一致？          │
│                                         │
└─────────────────────────────────────────┘
```

### 基础评估

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

## 指标

### 正确性指标

**精确匹配：**
```typescript
function exactMatch(predicted: string, expected: string): number {
  return predicted.trim().toLowerCase() === expected.trim().toLowerCase() 
    ? 1 
    : 0
}
```

**模糊匹配：**
```typescript
import { similarity } from 'string-similarity'

function fuzzyMatch(predicted: string, expected: string, threshold = 0.8): number {
  const score = similarity(predicted, expected)
  return score >= threshold ? 1 : 0
}
```

**包含：**
```typescript
function contains(predicted: string, expected: string): number {
  return predicted.toLowerCase().includes(expected.toLowerCase()) 
    ? 1 
    : 0
}
```

**语义相似度：**
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

### 性能指标

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
  
  // 成本计算（GPT-4 示例）
  const inputCostPer1M = 30 // 每 100 万输入令牌 $30
  const outputCostPer1M = 60 // 每 100 万输出令牌 $60
  
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
    throughput: 1000 / latency, // 每秒请求数
  }
}
```

### 质量指标

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
  // 使用 LLM 作为评判
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

## 测试数据集

### 数据集结构

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

### 数据集生成

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

### 数据集管理

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

## LLM 作为评判

### 基础评判

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

### 多标准评判

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

// 用法
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

### 成对比较

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

## 运行评估

### 基础评估循环

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
      
      // 测量指标
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

### 并行评估

```typescript
async function evaluateParallel(
  agent: ReActAgent,
  testCases: TestCase[],
  concurrency = 5
): Promise<EvaluationResults> {
  const results: TestResult[] = []
  
  // 批量处理
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

## A/B 测试

### 实验设置

```typescript
interface Experiment {
  id: string
  variants: {
    name: string
    agent: ReActAgent
    weight: number
  }[]
  metrics: string[]
  duration: number // 小时
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
    
    // 统计显著性
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
    // 简化的显著性测试
    const delta = Math.abs(variant.passRate - baseline.passRate)
    return delta > 0.05 // 5% 改进阈值
  }
  
  private selectWinner(stats: any[]): string {
    return stats.reduce((best, current) =>
      current.passRate > best.passRate ? current : best
    ).variant
  }
}
```

### 运行 A/B 测试

```typescript
// 设置变体
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

// 运行实验
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

## 持续评估

### 监控管道

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
        
        // 记录结果
        await this.logResults(results)
        
        // 检查回归
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
    // 获取历史基准
    const baseline = await db.evaluations.findFirst({
      where: {
        timestamp: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      },
      orderBy: { passRate: 'desc' },
    })
    
    if (!baseline) return []
    
    const regressions: Regression[] = []
    
    // 检查通过率回归
    if (current.passRate < baseline.passRate - 0.1) {
      regressions.push({
        metric: 'passRate',
        current: current.passRate,
        baseline: baseline.passRate,
        delta: current.passRate - baseline.passRate,
      })
    }
    
    // 检查延迟回归
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
    
    // 发送警报（电子邮件、Slack 等）
    await notificationService.send({
      title: 'Agent Performance Regression',
      message: `Detected ${regressions.length} performance regressions`,
      details: regressions,
    })
  }
}

// 用法
const evaluator = new ContinuousEvaluator(testDataset)
evaluator.start(60 * 60 * 1000, agent) // 每小时运行一次
```

---

## 最佳实践

### 测试覆盖
- [ ] 覆盖常见用例（80%）
- [ ] 包括边缘情况（15%）
- [ ] 测试失败模式（5%）
- [ ] 平衡难度

### 指标
- [ ] 使用多个指标
- [ ] 测量对用户重要的内容
- [ ] 随时间跟踪
- [ ] 设置警报阈值

### LLM 评判
- [ ] 使用强大的模型（GPT-4+）
- [ ] 提供明确的标准
- [ ] 使用人工标签验证评判
- [ ] 对重要测试使用多个评判

### 持续评估
- [ ] 定期运行（每小时/每天）
- [ ] 监控趋势
- [ ] 回归时发出警报
- [ ] 版本化测试数据集

---

## 下一步

- **[测试指南](./testing.md)** - 单元和集成测试
- **[性能指南](./performance.md)** - 优化智能体性能
- **[构建智能体](./building-agents.md)** - 应用评估见解

---

## 其他资源

- **[API 参考](/docs/api/platform.md#evaluation)** - 评估 API
- **[示例](/examples/)** - 评估示例
- **[最佳实践](/docs/best-practices)** - 更多指南
