# Testing

Comprehensive testing strategies for Seashore agents including unit testing tools, integration testing agents, mocking LLMs, test fixtures, and CI/CD integration.

## Overview

Testing AI agents requires unique approaches beyond traditional software testing. This guide covers strategies for building reliable, well-tested agent systems.

**What you'll learn:**
- Unit testing tools and components
- Integration testing agents
- Mocking LLMs and external services
- Test fixtures and factories
- Snapshot testing
- CI/CD integration

---

## Testing Philosophy

### Test Pyramid for Agents

```
        ┌─────────────────┐
        │   E2E Tests     │  Few, expensive
        │   (Full agent)  │  Test user flows
        └────────┬────────┘
                 │
        ┌────────┴────────┐
        │ Integration Tests│  Some, moderate cost
        │ (Agent + Tools)  │  Test interactions
        └────────┬─────────┘
                 │
        ┌────────┴─────────┐
        │   Unit Tests      │  Many, fast, cheap
        │ (Tools, Utils)    │  Test components
        └───────────────────┘
```

### What to Test

**Unit Tests (Fast, Deterministic):**
- Tool input validation
- Tool output formatting
- Utility functions
- Prompt templates
- Data transformations

**Integration Tests (Slower, Some Variability):**
- Agent + tools interaction
- Workflow execution
- Error handling
- RAG pipelines

**End-to-End Tests (Slowest, High Variability):**
- Complete user flows
- Multi-turn conversations
- Production scenarios

---

## Unit Testing

### Testing Tools

```typescript
import { describe, it, expect, vi } from 'vitest'
import { z } from 'zod'

describe('weatherTool', () => {
  const weatherTool = {
    name: 'get_weather',
    description: 'Get current weather',
    parameters: z.object({
      location: z.string(),
      units: z.enum(['celsius', 'fahrenheit']).default('celsius'),
    }),
    execute: async ({ location, units }) => {
      const response = await fetch(
        `https://api.weather.com/v1/current?location=${location}&units=${units}`
      )
      const data = await response.json()
      return `${data.temp}°${units === 'celsius' ? 'C' : 'F'}, ${data.condition}`
    },
  }
  
  it('should fetch weather data', async () => {
    // Mock fetch
    global.fetch = vi.fn().mockResolvedValue({
      json: async () => ({ temp: 22, condition: 'sunny' }),
    })
    
    const result = await weatherTool.execute({
      location: 'San Francisco',
      units: 'celsius',
    })
    
    expect(result).toBe('22°C, sunny')
    expect(fetch).toHaveBeenCalledWith(
      'https://api.weather.com/v1/current?location=San Francisco&units=celsius'
    )
  })
  
  it('should handle API errors', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('API error'))
    
    await expect(
      weatherTool.execute({
        location: 'InvalidCity',
        units: 'celsius',
      })
    ).rejects.toThrow('API error')
  })
  
  it('should validate parameters', () => {
    expect(() =>
      weatherTool.parameters.parse({
        location: 'Tokyo',
        units: 'invalid',
      })
    ).toThrow()
  })
  
  it('should use default units', () => {
    const parsed = weatherTool.parameters.parse({
      location: 'Tokyo',
    })
    
    expect(parsed.units).toBe('celsius')
  })
})
```

### Testing Utilities

```typescript
describe('utility functions', () => {
  describe('chunkText', () => {
    it('should split text into chunks', () => {
      const text = 'a'.repeat(1500)
      const chunks = chunkText(text, 500, 100)
      
      expect(chunks).toHaveLength(3)
      expect(chunks[0].length).toBe(500)
      expect(chunks[1].length).toBe(500)
      expect(chunks[2].length).toBe(500)
    })
    
    it('should overlap chunks', () => {
      const chunks = chunkText('ABCDEFGHIJ', 5, 2)
      
      expect(chunks[0]).toBe('ABCDE')
      expect(chunks[1]).toBe('DEFGH') // DE is overlap
      expect(chunks[2]).toBe('HIJ')
    })
  })
  
  describe('cosineSimilarity', () => {
    it('should calculate similarity', () => {
      const a = [1, 2, 3]
      const b = [1, 2, 3]
      
      expect(cosineSimilarity(a, b)).toBeCloseTo(1.0)
    })
    
    it('should handle orthogonal vectors', () => {
      const a = [1, 0, 0]
      const b = [0, 1, 0]
      
      expect(cosineSimilarity(a, b)).toBeCloseTo(0.0)
    })
  })
})
```

---

## Mocking LLMs

### Simple Mock

```typescript
import { vi } from 'vitest'

