# Introduction

Welcome to **Seashore** — a modern, modular agent framework for building AI-powered applications in TypeScript.

## What is Seashore?

Seashore is a TypeScript framework that makes it easy to build intelligent AI agents. Built on top of [TanStack AI](https://tanstack.com/latest/latest/doc/ai), it provides a comprehensive toolkit for creating agents that can:

- **Reason and act** using the ReAct (Reasoning + Acting) pattern
- **Use tools** to interact with external systems and APIs
- **Remember** conversations through multi-tier memory systems
- **Retrieve knowledge** with RAG (Retrieval-Augmented Generation)
- **Execute complex tasks** through visual workflow composition
- **Stay safe** with built-in security guardrails

## Why Seashore?

Building production AI applications requires much more than just calling an LLM API. You need to:

- Manage conversation state and context
- Define type-safe tools for your agent to use
- Orchestrate multi-step workflows with error handling
- Implement retrieval for knowledge-based questions
- Deploy your agent as a scalable API service
- Monitor performance and evaluate quality

Seashore provides all of this in a modular, type-safe package. Use only what you need, when you need it.

## Design Philosophy

Seashore follows these core principles:

### Type Safety First

Everything in Seashore is typed. Tools use Zod schemas for runtime validation. LLM outputs can be structured into TypeScript types. This catches errors before they reach production.

### Modular Architecture

Each feature is a separate package. Need just a simple agent? Install `@seashore/agent` and `@seashore/llm`. Building a RAG system? Add `@seashore/rag` and `@seashore/vectordb`. You control your bundle size.

### Progressive Complexity

Start with a 5-line agent that answers questions. Add tools for external actions. Integrate memory for conversations. Build workflows for complex tasks. Scale to production with observability and evaluation.

### Provider Agnostic

Use OpenAI, Anthropic, Gemini, or any compatible provider. Switch between them with a single line change. Extend the framework to support your own LLM backend.

## What You Can Build

Here are some examples of what's possible with Seashore:

- **Chatbots** with memory and personality
- **Customer support agents** that can look up orders and process refunds
- **Research assistants** that can browse the web and synthesize information
- **Code assistants** that can read, write, and execute code
- **Data analysts** that can query databases and generate reports
- **Content creators** that follow multi-step workflows
- **And much more...**

## How This Book is Organized

This book takes you from zero to production-ready AI agents:

1. **Getting Started** — Installation and your first agent in minutes
2. **Agents** — Core agent concepts and patterns
3. **Tools** — Extending agents with capabilities
4. **LLM Integration** — Working with different language models
5. **Workflows** — Building complex multi-step processes
6. **RAG** — Adding knowledge retrieval to your agents
7. **Memory** — Enabling agents to remember and learn
8. **Integrations** — Connecting to external systems and deploying
9. **Security & Evaluation** — Keeping agents safe and measuring quality

Let's get started!
