import type { z } from 'zod'

export interface RetryPolicy {
  maxRetries: number
  delayMs?: number
  backoffMultiplier?: number
}

export interface WorkflowContext {
  /** Shared state between steps */
  state: Map<string, unknown>
  /** Abort signal for cancellation */
  abortSignal: AbortSignal
}

export interface StepConfig<TInput = unknown, TOutput = unknown> {
  name: string
  execute: (input: TInput, ctx: WorkflowContext) => Promise<TOutput>
  outputSchema?: z.ZodSchema<TOutput>
  retryPolicy?: RetryPolicy
}

export interface StepEdgeConfig {
  after?: string | string[]
  when?: (ctx: WorkflowContext) => boolean | Promise<boolean>
  type?: 'normal' | 'human'
  prompt?: (ctx: WorkflowContext) => string
  timeout?: number
}

export type WorkflowStatus = 'idle' | 'running' | 'pending' | 'completed' | 'failed'

export interface WorkflowResult {
  status: WorkflowStatus
  state: Map<string, unknown>
  error?: Error
}

export interface PendingWorkflow {
  workflowId: string
  stepName: string
  prompt: string
  metadata: Record<string, unknown>
}

export interface HumanInputRequest {
  id: string
  type: 'approval' | 'input' | 'selection'
  prompt: string
  options?: string[]
  metadata: Record<string, unknown>
}

export interface HumanInputResponse {
  requestId: string
  approved?: boolean
  value?: string
  selectedOption?: string
}