function createMockLLM(responses: string[]) {
  let callCount = 0
  
  return vi.fn().mockImplementation(() => ({
    chat: async (messages: Message[]) => {
      const response = responses[callCount] || responses[responses.length - 1]
      callCount++
      
      return {
        content: response,
        usage: {
          inputTokens: 100,
          outputTokens: 50,
        },
      }
    },
  }))
}

// Usage
describe('agent with mocked LLM', () => {
  it('should handle simple query', async () => {
    const mockLLM = createMockLLM([
      'The capital of France is Paris.',
    ])
    
    const agent = createReActAgent({
      model: mockLLM,
      systemPrompt: 'You are helpful',
      tools: [],
    })
    
    const response = await agent.run([
      { role: 'user', content: 'What is the capital of France?' },
    ])
    
    expect(response.result.content).toContain('Paris')
    expect(mockLLM).toHaveBeenCalledTimes(1)
  })
})
```

### Realistic Mock

```typescript
class MockLLM {
  private responses = new Map<string, string>()
  private callHistory: Array<{ messages: Message[]; response: string }> = []
  
  // Configure responses for specific queries
  when(query: string | RegExp, response: string): this {
    const key = query instanceof RegExp ? query.source : query
    this.responses.set(key, response)
    return this
  }
  
  async chat(messages: Message[]): Promise<any> {
    const userMessage = messages[messages.length - 1].content
    
    // Find matching response
    for (const [pattern, response] of this.responses) {
      const regex = new RegExp(pattern, 'i')
      if (regex.test(userMessage)) {
        this.callHistory.push({ messages, response })
        return {
          content: response,
          usage: {
            inputTokens: this.estimateTokens(messages),
            outputTokens: this.estimateTokens([{ role: 'assistant', content: response }]),
          },
        }
      }
    }
    
    // Default response
    const defaultResponse = 'I don\'t know how to respond to that.'
    this.callHistory.push({ messages, response: defaultResponse })
    return {
      content: defaultResponse,
      usage: { inputTokens: 100, outputTokens: 20 },
    }
  }
  
  private estimateTokens(messages: Message[]): number {
    const text = messages.map(m => m.content).join(' ')
    return Math.ceil(text.length / 4)
  }
  
  getCallHistory() {
    return this.callHistory
  }
  
  reset(): void {
    this.callHistory = []
  }
}

// Usage
describe('agent with realistic mock', () => {
  let mockLLM: MockLLM
  
  beforeEach(() => {
    mockLLM = new MockLLM()
      .when('capital of france', 'The capital of France is Paris.')
      .when('weather in .*', 'I need to use the weather tool to check.')
      .when('calculate .*', 'I need to use the calculator tool.')
  })
  
  it('should use appropriate tools', async () => {
    const agent = createReActAgent({
      model: () => ({ chat: (m) => mockLLM.chat(m) }),
      systemPrompt: 'You are helpful',
      tools: [weatherTool, calculatorTool],
    })
    
    const response = await agent.run([
      { role: 'user', content: 'What is the weather in Tokyo?' },
    ])
    
    const history = mockLLM.getCallHistory()
    expect(history[0].response).toContain('weather tool')
  })
})
```

---

## Integration Testing

### Testing Agent + Tools

```typescript
describe('agent integration', () => {
  let agent: ReActAgent
  
  beforeEach(() => {
    agent = createReActAgent({
      model: () => llm('gpt-4o-mini'), // Use real or mocked LLM
      systemPrompt: 'You are a helpful assistant',
      tools: [searchTool, calculatorTool],
      maxIterations: 5,
    })
  })
  
  it('should answer factual questions', async () => {
    const response = await agent.run([
      { role: 'user', content: 'What is 15 * 24?' },
    ])
    
    expect(response.result.content).toContain('360')
    expect(response.result.toolCalls.length).toBeGreaterThan(0)
    expect(response.result.toolCalls[0].name).toBe('calculator')
  })
  
  it('should handle multi-step queries', async () => {
    const response = await agent.run([
      {
        role: 'user',
        content: 'Search for the population of Tokyo, then calculate 10% of it',
      },
    ])
    
    // Should call both tools
    const toolNames = response.result.toolCalls.map(tc => tc.name)
    expect(toolNames).toContain('search')
    expect(toolNames).toContain('calculator')
  })
  
  it('should respect max iterations', async () => {
    const response = await agent.run([
      { role: 'user', content: 'Complex query requiring many steps' },
    ])
    
    expect(response.result.toolCalls.length).toBeLessThanOrEqual(5)
  })
})
```

### Testing Workflows

```typescript
describe('workflow integration', () => {
  it('should execute steps in order', async () => {
    const executionOrder: string[] = []
    
    const stepA = createStep({
      name: 'stepA',
      execute: async () => {
        executionOrder.push('A')
        return { data: 'A' }
      },
    })
    
    const stepB = createStep({
      name: 'stepB',
      execute: async (context) => {
        executionOrder.push('B')
        expect(context.stepA.data).toBe('A')
        return { data: 'B' }
      },
    })
    
    const workflow = createWorkflow({
      name: 'test-workflow',
      steps: [stepA, stepB],
      edges: [{ from: 'stepA', to: 'stepB' }],
    })
    
    await workflow.run({})
    
    expect(executionOrder).toEqual(['A', 'B'])
  })
  
  it('should handle conditional branches', async () => {
    const executed: string[] = []
    
    const workflow = createWorkflow({
      name: 'conditional-workflow',
      steps: [
        createStep({
          name: 'check',
          execute: async () => ({ condition: true }),
        }),
        createStep({
          name: 'branchA',
          execute: async () => {
            executed.push('A')
            return {}
          },
        }),
        createStep({
          name: 'branchB',
          execute: async () => {
            executed.push('B')
            return {}
          },
        }),
      ],
      edges: [
        {
          from: 'check',
          to: 'branchA',
          condition: (ctx) => ctx.check.condition,
        },
        {
          from: 'check',
          to: 'branchB',
          condition: (ctx) => !ctx.check.condition,
        },
      ],
    })
    
    await workflow.run({})
    
    expect(executed).toEqual(['A']) // Only A executed
  })
})
```

---

## Test Fixtures

### Factory Pattern

```typescript
class AgentFactory {
  static createBasic(overrides?: Partial<ReActAgentConfig>): ReActAgent {
    return createReActAgent({
      model: () => llm('gpt-4o-mini'),
      systemPrompt: 'You are helpful',
      tools: [],
      maxIterations: 5,
      ...overrides,
    })
  }
  
