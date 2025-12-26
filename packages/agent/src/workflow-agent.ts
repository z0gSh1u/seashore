/**
 * @seashore/agent - Workflow Agent
 *
 * Integration between Agent and Workflow packages
 */

import type { TextAdapter, Message } from '@seashore/llm';
import type { Tool } from '@seashore/tool';
import type { Agent, AgentRunResult, RunOptions, AgentConfig } from './types.js';
import { createAgent } from './create-agent.js';
import type {
  Workflow,
  WorkflowConfig,
  WorkflowNode,
  WorkflowContext,
  WorkflowExecutionResult,
  WorkflowExecutionOptions,
} from '@seashore/workflow';
import {
  createWorkflow,
  createNode,
  createLLMNode,
  executeWorkflow,
  createWorkflowContext,
} from '@seashore/workflow';

/**
 * Workflow agent configuration
 */
export interface WorkflowAgentConfig {
  /** Agent name */
  readonly name: string;

  /** Workflow to execute */
  readonly workflow: Workflow<WorkflowAgentInput, WorkflowAgentOutput>;

  /** Default execution options */
  readonly defaultOptions?: WorkflowExecutionOptions;
}

/**
 * Input for workflow agent
 */
export interface WorkflowAgentInput {
  /** User message */
  readonly message: string;

  /** Conversation history */
  readonly messages?: readonly Message[];

  /** Custom context */
  readonly context?: Record<string, unknown>;
}

/**
 * Output from workflow agent
 */
export interface WorkflowAgentOutput {
  /** Response content */
  readonly content: string;

  /** Structured output (optional) */
  readonly structured?: unknown;

  /** Execution metadata */
  readonly metadata?: Record<string, unknown>;
}

/**
 * Create a workflow-based agent
 *
 * @example
 * ```typescript
 * import { createWorkflowAgent } from '@seashore/agent';
 * import { createWorkflow, createLLMNode, createToolNode } from '@seashore/workflow';
 *
 * const workflow = createWorkflow({
 *   name: 'research-workflow',
 *   nodes: [
 *     createLLMNode({
 *       name: 'analyze',
 *       adapter: openaiAdapter,
 *       messages: (input) => [
 *         { role: 'system', content: 'Analyze the user query' },
 *         { role: 'user', content: input.message },
 *       ],
 *     }),
 *     createToolNode({
 *       name: 'search',
 *       tool: searchTool,
 *       input: (_, ctx) => ({ query: ctx.nodeOutputs['analyze'].query }),
 *     }),
 *     createLLMNode({
 *       name: 'respond',
 *       adapter: openaiAdapter,
 *       messages: (input, ctx) => [
 *         { role: 'system', content: 'Respond based on search results' },
 *         { role: 'user', content: JSON.stringify(ctx.nodeOutputs['search']) },
 *       ],
 *     }),
 *   ],
 *   edges: [
 *     { from: 'analyze', to: 'search' },
 *     { from: 'search', to: 'respond' },
 *   ],
 * });
 *
 * const agent = createWorkflowAgent({
 *   name: 'research-agent',
 *   workflow,
 * });
 *
 * const result = await agent.run({ message: 'What is the capital of France?' });
 * console.log(result.content);
 * ```
 */
export function createWorkflowAgent(config: WorkflowAgentConfig): Agent & {
  runWorkflow: (
    input: WorkflowAgentInput,
    options?: WorkflowExecutionOptions
  ) => Promise<WorkflowExecutionResult<WorkflowAgentOutput>>;
} {
  const { name, workflow, defaultOptions = {} } = config;

  // Create a run function that executes the workflow
  async function run(input: WorkflowAgentInput, options: RunOptions = {}): Promise<AgentRunResult> {
    const startTime = Date.now();

    const workflowOptions: WorkflowExecutionOptions = {
      ...defaultOptions,
      signal: options.signal,
    };

    const result = await executeWorkflow(workflow, input, workflowOptions);
    const output = result.output;

    return {
      content: output.content,
      structured: output.structured,
      toolCalls: [],
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      durationMs: Date.now() - startTime,
      iterations: 1,
    };
  }

  // Create a streaming run (not fully implemented for workflows)
  async function* runStream(
    input: WorkflowAgentInput,
    options: RunOptions = {}
  ): AsyncGenerator<
    { type: 'text-delta'; textDelta: string } | { type: 'result'; result: AgentRunResult }
  > {
    const result = await run(input, options);

    // Emit the content as a single chunk
    yield { type: 'text-delta', textDelta: result.content };
    yield { type: 'result', result };
  }

  // Full workflow execution with detailed result
  async function runWorkflow(
    input: WorkflowAgentInput,
    options: WorkflowExecutionOptions = {}
  ): Promise<WorkflowExecutionResult<WorkflowAgentOutput>> {
    return executeWorkflow(workflow, input, { ...defaultOptions, ...options });
  }

  return {
    name,
    run: run as Agent['run'],
    runStream: runStream as Agent['runStream'],
    runWorkflow,
  };
}

