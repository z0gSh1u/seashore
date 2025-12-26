/**
 * GenUI Registry - registers component renderers for tool calls
 * @module @seashore/genui
 */

import type { GenUIRegistry, ComponentRenderer } from './types.js';

/**
 * Create a GenUI registry for custom component rendering
 * @example
 * ```tsx
 * const registry = createGenUIRegistry()
 *
 * registry.register('show_stock', {
 *   component: ({ data }) => (
 *     <div className="stock-card">
 *       <h3>{data.symbol}</h3>
 *       <p>${data.price}</p>
 *     </div>
 *   ),
 *   loading: () => <div>Loading stock...</div>,
 *   error: ({ error }) => <div>Error: {error.message}</div>,
 * })
 *
 * // Use in Chat
 * <Chat endpoint="/api/chat" genUIRegistry={registry} />
 * ```
 */
export function createGenUIRegistry(): GenUIRegistry {
  const renderers = new Map<string, ComponentRenderer>();

  return {
    register<T>(name: string, renderer: ComponentRenderer<T>): void {
      renderers.set(name, renderer as ComponentRenderer);
    },

    get(name: string): ComponentRenderer | undefined {
      return renderers.get(name);
    },

    has(name: string): boolean {
      return renderers.has(name);
    },

    names(): string[] {
      return Array.from(renderers.keys());
    },
  };
}

/**
 * Check if a value is GenUI data
 */
export function isGenUIData(value: unknown): value is { __genui: true; data: unknown } {
  return (
    typeof value === 'object' &&
    value !== null &&
    '__genui' in value &&
    (value as { __genui: unknown }).__genui === true
  );
}
