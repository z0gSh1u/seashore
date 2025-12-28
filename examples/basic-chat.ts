import * as dotenv from 'dotenv';
import * as path from 'path';
import { openaiText, chat } from '@seashore/llm';

// Load environment variables from .env
dotenv.config();

async function main() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error('Error: OPENAI_API_KEY is not set in examples/.env');
    process.exit(1);
  }

  console.log('🤖 Sending message to OpenAI...');

  try {
    const model = openaiText('gpt-4o', { apiKey });

    const response = await chat({
      model,
      messages: [
        { role: 'user', content: 'Hello! Tell me a one-sentence joke about programming.' },
      ],
    });

    console.log('\n📝 Response:');
    console.log(response.content);
  } catch (error) {
    console.error('Error:', error);
  }
}

main().catch(console.error);
