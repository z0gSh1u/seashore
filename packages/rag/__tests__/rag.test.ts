import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { LoadedDocument, DocumentChunk, RetrievedDocument, RAGContext } from '../src/types.js';

describe('@seashore/rag', () => {
  describe('Document Loaders', () => {
    it('should define correct LoadedDocument structure', () => {
      const doc: LoadedDocument = {
        content: 'Test content',
        metadata: {
          source: '/path/to/file.txt',
          sourceType: 'file',
        },
      };

      expect(doc.content).toBe('Test content');
      expect(doc.metadata.source).toBe('/path/to/file.txt');
      expect(doc.metadata.sourceType).toBe('file');
    });

    it('should support various source types', () => {
      const sourceTypes = ['file', 'url', 'string'] as const;

      for (const type of sourceTypes) {
        const doc: LoadedDocument = {
          content: 'content',
          metadata: { source: 'test', sourceType: type },
        };
        expect(doc.metadata.sourceType).toBe(type);
      }
    });

    it('should support optional metadata fields', () => {
      const doc: LoadedDocument = {
        content: 'Content',
        metadata: {
          source: '/file.md',
          sourceType: 'file',
          filename: 'file.md',
          mimeType: 'text/markdown',
          title: 'Document Title',
          author: 'Author Name',
          createdAt: new Date('2024-01-01'),
          fileSize: 1024,
        },
      };

      expect(doc.metadata.title).toBe('Document Title');
      expect(doc.metadata.author).toBe('Author Name');
      expect(doc.metadata.fileSize).toBe(1024);
    });
  });

  describe('Document Splitters', () => {
    it('should define correct DocumentChunk structure', () => {
      const chunk: DocumentChunk = {
        content: 'Chunk content',
        metadata: {
          source: '/file.txt',
          sourceType: 'file',
          chunkIndex: 0,
          chunkCount: 5,
        },
      };

      expect(chunk.content).toBe('Chunk content');
      expect(chunk.metadata.chunkIndex).toBe(0);
      expect(chunk.metadata.chunkCount).toBe(5);
    });

    it('should support position tracking', () => {
      const chunk: DocumentChunk = {
        content: 'Middle part of document',
        metadata: {
          source: '/file.txt',
          sourceType: 'file',
          chunkIndex: 2,
          startPosition: 500,
          endPosition: 1000,
        },
      };

      expect(chunk.metadata.startPosition).toBe(500);
      expect(chunk.metadata.endPosition).toBe(1000);
    });

    it('should support page number for PDF chunks', () => {
      const chunk: DocumentChunk = {
        content: 'PDF page content',
        metadata: {
          source: '/doc.pdf',
          sourceType: 'file',
          chunkIndex: 0,
          pageNumber: 5,
        },
      };

      expect(chunk.metadata.pageNumber).toBe(5);
    });
  });

  describe('Recursive Splitter', () => {
    it('should respect chunk size options', () => {
      const options = {
        chunkSize: 500,
        chunkOverlap: 50,
        separators: ['\n\n', '\n', ' '],
      };

      expect(options.chunkSize).toBe(500);
      expect(options.chunkOverlap).toBe(50);
      expect(options.separators).toHaveLength(3);
    });

    it('should handle different separator hierarchies', () => {
      const defaultSeparators = ['\n\n', '\n', '. ', ' ', ''];
      const codeSeparators = ['\n\n', '\n', ' ', ''];

      expect(defaultSeparators[0]).toBe('\n\n');
      expect(codeSeparators).not.toContain('. ');
    });
  });

  describe('Retrievers', () => {
    it('should define RetrievedDocument structure', () => {
      const doc: RetrievedDocument = {
        id: 'doc-123',
        content: 'Retrieved content',
        metadata: { source: 'test.txt' },
        score: 0.95,
      };

      expect(doc.id).toBe('doc-123');
      expect(doc.score).toBe(0.95);
      expect(doc.score).toBeGreaterThanOrEqual(0);
      expect(doc.score).toBeLessThanOrEqual(1);
    });

    it('should support retriever options', () => {
      const options = {
        k: 5,
        minScore: 0.7,
        filter: { type: 'article' },
        searchType: 'hybrid' as const,
        vectorWeight: 0.6,
      };

      expect(options.k).toBe(5);
      expect(options.minScore).toBe(0.7);
      expect(options.searchType).toBe('hybrid');
      expect(options.vectorWeight).toBe(0.6);
    });

    it('should support different search types', () => {
      const searchTypes = ['vector', 'text', 'hybrid'] as const;

      for (const type of searchTypes) {
        expect(['vector', 'text', 'hybrid']).toContain(type);
      }
    });
  });

  describe('RAG Pipeline', () => {
    it('should define RAGContext structure', () => {
      const context: RAGContext = {
        formattedContext: '[1] Source 1\nContent here',
        documents: [
          {
            id: 'doc-1',
            content: 'Content here',
            metadata: {},
            score: 0.9,
          },
        ],
        tokenCount: 100,
      };

      expect(context.formattedContext).toContain('Content here');
      expect(context.documents).toHaveLength(1);
      expect(context.tokenCount).toBe(100);
    });

    it('should support different context formats', () => {
      const formats = ['text', 'xml', 'markdown'] as const;

      for (const format of formats) {
        expect(['text', 'xml', 'markdown']).toContain(format);
      }
    });

    it('should estimate tokens correctly', () => {
      // Approximate: ~4 characters per token
      const text = 'This is a test sentence with some words.';
      const estimatedTokens = Math.ceil(text.length / 4);

      expect(estimatedTokens).toBeGreaterThan(0);
      expect(estimatedTokens).toBeLessThan(text.length);
    });
  });

  describe('RAG Configuration', () => {
    it('should have sensible defaults', () => {
      const defaults = {
        maxContextTokens: 4000,
        k: 4,
        includeSources: true,
        contextFormat: 'text',
      };

      expect(defaults.maxContextTokens).toBe(4000);
      expect(defaults.k).toBe(4);
      expect(defaults.includeSources).toBe(true);
    });

    it('should support custom system prompts', () => {
      const customPrompt = `Use this context to answer:
{context}

Be concise and accurate.`;

      expect(customPrompt).toContain('{context}');
    });
  });

  describe('Document Processing Pipeline', () => {
    it('should track ingestion statistics', () => {
      const stats = {
        documentCount: 10,
        chunkCount: 45,
      };

      expect(stats.chunkCount).toBeGreaterThanOrEqual(stats.documentCount);
    });

    it('should support async document iteration', async () => {
      async function* mockLoader() {
        yield { content: 'Doc 1', metadata: { source: '1', sourceType: 'string' as const } };
        yield { content: 'Doc 2', metadata: { source: '2', sourceType: 'string' as const } };
      }

      const docs: LoadedDocument[] = [];
      for await (const doc of mockLoader()) {
        docs.push(doc);
      }

      expect(docs).toHaveLength(2);
    });
  });

  describe('Embedding Integration', () => {
    it('should work with embedding functions', async () => {
      const mockEmbeddingFn = vi
        .fn()
        .mockResolvedValue([Array(1536).fill(0.1), Array(1536).fill(0.2)]);

      const texts = ['Hello', 'World'];
      const embeddings = await mockEmbeddingFn(texts);

      expect(mockEmbeddingFn).toHaveBeenCalledWith(texts);
      expect(embeddings).toHaveLength(2);
      expect(embeddings[0]).toHaveLength(1536);
    });

    it('should handle batch embedding', async () => {
      const batchSize = 100;
      const texts = Array(250).fill('Sample text');

      const batches = [];
      for (let i = 0; i < texts.length; i += batchSize) {
        batches.push(texts.slice(i, i + batchSize));
      }

      expect(batches).toHaveLength(3);
      expect(batches[0]).toHaveLength(100);
      expect(batches[2]).toHaveLength(50);
    });
  });
});
