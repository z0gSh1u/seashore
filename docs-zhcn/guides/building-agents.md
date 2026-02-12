# 构建智能体

学习如何构建生产就绪的 ReAct 智能体,包括提示工程、工具选择、迭代管理、错误处理和测试的最佳实践。

## 概述

构建有效的智能体不仅仅是将 LLM 与工具连接起来。本指南涵盖了智能体开发的完整生命周期,从初始设计到生产部署。

**你将学到:**
- 有效的系统提示模式
- 策略性工具选择和设计
- 迭代限制调优
- 错误处理策略
- 测试和调试技巧
- 性能优化

---

## 智能体架构

### ReAct 模式

ReAct 智能体遵循推理-行动循环:

```
用户查询 → 推理 → 行动(工具调用)→ 观察 → 推理 → ...
```

每次迭代包括:
1. **推理**: LLM 分析上下文并决定下一步行动
2. **行动**: 使用验证的参数调用工具
3. **观察**: 将工具结果添加到上下文中
4. **决策**: 继续迭代或返回最终答案

```typescript
import { createReActAgent } from '@seashore/agent'
import { createLLMAdapter } from '@seashore/core'

const llm = createLLMAdapter({
  provider: 'openai',
  apiKey: process.env.OPENAI_API_KEY!,
})

const agent = createReActAgent({
  model: () => llm('gpt-4o'),
  systemPrompt: 'You are a helpful assistant.',
  tools: [searchTool, calculatorTool],
  maxIterations: 10,
})
```

### 智能体组件

**核心组件:**
- **LLM 适配器**: 模型选择和配置
- **系统提示**: 行为和个性定义
- **工具**: 可用操作
- **护栏**: 安全和验证层
- **输出模式**: 结构化响应格式(可选)

---

## 系统提示工程

### 优秀提示的结构

精心设计的系统提示应包括:
1. **角色定义**: 智能体是谁?
2. **能力**: 它能做什么?
3. **限制**: 它不能做什么?
4. **行为准则**: 它应该如何行事?
5. **工具使用提示**: 何时使用哪些工具

```typescript
const systemPrompt = `你是 Acme Corp(电子商务平台)的客户支持智能体。

**你的能力:**
- 使用 search_orders 工具搜索订单历史
- 使用 get_product 工具查询产品信息
- 使用 initiate_return 工具处理退货
- 将复杂问题升级给人工支持

**准则:**
- 始终保持礼貌和专业
- 在访问订单详情前验证客户身份
- 在未检查退货政策前不要承诺退款
- 如果不确定,升级给人工支持
- 使用工具获取准确信息,而不是猜测

**工具使用:**
- 当客户提到订单号或想查询状态时使用 search_orders
- 对产品规格相关问题使用 get_product
- 仅在确认退货资格后使用 initiate_return
- 在对话中记录所有操作

记住: 客户满意度是优先事项,但要遵循公司政策。`
```

### 提示模式

**模式 1: 角色 + 规则**
```typescript
systemPrompt: `你是金融分析助手。

规则:
1. 始终引用财务数据来源
2. 不要提供投资建议
3. 所有数学运算使用计算工具
4. 货币格式为保留 2 位小数的美元
5. 警告用户市场信息可能存在延迟`
```

**模式 2: 人设 + 示例**
```typescript
systemPrompt: `你是 Alex,一个友好的技术支持智能体。

沟通风格:
- 使用随意但专业的语言
- 简单地分解技术概念
- 当用户感到沮丧时表示同理心
- 问题解决时表示庆祝

交互示例:
用户: "我的应用打不开了!"
你: "真让人沮丧!让我帮你排查一下。首先,让我们检查..."

用户: "现在能用了!"
你: "太好了!很高兴我们解决了这个问题。如果还有其他问题随时联系。"`
```

**模式 3: 任务特定指令**
```typescript
systemPrompt: `你是一个从多个来源综合信息的研究智能体。

你的工作流程:
1. 分析研究问题
2. 如果复杂则分解为子问题
3. 使用 search_academic 查找同行评审来源
4. 使用 search_web 查找时事
5. 交叉引用至少 3 个来源的信息
6. 将发现综合成连贯的摘要
7. 始终使用 [来源: URL] 格式引用来源

质量标准:
- 优先考虑最近的信息(最近 2 年)
- 标记来源之间的矛盾
- 区分事实和观点
- 注明置信度(高/中/低)`
```

