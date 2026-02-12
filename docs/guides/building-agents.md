# Building Agents

Learn how to build production-ready ReAct agents with best practices for prompt engineering, tool selection, iteration management, error handling, and testing.

## Overview

Building effective agents requires more than just wiring up an LLM with tools. This guide covers the complete lifecycle of agent development, from initial design through production deployment.

**What you'll learn:**
- Effective system prompt patterns
- Strategic tool selection and design
- Iteration limit tuning
- Error handling strategies
- Testing and debugging techniques
- Performance optimization

---

## Agent Architecture

### The ReAct Pattern

ReAct agents follow a reasoning-action cycle:

```
User Query → Reasoning → Action (Tool Call) → Observation → Reasoning → ...
```

Each iteration involves:
1. **Reasoning**: LLM analyzes context and decides next action
2. **Action**: Tool is called with validated parameters
3. **Observation**: Tool result is added to context
4. **Decision**: Continue iterating or return final answer

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

### Agent Components

**Core components:**
- **LLM adapter**: Model selection and configuration
- **System prompt**: Behavior and personality definition
- **Tools**: Available actions
- **Guardrails**: Safety and validation layers
- **Output schema**: Structured response format (optional)

---

## System Prompt Engineering

### Anatomy of a Good Prompt

A well-crafted system prompt should include:
1. **Role definition**: Who is the agent?
2. **Capabilities**: What can it do?
3. **Limitations**: What can't it do?
4. **Behavioral guidelines**: How should it act?
5. **Tool usage hints**: When to use which tools

```typescript
const systemPrompt = `You are a customer support agent for Acme Corp, an e-commerce platform.

**Your Capabilities:**
- Search order history using search_orders tool
- Look up product information using get_product tool
- Process returns using initiate_return tool
- Escalate complex issues to human support

**Guidelines:**
- Always be polite and professional
- Verify customer identity before accessing order details
- Never promise refunds without checking return policy
- If unsure, escalate to human support
- Use tools to get accurate information rather than guessing

**Tool Usage:**
- Use search_orders when customer mentions an order number or wants to check status
- Use get_product for questions about product specifications
- Use initiate_return only after confirming return eligibility
- Document all actions in the conversation

Remember: Customer satisfaction is the priority, but follow company policies.`
```

### Prompt Patterns

**Pattern 1: Role + Rules**
```typescript
systemPrompt: `You are a financial analyst assistant.

Rules:
1. Always cite sources for financial data
2. Never provide investment advice
3. Use calculation tools for all math operations
4. Format currency as USD with 2 decimals
5. Warn users about data lag in market information`
```

**Pattern 2: Persona + Examples**
```typescript
systemPrompt: `You are Alex, a friendly tech support agent.

Communication style:
- Use casual but professional language
- Break down technical concepts simply
- Show empathy when users are frustrated
- Celebrate when problems are solved

Example interactions:
User: "My app won't open!"
You: "That's frustrating! Let me help you troubleshoot. First, let's check..."

User: "It works now!"
You: "Awesome! Glad we got that sorted. Feel free to reach out if anything else comes up."`
```

**Pattern 3: Task-Specific Instructions**
```typescript
systemPrompt: `You are a research agent that synthesizes information from multiple sources.

Your workflow:
1. Analyze the research question
2. Break it into sub-questions if complex
3. Use search_academic for peer-reviewed sources
4. Use search_web for current events
5. Cross-reference information from at least 3 sources
6. Synthesize findings into a coherent summary
7. Always cite sources with [Source: URL] format

Quality standards:
- Prioritize recent information (last 2 years)
- Flag contradictions between sources
- Distinguish facts from opinions
- Note confidence level (high/medium/low)`
```

### Dynamic System Prompts

Adapt prompts based on context:

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

## Tool Selection Strategy

### Choosing the Right Tools

**Principles for tool selection:**
1. **Single responsibility**: Each tool does one thing well
2. **Clear boundaries**: Non-overlapping functionality
3. **Complementary**: Tools work together to solve tasks
4. **Appropriate granularity**: Not too broad, not too narrow

