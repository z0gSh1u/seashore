import * as dotenv from 'dotenv';
import * as path from 'path';
import { createAgent } from '@seashore/agent';
import { openaiText } from '@seashore/llm';

// Load environment variables
dotenv.config();

async function main() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error('Error: OPENAI_API_KEY is not set in examples/.env');
    process.exit(1);
  }

  const agent = createAgent({
    name: 'story-teller',
    model: openaiText('gpt-4o', { apiKey }),
    systemPrompt: 'You are a creative storyteller.',
  });

  const topic = 'A robot who loves gardening';
  console.log(`📖 Requesting story about: ${topic}\n`);
  console.log('--- STREAM START ---');

  const stream = agent.stream(`Tell me a short story about ${topic}.`);

  for await (const chunk of stream) {
    if (chunk.type === 'content' && chunk.delta) {
      process.stdout.write(chunk.delta);
    }
  }

  console.log('\n\n--- STREAM END ---');
}

main().catch(console.error);
