import * as dotenv from 'dotenv';
import * as path from 'path';
import { createWorkflow, createLLMNode } from '@seashore/workflow';
import { openaiText } from '@seashore/llm';

// Load environment variables
dotenv.config();

async function main() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error('Error: OPENAI_API_KEY is not set in examples/.env');
    process.exit(1);
  }

  const model = openaiText('gpt-4o', { apiKey });

  // 1. Define Nodes
  const outlineNode = createLLMNode({
    name: 'generate-outline',
    adapter: model,
    prompt: (input: { topic: string }) =>
      `Create a 3-point outline for a blog post about: ${input.topic}. Return only the outline.`,
  });

  const articleNode = createLLMNode({
    name: 'write-article',
    adapter: model,
    prompt: (input, ctx) => {
      // Access output from previous node
      const outline = (ctx.nodeOutputs['generate-outline'] as any).content;
      return `Write a short blog post based on this outline:\n${outline}`;
    },
  });

  // 2. Create Workflow
  const workflow = createWorkflow({
    name: 'blog-post-generator',
    nodes: [outlineNode, articleNode],
    edges: [{ from: 'generate-outline', to: 'write-article' }],
  });

  // 3. Execute
  const topic = 'The benefits of drinking water';
  console.log(`🚀 Starting workflow for topic: "${topic}"`);

  const result = await workflow.execute({ topic });

  console.log('\n📋 Outline:');
  console.log((result.nodeOutputs['generate-outline'] as any).content);

  console.log('\n📝 Article:');
  console.log((result.nodeOutputs['write-article'] as any).content);
}

main().catch(console.error);
