/**
 * @seashore/memory - Memory Consolidation
 *
 * Utilities for consolidating and summarizing memories
 */

import type { MemoryEntry, ConsolidationResult } from './types.js';

/**
 * Summarization function type
 */
export type SummarizeFn = (memories: readonly MemoryEntry[]) => Promise<string>;

/**
 * Consolidation strategy
 */
export type ConsolidationStrategy = 'merge' | 'summarize' | 'deduplicate';

/**
 * Consolidation options
 */
export interface ConsolidationOptions {
  /**
   * Strategy to use
   */
  strategy: ConsolidationStrategy;

  /**
   * Maximum memories to consolidate at once
   */
  batchSize?: number;

  /**
   * Summarization function (required for 'summarize' strategy)
   */
  summarizeFn?: SummarizeFn;

  /**
   * Similarity threshold for deduplication (0-1)
   */
  similarityThreshold?: number;
}

/**
 * Merge multiple memories into one
 */
export function mergeMemories(memories: readonly MemoryEntry[]): {
  content: string;
  importance: number;
} {
  if (memories.length === 0) {
    return { content: '', importance: 0 };
  }

  if (memories.length === 1) {
    return {
      content: memories[0]!.content,
      importance: memories[0]!.importance,
    };
  }

  // Sort by time
  const sorted = [...memories].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  // Merge content
  const content = sorted.map((m) => m.content).join('\n\n');

  // Average importance with recency boost
  const totalWeight = sorted.reduce((sum, m, i) => sum + (i + 1), 0);
  const weightedImportance = sorted.reduce((sum, m, i) => sum + m.importance * (i + 1), 0);
  const importance = weightedImportance / totalWeight;

  return { content, importance };
}

/**
 * Calculate text similarity (Jaccard)
 */
export function calculateSimilarity(text1: string, text2: string): number {
  const words1 = new Set(text1.toLowerCase().split(/\s+/));
  const words2 = new Set(text2.toLowerCase().split(/\s+/));

  const intersection = new Set([...words1].filter((w) => words2.has(w)));
  const union = new Set([...words1, ...words2]);

  if (union.size === 0) return 1;
  return intersection.size / union.size;
}

/**
 * Deduplicate memories by content similarity
 */
export function deduplicateMemories(
  memories: readonly MemoryEntry[],
  threshold: number = 0.8
): readonly MemoryEntry[] {
  if (memories.length <= 1) {
    return memories;
  }

  const result: MemoryEntry[] = [];
  const processed = new Set<string>();

  // Sort by importance (keep higher importance ones)
  const sorted = [...memories].sort((a, b) => b.importance - a.importance);

  for (const memory of sorted) {
    if (processed.has(memory.id)) continue;

    let isDuplicate = false;

    for (const existing of result) {
      const similarity = calculateSimilarity(memory.content, existing.content);
      if (similarity >= threshold) {
        isDuplicate = true;
        break;
      }
    }

    if (!isDuplicate) {
      result.push(memory);
    }

    processed.add(memory.id);
  }

  return result;
}

/**
 * Group memories by thread
 */
export function groupByThread(
  memories: readonly MemoryEntry[]
): Map<string | undefined, MemoryEntry[]> {
  const groups = new Map<string | undefined, MemoryEntry[]>();

  for (const memory of memories) {
    const threadId = memory.threadId;
    let group = groups.get(threadId);
    if (!group) {
      group = [];
      groups.set(threadId, group);
    }
    group.push(memory);
  }

  return groups;
}

/**
 * Group memories by time window
 */
export function groupByTimeWindow(
  memories: readonly MemoryEntry[],
  windowMs: number = 3600000 // 1 hour
): MemoryEntry[][] {
  if (memories.length === 0) {
    return [];
  }

  // Sort by time
  const sorted = [...memories].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  const groups: MemoryEntry[][] = [];
  let currentGroup: MemoryEntry[] = [sorted[0]!];
  let windowStart = sorted[0]!.createdAt.getTime();

  for (let i = 1; i < sorted.length; i++) {
    const memory = sorted[i]!;
    const memoryTime = memory.createdAt.getTime();

    if (memoryTime - windowStart <= windowMs) {
      currentGroup.push(memory);
    } else {
      groups.push(currentGroup);
      currentGroup = [memory];
      windowStart = memoryTime;
    }
  }

  if (currentGroup.length > 0) {
    groups.push(currentGroup);
  }

  return groups;
}

/**
 * Extract key points from memories
 */
export function extractKeyPoints(
  memories: readonly MemoryEntry[],
  maxPoints: number = 5
): string[] {
  // Simple extraction based on sentence boundaries and importance
  const allContent = memories.map((m) => m.content).join(' ');

  // Split into sentences
  const sentences = allContent.match(/[^.!?]+[.!?]+/g) ?? [];

  // Score sentences by length and position
  const scored = sentences.map((sentence, index) => {
    const normalizedPosition = 1 - index / sentences.length; // Earlier is better
    const lengthScore = Math.min(sentence.length, 100) / 100; // Moderate length is good
    const score = normalizedPosition * 0.3 + lengthScore * 0.7;
    return { sentence: sentence.trim(), score };
  });

  // Sort by score and take top
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, maxPoints).map((s) => s.sentence);
}

/**
 * Generate a default summary (when LLM not available)
 */
export function generateBasicSummary(memories: readonly MemoryEntry[]): string {
  if (memories.length === 0) {
    return '';
  }

  if (memories.length === 1) {
    return memories[0]!.content;
  }

  const keyPoints = extractKeyPoints(memories, 3);
  const timeRange =
    memories.length > 0
      ? `${new Date(Math.min(...memories.map((m) => m.createdAt.getTime()))).toLocaleString()} - ${new Date(Math.max(...memories.map((m) => m.createdAt.getTime()))).toLocaleString()}`
      : '';

  return `Summary of ${memories.length} memories (${timeRange}):\n${keyPoints.map((p) => `- ${p}`).join('\n')}`;
}

/**
 * Create a consolidation pipeline
 */
export function createConsolidationPipeline(options: ConsolidationOptions): (
  memories: readonly MemoryEntry[]
) => Promise<{
  content: string;
  importance: number;
}> {
  const { strategy, batchSize = 10, summarizeFn, similarityThreshold = 0.8 } = options;

  return async (memories: readonly MemoryEntry[]) => {
    // First deduplicate
    let processed = deduplicateMemories(memories, similarityThreshold);

    // Limit batch size
    if (processed.length > batchSize) {
      processed = processed.slice(0, batchSize);
    }

    switch (strategy) {
      case 'summarize':
        if (summarizeFn) {
          const summary = await summarizeFn(processed);
          const avgImportance =
            processed.reduce((sum, m) => sum + m.importance, 0) / processed.length;
          return { content: summary, importance: avgImportance };
        }
        return {
          content: generateBasicSummary(processed),
          importance: processed.reduce((sum, m) => sum + m.importance, 0) / processed.length,
        };

      case 'deduplicate':
        return mergeMemories(processed);

      case 'merge':
      default:
        return mergeMemories(processed);
    }
  };
}
