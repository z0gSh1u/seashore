/**
 * Example: Guardrails
 *
 * Purpose: Demonstrates input/output filtering and content moderation.
 *          Shows how to protect agents from harmful inputs and outputs.
 *
 * Prerequisites:
 * - OPENAI_API_KEY in .env file
 *
 * Learning Objectives:
 * 1. How to create custom guardrails with createGuardrail()
 * 2. How to use LLM-based guardrails for content moderation
 * 3. How to chain multiple guardrails
 * 4. How to handle guardrail violations
 *
 * Expected Output:
 * ```
 * 🛡️ Guardrails Example
 *
 * Creating guardrails...
 * ✓ Input length guardrail
 * ✓ Profanity filter guardrail
 * ✓ PII detection guardrail
 * ✓ LLM safety guardrail
 *
 * Test 1: Normal input
 * ✓ Passed all guardrails
 * Response: "Here's information about..."
 *
 * Test 2: Input too long
 * ✗ Blocked by: inputLength
 *   Reason: Input exceeds maximum length
 *
 * Test 3: Potentially unsafe content
 * ✗ Blocked by: llmSafety
 *   Reason: Content flagged as potentially harmful
 *
 * ✅ Example completed successfully!
 * ```
 */

import { createLLMAdapter } from '@seashore/core.js';
import { createReActAgent, type Message } from '@seashore/agent.js';
import { createGuardrail, createLLMGuardrail } from '@seashore/platform.js';
import { chat } from '@tanstack/ai';

// Validate environment variables
const apiKey = process.env.OPENAI_API_KEY;
const baseURL = process.env.OPENAI_BASE_URL;

if (!apiKey) {
  console.error('❌ Error: OPENAI_API_KEY is required');
  console.error('Please copy .env.example to .env and add your OpenAI API key');
  process.exit(1);
}

