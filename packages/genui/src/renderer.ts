/**
 * Tool Call Renderer - renders tool call results
 * @module @seashore/genui
 */

import React, { createElement } from 'react'
import type { ReactNode } from 'react'
import type { GenUIRegistry, ToolCallUI, ToolCallRenderResult, ComponentRendererProps } from './types.js'
import { isGenUIData } from './registry.js'

/**
 * Default renderer for non-GenUI tool results
 */
function DefaultToolResult({ result }: { result: unknown }): React.ReactElement {
  if (result === null || result === undefined) {
    return <span className="seashore-tool-result-empty">No result</span>
  }

  if (typeof result === 'string') {
    return <span className="seashore-tool-result-text">{result}</span>
  }

  return (
    <pre className="seashore-tool-result-json">
      {JSON.stringify(result, null, 2)}
    </pre>
  )
}

/**
 * Default loading component
 */
function DefaultLoading({ toolName }: { toolName: string }): React.ReactElement {
  return (
    <div className="seashore-tool-loading">
      <span className="seashore-tool-loading-spinner" />
      <span>Running {toolName}...</span>
    </div>
  )
}

/**
 * Default error component
 */
function DefaultError({ error, toolName }: { error: Error; toolName: string }): React.ReactElement {
  return (
    <div className="seashore-tool-error">
      <span className="seashore-tool-error-icon">⚠️</span>
      <span>Error in {toolName}: {error.message}</span>
    </div>
  )
}

/**
 * Render a tool call result
 * @param toolCall - Tool call data
 * @param registry - Optional GenUI registry for custom components
 * @returns Render result with element and GenUI flag
 */
export function renderToolCall(
  toolCall: ToolCallUI,
  registry?: GenUIRegistry
): ToolCallRenderResult {
  const { id, name, args, result, isLoading, error } = toolCall

  // Handle loading state
  if (isLoading) {
    const renderer = registry?.get(name)
    const LoadingComponent = renderer?.loading ?? DefaultLoading

    return {
      element: createElement(LoadingComponent, { toolName: name }),
      isGenUI: false,
    }
  }

  // Handle error state
  if (error) {
    const renderer = registry?.get(name)
    const ErrorComponent = renderer?.error ?? DefaultError

    return {
      element: createElement(ErrorComponent, {
        error: new Error(error),
        toolName: name,
      }),
      isGenUI: false,
    }
  }

  // Check if result is GenUI data
  if (isGenUIData(result)) {
    const renderer = registry?.get(name)

    if (renderer) {
      const props: ComponentRendererProps = {
        data: result.data,
        toolCallId: id,
        toolName: name,
      }

      return {
        element: createElement(renderer.component, props),
        isGenUI: true,
      }
    }
  }

  // Default rendering
  return {
    element: createElement(DefaultToolResult, { result }),
    isGenUI: false,
  }
}

/**
 * Create a tool call renderer function with a specific registry
 * @param registry - GenUI registry
 * @returns Render function
 */
export function createToolCallRenderer(
  registry: GenUIRegistry
): (toolCall: ToolCallUI) => ToolCallRenderResult {
  return (toolCall: ToolCallUI) => renderToolCall(toolCall, registry)
}