### 动态系统提示

根据上下文调整提示:

```typescript
function createContextualPrompt(user: User, sessionContext: Context): string {
  const basePrompt = 'You are a helpful assistant.'
  
  const capabilities = []
  if (user.role === 'admin') {
    capabilities.push('- You can access admin tools for user management')
  }
  if (sessionContext.isEmergency) {
    capabilities.push('- Prioritize speed over thoroughness')
    capabilities.push('- Escalate immediately if needed')
  }
  
  const timeContext = `Current time: ${new Date().toISOString()}`
  const userContext = `User: ${user.name} (${user.role})`
  
  return `${basePrompt}\n\n${capabilities.join('\n')}\n\n${timeContext}\n${userContext}`
}

const agent = createReActAgent({
  model: () => llm('gpt-4o'),
  systemPrompt: createContextualPrompt(currentUser, sessionContext),
  tools: getToolsForUser(currentUser),
})
```

---

## 工具选择策略

### 选择合适的工具

**工具选择原则:**
1. **单一职责**: 每个工具只做好一件事
2. **明确边界**: 功能不重叠
3. **互补性**: 工具协同工作解决任务
4. **适当粒度**: 不要太宽泛,也不要太狭窄

```typescript
// ❌ 不好: 过于宽泛的工具
const adminTool = {
  name: 'admin_action',
  description: 'Perform admin actions',
  parameters: z.object({
    action: z.string(), // 太模糊!
    data: z.any(),
  }),
  execute: async ({ action, data }) => {
    // 工具做太多事情
  }
}

// ✅ 好: 具体、专注的工具
const listUsersTool = {
  name: 'list_users',
  description: 'List all users with optional filters',
  parameters: z.object({
    role: z.enum(['admin', 'user', 'guest']).optional(),
    limit: z.number().min(1).max(100).default(20),
  }),
  execute: async ({ role, limit }) => {
    return await db.users.findMany({
      where: role ? { role } : undefined,
      take: limit,
    })
  }
}

const deleteUserTool = {
  name: 'delete_user',
  description: 'Delete a user by ID (admin only)',
  parameters: z.object({
    userId: z.string().uuid(),
    reason: z.string().min(10),
  }),
  execute: async ({ userId, reason }) => {
    await auditLog.create({ action: 'delete_user', userId, reason })
    return await db.users.delete({ where: { id: userId } })
  }
}
```

### 工具组合

从简单工具构建复杂能力:

```typescript
// 基础工具
const searchTool = createSerperSearch({ apiKey: process.env.SERPER_API_KEY! })
const scrapeTool = createFirecrawlScrape({ apiKey: process.env.FIRECRAWL_API_KEY! })
const summarizeTool = createSummarizeTool()

// 研究智能体使用所有三个工具
const researchAgent = createReActAgent({
  model: () => llm('gpt-4o'),
  systemPrompt: `You are a research assistant.
  
  Research process:
  1. Use search_web to find relevant sources
  2. Use scrape_page to extract detailed content
  3. Use summarize to condense information
  4. Synthesize findings across multiple sources`,
  tools: [searchTool, scrapeTool, summarizeTool],
  maxIterations: 15,
})

// 客户服务智能体需要不同的工具
const supportAgent = createReActAgent({
  model: () => llm('gpt-4o'),
  systemPrompt: 'You are a customer support agent.',
  tools: [
    searchOrdersTool,
    getProductInfoTool,
    initiateReturnTool,
    sendEmailTool,
  ],
  maxIterations: 8,
})
```

### 工具命名约定

**清晰、描述性的名称帮助 LLM 正确选择:**

```typescript
// ❌ 不好: 模糊的名称
'search'        // 搜索什么? 网络、数据库、文件?
'get'           // 获取什么?
'update'        // 更新什么?

// ✅ 好: 具体的名称
'search_web'
'search_knowledge_base'
'search_user_orders'

'get_user_profile'
'get_product_details'
'get_order_status'

'update_user_email'
'update_order_address'
'update_product_stock'
```

---

## 迭代管理

### 设置最大迭代次数

**指导原则:**
- **简单问答**: 3-5 次迭代
- **研究任务**: 10-15 次迭代
- **复杂工作流**: 20+ 次迭代

