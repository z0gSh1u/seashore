# 测试

Seashore 智能体的全面测试策略，包括单元测试工具、集成测试智能体、模拟 LLM、测试固件和 CI/CD 集成。

## 概述

测试 AI 智能体需要超越传统软件测试的独特方法。本指南涵盖构建可靠、经过充分测试的智能体系统的策略。

**您将学到：**
- 单元测试工具和组件
- 集成测试智能体
- 模拟 LLM 和外部服务
- 测试固件和工厂
- 快照测试
- CI/CD 集成

---

## 测试理念

### 智能体的测试金字塔

```
        ┌─────────────────┐
        │   E2E Tests     │  少量，昂贵
        │   (完整智能体)   │  测试用户流程
        └────────┬────────┘
                 │
        ┌────────┴────────┐
        │ Integration Tests│  一些，中等成本
        │ (智能体 + 工具)  │  测试交互
        └────────┬─────────┘
                 │
        ┌────────┴─────────┐
        │   Unit Tests      │  大量，快速，廉价
        │ (工具、实用程序)  │  测试组件
        └───────────────────┘
```

### 测试什么

**单元测试（快速、确定性）：**
- 工具输入验证
- 工具输出格式化
- 实用函数
- 提示模板
- 数据转换

**集成测试（较慢、一些变化）：**
- 智能体 + 工具交互
- 工作流执行
- 错误处理
- RAG 管道

**端到端测试（最慢、高变化性）：**
- 完整用户流程
- 多轮对话
- 生产场景

---

## 单元测试

### 测试工具

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
    // 模拟 fetch
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

### 测试实用程序

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
      expect(chunks[1]).toBe('DEFGH') // DE 是重叠
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

## 模拟 LLM

### 简单模拟

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

// 用法
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

### 现实模拟

```typescript
class MockLLM {
  private responses = new Map<string, string>()
  private callHistory: Array<{ messages: Message[]; response: string }> = []
  
  // 为特定查询配置响应
  when(query: string | RegExp, response: string): this {
    const key = query instanceof RegExp ? query.source : query
    this.responses.set(key, response)
    return this
  }
  
  async chat(messages: Message[]): Promise<any> {
    const userMessage = messages[messages.length - 1].content
    
    // 查找匹配的响应
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
    
    // 默认响应
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

// 用法
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

## 集成测试

### 测试智能体 + 工具

```typescript
describe('agent integration', () => {
  let agent: ReActAgent
  
  beforeEach(() => {
    agent = createReActAgent({
      model: () => llm('gpt-4o-mini'), // 使用真实或模拟 LLM
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
    
    // 应该调用两个工具
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

### 测试工作流

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
    
    expect(executed).toEqual(['A']) // 只执行 A
  })
})
```

---

## 测试固件

### 工厂模式

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

// 用法
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

### 消息固件

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

// 用法
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

## 快照测试

### 响应快照

```typescript
import { expect } from 'vitest'

describe('agent snapshots', () => {
  it('should match expected response structure', async () => {
    const response = await agent.run([
      MessageFactory.user('What is the capital of France?'),
    ])
    
    // 快照结构（而非确切内容）
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

## 性能测试

### 延迟测试

```typescript
describe('performance', () => {
  it('should respond within time limit', async () => {
    const start = Date.now()
    
    await agent.run([
      MessageFactory.user('Quick question: what is 2+2?'),
    ])
    
    const duration = Date.now() - start
    expect(duration).toBeLessThan(5000) // 5 秒
  })
  
  it('should handle concurrent requests', async () => {
    const requests = Array.from({ length: 10 }, (_, i) =>
      agent.run([MessageFactory.user(`Question ${i}`)])
    )
    
    const start = Date.now()
    await Promise.all(requests)
    const duration = Date.now() - start
    
    // 应在合理时间内完成
    expect(duration).toBeLessThan(30000) // 10 个请求 30 秒
  })
})
```

### 负载测试

```typescript
import { loadTest } from './test-utils.js'

describe('load tests', () => {
  it('should handle sustained load', async () => {
    const results = await loadTest({
      agent,
      requestsPerSecond: 10,
      duration: 60000, // 1 分钟
      messages: [MessageFactory.user('Test query')],
    })
    
    expect(results.successRate).toBeGreaterThan(0.95) // 95% 成功
    expect(results.p95Latency).toBeLessThan(3000) // p95 < 3s
  })
})
```

---

## CI/CD 集成

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

### 测试配置

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
    testTimeout: 30000, // 集成测试 30 秒
  },
})
```

---

## 最佳实践

### 单元测试
- [ ] 测试工具验证逻辑
- [ ] 测试实用函数
- [ ] 模拟外部依赖
- [ ] 快速（<100ms 每个测试）
- [ ] 确定性结果

### 集成测试
- [ ] 测试智能体 + 工具交互
- [ ] 测试错误处理
- [ ] 测试边缘情况
- [ ] 中等速度（<5s 每个测试）
- [ ] 使用现实场景

### E2E 测试
- [ ] 测试完整用户流程
- [ ] 测试多轮对话
- [ ] 测试生产配置
- [ ] 较慢（<30s 每个测试）
- [ ] 专注于关键路径

### 一般
- [ ] 描述性测试名称
- [ ] 安排-执行-断言模式
- [ ] 独立测试（无共享状态）
- [ ] 测试后清理
- [ ] 在 CI/CD 中运行

---

## 测试覆盖率

### 测量覆盖率

```bash
# 运行带覆盖率的测试
pnpm test --coverage

# 查看覆盖率报告
open coverage/index.html
```

### 覆盖率目标

**最低目标：**
- 工具：90% 覆盖率
- 实用程序：90% 覆盖率
- 智能体：70% 覆盖率（更难确定性测试）
- 工作流：80% 覆盖率

---

## 常见陷阱

### 1. 直接测试 LLM 输出

```typescript
// ❌ 错误：脆弱，在细微措辞变化时失败
expect(response.result.content).toBe('The capital of France is Paris.')

// ✅ 正确：灵活，测试意图
expect(response.result.content.toLowerCase()).toContain('paris')
```

### 2. 不模拟外部服务

```typescript
// ❌ 错误：依赖外部 API
const result = await fetch('https://api.example.com/data')

// ✅ 正确：模拟外部调用
global.fetch = vi.fn().mockResolvedValue({ json: async () => mockData })
```

### 3. 共享测试状态

```typescript
// ❌ 错误：测试相互影响
let agent: ReActAgent

describe('tests', () => {
  it('test 1', async () => {
    agent = createReActAgent(...)
    // 改变智能体
  })
  
  it('test 2', async () => {
    // 使用改变的智能体！
  })
})

// ✅ 正确：隔离状态
describe('tests', () => {
  beforeEach(() => {
    agent = createReActAgent(...)
  })
  
  it('test 1', async () => {
    // 新智能体
  })
  
  it('test 2', async () => {
    // 新智能体
  })
})
```

---

## 下一步

- **[评估](./evaluation.md)** - 超越测试：持续评估
- **[错误处理](./error-handling.md)** - 测试错误场景
- **[性能](./performance.md)** - 性能测试

---

## 其他资源

- **[Vitest 文档](https://vitest.dev/)** - 测试框架
- **[Testing Library](https://testing-library.com/)** - 测试实用程序
- **[示例](/examples/)** - 测试示例
- **[CI/CD 最佳实践](/docs/ci-cd)** - 部署测试
