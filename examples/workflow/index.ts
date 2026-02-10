import { createWorkflow, createStep } from '@seashore/agent';

/**
 * DAG Workflow Example
 * 
 * This example demonstrates:
 * - Creating a directed acyclic graph (DAG) workflow
 * - Defining steps with dependencies
 * - Parallel execution of independent steps
 * - Data passing between steps
 */

async function main() {
  console.log('=== Simple Linear Workflow ===\n');

  // Example 1: Linear pipeline
  const linearWorkflow = createWorkflow({
    name: 'data-processing-pipeline',
    steps: [
      createStep({
        id: 'fetch',
        fn: async () => {
          console.log('Step 1: Fetching data...');
          await sleep(500);
          return { data: [1, 2, 3, 4, 5] };
        },
      }),
      createStep({
        id: 'transform',
        fn: async ({ fetch }) => {
          console.log('Step 2: Transforming data...');
          await sleep(500);
          return fetch.data.map(x => x * 2);
        },
        dependencies: ['fetch'],
      }),
      createStep({
        id: 'aggregate',
        fn: async ({ transform }) => {
          console.log('Step 3: Aggregating results...');
          await sleep(500);
          const sum = transform.reduce((a, b) => a + b, 0);
          return { sum, count: transform.length, average: sum / transform.length };
        },
        dependencies: ['transform'],
      }),
      createStep({
        id: 'save',
        fn: async ({ aggregate }) => {
          console.log('Step 4: Saving results...');
          await sleep(500);
          console.log('Results:', aggregate);
          return { saved: true };
        },
        dependencies: ['aggregate'],
      }),
    ],
  });

  const result1 = await linearWorkflow.execute();
  console.log('Workflow completed:', result1.save);

  console.log('\n=== Parallel Workflow (Diamond Pattern) ===\n');

  // Example 2: Parallel execution (diamond pattern)
  const parallelWorkflow = createWorkflow({
    name: 'parallel-processing',
    steps: [
      // Single source
      createStep({
        id: 'source',
        fn: async () => {
          console.log('[Source] Loading data...');
          await sleep(300);
          return { numbers: [10, 20, 30, 40, 50] };
        },
      }),
      
      // Two parallel branches
      createStep({
        id: 'stats',
        fn: async ({ source }) => {
          console.log('[Stats] Calculating statistics...');
          await sleep(700);
          const sum = source.numbers.reduce((a, b) => a + b, 0);
          return {
            sum,
            mean: sum / source.numbers.length,
            min: Math.min(...source.numbers),
            max: Math.max(...source.numbers),
          };
        },
        dependencies: ['source'],
      }),
      createStep({
        id: 'transform',
        fn: async ({ source }) => {
          console.log('[Transform] Applying transformations...');
          await sleep(500);
          return {
            doubled: source.numbers.map(x => x * 2),
            squared: source.numbers.map(x => x ** 2),
          };
        },
        dependencies: ['source'],
      }),
      
      // Join results
      createStep({
        id: 'report',
        fn: async ({ stats, transform }) => {
          console.log('[Report] Generating report...');
          await sleep(300);
          return {
            statistics: stats,
            transformations: transform,
            timestamp: new Date().toISOString(),
          };
        },
        dependencies: ['stats', 'transform'],
      }),
    ],
  });

  const result2 = await parallelWorkflow.execute();
  console.log('\nFinal Report:', JSON.stringify(result2.report, null, 2));

  console.log('\n=== Complex Multi-Stage Workflow ===\n');

  // Example 3: Multi-stage with multiple parallel branches
  const complexWorkflow = createWorkflow({
    name: 'etl-pipeline',
    steps: [
      // Stage 1: Multiple sources
      createStep({
        id: 'source_a',
        fn: async () => {
          console.log('[Source A] Fetching...');
          await sleep(300);
          return { data: [1, 2, 3] };
        },
      }),
      createStep({
        id: 'source_b',
        fn: async () => {
          console.log('[Source B] Fetching...');
          await sleep(400);
          return { data: [4, 5, 6] };
        },
      }),
      
      // Stage 2: Process each source
      createStep({
        id: 'process_a',
        fn: async ({ source_a }) => {
          console.log('[Process A] Processing...');
          await sleep(200);
          return source_a.data.map(x => x * 10);
        },
        dependencies: ['source_a'],
      }),
      createStep({
        id: 'process_b',
        fn: async ({ source_b }) => {
          console.log('[Process B] Processing...');
          await sleep(200);
          return source_b.data.map(x => x * 10);
        },
        dependencies: ['source_b'],
      }),
      
      // Stage 3: Merge and validate
      createStep({
        id: 'merge',
        fn: async ({ process_a, process_b }) => {
          console.log('[Merge] Combining results...');
          await sleep(200);
          return [...process_a, ...process_b];
        },
        dependencies: ['process_a', 'process_b'],
      }),
      createStep({
        id: 'validate',
        fn: async ({ merge }) => {
          console.log('[Validate] Checking data quality...');
          await sleep(200);
          return {
            data: merge,
            valid: merge.every(x => x > 0),
            count: merge.length,
          };
        },
        dependencies: ['merge'],
      }),
      
      // Stage 4: Final output
      createStep({
        id: 'output',
        fn: async ({ validate }) => {
          console.log('[Output] Finalizing...');
          await sleep(200);
          console.log('Validation:', validate);
          return { success: true };
        },
        dependencies: ['validate'],
      }),
    ],
  });

  const result3 = await complexWorkflow.execute();
  console.log('Workflow Status:', result3.output);
}

// Utility function for simulating async work
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Run the example
main().catch(console.error);