  static createWithTools(tools: Tool[]): ReActAgent {
    return this.createBasic({ tools })
  }
  
  static createResearch(): ReActAgent {
    return this.createBasic({
      systemPrompt: 'You are a research assistant',
      tools: [searchTool, scrapeTool],
      maxIterations: 10,
    })
  }
  
  static createCustomerService(): ReActAgent {
    return this.createBasic({
      systemPrompt: 'You are a customer service agent',
      tools: [searchOrdersTool, getProductInfoTool],
      maxIterations: 8,
    })
  }
}

// Usage
describe('agent tests', () => {
  it('should create basic agent', () => {
    const agent = AgentFactory.createBasic()
    expect(agent).toBeDefined()
  })
  
  it('should create research agent', () => {
    const agent = AgentFactory.createResearch()
    expect(agent.tools.length).toBeGreaterThan(0)
  })
})
```

### Message Fixtures

```typescript
class MessageFactory {
  static user(content: string): Message {
    return { role: 'user', content }
  }
  
  static assistant(content: string): Message {
    return { role: 'assistant', content }
  }
  
  static system(content: string): Message {
    return { role: 'system', content }
  }
  
  static conversation(...exchanges: Array<[string, string]>): Message[] {
    return exchanges.flatMap(([user, assistant]) => [
      this.user(user),
      this.assistant(assistant),
    ])
  }
}

// Usage
describe('conversation tests', () => {
  it('should handle multi-turn conversation', async () => {
    const messages = [
      ...MessageFactory.conversation(
        ['What is 2+2?', '2+2 is 4'],
        ['What about 3+3?', '3+3 is 6']
      ),
      MessageFactory.user('What about 4+4?'),
    ]
    
    const response = await agent.run(messages)
    expect(response.result.content).toContain('8')
  })
})
```

---

## Snapshot Testing

### Response Snapshots

```typescript
import { expect } from 'vitest'

