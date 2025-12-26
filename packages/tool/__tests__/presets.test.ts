/**
 * @seashore/tool - Preset Tools Tests
 *
 * Tests for preset tools (serper, firecrawl)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { serperTool } from '../src/presets/serper.js';
import { firecrawlTool } from '../src/presets/firecrawl.js';

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('Preset Tools', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('serperTool', () => {
    const tool = serperTool({ apiKey: 'test-api-key' });

    it('should have correct metadata', () => {
      expect(tool.name).toBe('serper_search');
      expect(tool.description).toContain('search');
      expect(tool.jsonSchema).toBeDefined();
    });

    it('should validate input correctly', () => {
      expect(tool.validate({ query: 'test query' })).toBe(true);
      expect(tool.validate({ query: 'test', num: 5 })).toBe(true);
      expect(tool.validate({ query: 'test', type: 'news' })).toBe(true);

      expect(tool.validate({})).toBe(false);
      expect(tool.validate({ query: '' })).toBe(false);
      expect(tool.validate({ query: 123 })).toBe(false);
    });

    it('should execute search successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          organic: [
            {
              title: 'Test Result',
              link: 'https://example.com',
              snippet: 'This is a test result',
              position: 1,
            },
          ],
          searchParameters: {
            q: 'test query',
          },
        }),
      });

      const result = await tool.execute({ query: 'test query' });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.results).toHaveLength(1);
      expect(result.data?.results[0]?.title).toBe('Test Result');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://google.serper.dev/search',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'X-API-KEY': 'test-api-key',
          }),
        })
      );
    });

    it('should handle search types', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          news: [
            {
              title: 'News Article',
              link: 'https://news.com/article',
              snippet: 'Breaking news',
              date: '2024-01-01',
            },
          ],
        }),
      });

      const result = await tool.execute({ query: 'latest news', type: 'news' });

      expect(result.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith('https://google.serper.dev/news', expect.any(Object));
    });

    it('should handle API errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
      });

      const result = await tool.execute({ query: 'test' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('401');
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await tool.execute({ query: 'test' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Network error');
    });
  });

  describe('firecrawlTool', () => {
    const tool = firecrawlTool({ apiKey: 'test-api-key' });

    it('should have correct metadata', () => {
      expect(tool.name).toBe('firecrawl_scrape');
      expect(tool.description).toContain('scrape');
      expect(tool.jsonSchema).toBeDefined();
    });

    it('should validate input correctly', () => {
      expect(tool.validate({ url: 'https://example.com' })).toBe(true);
      expect(tool.validate({ url: 'https://example.com', formats: ['markdown'] })).toBe(true);

      expect(tool.validate({})).toBe(false);
      expect(tool.validate({ url: 'not-a-url' })).toBe(false);
      expect(tool.validate({ url: '' })).toBe(false);
    });

    it('should execute scrape successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            markdown: '# Test Page\n\nThis is test content.',
            metadata: {
              title: 'Test Page',
              description: 'A test page',
              url: 'https://example.com',
            },
          },
        }),
      });

      const result = await tool.execute({ url: 'https://example.com' });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.markdown).toContain('Test Page');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.firecrawl.dev/v1/scrape',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer test-api-key',
          }),
        })
      );
    });

    it('should handle format options', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            html: '<h1>Test</h1>',
            markdown: '# Test',
          },
        }),
      });

      await tool.execute({
        url: 'https://example.com',
        formats: ['markdown', 'html'],
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('"formats":["markdown","html"]'),
        })
      );
    });

    it('should handle API errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
      });

      const result = await tool.execute({ url: 'https://example.com' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('429');
    });

    it('should handle scrape failures', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: false,
          error: 'Page not found',
        }),
      });

      const result = await tool.execute({ url: 'https://example.com/404' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Page not found');
    });

    it('should include waitFor option', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: { markdown: 'content' },
        }),
      });

      await tool.execute({
        url: 'https://example.com',
        waitFor: 5000,
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('"waitFor":5000'),
        })
      );
    });
  });

  describe('Tool Schema Integration', () => {
    it('should have valid JSON schemas for LLM function calling', () => {
      const serper = serperTool({ apiKey: 'key' });
      const firecrawl = firecrawlTool({ apiKey: 'key' });

      // Serper schema
      expect(serper.jsonSchema.type).toBe('object');
      expect(serper.jsonSchema.properties).toHaveProperty('query');
      expect(serper.jsonSchema.required).toContain('query');

      // Firecrawl schema
      expect(firecrawl.jsonSchema.type).toBe('object');
      expect(firecrawl.jsonSchema.properties).toHaveProperty('url');
      expect(firecrawl.jsonSchema.required).toContain('url');
    });

    it('should parse valid inputs without throwing', () => {
      const serper = serperTool({ apiKey: 'key' });
      const firecrawl = firecrawlTool({ apiKey: 'key' });

      expect(() => serper.parse({ query: 'test' })).not.toThrow();
      expect(() => firecrawl.parse({ url: 'https://example.com' })).not.toThrow();
    });

    it('should throw on invalid inputs', () => {
      const serper = serperTool({ apiKey: 'key' });
      const firecrawl = firecrawlTool({ apiKey: 'key' });

      expect(() => serper.parse({})).toThrow();
      expect(() => firecrawl.parse({ url: 'invalid' })).toThrow();
    });
  });
});
