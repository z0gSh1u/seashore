/**
 * Document Indexing Script
 *
 * Indexes sample documents about Seashore into the vector database
 */

import 'dotenv/config'
import { createEmbeddingAdapter } from '@seashore/core'
import { createVectorDBService, createRAG } from '@seashore/data'

const OPENAI_API_KEY = process.env.OPENAI_API_KEY!
const DATABASE_URL = process.env.DATABASE_URL!

if (!OPENAI_API_KEY || !DATABASE_URL) {
  console.error('❌ Missing environment variables')
  process.exit(1)
}

// Sample documents about Seashore framework
const documents = [
  {
    id: 'intro',
    content: `Seashore is a TypeScript-first AI agent framework built on TanStack AI. 
    It provides a modular, type-safe foundation for building production AI agents with workflow 
    orchestration, RAG capabilities, and deployment infrastructure. Seashore focuses on simplicity, 
    modularity, and production readiness.`,
    metadata: {
      source: 'documentation',
      title: 'Introduction to Seashore',
      category: 'overview',
    },
  },
  {
    id: 'packages',
    content: `Seashore consists of five independent packages: @seashore/core provides LLM adapters, 
    embeddings, tools, and context utilities; @seashore/agent provides ReAct agents and workflow 
    orchestration; @seashore/data provides PostgreSQL storage, pgvector, and RAG pipelines; 
    @seashore/platform provides MCP integration, guardrails, evaluation, and deployment middleware; 
    @seashore/react provides React hooks for streaming chat interfaces.`,
    metadata: {
      source: 'documentation',
      title: 'Seashore Packages Overview',
      category: 'architecture',
    },
  },
  {
    id: 'react-agent',
    content: `ReAct agents in Seashore implement the Reasoning + Acting pattern. They can reason 
    about what to do, call tools to take actions, observe the results, and iterate until the task 
    is complete. Create a ReAct agent using createReActAgent() with an LLM adapter, tools array, 
    and optional system prompt. Agents support streaming responses, multi-turn conversations, 
    and configurable iteration limits.`,
    metadata: {
      source: 'documentation',
      title: 'ReAct Agents',
      category: 'agents',
    },
  },
  {
    id: 'tools',
    content: `Tools in Seashore are functions that agents can call. Each tool has a name, description, 
    parameter schema (using Zod), and an execute function. The LLM decides when to use tools based on 
    their descriptions. Seashore provides built-in tools like createSerperSearch for web search and 
    createFirecrawlScrape for web scraping. You can create custom tools for any functionality.`,
    metadata: {
      source: 'documentation',
      title: 'Tool Creation and Usage',
      category: 'tools',
    },
  },
  {
    id: 'workflows',
    content: `Workflows in Seashore use a DAG (Directed Acyclic Graph) for orchestration. Create 
    workflows with createWorkflow() and define steps with createStep(). Each step can declare 
    dependencies on other steps. Seashore automatically handles parallel execution of independent 
    steps and sequential execution of dependent steps. Workflows support error handling, retry 
    policies, and human-in-the-loop patterns.`,
    metadata: {
      source: 'documentation',
      title: 'DAG Workflow Orchestration',
      category: 'workflows',
    },
  },
  {
    id: 'rag',
    content: `RAG (Retrieval-Augmented Generation) in Seashore combines PostgreSQL with pgvector 
    for vector search. The RAG pipeline supports three search modes: pure vector search for semantic 
    matching, pure text search for keyword matching, and hybrid search using Reciprocal Rank Fusion 
    to combine both. Use createRAG() to set up a pipeline with document chunking, embedding, and 
    retrieval. Configure chunk size and overlap based on your use case.`,
    metadata: {
      source: 'documentation',
      title: 'RAG Pipeline and Vector Search',
      category: 'rag',
    },
  },
  {
    id: 'llm-adapters',
    content: `Seashore provides unified LLM adapters for OpenAI, Anthropic, and Google Gemini. 
    Use createLLMAdapter() with provider, model, and apiKey. The adapter abstracts provider 
    differences, allowing you to switch between models without code changes. All adapters support 
    streaming, tool calling, and structured outputs. You can configure temperature, max tokens, 
    and other parameters through the adapter.`,
    metadata: {
      source: 'documentation',
      title: 'LLM Adapter Configuration',
      category: 'llm',
    },
  },
  {
    id: 'embeddings',
    content: `Embedding adapters in Seashore convert text into vector representations for similarity 
    search. Use createEmbeddingAdapter() with providers like OpenAI (text-embedding-3-small or large), 
    Anthropic, or others. Embeddings are used in the RAG pipeline to convert both documents and queries 
    into vectors. Choose embedding models based on your accuracy vs cost tradeoffs.`,
    metadata: {
      source: 'documentation',
      title: 'Embedding Models',
      category: 'embeddings',
    },
  },
  {
    id: 'mcp',
    content: `Model Context Protocol (MCP) in Seashore allows agents to connect to external tools 
    and data sources. Use connectMCP() to connect to an MCP server, then convertMCPToolToTanstack() 
    to convert MCP tools into Seashore-compatible tools. MCP enables integrations with databases, 
    APIs, file systems, and other external resources without writing custom tool code.`,
    metadata: {
      source: 'documentation',
      title: 'MCP Integration',
      category: 'platform',
    },
  },
  {
    id: 'guardrails',
    content: `Guardrails in Seashore provide safety controls for inputs and outputs. Create guardrails 
    using createGuardrail() with custom validation logic, or createLLMGuardrail() for LLM-based 
    content moderation. Guardrails can block, modify, or allow content based on rules. Use them to 
    prevent prompt injection, filter harmful content, enforce policies, and ensure compliance.`,
    metadata: {
      source: 'documentation',
      title: 'Security Guardrails',
      category: 'platform',
    },
  },
  {
    id: 'evaluation',
    content: `Evaluation in Seashore helps measure agent quality. Use createMetric() for custom metrics 
    (accuracy, latency, cost) or createLLMJudgeMetric() for LLM-based quality evaluation. Create test 
    suites with createEvalSuite() to run agents against datasets and collect metrics. Evaluation 
    supports async metrics, batch evaluation, and custom scoring functions.`,
    metadata: {
      source: 'documentation',
      title: 'Agent Evaluation',
      category: 'platform',
    },
  },
  {
    id: 'deployment',
    content: `Seashore provides seashoreMiddleware() for deploying agents with Hono web framework. 
    The middleware handles SSE streaming, thread management, error handling, and agent lifecycle. 
    Deploy to Node.js, Docker, Cloudflare Workers, AWS Lambda, or other platforms. The middleware 
    integrates with storage services for persistent conversations.`,
    metadata: {
      source: 'documentation',
      title: 'Production Deployment',
      category: 'deployment',
    },
  },
  {
    id: 'react-hooks',
    content: `The @seashore/react package provides useSeashorChat hook for building chat interfaces. 
    The hook manages messages, input state, sending messages, and streaming responses. It handles 
    thread IDs for multi-turn conversations, loading states, and error handling. Use it to build 
    chat UIs in React applications with minimal boilerplate.`,
    metadata: {
      source: 'documentation',
      title: 'React Integration',
      category: 'react',
    },
  },
];

async function indexDocuments() {
  console.log('📚 Indexing documents...\n')

  try {
    // Setup embedder
    const embedder = createEmbeddingAdapter({
      provider: 'openai',
      model: 'text-embedding-3-small',
      apiKey: OPENAI_API_KEY,
    })

    // Setup vector database
    const vectorDB = await createVectorDBService({
      connectionString: DATABASE_URL,
    })

    // Create RAG pipeline
    const rag = createRAG({
      embedder,
      vectorDB,
      chunkSize: 512,
      chunkOverlap: 50,
    })

    // Index documents
    console.log(`Indexing ${documents.length} documents...`)

    await rag.indexDocuments(documents)

    console.log('\n✅ Successfully indexed documents!')
    console.log('\nIndexed documents:')
    documents.forEach((doc, i) => {
      console.log(`  ${i + 1}. ${doc.metadata.title}`)
    })

    console.log('\nNext steps:')
    console.log('  Run: pnpm start')

    process.exit(0)
  } catch (error) {
    console.error('❌ Indexing failed:', error)
    process.exit(1)
  }
}

indexDocuments()
