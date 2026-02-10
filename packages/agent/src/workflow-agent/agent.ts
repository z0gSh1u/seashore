import type { WorkflowResult } from '../workflow/types.js'

/**
 * A workflow-like interface that the agent can wrap
 */
interface WorkflowLike {
  name: string
  execute(options?: {
    initialState?: Map<string, unknown>
    abortSignal?: AbortSignal
  }): Promise<WorkflowResult>
}

/**
 * Configuration for creating a workflow agent
 */
export interface WorkflowAgentConfig {
  /**
   * Name of the agent
   */
  name: string

  /**
   * Workflow to wrap
   */
  workflow: WorkflowLike
}

/**
 * A workflow agent wraps a workflow and exposes it as an agent interface
 */
export interface WorkflowAgent {
  /**
   * Name of the agent
   */
  name: string

  /**
   * Run the workflow with the given input
   */
  run(input: string, options?: { abortSignal?: AbortSignal }): Promise<WorkflowResult>
}

/**
 * Creates a workflow agent that wraps a workflow as an agent interface.
 *
 * This is useful for using workflows in contexts that expect an agent,
 * or for treating multi-step workflows as a single agent component.
 *
 * @param config - Configuration for the agent
 * @returns Workflow agent instance
 *
 * @example
 * ```typescript
 * import { createWorkflowAgent, createWorkflow, createStep } from '@seashore/agent'
 *
 * const step1 = createStep({
 *   name: 'fetch',
 *   execute: async () => ({ data: 'hello' })
 * })
 *
 * const step2 = createStep({
 *   name: 'process',
 *   execute: async (context) => {
 *     const input = context.state.get('fetch')
 *     return input.data.toUpperCase()
 *   }
 * })
 *
 * const workflow = createWorkflow({ name: 'data-pipeline' })
 *   .step(step1)
 *   .step(step2, { dependsOn: ['fetch'] })
 *
 * const agent = createWorkflowAgent({
 *   name: 'pipeline-agent',
 *   workflow
 * })
 *
 * const result = await agent.run('some input')
 * console.log(result.state.get('process')) // "HELLO"
 * ```
 */
export function createWorkflowAgent(config: WorkflowAgentConfig): WorkflowAgent {
  return {
    name: config.name,
    async run(input: string, options?: { abortSignal?: AbortSignal }): Promise<WorkflowResult> {
      const initialState = new Map<string, unknown>()
      initialState.set('__input', input)
      return config.workflow.execute({
        initialState,
        abortSignal: options?.abortSignal,
      })
    },
  }
}
