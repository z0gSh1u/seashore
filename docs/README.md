# Seashore Documentation

Welcome to the Seashore documentation! This guide will help you build production-ready AI agents with TypeScript.

## 📚 Documentation Structure

### Getting Started
Start here if you're new to Seashore:
- [Installation](./getting-started/installation.md) - Install and setup Seashore
- [Quick Start](./getting-started/quickstart.md) - Build your first agent in 5 minutes
- [Tutorial](./getting-started/tutorial.md) - Step-by-step guide to building a complete application

### Core Concepts
Understand the building blocks of Seashore:
- [Architecture](./core-concepts/architecture.md) - How Seashore is structured
- [Agents](./core-concepts/agents.md) - ReAct agents and tool calling
- [Workflows](./core-concepts/workflows.md) - DAG-based orchestration
- [Tools](./core-concepts/tools.md) - Creating and using tools
- [LLM Adapters](./core-concepts/llm-adapters.md) - Working with different LLM providers
- [RAG](./core-concepts/rag.md) - Retrieval-Augmented Generation
- [Context Management](./core-concepts/context.md) - Managing conversation context

### API Reference
Detailed API documentation for each package:
- [@seashore/core](./api/core.md) - LLM adapters, embeddings, tools, context
- [@seashore/agent](./api/agent.md) - ReAct agents and workflows
- [@seashore/data](./api/data.md) - PostgreSQL, pgvector, RAG
- [@seashore/platform](./api/platform.md) - MCP, guardrails, evaluation, deployment
- [@seashore/react](./api/react.md) - React hooks

### Guides
In-depth guides and best practices:
- [Building Agents](./guides/building-agents.md) - Best practices for agent development
- [Tool Development](./guides/tool-development.md) - Creating robust tools
- [RAG Pipeline](./guides/rag-pipeline.md) - Building production RAG systems
- [Workflow Orchestration](./guides/workflow-orchestration.md) - Complex workflow patterns
- [Using MCP](./guides/mcp.md) - Model Context Protocol integration
- [Guardrails](./guides/guardrails.md) - Implementing safety controls
- [Evaluation](./guides/evaluation.md) - Testing and evaluating agents
- [Performance Optimization](./guides/performance.md) - Tips for production performance
- [Error Handling](./guides/error-handling.md) - Robust error handling patterns
- [Testing](./guides/testing.md) - Testing strategies for agents

### Deployment
Deploy Seashore to production:
- [Deployment Overview](./deployment/overview.md) - Deployment options
- [Hono Deployment](./deployment/hono.md) - Deploy with Hono
- [Docker](./deployment/docker.md) - Containerize your application
- [Cloudflare Workers](./deployment/cloudflare-workers.md) - Deploy to the edge
- [AWS Lambda](./deployment/aws-lambda.md) - Serverless deployment
- [Environment Variables](./deployment/environment.md) - Configuration management
- [Monitoring](./deployment/monitoring.md) - Observability and logging

### Migration & Troubleshooting
- [Migration Guide](./migration/migration-guide.md) - Migrating from other frameworks
- [Troubleshooting](./troubleshooting/common-issues.md) - Common issues and solutions
- [FAQ](./troubleshooting/faq.md) - Frequently asked questions

## 🎯 Quick Navigation

**New to AI agents?** Start with [Quick Start](./getting-started/quickstart.md)

**Coming from LangChain?** Check out the [Migration Guide](./migration/migration-guide.md)

**Building a RAG system?** See the [RAG Guide](./guides/rag-pipeline.md)

**Deploying to production?** Read [Deployment Overview](./deployment/overview.md)

**Having issues?** Visit [Troubleshooting](./troubleshooting/common-issues.md)

## 📦 Package Selection Guide

Not sure which packages you need? Here's a quick guide:

| Use Case | Packages |
|----------|----------|
| Simple chatbot | `@seashore/core` + `@seashore/agent` |
| RAG application | `@seashore/core` + `@seashore/agent` + `@seashore/data` |
| Production deployment | All packages |
| React frontend | Add `@seashore/react` |
| MCP integration | Add `@seashore/platform` |

## 🤝 Contributing

Want to contribute to Seashore? Check out our [Contributing Guide](../CONTRIBUTING.md).

## 📄 License

Seashore is [MIT licensed](../LICENSE).
