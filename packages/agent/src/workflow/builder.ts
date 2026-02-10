import { DAG } from './dag.js'
import type {
  StepConfig,
  StepEdgeConfig,
  WorkflowContext,
  WorkflowResult,
  WorkflowStatus,
} from './types.js'

export function createStep<TInput = unknown, TOutput = unknown>(
  config: StepConfig<TInput, TOutput>,
): StepConfig<TInput, TOutput> {
  return config
}

interface StepEntry {
  config: StepConfig
  edge: StepEdgeConfig
}

interface WorkflowConfig {
  name: string
}

interface ExecuteOptions {
  initialState?: Map<string, unknown>
  abortSignal?: AbortSignal
}

interface Workflow {
  name: string
  step(config: StepConfig, edge?: StepEdgeConfig): Workflow
  execute(options?: ExecuteOptions): Promise<WorkflowResult>
}

export function createWorkflow(config: WorkflowConfig): Workflow {
  const steps = new Map<string, StepEntry>()
  const dag = new DAG()

  const workflow: Workflow = {
    name: config.name,

    step(stepConfig: StepConfig, edge: StepEdgeConfig = {}): Workflow {
      dag.addNode(stepConfig.name)
      steps.set(stepConfig.name, { config: stepConfig, edge })

      const after = edge.after
      if (after) {
        const deps = Array.isArray(after) ? after : [after]
        for (const dep of deps) {
          dag.addEdge(dep, stepConfig.name)
        }
      }

      return workflow
    },

    async execute(options: ExecuteOptions = {}): Promise<WorkflowResult> {
      const abortController = new AbortController()
      if (options.abortSignal) {
        options.abortSignal.addEventListener('abort', () => abortController.abort())
      }

      const ctx: WorkflowContext = {
        state: options.initialState ?? new Map(),
        abortSignal: abortController.signal,
      }

      // Validate DAG (will throw on circular deps)
      try {
        dag.topologicalSort()
      } catch (err) {
        return {
          status: 'failed',
          state: ctx.state,
          error: err instanceof Error ? err : new Error(String(err)),
        }
      }

      const completed = new Set<string>()
      const skipped = new Set<string>()

      try {
        while (completed.size + skipped.size < steps.size) {
          if (abortController.signal.aborted) {
            throw new Error('Aborted')
          }

          const ready = dag.getReady(new Set([...completed, ...skipped]))
            .filter((n) => !skipped.has(n))

          if (ready.length === 0) break

          // Evaluate conditions and filter
          const toRun: string[] = []
          for (const name of ready) {
            const entry = steps.get(name)
            if (!entry) continue

            if (entry.edge.when) {
              const shouldRun = await entry.edge.when(ctx)
              if (!shouldRun) {
                skipped.add(name)
                continue
              }
            }

            toRun.push(name)
          }

          if (toRun.length === 0 && ready.length > 0) continue

          // Execute ready steps in parallel
          await Promise.all(
            toRun.map(async (name) => {
              const entry = steps.get(name)
              if (!entry) return

              const input = ctx.state.get(name) ?? undefined
              const output = await entry.config.execute(input, ctx)
              ctx.state.set(name, output)
              completed.add(name)
            }),
          )
        }

        return { status: 'completed', state: ctx.state }
      } catch (err) {
        return {
          status: 'failed',
          state: ctx.state,
          error: err instanceof Error ? err : new Error(String(err)),
        }
      }
    },
  }

  return workflow
}
