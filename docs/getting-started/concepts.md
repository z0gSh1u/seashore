# Core Concepts

## Agent

An **Agent** is the central component that orchestrates LLM interactions, tool usage, and reasoning. Seashore uses the ReAct (Reasoning + Acting) pattern.

```typescript
const agent = createAgent({
  name: 'my-agent',
  adapter: llmAdapter,
  tools: [...],
  systemPrompt: '...',
})
```

## Adapter

**Adapters** provide a unified interface to different LLM providers:

- `openaiText` - OpenAI GPT models
- `anthropicText` - Anthropic Claude models
- Custom adapters for other providers

## Tool

**Tools** extend agent capabilities with external functions:

```typescript
const tool = defineTool({
  name: 'tool_name',
  description: 'What the tool does',
  parameters: zodSchema,
  execute: async (params) => result,
})
```

## Workflow

**Workflows** chain multiple agents and operations:

```typescript
const workflow = createWorkflow()
  .addNode('agent1', agentNode)
  .addNode('agent2', agentNode)
  .addEdge('agent1', 'agent2')
```

## Memory

**Memory** provides context persistence:

- Short-term: Recent conversation history
- Mid-term: Session summaries
- Long-term: Persistent knowledge via vector search

## RAG

**RAG** (Retrieval-Augmented Generation) enhances responses with relevant context from a knowledge base.

## MCP

**MCP** (Model Context Protocol) enables integration with external tools and data sources through a standardized protocol.