```typescript
// ❌ BAD: Overly broad tool
const adminTool = {
  name: 'admin_action',
  description: 'Perform admin actions',
  parameters: z.object({
    action: z.string(), // Too vague!
    data: z.any(),
  }),
  execute: async ({ action, data }) => {
    // Tool does too many things
  }
}

// ✅ GOOD: Specific, focused tools
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

### Tool Composition

Build complex capabilities from simple tools:

```typescript
// Basic tools
const searchTool = createSerperSearch({ apiKey: process.env.SERPER_API_KEY! })
const scrapeTool = createFirecrawlScrape({ apiKey: process.env.FIRECRAWL_API_KEY! })
const summarizeTool = createSummarizeTool()

// Research agent uses all three
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

// Customer service agent needs different tools
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

### Tool Naming Conventions

**Clear, descriptive names help LLMs choose correctly:**

```typescript
// ❌ BAD: Ambiguous names
'search'        // Search what? Web, database, files?
'get'           // Get what?
'update'        // Update what?

// ✅ GOOD: Specific names
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

## Iteration Management

### Setting Max Iterations

**Guidelines:**
- **Simple Q&A**: 3-5 iterations
- **Research tasks**: 10-15 iterations
- **Complex workflows**: 20+ iterations

```typescript
// Simple Q&A agent
const qaAgent = createReActAgent({
  model: () => llm('gpt-4o-mini'),
  systemPrompt: 'Answer questions concisely.',
  tools: [searchTool],
  maxIterations: 3, // Quick answers only
})

// Deep research agent
const researchAgent = createReActAgent({
  model: () => llm('gpt-4o'),
  systemPrompt: 'Conduct thorough research.',
  tools: [searchTool, scrapeTool, analyzeTool],
  maxIterations: 20, // Allow deep investigation
})
```

### Preventing Infinite Loops

**Common causes:**
1. Tool returns unhelpful results
2. Agent misunderstands task
3. Tools have side effects that confuse agent

**Solutions:**

```typescript
// 1. Ensure tools return actionable information
const searchTool = {
  name: 'search',
  description: 'Search for information',
  parameters: z.object({ query: z.string() }),
  execute: async ({ query }) => {
    const results = await search(query)
    
    // ❌ BAD: Empty or vague response
    if (results.length === 0) return 'No results'
    
    // ✅ GOOD: Guidance for next step
    if (results.length === 0) {
      return 'No results found. Try:\n' +
             '1. Using different keywords\n' +
             '2. Broadening the search terms\n' +
             '3. Checking spelling'
    }
    
    return results
  }
}

// 2. Add iteration progress hints to system prompt
systemPrompt: `You are a research assistant.

Important: Work efficiently!
- Make each tool call count
- Don't repeat failed searches
- If you've tried 3+ times without progress, summarize what you found and provide partial answer`

// 3. Track tool call history
let callHistory: Array<{ tool: string; args: any }> = []

const monitoredTool = {
  name: 'search',
  description: 'Search for information',
  parameters: z.object({ query: z.string() }),
  execute: async ({ query }) => {
    // Check for repeated calls
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

### Early Termination

Stop gracefully when task is complete:

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

## Error Handling

### Tool Error Patterns

**Pattern 1: Return error messages**
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
      // Return helpful error message
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

**Pattern 2: Retry with exponential backoff**
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

**Pattern 3: Fallback strategies**
```typescript
const searchTool = {
  name: 'search',
  description: 'Search multiple sources',
  parameters: z.object({ query: z.string() }),
  execute: async ({ query }) => {
    // Try primary source
    try {
      return await searchPrimary(query)
    } catch (error) {
      console.warn('Primary search failed, trying fallback')
    }
    
    // Try secondary source
    try {
      return await searchSecondary(query)
    } catch (error) {
      console.warn('Secondary search failed, trying cache')
    }
    
    // Try cached results
    const cached = await getCachedResults(query)
    if (cached) {
      return `${cached} (Note: Cached results, may be outdated)`
    }
    
    return 'All search sources unavailable. Please try again later.'
  }
}
```

### Agent-Level Error Handling

```typescript
async function runAgentSafely(
  agent: ReActAgent,
  messages: Message[]
): Promise<AgentResponse | null> {
  try {
    return await agent.run(messages)
  } catch (error) {
    if (error instanceof Error) {
      // Handle specific error types
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
        await delay(60000) // Wait 1 minute
        return runAgentSafely(agent, messages) // Retry
      }
      
      if (error.message.includes('context length')) {
        console.error('Context too large, truncating')
        const truncatedMessages = messages.slice(-10) // Keep last 10
        return agent.run(truncatedMessages)
      }
    }
    
    console.error('Agent error:', error)
    return null
  }
}
```

---

## Testing Agents

### Unit Testing Tools

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
    // Mock API failure
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'))
    
    const result = await weatherTool.execute({
      location: 'San Francisco'
    })
    
    expect(result).toContain('temporarily unavailable')
  })
})
```

### Integration Testing Agents

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

### Mocking LLMs

```typescript
import { createLLMAdapter } from '@seashore/core'

