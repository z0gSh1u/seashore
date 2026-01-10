# Evaluation

Measure and improve your agent's performance with comprehensive evaluation tools.

## Basic Evaluation

Evaluate agent outputs against expected results:

```typescript
import { createEvaluator, evaluateBatch } from '@seashore/evaluation'

// Create evaluator
const evaluator = createEvaluator({
  metrics: [
    relevanceMetric({ threshold: 0.7 }),
    coherenceMetric({ threshold: 0.6 }),
  ],
  llmAdapter: {
    generate: async (prompt) => {
      const result = await model.chat({ messages: [{ role: 'user', content: prompt }] })
      return result.content
    },
  },
})

// Define test cases
const testCases = [
  {
    id: 'test-1',
    input: 'What is TypeScript?',
    output: await agent.run('What is TypeScript?').content,
    reference: 'TypeScript is a typed superset of JavaScript.',
  },
  {
    id: 'test-2',
    input: 'Explain React',
    output: await agent.run('Explain React').content,
    reference: 'React is a library for building user interfaces.',
  },
]

// Evaluate
const results = await evaluateBatch({
  evaluator,
  testCases,
  onProgress: (completed, total) => {
    console.log(`Progress: ${completed}/${total}`)
  },
})

console.log(results)
// {
//   results: [...],
//   passedCount: 2,
//   failedCount: 0,
//   passRate: 1.0,
//   overallAverage: 0.85
// }
```

## Built-in Metrics

### Relevance Metric

Measures how well the output addresses the input:

```typescript
import { relevanceMetric } from '@seashore/evaluation'

const metric = relevanceMetric({
  threshold: 0.7,
  weight: 1.0,
})

const result = await metric.evaluate(
  'What is TypeScript?',
  'TypeScript is a typed superset of JavaScript.',
  'TypeScript is a typed superset of JavaScript.'
)
```

### Coherence Metric

Measures logical consistency:

```typescript
import { coherenceMetric } from '@seashore/evaluation'

const metric = coherenceMetric({
  threshold: 0.6,
  weight: 0.8,
})
```

### Custom Rule Metric

```typescript
import { customMetric } from '@seashore/evaluation'

const metric = customMetric({
  name: 'length_check',
  description: 'Check if output length is appropriate',
  type: 'rule',
  threshold: 0.8,
  evaluate: (input, output, reference) => {
    const length = output.length
    const passed = length >= 10 && length <= 500
    return {
      score: passed ? 1.0 : 0.5,
      reason: passed ? 'Length appropriate' : `Length: ${length}`,
    }
  },
})
```

## Datasets

Manage test datasets:

```typescript
import { createDataset } from '@seashore/evaluation'

const dataset = createDataset({
  name: 'qa-dataset',
  description: 'Q&A test cases',
  testCases: [
    {
      id: 'qa-1',
      input: 'What is TypeScript?',
      reference: 'TypeScript is a typed superset of JavaScript.',
      metadata: { category: 'basics' },
    },
    // ... more cases
  ],
})

// Add cases
dataset.addCase({
  id: 'qa-2',
  input: 'What is React?',
  reference: 'React is a UI library.',
})

// Filter cases
const basics = dataset.filter((testCase) => testCase.metadata?.category === 'basics')

// Shuffle for random testing
const shuffled = dataset.shuffle()
```

## A/B Testing

Compare different agent configurations:

```typescript
import { compareAgents } from '@seashore/evaluation'

const agentA = createAgent({
  name: 'agent-a',
  model: openaiText('gpt-4o'),
  systemPrompt: 'You are concise.',
})

const agentB = createAgent({
  name: 'agent-b',
  model: openaiText('gpt-4o'),
  systemPrompt: 'You are detailed.',
})

const comparison = await compareAgents({
  agents: { 'Agent A': agentA, 'Agent B': agentB },
  testCases: dataset.testCases,
  metrics: [relevanceMetric(), coherenceMetric()],
})

console.log(comparison)
// {
//   winner: 'Agent A',
//   scores: {
//     'Agent A': { relevance: 0.85, coherence: 0.82 },
//     'Agent B': { relevance: 0.78, coherence: 0.88 }
//   }
// }
```

## Human Evaluation

Collect human feedback:

```typescript
import { createHumanEvaluator } from '@seashore/evaluation'

const humanEval = createHumanEvaluator({
  criteria: ['accuracy', 'helpfulness', 'clarity'],
  scale: 1-5,
})

const task = await humanEval.createTask({
  input: 'What is TypeScript?',
  output: 'TypeScript is a typed superset of JavaScript.',
  reference: 'TypeScript adds types to JavaScript.',
})

// Get feedback URL
console.log(task.feedbackUrl)
// Human reviews at this URL

// Get results
const results = await humanEval.getResults(task.id)
// {
//   accuracy: 4.5,
//   helpfulness: 4.8,
//   clarity: 4.2,
//   average: 4.5
// }
```

## Continuous Evaluation

Run evaluation on a schedule:

```typescript
import { scheduleEvaluation } from '@seashore/evaluation'

// Run daily
scheduleEvaluation({
  evaluator,
  dataset,
  schedule: '0 0 * * *', // Cron expression
  onResults: async (results) => {
    // Log results
    console.log('Daily evaluation:', results)

    // Send to monitoring
    await sendToMonitoring(results)

    // Check for regressions
    if (results.passRate < 0.9) {
      await sendAlert('Pass rate below 90%')
    }
  },
})
```

## Evaluation Reports

Generate detailed reports:

```typescript
import { generateReport } from '@seashore/evaluation'

const report = await generateReport({
  results,
  format: 'html', // 'html', 'json', 'markdown'
})

console.log(report.html)
// Generates a detailed HTML report with:
// - Overall statistics
// - Per-test breakdown
// - Metric comparisons
// - Visualizations
```

## Best Practices

1. **Diverse Datasets** — Test with varied inputs
2. **Reference Outputs** — Include high-quality reference answers
3. **Multiple Metrics** — Use different metrics for different aspects
4. **Regular Testing** — Run evaluations continuously
5. **Human Review** — Combine automated with human evaluation
6. **Regression Testing** — Track performance over time

## Next Steps

- [Guardrails](./guardrails.md) — Add safety to agents
- [Observability](../integrations/observability.md) — Monitor in production