```typescript
// 简单问答智能体
const qaAgent = createReActAgent({
  model: () => llm('gpt-4o-mini'),
  systemPrompt: 'Answer questions concisely.',
  tools: [searchTool],
  maxIterations: 3, // 只快速回答
})

// 深度研究智能体
const researchAgent = createReActAgent({
  model: () => llm('gpt-4o'),
  systemPrompt: 'Conduct thorough research.',
  tools: [searchTool, scrapeTool, analyzeTool],
  maxIterations: 20, // 允许深入调查
})
```

### 防止无限循环

**常见原因:**
1. 工具返回无用结果
2. 智能体误解任务
3. 工具有副作用使智能体困惑

**解决方案:**

```typescript
// 1. 确保工具返回可操作的信息
const searchTool = {
  name: 'search',
  description: 'Search for information',
  parameters: z.object({ query: z.string() }),
  execute: async ({ query }) => {
    const results = await search(query)
    
    // ❌ 不好: 空洞或模糊的响应
    if (results.length === 0) return 'No results'
    
    // ✅ 好: 为下一步提供指导
    if (results.length === 0) {
      return 'No results found. Try:\n' +
             '1. Using different keywords\n' +
             '2. Broadening the search terms\n' +
             '3. Checking spelling'
    }
    
    return results
  }
}

// 2. 在系统提示中添加迭代进度提示
systemPrompt: `You are a research assistant.

Important: Work efficiently!
- Make each tool call count
- Don't repeat failed searches
- If you've tried 3+ times without progress, summarize what you found and provide partial answer`

// 3. 跟踪工具调用历史
let callHistory: Array<{ tool: string; args: any }> = []

const monitoredTool = {
  name: 'search',
  description: 'Search for information',
  parameters: z.object({ query: z.string() }),
  execute: async ({ query }) => {
    // 检查重复调用
    const recentCalls = callHistory.slice(-3)
    const repeating = recentCalls.filter(c => 
      c.tool === 'search' && c.args.query === query
    ).length > 1
    
    if (repeating) {
      return 'You already searched for this. Try a different approach.'
    }
    
    callHistory.push({ tool: 'search', args: { query } })
    return await search(query)
  }
}
```

### 提前终止

当任务完成时优雅地停止:

```typescript
const agent = createReActAgent({
  model: () => llm('gpt-4o'),
  systemPrompt: `You are a helpful assistant.

When you have enough information to answer the user's question, provide the answer immediately. Don't continue searching unnecessarily.

Respond with your final answer when:
- You've gathered sufficient information
- The question has been fully addressed
- Additional tool calls won't improve the answer`,
  tools: [searchTool],
  maxIterations: 10,
})
```

---

## 错误处理

### 工具错误模式

**模式 1: 返回错误消息**
```typescript
const weatherTool = {
  name: 'get_weather',
  description: 'Get weather for a location',
  parameters: z.object({
    location: z.string(),
  }),
  execute: async ({ location }) => {
    try {
      const data = await weatherAPI.fetch(location)
      return `Temperature: ${data.temp}°C, Conditions: ${data.condition}`
    } catch (error) {
      // 返回有用的错误消息
      if (error.code === 'LOCATION_NOT_FOUND') {
        return `Location "${location}" not found. Please provide:\n` +
               `- A city name (e.g., "San Francisco")\n` +
               `- A zip code (e.g., "94102")\n` +
               `- Coordinates (e.g., "37.7749,-122.4194")`
      }
      
      if (error.code === 'RATE_LIMIT') {
        return 'Weather service is rate limited. Please try again in 1 minute.'
      }
      
      return 'Weather service is temporarily unavailable. Try again later.'
    }
  }
}
```

**模式 2: 使用指数退避重试**
```typescript
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelay = 1000
): Promise<T> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      if (attempt === maxRetries) throw error
      
      const delay = baseDelay * Math.pow(2, attempt)
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
  throw new Error('Retry failed')
}