// Create mock LLM for testing
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

## Performance Optimization

### Model Selection

```typescript
// Use cheaper models for simple tasks
const qaAgent = createReActAgent({
  model: () => llm('gpt-4o-mini'), // Faster, cheaper
  systemPrompt: 'Answer questions briefly',
  tools: [searchTool],
})

// Use powerful models for complex reasoning
const researchAgent = createReActAgent({
  model: () => llm('gpt-4o'), // Better reasoning
  systemPrompt: 'Conduct thorough research',
  tools: [searchTool, analyzeTool],
})
```

### Parallel Tool Calls

```typescript
// Enable parallel tool execution (if supported by model)
const agent = createReActAgent({
  model: () => llm('gpt-4o'),
  systemPrompt: `You are efficient. When multiple independent tasks are needed, list them all at once.

Example:
User: "Get weather for Tokyo, London, and Paris"
You: Call get_weather 3 times in parallel, not sequentially`,
  tools: [weatherTool],
})
```

### Response Caching

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

## Best Practices Checklist

### System Prompt
- [ ] Clear role definition
- [ ] Explicit capabilities and limitations
- [ ] Tool usage guidelines
- [ ] Behavioral expectations
- [ ] Example interactions (if applicable)

### Tools
- [ ] Single responsibility per tool
- [ ] Non-overlapping functionality
- [ ] Clear, descriptive names
- [ ] Comprehensive parameter descriptions
- [ ] Robust error handling
- [ ] Input validation
- [ ] Appropriate output format

### Configuration
- [ ] Appropriate max iterations for task complexity
- [ ] Correct model for reasoning requirements
- [ ] Guardrails for safety/compliance
- [ ] Output schema for structured responses (if needed)

### Error Handling
- [ ] Graceful degradation
- [ ] Helpful error messages
- [ ] Retry logic for transient failures
- [ ] Fallback strategies

### Testing
- [ ] Unit tests for all tools
- [ ] Integration tests for agent
- [ ] Edge case coverage
- [ ] Performance benchmarks

---

## Common Pitfalls

### 1. Vague System Prompts

```typescript
// ❌ BAD
systemPrompt: 'You are helpful'

// ✅ GOOD
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

### 2. Too Many Tools

```typescript
// ❌ BAD: Overwhelming
const agent = createReActAgent({
  tools: [
    tool1, tool2, tool3, tool4, tool5, tool6, tool7, tool8,
    tool9, tool10, tool11, tool12, tool13, tool14, tool15
  ] // Agent struggles to choose
})

// ✅ GOOD: Focused set
const agent = createReActAgent({
  tools: [searchTool, calculatorTool, weatherTool] // Clear choices
})
```

### 3. Unclear Max Iterations

```typescript
// ❌ BAD: Arbitrary number
maxIterations: 100 // Why 100?

// ✅ GOOD: Justified based on task
maxIterations: 15 // Research requires ~10-15 searches + synthesis
```

### 4. Silent Tool Failures

```typescript
// ❌ BAD
execute: async ({ userId }) => {
  const user = await db.user.findUnique({ where: { id: userId } })
  return user // undefined if not found
}

// ✅ GOOD
execute: async ({ userId }) => {
  const user = await db.user.findUnique({ where: { id: userId } })
  if (!user) {
    return `User ${userId} not found. Please verify the ID and try again.`
  }
  return user
}
```

---

## Next Steps

- **[Tool Development Guide](./tool-development.md)** - Create robust tools
- **[Workflow Orchestration](./workflow-orchestration.md)** - Chain multiple agents
- **[Guardrails Guide](./guardrails.md)** - Add safety controls
- **[Evaluation Guide](./evaluation.md)** - Measure agent performance
- **[Testing Guide](./testing.md)** - Comprehensive testing strategies

---

## Additional Resources

- **[Examples](/examples/basic-agent/)** - Code examples
- **[Core Concepts: Agents](/docs/core-concepts/agents.md)** - Detailed agent documentation
- **[API Reference](/docs/api/agent.md)** - Complete API documentation