async function main(): Promise<void> {
  console.log('🛡️ Guardrails Example\n');

  // Step 1: Create various guardrails
  console.log('Creating guardrails...');

  // Guardrail 1: Input length limit
  const inputLengthGuardrail = createGuardrail({
    name: 'inputLength',
    beforeRequest: async (messages: Message[]) => {
      const lastMessage = messages[messages.length - 1];
      const maxLength = 500;

      if (lastMessage && lastMessage.content.length > maxLength) {
        throw new Error(
          `Input exceeds maximum length of ${maxLength} characters. ` +
            `Your input: ${lastMessage.content.length} characters.`,
        );
      }

      return messages;
    },
  });

  // Guardrail 2: Simple profanity filter
  const profanityGuardrail = createGuardrail({
    name: 'profanityFilter',
    beforeRequest: async (messages: Message[]) => {
      const lastMessage = messages[messages.length - 1];
      const forbiddenWords = ['badword1', 'badword2', 'spam', 'scam'];

      if (lastMessage) {
        const content = lastMessage.content.toLowerCase();
        for (const word of forbiddenWords) {
          if (content.includes(word)) {
            throw new Error(
              `Input contains prohibited content: "${word}". ` + `Please rephrase your message.`,
            );
          }
        }
      }

      return messages;
    },
  });

  // Guardrail 3: PII (Personally Identifiable Information) detection
  const piiGuardrail = createGuardrail({
    name: 'piiDetection',
    beforeRequest: async (messages: Message[]) => {
      const lastMessage = messages[messages.length - 1];

      if (lastMessage) {
        // Simple regex patterns for PII detection
        const patterns = [
          { name: 'SSN', regex: /\b\d{3}-\d{2}-\d{4}\b/ },
          { name: 'Email', regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/ },
          { name: 'Credit Card', regex: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/ },
        ];

        for (const pattern of patterns) {
          if (pattern.regex.test(lastMessage.content)) {
            throw new Error(
              `Input may contain ${pattern.name}. ` +
                `Please remove personal information before submitting.`,
            );
          }
        }
      }

      return messages;
    },
  });

  // Guardrail 4: LLM-based safety check
  const llmSafetyGuardrail = createLLMGuardrail({
    name: 'llmSafety',
    model: () => createLLMAdapter({ provider: 'openai', apiKey, baseURL })('gpt-4o-mini'),
    safetyPrompt:
      'Evaluate if the following content is safe and appropriate. ' +
      'Respond with only "SAFE" or "UNSAFE".\n\nContent:',
    onViolation: 'block', // 'block' | 'warn' | 'sanitize'
  });

  console.log('✓ Created 4 guardrails\n');

  // Step 2: Create agent with guardrails
  const adapter = createLLMAdapter({
    provider: 'openai',
    apiKey,
    baseURL,
  });

  const agent = createReActAgent({
    model: () => adapter('gpt-4o-mini'),
    systemPrompt: 'You are a helpful assistant. Provide safe, accurate information.',
    guardrails: [
      inputLengthGuardrail,
      profanityGuardrail,
      piiGuardrail,
      // llmSafetyGuardrail, // Uncomment to enable LLM-based safety checks
    ],
  });

  // Step 3: Test guardrails with various inputs
  console.log('Testing guardrails...\n');

  const testCases = [
    {
      name: 'Normal Input',
      message: 'What is the capital of France?',
      shouldPass: true,
    },
    {
      name: 'Input Too Long',
      message: 'a'.repeat(600), // Exceeds 500 char limit
      shouldPass: false,
    },
    {
      name: 'Contains Forbidden Word',
      message: 'This is a spam message',
      shouldPass: false,
    },
    {
      name: 'Contains PII (Email)',
      message: 'Contact me at john@example.com',
      shouldPass: false,
    },
  ];

  for (const test of testCases) {
    console.log(`Test: ${test.name}`);
    console.log(
      `Input: "${test.message.substring(0, 50)}${test.message.length > 50 ? '...' : ''}"`,
    );

    try {
      const response = await agent.run([{ role: 'user', content: test.message }]);

      if (test.shouldPass) {
        console.log('✅ Passed all guardrails');
        console.log(`Response: ${response.result.content.substring(0, 100)}...\n`);
      } else {
        console.log('⚠️  Warning: Expected to be blocked but passed\n');
      }
    } catch (error) {
      if (error instanceof Error) {
        if (test.shouldPass) {
          console.log(`❌ Unexpectedly blocked: ${error.message}\n`);
        } else {
          console.log(`✅ Blocked as expected`);
          console.log(`Reason: ${error.message}\n`);
        }
      }
    }
  }

  // Step 4: Demonstrate output guardrail
  console.log('---\n');
  console.log('Output Guardrail Demo:\n');

  const outputFilterGuardrail = createGuardrail({
    name: 'outputFilter',
    afterResponse: async (result) => {
      // Example: Remove any phone numbers from output
      const filtered = result.content.replace(/\b\d{3}-\d{3}-\d{4}\b/g, '[PHONE NUMBER REMOVED]');

      if (filtered !== result.content) {
        console.log('🛡️  Output guardrail: Removed phone number from response');
      }

      return { ...result, content: filtered };
    },
  });

  const agentWithOutputGuardrail = createReActAgent({
    model: () => adapter('gpt-4o-mini'),
    systemPrompt:
      'You are a helpful assistant. If asked for contact info, ' +
      'provide a fake phone number like 555-123-4567 for demonstration.',
    guardrails: [outputFilterGuardrail],
  });

  console.log('Testing output filtering...');
  console.log('Input: "Give me a phone number example"\n');

  try {
    const response = await agentWithOutputGuardrail.run([
      { role: 'user', content: 'Give me a phone number example' },
    ]);

    console.log(`Response: ${response.result.content}`);
  } catch (error) {
    console.error('Error:', error);
  }

  console.log('\n✅ Example completed successfully!');
}

// Run with error handling
main().catch((error: Error) => {
  console.error('\n💥 Fatal error:', error.message);
  process.exit(1);
});
