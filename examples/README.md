# Seashore Examples

Progressive examples demonstrating Seashore AI agent framework features.

## Quick Start

1. **Install dependencies**:
   ```bash
   pnpm install
   ```

2. **Set up environment**:
   ```bash
   cp .env.example .env
   # Edit .env and add your API keys
   ```

3. **Run an example**:
   ```bash
   pnpm example 01-basic/01-hello-llm.ts
   ```

## Structure

### 01-basic: Core Concepts
Single-feature examples to learn fundamentals:

- `01-hello-llm.ts` - Basic LLM adapter usage
- `02-simple-tool.ts` - Creating and using tools
- `03-workflow-chain.ts` - Simple DAG workflow
- `04-embedding.ts` - Text embeddings
- `05-storage.ts` - Message storage with PostgreSQL

### 02-intermediate: Feature Combinations
Combining multiple features:

- `01-react-agent.ts` - Agent with tools
- `02-rag-search.ts` - RAG retrieval pipeline
- `03-guardrails.ts` - Input/output safety filters
- `04-mcp-tools.ts` - MCP server integration

### 03-advanced: Real-World Scenarios
Complete applications:

- `01-doc-chatbot.ts` - Document Q&A with RAG
- `02-multi-agent.ts` - Multi-agent workflow orchestration
- `03-deploy-api.ts` - Deploy as Hono API

## Environment Variables

Required variables for most examples:

```bash
# OpenAI (most examples)
OPENAI_API_KEY=your_key_here
OPENAI_BASE_URL=https://api.openai.com/v1  # Optional

# Database (data examples)
DATABASE_URL=postgresql://user:pass@localhost:5432/db

# Third-party services
SERPER_API_KEY=your_key_here
FIRECRAWL_API_KEY=your_key_here
```

See `.env.example` for complete list.

## Prerequisites by Example

| Example | Requirements |
|---------|--------------|
| 01-hello-llm.ts | OPENAI_API_KEY |
| 02-simple-tool.ts | OPENAI_API_KEY |
| 03-workflow-chain.ts | None (no LLM) |
| 04-embedding.ts | OPENAI_API_KEY |
| 05-storage.ts | DATABASE_URL |
| 02-intermediate/* | OPENAI_API_KEY |
| 03-advanced/01-doc-chatbot.ts | OPENAI_API_KEY + DATABASE_URL |
| 03-advanced/03-deploy-api.ts | OPENAI_API_KEY |

## Running Examples

```bash
# From repo root
pnpm example <path>

# Examples
pnpm example 01-basic/01-hello-llm.ts
pnpm example 02-intermediate/01-react-agent.ts
pnpm example 03-advanced/01-doc-chatbot.ts
```

## Troubleshooting

### API Key Errors
```
Error: OPENAI_API_KEY is required
```
- Copy `.env.example` to `.env`
- Add your API key to `.env`

### Database Errors
```
Error: Connection refused
```
- Ensure PostgreSQL is running
- Check DATABASE_URL format

### Rate Limit Errors
```
Error: Rate limit exceeded
```
- Wait a few seconds and retry
- Consider using a different API key tier

## Contributing

When adding new examples:
1. Follow the file template in existing examples
2. Include detailed comments explaining each step
3. Add to the appropriate category (basic/intermediate/advanced)
4. Update this README with the new example
