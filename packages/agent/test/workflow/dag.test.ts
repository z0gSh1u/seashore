import { describe, it, expect } from 'vitest'
import { DAG } from '../../src/workflow/dag.js'

describe('DAG', () => {
  it('should add nodes', () => {
    const dag = new DAG()
    dag.addNode('a')
    dag.addNode('b')
    expect(dag.nodeCount).toBe(2)
  })

  it('should add edges', () => {
    const dag = new DAG()
    dag.addNode('a')
    dag.addNode('b')
    dag.addEdge('a', 'b')
    expect(dag.getDependencies('b')).toEqual(['a'])
  })

  it('should detect circular dependencies', () => {
    const dag = new DAG()
    dag.addNode('a')
    dag.addNode('b')
    dag.addEdge('a', 'b')
    dag.addEdge('b', 'a')
    expect(() => dag.topologicalSort()).toThrow('Circular dependency')
  })

  it('should return correct topological order', () => {
    const dag = new DAG()
    dag.addNode('a')
    dag.addNode('b')
    dag.addNode('c')
    dag.addEdge('a', 'b')
    dag.addEdge('a', 'c')
    dag.addEdge('b', 'c')

    const order = dag.topologicalSort()
    expect(order.indexOf('a')).toBeLessThan(order.indexOf('b'))
    expect(order.indexOf('b')).toBeLessThan(order.indexOf('c'))
  })

  it('should return nodes with no dependencies as roots', () => {
    const dag = new DAG()
    dag.addNode('a')
    dag.addNode('b')
    dag.addNode('c')
    dag.addEdge('a', 'c')
    dag.addEdge('b', 'c')

    const roots = dag.getRoots()
    expect(roots).toContain('a')
    expect(roots).toContain('b')
    expect(roots).not.toContain('c')
  })

  it('should return ready nodes (dependencies all met)', () => {
    const dag = new DAG()
    dag.addNode('a')
    dag.addNode('b')
    dag.addNode('c')
    dag.addEdge('a', 'b')
    dag.addEdge('a', 'c')

    const ready = dag.getReady(new Set(['a']))
    expect(ready).toContain('b')
    expect(ready).toContain('c')
  })
})
