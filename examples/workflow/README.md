# DAG Workflow Example

Demonstrates Seashore's workflow orchestration with Directed Acyclic Graphs (DAG).

## Features

- Linear workflows (sequential steps)
- Parallel execution (diamond pattern)
- Complex multi-stage pipelines
- Automatic dependency resolution
- Topological sorting

## Setup

```bash
pnpm install
pnpm start
```

## What This Example Shows

### 1. Linear Workflow
Simple pipeline where each step depends on the previous one:
```
fetch → transform → aggregate → save
```

### 2. Parallel Workflow (Diamond Pattern)
Steps that can run in parallel:
```
       source
      /      \
   stats   transform
      \      /
      report
```

Both `stats` and `transform` run in parallel since they only depend on `source`.

### 3. Complex Multi-Stage Workflow
Multiple sources, parallel processing, merge, and validate:
```
source_a    source_b
   |           |
process_a   process_b
    \         /
      merge
        |
     validate
        |
      output
```

## Key Concepts

### Step Definition
```typescript
createStep({
  id: 'step-name',
  fn: async (deps) => {
    // Access previous step results via deps
    return result;
  },
  dependencies: ['previous-step'],
})
```

### Workflow Creation
```typescript
const workflow = createWorkflow({
  name: 'my-workflow',
  steps: [...steps],
});

const results = await workflow.execute();
```

### Parallel Execution
Steps with no dependencies between them execute in parallel automatically:
```typescript
// These run in parallel:
createStep({ id: 'a', fn: async () => ... }),
createStep({ id: 'b', fn: async () => ... }),

// This waits for both:
createStep({ 
  id: 'c', 
  fn: async ({ a, b }) => ...,
  dependencies: ['a', 'b'] 
}),
```

## Benefits

- **Type-safe**: Full TypeScript inference for dependencies
- **Parallel**: Automatic parallelization of independent steps
- **Safe**: Circular dependency detection
- **Simple**: Clean API without complex abstractions

## Next Steps

- Add error handling to steps
- Implement retry logic
- Add workflow visualization
- Integrate with agents (see workflow-agent example)