const resilientTool = {
  name: 'api_call',
  description: 'Call external API',
  parameters: z.object({ endpoint: z.string() }),
  execute: async ({ endpoint }) => {
    return withRetry(() => fetch(`/api/${endpoint}`), 3, 1000)
  }
}
```

**模式 3: 回退策略**
```typescript
const searchTool = {
  name: 'search',
  description: 'Search multiple sources',
  parameters: z.object({ query: z.string() }),
  execute: async ({ query }) => {
    // 尝试主要来源
    try {
      return await searchPrimary(query)
    } catch (error) {
      console.warn('Primary search failed, trying fallback')
    }
    
    // 尝试次要来源
    try {
      return await searchSecondary(query)
    } catch (error) {
      console.warn('Secondary search failed, trying cache')
    }
    
    // 尝试缓存结果
    const cached = await getCachedResults(query)
    if (cached) {
      return `${cached} (Note: Cached results, may be outdated)`
    }
    
    return 'All search sources unavailable. Please try again later.'
  }
}
```

### 智能体级别的错误处理

```typescript
async function runAgentSafely(
  agent: ReActAgent,
  messages: Message[]
): Promise<AgentResponse | null> {
  try {
    return await agent.run(messages)
  } catch (error) {
    if (error instanceof Error) {
      // 处理特定错误类型
      if (error.message.includes('max iterations')) {
        console.error('Agent exceeded max iterations')
        return {
          result: {
            content: 'Task too complex. Breaking down into smaller steps...',
            toolCalls: [],
          },
          messages: [],
        }
      }
      
      if (error.message.includes('rate limit')) {
        console.error('Rate limited')
        await delay(60000) // 等待 1 分钟
        return runAgentSafely(agent, messages) // 重试
      }
      
      if (error.message.includes('context length')) {
        console.error('Context too large, truncating')
        const truncatedMessages = messages.slice(-10) // 保留最后 10 条
        return agent.run(truncatedMessages)
      }
    }
    
    console.error('Agent error:', error)
    return null
  }
}
```

---

## 测试智能体

### 单元测试工具

```typescript
import { describe, it, expect, vi } from 'vitest'

describe('weatherTool', () => {
  it('should return weather data for valid location', async () => {
    const result = await weatherTool.execute({
      location: 'San Francisco'
    })
    
    expect(result).toContain('Temperature:')
    expect(result).toContain('°C')
  })
  
  it('should handle invalid location gracefully', async () => {
    const result = await weatherTool.execute({
      location: 'InvalidCity123'
    })
    
    expect(result).toContain('not found')
    expect(result).toContain('Please provide')
  })
  
  it('should handle API failures', async () => {
    // 模拟 API 失败
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'))
    
    const result = await weatherTool.execute({
      location: 'San Francisco'
    })
    
    expect(result).toContain('temporarily unavailable')
  })
})
```

### 集成测试智能体

```typescript
describe('researchAgent', () => {
  it('should complete simple research task', async () => {
    const response = await agent.run([
      { role: 'user', content: 'What is the capital of France?' }
    ])
    
    expect(response.result.content).toContain('Paris')
    expect(response.result.toolCalls.length).toBeGreaterThan(0)
  })
  
  it('should not exceed max iterations', async () => {
    const response = await agent.run([
      { role: 'user', content: 'Research quantum computing' }
    ])
    
    expect(response.result.toolCalls.length).toBeLessThanOrEqual(10)
  })
  
  it('should use appropriate tools', async () => {
    const response = await agent.run([
      { role: 'user', content: 'What is the weather in Tokyo?' }
    ])
    
    const weatherCalls = response.result.toolCalls.filter(
      call => call.name === 'get_weather'
    )
    expect(weatherCalls.length).toBeGreaterThan(0)
  })
})
```

### 模拟 LLM

```typescript
import { createLLMAdapter } from '@seashore/core'

// 为测试创建模拟 LLM
function createMockLLM(responses: string[]) {
  let callCount = 0
  
  return () => ({
    chat: async () => {
      const response = responses[callCount] || responses[responses.length - 1]
      callCount++
      return { content: response }
    }
  })
}

describe('agent behavior', () => {
  it('should handle unexpected LLM responses', async () => {
    const mockLLM = createMockLLM([
      'I will use the invalid_tool',
      'Let me try search instead',
      'The answer is Paris'
    ])
    
    const agent = createReActAgent({
      model: mockLLM,
      systemPrompt: 'Answer questions',
      tools: [searchTool],
    })
    
    const response = await agent.run([
      { role: 'user', content: 'What is the capital of France?' }
    ])
    
    expect(response.result.content).toContain('Paris')
  })
})
```

---

## 性能优化

### 模型选择

```typescript
// 对简单任务使用更便宜的模型
const qaAgent = createReActAgent({
  model: () => llm('gpt-4o-mini'), // 更快、更便宜
  systemPrompt: 'Answer questions briefly',
  tools: [searchTool],
})

