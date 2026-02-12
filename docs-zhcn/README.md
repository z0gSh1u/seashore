# Seashore 文档

欢迎阅读 Seashore 文档！本指南将帮助你使用 TypeScript 构建生产级 AI 智能体。

## 📚 文档结构

### 入门指南
如果你是 Seashore 的新用户，请从这里开始：
- [安装](./getting-started/installation.md) - 安装和设置 Seashore
- [快速开始](./getting-started/quickstart.md) - 5 分钟内构建你的第一个智能体
- [教程](./getting-started/tutorial.md) - 构建完整应用程序的分步指南

### 核心概念
了解 Seashore 的构建模块：
- [架构](./core-concepts/architecture.md) - Seashore 的结构
- [智能体](./core-concepts/agents.md) - ReAct 智能体和工具调用
- [工作流](./core-concepts/workflows.md) - 基于 DAG 的编排
- [工具](./core-concepts/tools.md) - 创建和使用工具
- [LLM 适配器](./core-concepts/llm-adapters.md) - 使用不同的 LLM 提供商
- [RAG](./core-concepts/rag.md) - 检索增强生成
- [上下文管理](./core-concepts/context.md) - 管理对话上下文

### API 参考
每个包的详细 API 文档：
- [@seashore/core](./api/core.md) - LLM 适配器、嵌入、工具、上下文
- [@seashore/agent](./api/agent.md) - ReAct 智能体和工作流
- [@seashore/data](./api/data.md) - PostgreSQL、pgvector、RAG
- [@seashore/platform](./api/platform.md) - MCP、防护栏、评估、部署
- [@seashore/react](./api/react.md) - React hooks

### 指南
深入的指南和最佳实践：
- [构建智能体](./guides/building-agents.md) - 智能体开发最佳实践
- [工具开发](./guides/tool-development.md) - 创建健壮的工具
- [RAG 管道](./guides/rag-pipeline.md) - 构建生产级 RAG 系统
- [工作流编排](./guides/workflow-orchestration.md) - 复杂工作流模式
- [使用 MCP](./guides/mcp.md) - Model Context Protocol 集成
- [防护栏](./guides/guardrails.md) - 实现安全控制
- [评估](./guides/evaluation.md) - 测试和评估智能体
- [性能优化](./guides/performance.md) - 生产环境性能提示
- [错误处理](./guides/error-handling.md) - 健壮的错误处理模式
- [测试](./guides/testing.md) - 智能体测试策略

### 部署
将 Seashore 部署到生产环境：
- [部署概览](./deployment/overview.md) - 部署选项
- [Hono 部署](./deployment/hono.md) - 使用 Hono 部署
- [Docker](./deployment/docker.md) - 容器化你的应用程序
- [Cloudflare Workers](./deployment/cloudflare-workers.md) - 部署到边缘
- [AWS Lambda](./deployment/aws-lambda.md) - 无服务器部署
- [环境变量](./deployment/environment.md) - 配置管理
- [监控](./deployment/monitoring.md) - 可观测性和日志记录

### 迁移和故障排除
- [迁移指南](./migration/migration-guide.md) - 从其他框架迁移
- [故障排除](./troubleshooting/common-issues.md) - 常见问题和解决方案
- [常见问题](./troubleshooting/faq.md) - 常见问题解答

## 🎯 快速导航

**刚接触 AI 智能体？** 从[快速开始](./getting-started/quickstart.md)开始

**从 LangChain 迁移？** 查看[迁移指南](./migration/migration-guide.md)

**构建 RAG 系统？** 参见 [RAG 指南](./guides/rag-pipeline.md)

**部署到生产环境？** 阅读[部署概览](./deployment/overview.md)

**遇到问题？** 访问[故障排除](./troubleshooting/common-issues.md)

## 📦 包选择指南

不确定需要哪些包？这里有一个快速指南：

| 使用场景 | 所需包 |
|----------|----------|
| 简单聊天机器人 | `@seashore/core` + `@seashore/agent` |
| RAG 应用 | `@seashore/core` + `@seashore/agent` + `@seashore/data` |
| 生产部署 | 所有包 |
| React 前端 | 添加 `@seashore/react` |
| MCP 集成 | 添加 `@seashore/platform` |

## 🤝 贡献

想要为 Seashore 做贡献？查看我们的[贡献指南](../CONTRIBUTING.md)。

## 📄 许可证

Seashore 基于 [MIT 许可证](../LICENSE)。
