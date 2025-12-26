/**
 * @seashore/rag - Web Loader
 *
 * Load content from web pages
 */

import type { DocumentLoader, LoadedDocument, WebLoaderOptions } from '../types.js';

/**
 * Create a web page loader
 */
export function createWebLoader(options: WebLoaderOptions): DocumentLoader {
  const { url, selector, timeout = 30000, headers = {} } = options;

  return {
    async load(): Promise<readonly LoadedDocument[]> {
      // Dynamic import for node-html-parser
      const { parse } = await import('node-html-parser');

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      try {
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'Seashore RAG Loader/1.0',
            Accept: 'text/html',
            ...headers,
          },
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const html = await response.text();
        const root = parse(html);

        // Extract title
        const titleElement = root.querySelector('title');
        const title = titleElement?.text?.trim();

        // Extract content
        let content: string;

        if (selector) {
          const selectedElement = root.querySelector(selector);
          content = selectedElement?.text ?? '';
        } else {
          // Default: extract main content areas
          const mainContent =
            root.querySelector('main') ??
            root.querySelector('article') ??
            root.querySelector('[role="main"]') ??
            root.querySelector('.content') ??
            root.querySelector('#content') ??
            root.querySelector('body');

          // Remove script and style tags
          const scripts = mainContent?.querySelectorAll(
            'script, style, nav, header, footer, aside'
          );
          scripts?.forEach((el) => el.remove());

          content = mainContent?.text ?? '';
        }

        // Clean up whitespace
        content = content
          .replace(/\s+/g, ' ')
          .replace(/\n\s*\n/g, '\n\n')
          .trim();

        // Extract metadata
        const metaDescription = root
          .querySelector('meta[name="description"]')
          ?.getAttribute('content');
        const metaAuthor = root.querySelector('meta[name="author"]')?.getAttribute('content');
        const canonicalUrl = root.querySelector('link[rel="canonical"]')?.getAttribute('href');

        const document: LoadedDocument = {
          content,
          metadata: {
            source: canonicalUrl ?? url,
            sourceType: 'url',
            url,
            mimeType: response.headers.get('content-type') ?? 'text/html',
            title,
            author: metaAuthor,
            description: metaDescription,
          },
        };

        return [document];
      } finally {
        clearTimeout(timeoutId);
      }
    },

    async *loadLazy(): AsyncGenerator<LoadedDocument> {
      const docs = await this.load();
      for (const doc of docs) {
        yield doc;
      }
    },
  };
}

/**
 * Create a loader for multiple web pages
 */
export function createMultiWebLoader(
  urls: readonly string[],
  options: Omit<WebLoaderOptions, 'url'> = {}
): DocumentLoader {
  return {
    async load(): Promise<readonly LoadedDocument[]> {
      const loaders = urls.map((url) => createWebLoader({ url, ...options }));
      const results = await Promise.allSettled(loaders.map((loader) => loader.load()));

      const documents: LoadedDocument[] = [];
      for (const result of results) {
        if (result.status === 'fulfilled') {
          documents.push(...result.value);
        } else {
          console.warn('Failed to load web page:', result.reason);
        }
      }

      return documents;
    },

    async *loadLazy(): AsyncGenerator<LoadedDocument> {
      for (const url of urls) {
        try {
          const loader = createWebLoader({ url, ...options });
          const docs = await loader.load();
          for (const doc of docs) {
            yield doc;
          }
        } catch (error) {
          console.warn(`Failed to load ${url}:`, error);
        }
      }
    },
  };
}

/**
 * Create a loader for sitemap URLs
 */
export function createSitemapLoader(
  sitemapUrl: string,
  options: Omit<WebLoaderOptions, 'url'> & { maxUrls?: number } = {}
): DocumentLoader {
  const { maxUrls = 100, ...webOptions } = options;

  return {
    async load(): Promise<readonly LoadedDocument[]> {
      const { parse } = await import('node-html-parser');

      const response = await fetch(sitemapUrl);
      const xml = await response.text();
      const root = parse(xml);

      // Extract URLs from sitemap
      const urlElements = root.querySelectorAll('loc');
      const urls = urlElements.map((el) => el.text).slice(0, maxUrls);

      const loader = createMultiWebLoader(urls, webOptions);
      return loader.load();
    },

    async *loadLazy(): AsyncGenerator<LoadedDocument> {
      const docs = await this.load();
      for (const doc of docs) {
        yield doc;
      }
    },
  };
}
