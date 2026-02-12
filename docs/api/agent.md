# @seashore/agent API Reference

The `@seashore/agent` package provides agent orchestration capabilities, including ReAct agents, workflow management with DAG-based execution, and workflow agents.

## Table of Contents

- [ReAct Agent](#react-agent)
  - [createReActAgent](#createreactagent)
  - [ReActAgentConfig](#reactagentconfig)
  - [ReActAgent](#reactagent)
  - [Message](#message)
  - [AgentResult](#agentresult)
  - [AgentResponse](#agentresponse)
  - [Tool](#tool)
  - [Guardrail](#guardrail)
- [Workflow](#workflow)
  - [createWorkflow](#createworkflow)
  - [createStep](#createstep)
  - [DAG](#dag)
  - [StepConfig](#stepconfig)
  - [StepEdgeConfig](#stepedgeconfig)
  - [WorkflowContext](#workflowcontext)
  - [WorkflowResult](#workflowresult)
  - [RetryPolicy](#retrypolicy)
- [Workflow Agent](#workflow-agent)
  - [createWorkflowAgent](#createworkflowagent)
  - [WorkflowAgentConfig](#workflowagentconfig)

---

## ReAct Agent

### createReActAgent

Creates a ReAct (Reasoning + Acting) agent that can use tools and iterate through multiple steps to solve tasks.

```typescript
function createReActAgent(config: ReActAgentConfig): ReActAgent
```

**Parameters:**
- `config` (`ReActAgentConfig`): Configuration for the agent

**Returns:**
- `ReActAgent`: Agent instance with `run()` and `stream()` methods

**Example:**

```typescript
import { createReActAgent } from '@seashore/agent'
import { createLLMAdapter, createToolkit, createSerperSearch } from '@seashore/core'
import { toolDefinition } from '@tanstack/ai'
import { z } from 'zod'

// Create LLM adapter
const llmAdapter = createLLMAdapter({
  provider: 'openai',
  apiKey: process.env.OPENAI_API_KEY!,
})

// Create tools
const searchTool = createSerperSearch({
  apiKey: process.env.SERPER_API_KEY!,
})

const calculatorTool = toolDefinition({
  name: 'calculator',
  description: 'Perform mathematical calculations',
  inputSchema: z.object({
    expression: z.string(),
  }),
  outputSchema: z.object({
    result: z.number(),
  }),
}).server(async (input) => {
  return { result: eval(input.expression) }
})

const toolkit = createToolkit([searchTool, calculatorTool])

// Create agent
const agent = createReActAgent({
  model: llmAdapter('gpt-4o'),
  systemPrompt: 'You are a helpful research assistant with access to web search and calculations.',
  tools: toolkit,
  maxIterations: 5,
})

// Run agent
const response = await agent.run([
  { role: 'user', content: 'What is the population of Tokyo and multiply it by 2?' },
])

console.log(response.result.content)
console.log(response.result.toolCalls)
```

---

### ReActAgentConfig

Configuration interface for creating a ReAct agent.

```typescript
interface ReActAgentConfig {
  model: () => any
  systemPrompt: string
  tools?: Tool[]
  maxIterations?: number
  guardrails?: Guardrail[]
  outputSchema?: z.ZodType<any>
}
```

**Properties:**

- `model` (`() => any`): Model factory function from `createLLMAdapter()` that returns a TanStack AI model
  ```typescript
  const llmAdapter = createLLMAdapter({ provider: 'openai', apiKey: '...' })
  model: llmAdapter('gpt-4o')
  ```

- `systemPrompt` (`string`): System prompt that defines the agent's behavior and role

- `tools` (`Tool[]`, optional): Array of tools available to the agent (default: `[]`)

- `maxIterations` (`number`, optional): Maximum number of reasoning/action iterations (default: `10`)

- `guardrails` (`Guardrail[]`, optional): Array of guardrails for request/response filtering (default: `[]`)

- `outputSchema` (`z.ZodType<any>`, optional): Zod schema for structured output validation

**Example with all options:**

```typescript
import { createReActAgent } from '@seashore/agent'
import { createLLMAdapter } from '@seashore/core'
import { z } from 'zod'

const agent = createReActAgent({
  model: createLLMAdapter({ provider: 'openai', apiKey: '...' })('gpt-4o'),
  systemPrompt: 'You are a helpful assistant.',
  tools: [searchTool, calculatorTool],
  maxIterations: 5,
  guardrails: [contentFilterGuardrail],
  outputSchema: z.object({
    answer: z.string(),
    sources: z.array(z.string()),
  }),
})
```

---

### ReActAgent

Interface for ReAct agent instances.

```typescript
interface ReActAgent {
  run(messages: Message[], options?: RunOptions): Promise<AgentResponse>
  stream(messages: Message[], options?: RunOptions): Promise<StreamingAgentResponse>
}
```

**Methods:**

#### run

Executes the agent with the given messages and returns the full response.

```typescript
async run(messages: Message[], options?: RunOptions): Promise<AgentResponse>
```

**Parameters:**
- `messages` (`Message[]`): Array of conversation messages
- `options` (`RunOptions`, optional): Execution options

**Returns:**
- `Promise<AgentResponse>`: Complete agent response with messages and result

**Example:**

```typescript
const response = await agent.run([
  { role: 'user', content: 'What is the weather in San Francisco?' },
])

console.log(response.result.content)
console.log(response.messages) // Full conversation history
```

#### stream

Executes the agent and returns a streaming response.

```typescript
async stream(messages: Message[], options?: RunOptions): Promise<StreamingAgentResponse>
```

**Parameters:**
- `messages` (`Message[]`): Array of conversation messages
- `options` (`RunOptions`, optional): Execution options

**Returns:**
- `Promise<StreamingAgentResponse>`: Streaming agent response

**Example:**

```typescript
const response = await agent.stream([
  { role: 'user', content: 'Write a long essay about AI' },
])

// Stream content
for await (const chunk of response.stream) {
  if (chunk.type === 'content' && chunk.delta) {
    process.stdout.write(chunk.delta)
  }
}

console.log('\n\nFinal result:', response.result.content)
```

---

### Message

Message interface for conversations.

```typescript
interface Message {
  role: 'user' | 'assistant' | 'system'
  content: string
}
```

**Properties:**
- `role`: The role of the message sender
- `content`: The message content

**Example:**

```typescript
const messages: Message[] = [
  { role: 'system', content: 'You are a helpful assistant' },
  { role: 'user', content: 'Hello!' },
  { role: 'assistant', content: 'Hi! How can I help you today?' },
  { role: 'user', content: 'What is 2+2?' },
]
```

---

### AgentResult

Result from agent execution.

```typescript
interface AgentResult {
  content: string
  toolCalls: ToolCall[]
}
```

**Properties:**
- `content` (`string`): The final text response from the agent
- `toolCalls` (`ToolCall[]`): Array of tool calls made during execution

**ToolCall Interface:**

```typescript
interface ToolCall {
  id: string
  name: string
  arguments: Record<string, unknown>
}
```

**Example:**

```typescript
const response = await agent.run([
  { role: 'user', content: 'Search for AI news and calculate 10*20' },
])

console.log('Response:', response.result.content)

// Check tool usage
for (const toolCall of response.result.toolCalls) {
  console.log(`Used tool: ${toolCall.name}`)
  console.log('Arguments:', toolCall.arguments)
}
```

---

### AgentResponse

Full response from agent execution.

```typescript
interface AgentResponse {
  messages: Message[]
  result: AgentResult
}
```

**Properties:**
- `messages` (`Message[]`): Complete conversation history including tool calls
- `result` (`AgentResult`): Final agent result

**StreamingAgentResponse:**

```typescript
interface StreamingAgentResponse extends AgentResponse {
  stream: AsyncIterable<any>
}
```

---

### Tool

Tool definition interface for agents.

```typescript
interface Tool {
  name: string
  description: string
  parameters: z.ZodType<any>
  execute: (args: any) => Promise<any> | any
}
```

**Properties:**
- `name` (`string`): Unique tool identifier
- `description` (`string`): Description of what the tool does (used by LLM)
- `parameters` (`z.ZodType<any>`): Zod schema defining input parameters
- `execute` (`(args: any) => Promise<any> | any`): Function that executes the tool

**Example:**

```typescript
import { toolDefinition } from '@tanstack/ai'
import { z } from 'zod'

const weatherTool = toolDefinition({
  name: 'get_weather',
  description: 'Get current weather for a location',
  inputSchema: z.object({
    location: z.string().describe('City name or zip code'),
    units: z.enum(['celsius', 'fahrenheit']).optional().default('celsius'),
  }),
  outputSchema: z.object({
    temperature: z.number(),
    conditions: z.string(),
    humidity: z.number(),
  }),
}).server(async (input) => {
  // Call weather API
  const response = await fetch(
    `https://api.weather.com/v1/weather?location=${input.location}&units=${input.units}`
  )
  return response.json()
})
```

---

### Guardrail

Guardrail interface for filtering and validating agent inputs/outputs.

```typescript
interface Guardrail {
  beforeRequest?: (messages: Message[]) => Message[] | Promise<Message[]>
  afterResponse?: (result: AgentResult) => AgentResult | Promise<AgentResult>
}
```

**Properties:**

- `beforeRequest` (optional): Hook to modify or validate messages before sending to LLM
  - **Parameters:** `messages` (`Message[]`) - Messages to process
  - **Returns:** Modified messages or throws error to block request

- `afterResponse` (optional): Hook to modify or validate the response after receiving from LLM
  - **Parameters:** `result` (`AgentResult`) - Result to process
  - **Returns:** Modified result or throws error to block response

**Example:**

```typescript
// Content filter guardrail
const contentFilter: Guardrail = {
  beforeRequest: async (messages) => {
    for (const msg of messages) {
      if (msg.content.includes('unsafe-word')) {
        throw new Error('Content policy violation: unsafe content detected')
      }
    }
    return messages
  },
  afterResponse: async (result) => {
    if (result.content.includes('sensitive-info')) {
      // Redact sensitive information
      result.content = result.content.replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[REDACTED]')
    }
    return result
  },
}

// PII removal guardrail
const piiRemover: Guardrail = {
  afterResponse: async (result) => {
    result.content = result.content
      .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[EMAIL]')
      .replace(/\b\d{3}-\d{3}-\d{4}\b/g, '[PHONE]')
    return result
  },
}

const agent = createReActAgent({
  model: llmAdapter('gpt-4o'),
  systemPrompt: 'You are a helpful assistant',
  tools: [],
  guardrails: [contentFilter, piiRemover],
})
```

---

## Workflow

### createWorkflow

Creates a workflow with DAG-based step execution.

```typescript
function createWorkflow(config: WorkflowConfig): Workflow
```

**Parameters:**
- `config` (`{ name: string }`): Workflow configuration

**Returns:**
- `Workflow`: Workflow instance with chainable `step()` method

**Workflow Interface:**

```typescript
interface Workflow {
  name: string
  step(config: StepConfig, edge?: StepEdgeConfig): Workflow
  execute(options?: ExecuteOptions): Promise<WorkflowResult>
}
```

**Example:**

```typescript
import { createWorkflow, createStep } from '@seashore/agent'

const workflow = createWorkflow({ name: 'data-pipeline' })
  .step(createStep({
    name: 'fetch',
    execute: async (input, ctx) => {
      const data = await fetch('https://api.example.com/data')
      return data.json()
    },
  }))
  .step(createStep({
    name: 'transform',
    execute: async (input, ctx) => {
      const fetchData = ctx.state.get('fetch')
      return transformData(fetchData)
    },
  }), { after: 'fetch' })
  .step(createStep({
    name: 'save',
    execute: async (input, ctx) => {
      const transformed = ctx.state.get('transform')
      await saveToDatabase(transformed)
      return { success: true }
    },
  }), { after: 'transform' })

// Execute workflow
const result = await workflow.execute()
console.log(result.status) // 'completed'
console.log(result.state.get('save')) // { success: true }
```

---

### createStep

Creates a workflow step configuration.

```typescript
function createStep<TInput = unknown, TOutput = unknown>(
  config: StepConfig<TInput, TOutput>
): StepConfig<TInput, TOutput>
```

**Parameters:**
- `config` (`StepConfig<TInput, TOutput>`): Step configuration

**Returns:**
- `StepConfig<TInput, TOutput>`: Step configuration (type-safe passthrough)

**Example:**

```typescript
import { createStep } from '@seashore/agent'
import { z } from 'zod'

const fetchDataStep = createStep({
  name: 'fetch_data',
  execute: async (input, ctx) => {
    const response = await fetch('https://api.example.com/data')
    return response.json()
  },
  outputSchema: z.object({
    users: z.array(z.object({
      id: z.string(),
      name: z.string(),
    })),
  }),
  retryPolicy: {
    maxRetries: 3,
    delayMs: 1000,
    backoffMultiplier: 2,
  },
})
```

---

### DAG

Directed Acyclic Graph (DAG) class for managing step dependencies.

```typescript
class DAG {
  addNode(id: string): void
  addEdge(from: string, to: string): void
  getDependencies(id: string): string[]
  getRoots(): string[]
  getReady(completed: Set<string>): string[]
  topologicalSort(): string[]
  get nodeCount(): number
}
```

**Methods:**

- `addNode(id)`: Add a node to the DAG
- `addEdge(from, to)`: Add a dependency edge (from must complete before to)
- `getDependencies(id)`: Get all dependencies for a node
- `getRoots()`: Get all nodes with no dependencies
- `getReady(completed)`: Get all nodes ready to execute (dependencies completed)
- `topologicalSort()`: Return nodes in topological order (throws on circular dependencies)

**Example:**

```typescript
import { DAG } from '@seashore/agent'

const dag = new DAG()

// Add nodes
dag.addNode('step1')
dag.addNode('step2')
dag.addNode('step3')

// Add dependencies
dag.addEdge('step1', 'step2') // step2 depends on step1
dag.addEdge('step1', 'step3') // step3 depends on step1

// Get execution order
const order = dag.topologicalSort()
console.log(order) // ['step1', 'step2', 'step3'] or ['step1', 'step3', 'step2']

// Get roots (steps with no dependencies)
console.log(dag.getRoots()) // ['step1']

// Get ready steps
const completed = new Set(['step1'])
console.log(dag.getReady(completed)) // ['step2', 'step3']

// Detect circular dependencies
try {
  dag.addEdge('step3', 'step1') // Creates cycle
  dag.topologicalSort()
} catch (error) {
  console.error('Circular dependency detected')
}
```

---

### StepConfig

Configuration for a workflow step.

```typescript
interface StepConfig<TInput = unknown, TOutput = unknown> {
  name: string
  execute: (input: TInput, ctx: WorkflowContext) => Promise<TOutput>
  outputSchema?: z.ZodSchema<TOutput>
  retryPolicy?: RetryPolicy
}
```

**Properties:**

- `name` (`string`): Unique step identifier
- `execute` (`(input: TInput, ctx: WorkflowContext) => Promise<TOutput>`): Step execution function
- `outputSchema` (`z.ZodSchema<TOutput>`, optional): Zod schema for output validation
- `retryPolicy` (`RetryPolicy`, optional): Retry configuration for handling failures

**Example:**

```typescript
const processDataStep: StepConfig = {
  name: 'process_data',
  execute: async (input, ctx) => {
    const rawData = ctx.state.get('fetch_data')
    return processData(rawData)
  },
  outputSchema: z.object({
    processed: z.boolean(),
    count: z.number(),
  }),
  retryPolicy: {
    maxRetries: 3,
    delayMs: 1000,
    backoffMultiplier: 2,
  },
}
```

---

### StepEdgeConfig

Configuration for step dependencies and conditional execution.

```typescript
interface StepEdgeConfig {
  after?: string | string[]
  when?: (ctx: WorkflowContext) => boolean | Promise<boolean>
  type?: 'normal' | 'human'
  prompt?: (ctx: WorkflowContext) => string
  timeout?: number
}
```

**Properties:**

- `after` (`string | string[]`, optional): Step(s) that must complete before this step
- `when` (`(ctx: WorkflowContext) => boolean | Promise<boolean>`, optional): Condition for executing this step
- `type` (`'normal' | 'human'`, optional): Step type (default: `'normal'`)
- `prompt` (`(ctx: WorkflowContext) => string`, optional): Prompt for human input steps
- `timeout` (`number`, optional): Timeout in milliseconds

**Example:**

```typescript
import { createWorkflow, createStep } from '@seashore/agent'

const workflow = createWorkflow({ name: 'conditional-flow' })
  .step(createStep({
    name: 'check',
    execute: async () => ({ needsProcessing: true }),
  }))
  .step(createStep({
    name: 'process',
    execute: async () => ({ result: 'processed' }),
  }), {
    after: 'check',
    when: (ctx) => {
      const checkResult = ctx.state.get('check') as { needsProcessing: boolean }
      return checkResult.needsProcessing
    },
  })
  .step(createStep({
    name: 'parallel1',
    execute: async () => 'done1',
  }), { after: 'check' })
  .step(createStep({
    name: 'parallel2',
    execute: async () => 'done2',
  }), { after: 'check' })
  .step(createStep({
    name: 'final',
    execute: async () => 'complete',
  }), { after: ['parallel1', 'parallel2', 'process'] })
```

---

### WorkflowContext

Context passed to step execution functions.

```typescript
interface WorkflowContext {
  state: Map<string, unknown>
  abortSignal: AbortSignal
}
```

**Properties:**

- `state` (`Map<string, unknown>`): Shared state between steps (step outputs stored by step name)
- `abortSignal` (`AbortSignal`): Signal for cancelling workflow execution

**Example:**

```typescript
const step1 = createStep({
  name: 'step1',
  execute: async (input, ctx) => {
    // Store data in context
    ctx.state.set('myData', { value: 42 })
    return 'step1 complete'
  },
})

const step2 = createStep({
  name: 'step2',
  execute: async (input, ctx) => {
    // Retrieve data from context
    const myData = ctx.state.get('myData') as { value: number }
    
    // Check for cancellation
    if (ctx.abortSignal.aborted) {
      throw new Error('Workflow aborted')
    }
    
    return myData.value * 2
  },
})
```

---

### WorkflowResult

Result from workflow execution.

```typescript
interface WorkflowResult {
  status: WorkflowStatus
  state: Map<string, unknown>
  error?: Error
}
```

**Properties:**

- `status` (`WorkflowStatus`): Execution status
- `state` (`Map<string, unknown>`): Final workflow state with all step outputs
- `error` (`Error`, optional): Error if workflow failed

**WorkflowStatus:**

```typescript
type WorkflowStatus = 'idle' | 'running' | 'pending' | 'completed' | 'failed'
```

**Example:**

```typescript
const result = await workflow.execute()

if (result.status === 'completed') {
  console.log('Workflow completed successfully')
  console.log('Step outputs:', Object.fromEntries(result.state))
} else if (result.status === 'failed') {
  console.error('Workflow failed:', result.error)
}
```

---

### RetryPolicy

Retry configuration for step execution failures.

```typescript
interface RetryPolicy {
  maxRetries: number
  delayMs?: number
  backoffMultiplier?: number
}
```

**Properties:**

- `maxRetries` (`number`): Maximum number of retry attempts
- `delayMs` (`number`, optional): Initial delay between retries in milliseconds
- `backoffMultiplier` (`number`, optional): Multiplier for exponential backoff

**Example:**

```typescript
const unstableStep = createStep({
  name: 'api_call',
  execute: async () => {
    const response = await fetch('https://unstable-api.com/data')
    if (!response.ok) throw new Error('API error')
    return response.json()
  },
  retryPolicy: {
    maxRetries: 5,
    delayMs: 1000,      // Start with 1 second
    backoffMultiplier: 2 // 1s, 2s, 4s, 8s, 16s
  },
})
```

---

## Workflow Agent

### createWorkflowAgent

Creates an agent that wraps a workflow for composability.

```typescript
function createWorkflowAgent(config: WorkflowAgentConfig): WorkflowAgent
```

**Parameters:**
- `config` (`WorkflowAgentConfig`): Workflow agent configuration

**Returns:**
- `WorkflowAgent`: Workflow agent instance

**Example:**

```typescript
import { createWorkflowAgent, createWorkflow, createStep } from '@seashore/agent'

// Create workflow
const dataWorkflow = createWorkflow({ name: 'data-processing' })
  .step(createStep({
    name: 'fetch',
    execute: async () => fetchData(),
  }))
  .step(createStep({
    name: 'process',
    execute: async (input, ctx) => processData(ctx.state.get('fetch')),
  }), { after: 'fetch' })

// Wrap as agent
const workflowAgent = createWorkflowAgent({
  workflow: dataWorkflow,
  inputMapper: (userInput: string) => ({ query: userInput }),
  outputMapper: (workflowResult) => {
    const processed = workflowResult.state.get('process')
    return JSON.stringify(processed)
  },
})

// Use like any agent
const response = await workflowAgent.run([
  { role: 'user', content: 'Process the latest data' },
])
```

---

### WorkflowAgentConfig

Configuration for workflow agents.

```typescript
interface WorkflowAgentConfig {
  workflow: Workflow
  inputMapper?: (input: string) => unknown
  outputMapper?: (result: WorkflowResult) => string
}
```

**Properties:**

- `workflow` (`Workflow`): The workflow to wrap
- `inputMapper` (`(input: string) => unknown`, optional): Function to transform user input to workflow input
- `outputMapper` (`(result: WorkflowResult) => string`, optional): Function to transform workflow result to agent response

---

## Complete Examples

### Example 1: Research Agent with Tools

```typescript
import { createReActAgent } from '@seashore/agent'
import { createLLMAdapter, createToolkit, createSerperSearch } from '@seashore/core'

const agent = createReActAgent({
  model: createLLMAdapter({
    provider: 'openai',
    apiKey: process.env.OPENAI_API_KEY!,
  })('gpt-4o'),
  systemPrompt: `You are a research assistant. Use web search to find accurate information.
Always cite your sources.`,
  tools: createToolkit([
    createSerperSearch({ apiKey: process.env.SERPER_API_KEY! }),
  ]),
  maxIterations: 5,
})

const response = await agent.run([
  { role: 'user', content: 'What are the latest developments in quantum computing?' },
])

console.log(response.result.content)
```

### Example 2: Complex Workflow

```typescript
import { createWorkflow, createStep, DAG } from '@seashore/agent'

const mlWorkflow = createWorkflow({ name: 'ml-training' })
  .step(createStep({
    name: 'load_data',
    execute: async () => {
      return await loadDataset()
    },
  }))
  .step(createStep({
    name: 'preprocess',
    execute: async (input, ctx) => {
      const data = ctx.state.get('load_data')
      return preprocessData(data)
    },
  }), { after: 'load_data' })
  .step(createStep({
    name: 'train_model_a',
    execute: async (input, ctx) => {
      const data = ctx.state.get('preprocess')
      return trainModel(data, 'model-a')
    },
  }), { after: 'preprocess' })
  .step(createStep({
    name: 'train_model_b',
    execute: async (input, ctx) => {
      const data = ctx.state.get('preprocess')
      return trainModel(data, 'model-b')
    },
  }), { after: 'preprocess' })
  .step(createStep({
    name: 'ensemble',
    execute: async (input, ctx) => {
      const modelA = ctx.state.get('train_model_a')
      const modelB = ctx.state.get('train_model_b')
      return ensembleModels([modelA, modelB])
    },
  }), { after: ['train_model_a', 'train_model_b'] })

const result = await mlWorkflow.execute()
console.log('Training complete:', result.status)
```

### Example 3: Agent with Guardrails

```typescript
import { createReActAgent } from '@seashore/agent'
import type { Guardrail } from '@seashore/agent'

const piiFilter: Guardrail = {
  afterResponse: async (result) => {
    result.content = result.content
      .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[EMAIL]')
      .replace(/\b\d{3}-\d{3}-\d{4}\b/g, '[PHONE]')
      .replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[SSN]')
    return result
  },
}

const toxicityFilter: Guardrail = {
  beforeRequest: async (messages) => {
    for (const msg of messages) {
      if (containsToxicContent(msg.content)) {
        throw new Error('Message violates content policy')
      }
    }
    return messages
  },
}

const safeAgent = createReActAgent({
  model: llmAdapter('gpt-4o'),
  systemPrompt: 'You are a helpful assistant',
  tools: [],
  guardrails: [toxicityFilter, piiFilter],
})
```

---

## Type Exports

```typescript
import type {
  ReActAgent,
  ReActAgentConfig,
  Message,
  AgentResult,
  AgentResponse,
  StreamingAgentResponse,
  Tool,
  ToolCall,
  Guardrail,
  BeforeRequestHook,
  AfterResponseHook,
  RunOptions,
  StepConfig,
  StepEdgeConfig,
  WorkflowContext,
  WorkflowResult,
  WorkflowStatus,
  RetryPolicy,
  PendingWorkflow,
  HumanInputRequest,
  HumanInputResponse,
  WorkflowAgentConfig,
  WorkflowAgent,
} from '@seashore/agent'
```

---

## Best Practices

1. **Set appropriate maxIterations**: Start with 5-10 iterations for most agents. Increase for complex tasks.

2. **Use descriptive step names**: Workflow step names should clearly describe what the step does.

3. **Handle errors in steps**: Wrap step execution in try/catch or use retry policies.

4. **Keep workflows focused**: Each workflow should accomplish one clear objective.

5. **Use guardrails for production**: Always add content filtering and PII removal for production agents.

6. **Test workflows independently**: Test workflows separately from agents for easier debugging.

7. **Leverage parallel execution**: Design workflows so independent steps can run in parallel.

8. **Monitor tool usage**: Track which tools are called most frequently to optimize performance.
