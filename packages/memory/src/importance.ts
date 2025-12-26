/**
 * @seashore/memory - Importance Evaluation
 *
 * Evaluate the importance of memories for consolidation
 */

import type { ImportanceEvaluator, MemoryEntry } from './types.js';

/**
 * Importance signals detected in content
 */
export interface ImportanceSignals {
  hasPersonalInfo: boolean;
  hasNumbers: boolean;
  hasNames: boolean;
  hasQuestions: boolean;
  hasFacts: boolean;
  hasInstructions: boolean;
  hasEmotions: boolean;
  length: 'short' | 'medium' | 'long';
}

/**
 * Detect importance signals in content
 */
export function detectSignals(content: string): ImportanceSignals {
  const lower = content.toLowerCase();
  const words = content.split(/\s+/);

  return {
    // Personal info indicators
    hasPersonalInfo:
      /\b(my|i am|i'm|name is|called|live in|work at|born|age|phone|email|address)\b/i.test(
        content
      ),

    // Numbers (dates, quantities, etc.)
    hasNumbers: /\d+/.test(content),

    // Proper names (capitalized words)
    hasNames: /\b[A-Z][a-z]+\b/.test(content) && words.length > 2,

    // Questions
    hasQuestions: /\?/.test(content) || /^(who|what|where|when|why|how)\b/i.test(content),

    // Factual statements
    hasFacts: /\b(is|are|was|were|has|have|will|can|must|should)\b/.test(lower) && !hasQuestions,

    // Instructions or commands
    hasInstructions: /\b(remember|note|always|never|important|please|don't|must|should)\b/i.test(
      content
    ),

    // Emotional content
    hasEmotions:
      /\b(love|hate|happy|sad|angry|excited|worried|afraid|great|terrible|amazing)\b/i.test(
        content
      ),

    // Content length
    length: content.length < 50 ? 'short' : content.length < 200 ? 'medium' : 'long',
  };

  function hasQuestions(): boolean {
    return /\?/.test(content);
  }
}

/**
 * Calculate importance score from signals
 */
export function calculateImportance(signals: ImportanceSignals): number {
  let score = 0.5; // Base score

  // Personal information is highly important
  if (signals.hasPersonalInfo) {
    score += 0.25;
  }

  // Facts and instructions are important
  if (signals.hasFacts) {
    score += 0.1;
  }
  if (signals.hasInstructions) {
    score += 0.2;
  }

  // Names and numbers indicate specific information
  if (signals.hasNames) {
    score += 0.1;
  }
  if (signals.hasNumbers) {
    score += 0.05;
  }

  // Questions might be important context
  if (signals.hasQuestions) {
    score += 0.05;
  }

  // Emotional content can be important
  if (signals.hasEmotions) {
    score += 0.05;
  }

  // Length adjustments
  if (signals.length === 'short') {
    score -= 0.1; // Very short content is less likely to be important
  } else if (signals.length === 'long') {
    score += 0.05; // Longer content has more information
  }

  // Clamp to [0, 1]
  return Math.max(0, Math.min(1, score));
}

/**
 * Default importance evaluator (rule-based)
 */
export const defaultImportanceEvaluator: ImportanceEvaluator = async (
  content: string,
  context?: { threadId?: string; recentMemories?: readonly MemoryEntry[] }
) => {
  const signals = detectSignals(content);
  let importance = calculateImportance(signals);

  // Boost importance if content relates to recent memories
  if (context?.recentMemories && context.recentMemories.length > 0) {
    const recentContent = context.recentMemories.map((m) => m.content.toLowerCase()).join(' ');

    // Check for topic continuity
    const contentWords = new Set(content.toLowerCase().split(/\s+/));
    const recentWords = new Set(recentContent.split(/\s+/));
    const overlap = [...contentWords].filter((w) => recentWords.has(w) && w.length > 3);

    if (overlap.length > 5) {
      importance += 0.1; // Boost for topic continuity
    }
  }

  return Math.max(0, Math.min(1, importance));
};

/**
 * Create an LLM-based importance evaluator
 */
export function createImportanceEvaluator(
  evaluateFn: (content: string) => Promise<number>
): ImportanceEvaluator {
  return async (content: string, context) => {
    try {
      return await evaluateFn(content);
    } catch {
      // Fall back to rule-based
      return defaultImportanceEvaluator(content, context);
    }
  };
}

/**
 * Create a hybrid evaluator (rules + LLM)
 */
export function createHybridEvaluator(
  llmEvaluator: (content: string) => Promise<number>,
  llmWeight: number = 0.7
): ImportanceEvaluator {
  const ruleWeight = 1 - llmWeight;

  return async (content: string, context) => {
    const ruleImportance = await defaultImportanceEvaluator(content, context);

    try {
      const llmImportance = await llmEvaluator(content);
      return ruleImportance * ruleWeight + llmImportance * llmWeight;
    } catch {
      return ruleImportance;
    }
  };
}

/**
 * Prompt template for LLM-based importance evaluation
 */
export const IMPORTANCE_PROMPT_TEMPLATE = `Rate the importance of the following memory for an AI assistant on a scale of 0 to 1.

Consider these factors:
- Personal information about the user (name, preferences, etc.) = HIGH
- Factual information the user wants remembered = HIGH
- Instructions or preferences = HIGH
- Casual conversation or greetings = LOW
- Repeated or redundant information = LOW

Memory: "{content}"

Return only a number between 0 and 1.`;

/**
 * Parse importance from LLM response
 */
export function parseImportanceResponse(response: string): number {
  const match = response.match(/([0-9]*\.?[0-9]+)/);
  if (match) {
    const value = parseFloat(match[1]!);
    if (!isNaN(value) && value >= 0 && value <= 1) {
      return value;
    }
  }
  return 0.5; // Default if parsing fails
}
