# Basic ReAct Agent Example

A simple example demonstrating how to create and use a ReAct agent with custom tools in Seashore.

## Features

- LLM adapter setup (OpenAI GPT-4)
- Custom tool creation (weather, calculator)
- ReAct agent with tool calling
- Streaming responses

## Setup

1. Install dependencies:
```bash
pnpm install
```

2. Set your OpenAI API key:
```bash
export OPENAI_API_KEY='your-key-here'
```

3. Run the example:
```bash
pnpm start
```

## What This Example Shows

### 1. Creating Tools
The example creates two tools:
- **Weather tool**: Returns mock weather data for a location
- **Calculator tool**: Performs basic arithmetic operations

### 2. Agent Configuration
- System prompt to guide behavior
- Multiple tools for the agent to choose from
- Maximum iteration limit for safety

### 3. Different Query Types
- Simple queries (single tool use)
- Complex queries (multiple tool uses)
- Streaming responses

## Expected Output

```
=== Example 1: Weather Query ===

Agent: The weather in San Francisco is currently 22°C, sunny with light clouds.
Tool calls: 1

=== Example 2: Math Query ===

Agent: 15 multiplied by 8 equals 120.

=== Example 3: Complex Query ===

Agent: The average temperature between London (20°C) and Paris (18°C) is 19°C.

=== Example 4: Streaming Response ===

[Tool: get_weather]
The weather in Tokyo is...
[Tool: calculator]
100 divided by 4 equals 25.
```

## Code Structure

```typescript
// 1. Setup LLM
const llm = createLLMAdapter({ ... });

// 2. Create tools
const tool = createTool({ ... });

// 3. Create agent
const agent = createReActAgent({ llm, tools });

// 4. Run agent
const result = await agent.run({ message: '...' });
```

## Next Steps

- Try modifying the tools
- Add your own custom tools
- Experiment with different LLM models
- Add structured output schemas
- See the workflow example for orchestration