/**
 * Create an agent node for use in workflows
 *
 * @example
 * ```typescript
 * import { createAgentNode } from '@seashore/agent';
 * import { createAgent } from '@seashore/agent';
 *
 * const researchAgent = createAgent({
 *   name: 'researcher',
 *   model: openaiAdapter,
 *   systemPrompt: 'You are a research assistant.',
 *   tools: [searchTool],
 * });
 *
 * const agentNode = createAgentNode({
 *   name: 'research-step',
 *   agent: researchAgent,
 *   extractMessage: (input) => input.query,
 * });
 * ```
 */
export function createAgentNode(config: {
  name: string;
  agent: Agent;
  extractMessage: (input: unknown, ctx: WorkflowContext) => string;
  options?: RunOptions;
}): WorkflowNode<unknown, AgentRunResult> {
  const { name, agent, extractMessage, options = {} } = config;

  return createNode({
    name,
    execute: async (input, ctx) => {
      const message = extractMessage(input, ctx);
      return agent.run(message, {
        ...options,
        signal: ctx.signal,
      });
    },
  });
}

/**
 * Compose multiple agents into a workflow
 *
 * @example
 * ```typescript
 * import { composeAgents } from '@seashore/agent';
 *
 * const composedWorkflow = composeAgents({
 *   name: 'multi-agent-pipeline',
 *   agents: [
 *     { agent: plannerAgent, name: 'planner' },
 *     { agent: researchAgent, name: 'researcher' },
 *     { agent: writerAgent, name: 'writer' },
 *   ],
 *   inputExtractor: (prevResult, input, ctx) => {
 *     if (!prevResult) return input.message;
 *     return prevResult.content;
 *   },
 * });
 * ```
 */
export function composeAgents(config: {
  name: string;
  agents: Array<{ agent: Agent; name: string }>;
  inputExtractor?: (
    prevResult: AgentRunResult | null,
    input: WorkflowAgentInput,
    ctx: WorkflowContext
  ) => string;
}): Workflow<WorkflowAgentInput, WorkflowAgentOutput> {
  const { name, agents, inputExtractor } = config;

  const defaultExtractor = (
    prevResult: AgentRunResult | null,
    input: WorkflowAgentInput
  ): string => {
    if (!prevResult) return input.message;
    return prevResult.content;
  };

  const extract = inputExtractor ?? defaultExtractor;

  // Create nodes for each agent
  const nodes = agents.map(({ agent, name: nodeName }, index) =>
    createNode<WorkflowAgentInput, AgentRunResult>({
      name: nodeName,
      execute: async (input, ctx) => {
        const prevNodeName = index > 0 ? agents[index - 1].name : null;
        const prevResult = prevNodeName ? (ctx.nodeOutputs[prevNodeName] as AgentRunResult) : null;

        const message = extract(prevResult, input, ctx);
        return agent.run(message, { signal: ctx.signal });
      },
    })
  );

  // Create edges to chain agents sequentially
  const edges = agents.slice(1).map((_, index) => ({
    from: agents[index].name,
    to: agents[index + 1].name,
  }));

  // Add final output transformation node
  const outputNode = createNode<unknown, WorkflowAgentOutput>({
    name: '_output',
    execute: async (_, ctx) => {
      const lastAgentName = agents[agents.length - 1].name;
      const lastResult = ctx.nodeOutputs[lastAgentName] as AgentRunResult;

      return {
        content: lastResult.content,
        structured: lastResult.structured,
        metadata: {
          agentChain: agents.map((a) => a.name),
        },
      };
    },
  });

  // Add edge from last agent to output
  if (agents.length > 0) {
    edges.push({
      from: agents[agents.length - 1].name,
      to: '_output',
    });
  }

  return createWorkflow({
    name,
    nodes: [...nodes, outputNode] as WorkflowNode[],
    edges,
  });
}
