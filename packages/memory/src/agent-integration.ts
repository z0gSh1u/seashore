/**
 * @seashore/memory - Agent Integration
 *
 * Wrapper to add memory capabilities to agents
 */

import type { MemoryManager, WithMemoryOptions } from './types.js';

/**
 * Memory-enhanced message type
 */
export interface MemoryEnhancedMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

/**
 * Agent with memory context
 */
export interface AgentWithMemory {
  /**
   * Process a message with memory context
   */
  processWithMemory(
    userMessage: string,
    threadId: string
  ): Promise<{
    response: string;
    memoryContext: string;
    remembered: boolean;
  }>;

  /**
   * Get the memory manager
   */
  getMemory(): MemoryManager;
}

/**
 * Create a memory context system prompt
 */
export function createMemorySystemPrompt(memoryContext: string, baseSystemPrompt?: string): string {
  const memorySection = memoryContext
    ? `\n\n## Memory Context\nYou have the following relevant memories from previous conversations:\n${memoryContext}\n\nUse this context to provide personalized and consistent responses.`
    : '';

  return (baseSystemPrompt ?? 'You are a helpful assistant.') + memorySection;
}

/**
 * Add memory capabilities to an agent
 *
 * This is a higher-order function that wraps agent functionality
 * with memory management.
 */
export function withMemory<T extends { invoke: (input: unknown) => Promise<unknown> }>(
  agent: T,
  options: WithMemoryOptions
): T & AgentWithMemory {
  const {
    memory,
    includeInSystemPrompt = true,
    maxMemoriesInContext = 5,
    autoRemember = true,
    autoRememberResponses = false,
  } = options;

  // Create enhanced agent
  const enhancedAgent = Object.create(agent) as T & AgentWithMemory;

  enhancedAgent.processWithMemory = async (
    userMessage: string,
    threadId: string
  ): Promise<{
    response: string;
    memoryContext: string;
    remembered: boolean;
  }> => {
    // Recall relevant memories
    const relevantMemories = await memory.recall(userMessage, {
      threadId,
      limit: maxMemoriesInContext,
    });

    // Format memory context
    const memoryContext = relevantMemories.map((m) => `[${m.type}] ${m.content}`).join('\n');

    // Remember the user message if auto-remember is enabled
    let remembered = false;
    if (autoRemember) {
      await memory.remember(userMessage, {
        threadId,
        metadata: { role: 'user' },
      });
      remembered = true;
    }

    // Note: The actual agent invocation would need to be customized
    // based on the agent interface. This is a placeholder.
    const response = `Response with memory context available`;

    // Remember the response if enabled
    if (autoRememberResponses && response) {
      await memory.remember(response, {
        threadId,
        metadata: { role: 'assistant' },
        importance: 0.3, // Lower importance for assistant responses
      });
    }

    return {
      response,
      memoryContext,
      remembered,
    };
  };

  enhancedAgent.getMemory = () => memory;

  return enhancedAgent;
}

/**
 * Create memory-aware message processor
 */
export function createMemoryProcessor(memory: MemoryManager) {
  return {
    /**
     * Pre-process: Get memory context before generating response
     */
    async preProcess(
      userMessage: string,
      threadId: string,
      options: { maxMemories?: number } = {}
    ): Promise<{
      memories: string[];
      context: string;
    }> {
      const { maxMemories = 5 } = options;

      const relevantMemories = await memory.recall(userMessage, {
        threadId,
        limit: maxMemories,
      });

      const memories = relevantMemories.map((m) => m.content);
      const context = memories.join('\n\n');

      return { memories, context };
    },

    /**
     * Post-process: Remember the exchange after response
     */
    async postProcess(
      userMessage: string,
      assistantResponse: string,
      threadId: string,
      options: {
        rememberUser?: boolean;
        rememberAssistant?: boolean;
        userImportance?: number;
        assistantImportance?: number;
      } = {}
    ): Promise<void> {
      const {
        rememberUser = true,
        rememberAssistant = false,
        userImportance,
        assistantImportance = 0.3,
      } = options;

      if (rememberUser) {
        await memory.remember(userMessage, {
          threadId,
          importance: userImportance,
          metadata: { role: 'user' },
        });
      }

      if (rememberAssistant) {
        await memory.remember(assistantResponse, {
          threadId,
          importance: assistantImportance,
          metadata: { role: 'assistant' },
        });
      }
    },

    /**
     * Extract and remember important facts from conversation
     */
    async extractFacts(
      conversation: string,
      threadId: string,
      extractFn: (text: string) => Promise<string[]>
    ): Promise<number> {
      const facts = await extractFn(conversation);

      let remembered = 0;
      for (const fact of facts) {
        await memory.remember(fact, {
          threadId,
          type: 'long', // Facts go to long-term memory
          importance: 0.8, // High importance
          metadata: { type: 'fact' },
        });
        remembered++;
      }

      return remembered;
    },
  };
}

/**
 * Middleware function type for agent pipelines
 */
export type MemoryMiddleware = (
  input: { message: string; threadId: string },
  next: () => Promise<string>
) => Promise<string>;

/**
 * Create memory middleware for agent pipelines
 */
export function createMemoryMiddleware(
  memory: MemoryManager,
  options: Omit<WithMemoryOptions, 'memory'> = {}
): MemoryMiddleware {
  const { maxMemoriesInContext = 5, autoRemember = true, autoRememberResponses = false } = options;

  return async (input, next) => {
    const { message, threadId } = input;

    // Remember input if enabled
    if (autoRemember) {
      await memory.remember(message, {
        threadId,
        metadata: { role: 'user' },
      });
    }

    // Get memory context
    const memories = await memory.recall(message, {
      threadId,
      limit: maxMemoriesInContext,
    });

    // Store context for the agent to use
    // This would need integration with your agent's context mechanism
    // For now, we just proceed to next
    const response = await next();

    // Remember response if enabled
    if (autoRememberResponses) {
      await memory.remember(response, {
        threadId,
        importance: 0.3,
        metadata: { role: 'assistant' },
      });
    }

    return response;
  };
}
