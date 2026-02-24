import { describe, it, expect, vi } from 'vitest'
import { createWorkflow } from '../../src/workflow/builder.js'
import { createStep } from '../../src/workflow/builder.js'

describe('Workflow Executor', () => {
  it('should execute a single step', async () => {
    const step = createStep({
      name: 'greet',
      execute: async () => 'hello',
    })

    const workflow = createWorkflow({ name: 'test' }).step(step)
    const result = await workflow.execute()
    expect(result.status).toBe('completed')
    expect(result.state.get('greet')).toBe('hello')
  })

  it('should execute steps in dependency order', async () => {
    const order: string[] = []

    const stepA = createStep({
      name: 'a',
      execute: async () => { order.push('a'); return 1 },
    })
    const stepB = createStep({
      name: 'b',
      execute: async () => { order.push('b'); return 2 },
    })

    const workflow = createWorkflow({ name: 'test' })
      .step(stepA)
      .step(stepB, { after: 'a' })

    await workflow.execute()
    expect(order).toEqual(['a', 'b'])
  })

  it('should execute independent steps in parallel', async () => {
    const timestamps: Record<string, number> = {}

    const stepA = createStep({
      name: 'a',
      execute: async () => {
        timestamps.aStart = Date.now()
        await new Promise((r) => setTimeout(r, 50))
        timestamps.aEnd = Date.now()
        return 1
      },
    })
    const stepB = createStep({
      name: 'b',
      execute: async () => {
        timestamps.bStart = Date.now()
        await new Promise((r) => setTimeout(r, 50))
        timestamps.bEnd = Date.now()
        return 2
      },
    })

    const workflow = createWorkflow({ name: 'test' })
      .step(stepA)
      .step(stepB)

    await workflow.execute()

    // Both should start at roughly the same time if parallel
    const startDiff = Math.abs((timestamps.aStart ?? 0) - (timestamps.bStart ?? 0))
    expect(startDiff).toBeLessThan(30)
  })

  it('should support conditional steps', async () => {
    const stepA = createStep({
      name: 'a',
      execute: async () => 'high',
    })
    const stepB = createStep({
      name: 'b',
      execute: async () => 'ran-b',
    })
    const stepC = createStep({
      name: 'c',
      execute: async () => 'ran-c',
    })

    const workflow = createWorkflow({ name: 'test' })
      .step(stepA)
      .step(stepB, {
        after: 'a',
        when: (ctx: any) => ctx.state.get('a') === 'high',
      })
      .step(stepC, {
        after: 'a',
        when: (ctx: any) => ctx.state.get('a') === 'low',
      })

    const result = await workflow.execute()
    expect(result.state.get('b')).toBe('ran-b')
    expect(result.state.has('c')).toBe(false)
  })

  it('should propagate errors and mark as failed', async () => {
    const stepA = createStep({
      name: 'a',
      execute: async () => { throw new Error('boom') },
    })

    const workflow = createWorkflow({ name: 'test' }).step(stepA)
    const result = await workflow.execute()
    expect(result.status).toBe('failed')
    expect(result.error?.message).toBe('boom')
  })

  it('should support abort via AbortController', async () => {
    const controller = new AbortController()

    const stepA = createStep({
      name: 'a',
      execute: async (_input: any, ctx: any) => {
        await new Promise((resolve, reject) => {
          const timer = setTimeout(resolve, 5000)
          ctx.abortSignal.addEventListener('abort', () => {
            clearTimeout(timer)
            reject(new Error('Aborted'))
          })
        })
      },
    })

    const workflow = createWorkflow({ name: 'test' }).step(stepA)
    const promise = workflow.execute({ abortSignal: controller.signal })

    setTimeout(() => controller.abort(), 10)

    const result = await promise
    expect(result.status).toBe('failed')
  })
})