describe('agent snapshots', () => {
  it('should match expected response structure', async () => {
    const response = await agent.run([
      MessageFactory.user('What is the capital of France?'),
    ])
    
    // Snapshot the structure (not exact content)
    expect({
      hasContent: response.result.content.length > 0,
      toolCallCount: response.result.toolCalls.length,
      messageCount: response.messages.length,
    }).toMatchSnapshot()
  })
  
  it('should have stable tool call structure', async () => {
    const response = await agent.run([
      MessageFactory.user('Calculate 15 * 24'),
    ])
    
    const toolCall = response.result.toolCalls[0]
    
    expect({
      name: toolCall.name,
      argumentKeys: Object.keys(toolCall.arguments),
    }).toMatchSnapshot()
  })
})
```

---

## Performance Testing

### Latency Testing

```typescript
describe('performance', () => {
  it('should respond within time limit', async () => {
    const start = Date.now()
    
    await agent.run([
      MessageFactory.user('Quick question: what is 2+2?'),
    ])
    
    const duration = Date.now() - start
    expect(duration).toBeLessThan(5000) // 5 seconds
  })
  
  it('should handle concurrent requests', async () => {
    const requests = Array.from({ length: 10 }, (_, i) =>
      agent.run([MessageFactory.user(`Question ${i}`)])
    )
    
    const start = Date.now()
    await Promise.all(requests)
    const duration = Date.now() - start
    
    // Should complete in reasonable time
    expect(duration).toBeLessThan(30000) // 30 seconds for 10 requests
  })
})
```

### Load Testing

```typescript
import { loadTest } from './test-utils.js'

describe('load tests', () => {
  it('should handle sustained load', async () => {
    const results = await loadTest({
      agent,
      requestsPerSecond: 10,
      duration: 60000, // 1 minute
      messages: [MessageFactory.user('Test query')],
    })
    
    expect(results.successRate).toBeGreaterThan(0.95) // 95% success
    expect(results.p95Latency).toBeLessThan(3000) // p95 < 3s
  })
})
```

---

## CI/CD Integration

### GitHub Actions

```yaml
# .github/workflows/test.yml
name: Test

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'
      
      - name: Install pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 8
      
      - name: Install dependencies
        run: pnpm install
      
      - name: Run tests
        run: pnpm test
        env:
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
```

### Test Configuration

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.test.ts',
        'src/**/*.spec.ts',
        'src/**/types.ts',
      ],
    },
    testTimeout: 30000, // 30s for integration tests
  },
})
```

---

## Best Practices

### Unit Tests
- [ ] Test tool validation logic
- [ ] Test utility functions
- [ ] Mock external dependencies
- [ ] Fast (<100ms per test)
- [ ] Deterministic results

### Integration Tests
- [ ] Test agent + tool interactions
- [ ] Test error handling
- [ ] Test edge cases
- [ ] Moderate speed (<5s per test)
- [ ] Use realistic scenarios

### E2E Tests
- [ ] Test complete user flows
- [ ] Test multi-turn conversations
- [ ] Test production configurations
- [ ] Slower (<30s per test)
- [ ] Focus on critical paths

### General
- [ ] Descriptive test names
- [ ] Arrange-Act-Assert pattern
- [ ] Independent tests (no shared state)
- [ ] Clean up after tests
- [ ] Run in CI/CD

---

## Test Coverage

### Measuring Coverage

```bash
# Run tests with coverage
pnpm test --coverage

# View coverage report
open coverage/index.html
```

### Coverage Goals

**Minimum targets:**
- Tools: 90% coverage
- Utilities: 90% coverage
- Agents: 70% coverage (harder to test deterministically)
- Workflows: 80% coverage

---

## Common Pitfalls

### 1. Testing LLM Output Directly

```typescript
// ❌ BAD: Brittle, fails on minor wording changes
expect(response.result.content).toBe('The capital of France is Paris.')

// ✅ GOOD: Flexible, tests intent
expect(response.result.content.toLowerCase()).toContain('paris')
```

### 2. Not Mocking External Services

```typescript
// ❌ BAD: Relies on external API
const result = await fetch('https://api.example.com/data')

// ✅ GOOD: Mock external calls
global.fetch = vi.fn().mockResolvedValue({ json: async () => mockData })
```

### 3. Shared Test State

```typescript
// ❌ BAD: Tests affect each other
let agent: ReActAgent

describe('tests', () => {
  it('test 1', async () => {
    agent = createReActAgent(...)
    // mutates agent
  })
  
  it('test 2', async () => {
    // uses mutated agent!
  })
})

// ✅ GOOD: Isolated state
describe('tests', () => {
  beforeEach(() => {
    agent = createReActAgent(...)
  })
  
  it('test 1', async () => {
    // fresh agent
  })
  
  it('test 2', async () => {
    // fresh agent
  })
})
```

---

## Next Steps

- **[Evaluation](./evaluation.md)** - Beyond testing: continuous evaluation
- **[Error Handling](./error-handling.md)** - Test error scenarios
- **[Performance](./performance.md)** - Performance testing

---

## Additional Resources

- **[Vitest Documentation](https://vitest.dev/)** - Test framework
- **[Testing Library](https://testing-library.com/)** - Testing utilities
- **[Examples](/examples/)** - Test examples
- **[CI/CD Best Practices](/docs/ci-cd)** - Deployment testing
