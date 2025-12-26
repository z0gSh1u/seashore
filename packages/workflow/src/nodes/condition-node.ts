/**
 * @seashore/workflow - Condition Node
 *
 * Node type for conditional routing
 */

import type { WorkflowNode, ConditionNodeConfig, WorkflowContext } from '../types.js';

/**
 * Condition node output
 */
export interface ConditionNodeOutput {
  /** Which branch was taken */
  readonly branch: string;

  /** The evaluated condition result */
  readonly conditionResult: boolean;
}

/**
 * Create a condition node for if/else routing
 *
 * @example
 * ```typescript
 * import { createConditionNode } from '@seashore/workflow';
 *
 * const routeNode = createConditionNode({
 *   name: 'route',
 *   condition: (ctx) => {
 *     const result = ctx.nodeOutputs['analyze'];
 *     return result?.needsSearch === true;
 *   },
 *   ifTrue: 'search-node',
 *   ifFalse: 'respond-node',
 * });
 * ```
 */
export function createConditionNode(
  config: ConditionNodeConfig
): WorkflowNode<unknown, ConditionNodeOutput> {
  const { name, condition, ifTrue, ifFalse } = config;

  return {
    name,
    type: 'condition',

    async execute(_input: unknown, ctx: WorkflowContext): Promise<ConditionNodeOutput> {
      const conditionResult = await Promise.resolve(condition(ctx));

      return {
        branch: conditionResult ? ifTrue : ifFalse,
        conditionResult,
      };
    },
  };
}

/**
 * Switch node configuration
 */
export interface SwitchNodeConfig {
  /** Node name */
  readonly name: string;

  /** Value to switch on */
  readonly value: (ctx: WorkflowContext) => string | Promise<string>;

  /** Case mappings */
  readonly cases: Record<string, string>;

  /** Default case */
  readonly default: string;
}

/**
 * Switch node output
 */
export interface SwitchNodeOutput {
  /** Which branch was taken */
  readonly branch: string;

  /** The switch value */
  readonly value: string;
}

/**
 * Create a switch node for multi-way routing
 *
 * @example
 * ```typescript
 * import { createSwitchNode } from '@seashore/workflow';
 *
 * const routeNode = createSwitchNode({
 *   name: 'route-by-type',
 *   value: (ctx) => ctx.nodeOutputs['classify']?.type ?? 'unknown',
 *   cases: {
 *     'question': 'answer-node',
 *     'complaint': 'escalate-node',
 *     'feedback': 'thank-node',
 *   },
 *   default: 'general-node',
 * });
 * ```
 */
export function createSwitchNode(
  config: SwitchNodeConfig
): WorkflowNode<unknown, SwitchNodeOutput> {
  const { name, value: getValue, cases, default: defaultCase } = config;

  return {
    name,
    type: 'condition',

    async execute(_input: unknown, ctx: WorkflowContext): Promise<SwitchNodeOutput> {
      const value = await Promise.resolve(getValue(ctx));
      const branch = cases[value] ?? defaultCase;

      return {
        branch,
        value,
      };
    },
  };
}
