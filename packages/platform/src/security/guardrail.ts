export interface GuardrailResult {
  blocked: boolean
  reason?: string
}

export interface GuardrailConfig {
  name: string
  beforeRequest?: (messages: unknown[]) => Promise<GuardrailResult>
  afterResponse?: (response: unknown) => Promise<GuardrailResult>
}

export interface Guardrail {
  name: string
  beforeRequest?: (messages: unknown[]) => Promise<GuardrailResult>
  afterResponse?: (response: unknown) => Promise<GuardrailResult>
}

export function createGuardrail(config: GuardrailConfig): Guardrail {
  return {
    name: config.name,
    beforeRequest: config.beforeRequest,
    afterResponse: config.afterResponse,
  }
}
