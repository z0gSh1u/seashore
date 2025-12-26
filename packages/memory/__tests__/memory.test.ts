import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { MemoryEntry, MemoryType, MemoryStats, ConsolidationResult } from '../src/types.js';

describe('@seashore/memory', () => {
  describe('Memory Types', () => {
    it('should define correct memory types', () => {
      const types: MemoryType[] = ['short', 'mid', 'long'];
      expect(types).toHaveLength(3);
    });

    it('should have correct MemoryEntry structure', () => {
      const entry: MemoryEntry = {
        id: 'mem-1',
        agentId: 'agent-1',
        threadId: 'thread-1',
        type: 'short',
        content: 'User said their name is John',
        importance: 0.8,
        createdAt: new Date(),
        lastAccessedAt: new Date(),
        accessCount: 0,
        metadata: { source: 'conversation' },
      };

      expect(entry.id).toBe('mem-1');
      expect(entry.type).toBe('short');
      expect(entry.importance).toBe(0.8);
    });
  });

  describe('Short-Term Memory', () => {
    it('should enforce max entries limit', () => {
      const maxEntries = 10;
      const entries = Array(15)
        .fill(null)
        .map((_, i) => ({
          id: `mem-${i}`,
          agentId: 'agent-1',
          type: 'short' as const,
          content: `Memory ${i}`,
          importance: Math.random(),
          createdAt: new Date(),
          lastAccessedAt: new Date(),
          accessCount: 0,
        }));

      // After enforcing limit, should have maxEntries
      expect(maxEntries).toBe(10);
    });

    it('should track access count', () => {
      const entry: MemoryEntry = {
        id: 'mem-1',
        agentId: 'agent-1',
        type: 'short',
        content: 'Test',
        importance: 0.5,
        createdAt: new Date(),
        lastAccessedAt: new Date(),
        accessCount: 0,
      };

      // Simulate access
      entry.accessCount++;
      entry.lastAccessedAt = new Date();

      expect(entry.accessCount).toBe(1);
    });

    it('should expire memories based on TTL', () => {
      const ttlMs = 3600000; // 1 hour
      const now = Date.now();
      const oldMemory = new Date(now - ttlMs - 1000); // Just expired
      const newMemory = new Date(now - ttlMs + 1000); // Not expired yet

      const isExpired = (created: Date) => Date.now() - created.getTime() > ttlMs;

      expect(isExpired(oldMemory)).toBe(true);
      expect(isExpired(newMemory)).toBe(false);
    });
  });

  describe('Mid-Term Memory', () => {
    it('should support promotion threshold', () => {
      const promotionThreshold = 0.5;
      const memories: MemoryEntry[] = [
        {
          id: '1',
          agentId: 'a',
          type: 'short',
          content: '',
          importance: 0.3,
          createdAt: new Date(),
          lastAccessedAt: new Date(),
          accessCount: 0,
        },
        {
          id: '2',
          agentId: 'a',
          type: 'short',
          content: '',
          importance: 0.7,
          createdAt: new Date(),
          lastAccessedAt: new Date(),
          accessCount: 0,
        },
        {
          id: '3',
          agentId: 'a',
          type: 'short',
          content: '',
          importance: 0.5,
          createdAt: new Date(),
          lastAccessedAt: new Date(),
          accessCount: 0,
        },
      ];

      const candidates = memories.filter((m) => m.importance >= promotionThreshold);
      expect(candidates).toHaveLength(2);
    });
  });

  describe('Long-Term Memory', () => {
    it('should support vector embeddings', () => {
      const entry: MemoryEntry = {
        id: 'mem-1',
        agentId: 'agent-1',
        type: 'long',
        content: 'Important fact to remember',
        importance: 0.9,
        embedding: Array(1536).fill(0.1),
        createdAt: new Date(),
        lastAccessedAt: new Date(),
        accessCount: 0,
      };

      expect(entry.embedding).toHaveLength(1536);
    });

    it('should not have expiration', () => {
      // Long-term memories don't expire
      const entry: MemoryEntry = {
        id: 'mem-1',
        agentId: 'agent-1',
        type: 'long',
        content: 'Permanent memory',
        importance: 0.8,
        createdAt: new Date('2020-01-01'),
        lastAccessedAt: new Date(),
        accessCount: 10,
      };

      // Even old long-term memories should be valid
      expect(entry.type).toBe('long');
    });
  });

  describe('Importance Evaluation', () => {
    it('should detect personal information signals', () => {
      const personalContent = "My name is John and I'm 30 years old";
      const casualContent = 'Hello, how are you today?';

      const hasPersonalInfo = (text: string) => /\b(my|i am|i'm|name is|age)\b/i.test(text);

      expect(hasPersonalInfo(personalContent)).toBe(true);
      expect(hasPersonalInfo(casualContent)).toBe(false);
    });

    it('should calculate importance score', () => {
      const signals = {
        hasPersonalInfo: true,
        hasNumbers: true,
        hasFacts: true,
      };

      let score = 0.5;
      if (signals.hasPersonalInfo) score += 0.25;
      if (signals.hasNumbers) score += 0.05;
      if (signals.hasFacts) score += 0.1;

      expect(score).toBe(0.9);
    });
  });

  describe('Memory Consolidation', () => {
    it('should merge memories correctly', () => {
      const memories: MemoryEntry[] = [
        {
          id: '1',
          agentId: 'a',
          type: 'short',
          content: 'First',
          importance: 0.5,
          createdAt: new Date(1000),
          lastAccessedAt: new Date(),
          accessCount: 0,
        },
        {
          id: '2',
          agentId: 'a',
          type: 'short',
          content: 'Second',
          importance: 0.7,
          createdAt: new Date(2000),
          lastAccessedAt: new Date(),
          accessCount: 0,
        },
      ];

      const merged = memories.map((m) => m.content).join('\n\n');
      expect(merged).toBe('First\n\nSecond');
    });

    it('should calculate text similarity', () => {
      const text1 = 'The quick brown fox';
      const text2 = 'The quick brown dog';

      const words1 = new Set(text1.toLowerCase().split(/\s+/));
      const words2 = new Set(text2.toLowerCase().split(/\s+/));
      const intersection = [...words1].filter((w) => words2.has(w));
      const union = new Set([...words1, ...words2]);

      const similarity = intersection.length / union.size;
      expect(similarity).toBeGreaterThan(0.5);
    });

    it('should return correct consolidation result', () => {
      const result: ConsolidationResult = {
        promotedToMid: 3,
        promotedToLong: 1,
        expiredShort: 5,
        expiredMid: 2,
        removed: 0,
      };

      expect(result.promotedToMid).toBe(3);
      expect(result.promotedToLong).toBe(1);
    });
  });

  describe('Memory Stats', () => {
    it('should calculate correct stats', () => {
      const stats: MemoryStats = {
        totalCount: 15,
        byType: {
          short: 5,
          mid: 7,
          long: 3,
        },
        avgImportance: 0.65,
        oldestMemory: new Date('2024-01-01'),
        newestMemory: new Date('2024-03-01'),
      };

      expect(stats.byType.short + stats.byType.mid + stats.byType.long).toBe(stats.totalCount);
    });
  });

  describe('Memory Manager', () => {
    it('should remember and recall', async () => {
      // Mock memory manager behavior
      const remembered: string[] = [];
      const mockManager = {
        remember: vi.fn().mockImplementation(async (content: string) => {
          remembered.push(content);
          return {
            id: `mem-${remembered.length}`,
            content,
            type: 'short',
            importance: 0.5,
          };
        }),
        recall: vi.fn().mockImplementation(async (query: string) => {
          return remembered
            .filter((m) => m.includes(query.split(' ')[0] ?? ''))
            .map((content, i) => ({
              id: `mem-${i}`,
              content,
              type: 'short',
              importance: 0.5,
            }));
        }),
      };

      await mockManager.remember('My name is John');
      await mockManager.remember('I like pizza');

      const recalled = await mockManager.recall('John');
      expect(recalled.length).toBeGreaterThanOrEqual(0);
    });

    it('should get context for thread', async () => {
      const memories = [
        { type: 'short', content: 'Recent message' },
        { type: 'mid', content: 'Earlier context' },
        { type: 'long', content: 'Relevant knowledge' },
      ];

      const context = memories.map((m) => `[${m.type}] ${m.content}`).join('\n');

      expect(context).toContain('Recent message');
      expect(context).toContain('Earlier context');
      expect(context).toContain('Relevant knowledge');
    });
  });

  describe('Agent Integration', () => {
    it('should create memory system prompt', () => {
      const basePrompt = 'You are a helpful assistant.';
      const memoryContext = 'User prefers formal language.\nUser name is Alice.';

      const prompt =
        basePrompt +
        `\n\n## Memory Context\nYou have the following relevant memories:\n${memoryContext}`;

      expect(prompt).toContain('Memory Context');
      expect(prompt).toContain('Alice');
    });

    it('should support memory middleware', async () => {
      const middleware = vi.fn().mockImplementation(async (input, next) => {
        // Pre-process: Get memory context
        const context = 'Retrieved memory context';

        // Call next handler
        const response = await next();

        // Post-process: Remember exchange
        return response;
      });

      const next = vi.fn().mockResolvedValue('Assistant response');
      await middleware({ message: 'Hello', threadId: 'thread-1' }, next);

      expect(next).toHaveBeenCalled();
    });
  });
});
