/**
 * Example: Workflow Chain
 *
 * Purpose: Demonstrates DAG (Directed Acyclic Graph) workflow orchestration.
 *          Shows how to create steps, define dependencies, and execute workflows.
 *
 * Prerequisites:
 * - None! This example doesn't require API keys or databases.
 *
 * Learning Objectives:
 * 1. How to create workflow steps with createStep()
 * 2. How to define dependencies between steps
 * 3. How to share state between steps using the context
 * 4. How to execute workflows and handle results
 *
 * Expected Output:
 * ```
 * ⚙️ Workflow: data-processing
 *
 * Step 1: Fetch Data
 *   → Retrieved 5 items
 *
 * Step 2: Process Data (depends on: fetch)
 *   → Processed items, sum = 150
 *
 * Step 3: Save Results (depends on: process)
 *   → Saved 3 records to database
 *
 * ✅ Workflow completed successfully!
 * Final state: { fetch: [...], process: [...], save: [...] }
 * ```
 */

import { createWorkflow, createStep, type WorkflowContext } from '@seashore/agent.js';

async function main(): Promise<void> {
  console.log('⚙️ Workflow Chain Example\n');

  // Step 1: Create a workflow
  const workflow = createWorkflow({
    name: 'data-processing',
  });

  // Step 2: Define workflow steps

  // Step 2.1: Fetch data (no dependencies)
  const fetchStep = createStep({
    name: 'fetch',
    execute: async (_input: undefined, ctx: WorkflowContext) => {
      console.log('📥 Step 1: Fetching data...');

      // Simulate API call
      await delay(500);

      const data = [
        { id: 1, value: 10 },
        { id: 2, value: 20 },
        { id: 3, value: 30 },
        { id: 4, value: 40 },
        { id: 5, value: 50 },
      ];

      console.log(`  ✓ Retrieved ${data.length} items`);

      // Store in shared workflow state
      ctx.state.set('items', data);

      return data;
    },
  });

  // Step 2.2: Process data (depends on fetch)
  const processStep = createStep({
    name: 'process',
    execute: async (_input: undefined, ctx: WorkflowContext) => {
      console.log('🔧 Step 2: Processing data...');

      // Access data from previous step via context
      const items = ctx.state.get('items') as Array<{ id: number; value: number }>;

      // Simulate processing
      await delay(500);

      // Calculate statistics
      const sum = items.reduce((acc, item) => acc + item.value, 0);
      const avg = sum / items.length;
      const processed = {
        count: items.length,
        sum,
        average: avg,
        doubled: items.map((item) => ({ ...item, value: item.value * 2 })),
      };

      console.log(`  ✓ Processed ${processed.count} items`);
      console.log(`    Sum: ${processed.sum}, Average: ${processed.average.toFixed(2)}`);

      ctx.state.set('stats', processed);

      return processed;
    },
  });

  // Step 2.3: Save results (depends on process)
  const saveStep = createStep({
    name: 'save',
    execute: async (_input: undefined, ctx: WorkflowContext) => {
      console.log('💾 Step 3: Saving results...');

      const stats = ctx.state.get('stats') as { count: number; doubled: unknown[] };

      // Simulate database save
      await delay(300);

      console.log(`  ✓ Saved ${stats.doubled.length} records`);

      return { saved: true, timestamp: new Date().toISOString() };
    },
  });

  // Step 3: Build the workflow with dependencies
  console.log('Building workflow...\n');

  workflow
    .step(fetchStep)
    .step(processStep, { after: 'fetch' })
    .step(saveStep, { after: 'process' });

  // Step 4: Execute the workflow
  console.log('🚀 Executing workflow...\n');

  const result = await workflow.execute();

  // Step 5: Handle results
  if (result.status === 'completed') {
    console.log('\n✅ Workflow completed successfully!');
    console.log('\n📊 Final State:');

    // Display all state values
    for (const [key, value] of result.state) {
      console.log(`  ${key}:`, JSON.stringify(value, null, 2));
    }

    // Demonstrate parallel execution
    console.log('\n---\n');
    await demonstrateParallelWorkflow();
  } else {
    console.error('\n❌ Workflow failed:', result.error?.message);
    process.exit(1);
  }
}

/**
 * Bonus: Demonstrate parallel step execution
 */
async function demonstrateParallelWorkflow(): Promise<void> {
  console.log('🔄 Bonus: Parallel Execution Demo\n');

  const parallelWorkflow = createWorkflow({
    name: 'parallel-processing',
  });

  // Three independent steps that can run in parallel
  const stepA = createStep({
    name: 'stepA',
    execute: async () => {
      console.log('  Step A starting...');
      await delay(500);
      console.log('  Step A completed');
      return 'Result A';
    },
  });

  const stepB = createStep({
    name: 'stepB',
    execute: async () => {
      console.log('  Step B starting...');
      await delay(400);
      console.log('  Step B completed');
      return 'Result B';
    },
  });

  const stepC = createStep({
    name: 'stepC',
    execute: async () => {
      console.log('  Step C starting...');
      await delay(300);
      console.log('  Step C completed');
      return 'Result C';
    },
  });

  // Combine step depends on all three
  const combineStep = createStep({
    name: 'combine',
    execute: async (_input: undefined, ctx: WorkflowContext) => {
      console.log('  Combine step starting...');
      const a = ctx.state.get('stepA') as string;
      const b = ctx.state.get('stepB') as string;
      const c = ctx.state.get('stepC') as string;
      console.log(`  Combined: ${a}, ${b}, ${c}`);
      return { a, b, c };
    },
  });

  // No dependencies = parallel execution
  parallelWorkflow.step(stepA).step(stepB).step(stepC);

  // This step waits for all three
  parallelWorkflow.step(combineStep, { after: ['stepA', 'stepB', 'stepC'] });

  console.log('Executing parallel workflow (A, B, C run in parallel)...\n');

  const startTime = Date.now();
  const result = await parallelWorkflow.execute();
  const duration = Date.now() - startTime;

  if (result.status === 'completed') {
    console.log(`\n✅ Parallel workflow completed in ${duration}ms`);
    console.log('Notice how total time ~500ms, not 500+400+300=1200ms!');
  }
}

// Helper function for delays
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Run with error handling
main().catch((error: Error) => {
  console.error('\n💥 Fatal error:', error.message);
  process.exit(1);
});