// 对复杂推理使用强大的模型
const researchAgent = createReActAgent({
  model: () => llm('gpt-4o'), // 更好的推理能力
  systemPrompt: 'Conduct thorough research',
  tools: [searchTool, analyzeTool],
})
```

### 并行工具调用

```typescript
// 启用并行工具执行(如果模型支持)
const agent = createReActAgent({
  model: () => llm('gpt-4o'),
  systemPrompt: `You are efficient. When multiple independent tasks are needed, list them all at once.

Example:
User: "Get weather for Tokyo, London, and Paris"
You: Call get_weather 3 times in parallel, not sequentially`,
  tools: [weatherTool],
})
```

### 响应缓存

```typescript
const responseCache = new Map<string, AgentResponse>()

async function runWithCache(
  agent: ReActAgent,
  messages: Message[]
): Promise<AgentResponse> {
  const cacheKey = JSON.stringify(messages)
  
  if (responseCache.has(cacheKey)) {
    console.log('Cache hit!')
    return responseCache.get(cacheKey)!
  }
  
  const response = await agent.run(messages)
  responseCache.set(cacheKey, response)
  
  return response
}
```

---

## 最佳实践检查清单

### 系统提示
- [ ] 明确的角色定义
- [ ] 明确的能力和限制
- [ ] 工具使用指南
- [ ] 行为期望
- [ ] 交互示例(如适用)

### 工具
- [ ] 每个工具单一职责
- [ ] 功能不重叠
- [ ] 清晰、描述性的名称
- [ ] 全面的参数描述
- [ ] 健壮的错误处理
- [ ] 输入验证
- [ ] 适当的输出格式

### 配置
- [ ] 根据任务复杂度设置适当的最大迭代次数
- [ ] 根据推理要求选择正确的模型
- [ ] 安全/合规护栏
- [ ] 结构化响应的输出模式(如需要)

### 错误处理
- [ ] 优雅降级
- [ ] 有用的错误消息
- [ ] 瞬时故障的重试逻辑
- [ ] 回退策略

### 测试
- [ ] 所有工具的单元测试
- [ ] 智能体的集成测试
- [ ] 边缘情况覆盖
- [ ] 性能基准测试

---

## 常见陷阱

### 1. 模糊的系统提示

```typescript
// ❌ 不好
systemPrompt: 'You are helpful'

// ✅ 好
systemPrompt: `You are a customer support agent for Acme Corp.

Your role:
- Help customers track orders
- Answer product questions
- Process returns within policy
- Escalate billing issues to finance team

Always:
- Verify customer identity first
- Be polite and empathetic
- Follow company policies
- Document all actions`
```

### 2. 工具太多

```typescript
// ❌ 不好: 令人不知所措
const agent = createReActAgent({
  tools: [
    tool1, tool2, tool3, tool4, tool5, tool6, tool7, tool8,
    tool9, tool10, tool11, tool12, tool13, tool14, tool15
  ] // 智能体难以选择
})

// ✅ 好: 集中的工具集
const agent = createReActAgent({
  tools: [searchTool, calculatorTool, weatherTool] // 清晰的选择
})
```

### 3. 不明确的最大迭代次数

```typescript
// ❌ 不好: 任意数字
maxIterations: 100 // 为什么是 100?

// ✅ 好: 基于任务的合理设置
maxIterations: 15 // 研究需要约 10-15 次搜索 + 综合
```

### 4. 静默工具失败

```typescript
// ❌ 不好
execute: async ({ userId }) => {
  const user = await db.user.findUnique({ where: { id: userId } })
  return user // 如果未找到则为 undefined
}

// ✅ 好
execute: async ({ userId }) => {
  const user = await db.user.findUnique({ where: { id: userId } })
  if (!user) {
    return `User ${userId} not found. Please verify the ID and try again.`
  }
  return user
}
```

---

## 下一步

- **[工具开发指南](./tool-development.md)** - 创建健壮的工具
- **[工作流编排](./workflow-orchestration.md)** - 链接多个智能体
- **[护栏指南](./guardrails.md)** - 添加安全控制
- **[评估指南](./evaluation.md)** - 测量智能体性能
- **[测试指南](./testing.md)** - 全面的测试策略

---

## 其他资源

- **[示例](/examples/basic-agent/)** - 代码示例
- **[核心概念: 智能体](/docs/core-concepts/agents.md)** - 详细的智能体文档
- **[API 参考](/docs/api/agent.md)** - 完整的 API 文档
