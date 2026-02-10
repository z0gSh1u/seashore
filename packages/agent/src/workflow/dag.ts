export class DAG {
  private nodes = new Set<string>()
  private edges = new Map<string, Set<string>>() // node -> set of dependencies

  get nodeCount(): number {
    return this.nodes.size
  }

  addNode(id: string): void {
    this.nodes.add(id)
    if (!this.edges.has(id)) {
      this.edges.set(id, new Set())
    }
  }

  addEdge(from: string, to: string): void {
    if (!this.nodes.has(from) || !this.nodes.has(to)) {
      throw new Error(`Both nodes must exist: ${from} -> ${to}`)
    }
    this.edges.get(to)!.add(from)
  }

  getDependencies(id: string): string[] {
    return Array.from(this.edges.get(id) ?? [])
  }

  getRoots(): string[] {
    return Array.from(this.nodes).filter(
      (n) => (this.edges.get(n)?.size ?? 0) === 0,
    )
  }

  getReady(completed: Set<string>): string[] {
    return Array.from(this.nodes).filter((n) => {
      if (completed.has(n)) return false
      const deps = this.edges.get(n)
      if (!deps || deps.size === 0) return !completed.has(n)
      return Array.from(deps).every((d) => completed.has(d))
    })
  }

  topologicalSort(): string[] {
    const visited = new Set<string>()
    const visiting = new Set<string>()
    const result: string[] = []

    const visit = (node: string) => {
      if (visiting.has(node)) {
        throw new Error(`Circular dependency detected involving: ${node}`)
      }
      if (visited.has(node)) return

      visiting.add(node)
      for (const dep of this.edges.get(node) ?? []) {
        visit(dep)
      }
      visiting.delete(node)
      visited.add(node)
      result.push(node)
    }

    for (const node of this.nodes) {
      visit(node)
    }

    return result
  }
}
