import { describe, it, expect } from 'vitest'
import { createWorkflowAgent } from './agent.js'
import { createWorkflow, createStep } from '../workflow/builder.js'

describe('createWorkflowAgent', () => {
  it('should wrap a workflow as an agent', async () => {
    const step = createStep({
      name: 'process',
      execute: async (input) => `processed: ${input}`,
    })

    const workflow = createWorkflow({ name: 'test-wf' }).step(step)

    const agent = createWorkflowAgent({
      name: 'test-wf-agent',
      workflow,
    })

    expect(agent.name).toBe('test-wf-agent')
    expect(typeof agent.run).toBe('function')
  })

  it('should execute the workflow and return result', async () => {
    const step = createStep({
      name: 'double',
      execute: async () => 42,
    })

    const workflow = createWorkflow({ name: 'calc' }).step(step)
    const agent = createWorkflowAgent({ name: 'calc-agent', workflow })

    const result = await agent.run('ignored for now')
    expect(result.status).toBe('completed')
    expect(result.state.get('double')).toBe(42)
  })
})
