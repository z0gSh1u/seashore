/**
 * @seashore/rag - Markdown Loader
 *
 * Load markdown files with optional frontmatter extraction
 */

import { readFile, stat } from 'fs/promises';
import { basename, resolve } from 'path';
import type { DocumentLoader, LoadedDocument, MarkdownLoaderOptions } from '../types.js';

/**
 * Parse YAML-like frontmatter (simplified)
 */
function parseFrontmatter(content: string): {
  metadata: Record<string, string>;
  content: string;
} {
  const frontmatterRegex = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/;
  const match = content.match(frontmatterRegex);

  if (!match) {
    return { metadata: {}, content };
  }

  const frontmatterStr = match[1];
  const metadata: Record<string, string> = {};

  // Simple key: value parsing
  const lines = frontmatterStr?.split('\n') ?? [];
  for (const line of lines) {
    const colonIndex = line.indexOf(':');
    if (colonIndex > 0) {
      const key = line.slice(0, colonIndex).trim();
      let value = line.slice(colonIndex + 1).trim();

      // Remove quotes
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      metadata[key] = value;
    }
  }

  return {
    metadata,
    content: content.slice(match[0].length),
  };
}

/**
 * Extract title from markdown (first H1)
 */
function extractTitle(content: string): string | undefined {
  const titleMatch = content.match(/^#\s+(.+)$/m);
  return titleMatch?.[1]?.trim();
}

/**
 * Create a markdown file loader
 */
export function createMarkdownLoader(options: MarkdownLoaderOptions): DocumentLoader {
  const { path, extractMetadata = true } = options;
  const absolutePath = resolve(path);

  return {
    async load(): Promise<readonly LoadedDocument[]> {
      const rawContent = await readFile(absolutePath, 'utf-8');
      const stats = await stat(absolutePath);

      let content = rawContent;
      let frontmatterMetadata: Record<string, string> = {};

      if (extractMetadata) {
        const parsed = parseFrontmatter(rawContent);
        content = parsed.content;
        frontmatterMetadata = parsed.metadata;
      }

      const title = frontmatterMetadata['title'] ?? extractTitle(content);

      const document: LoadedDocument = {
        content,
        metadata: {
          source: absolutePath,
          sourceType: 'file',
          filename: basename(absolutePath),
          mimeType: 'text/markdown',
          fileSize: stats.size,
          createdAt: stats.birthtime,
          modifiedAt: stats.mtime,
          title,
          ...frontmatterMetadata,
        },
      };

      return [document];
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
 * Create a loader for multiple markdown files
 */
export function createMultiMarkdownLoader(
  paths: readonly string[],
  extractMetadata = true
): DocumentLoader {
  return {
    async load(): Promise<readonly LoadedDocument[]> {
      const loaders = paths.map((path) => createMarkdownLoader({ path, extractMetadata }));
      const results = await Promise.all(loaders.map((loader) => loader.load()));
      return results.flat();
    },

    async *loadLazy(): AsyncGenerator<LoadedDocument> {
      for (const path of paths) {
        const loader = createMarkdownLoader({ path, extractMetadata });
        const docs = await loader.load();
        for (const doc of docs) {
          yield doc;
        }
      }
    },
  };
}

/**
 * Create a loader from raw markdown string
 */
export function createMarkdownStringLoader(
  markdown: string,
  metadata: Partial<LoadedDocument['metadata']> = {}
): DocumentLoader {
  return {
    async load(): Promise<readonly LoadedDocument[]> {
      const parsed = parseFrontmatter(markdown);
      const title = parsed.metadata['title'] ?? extractTitle(parsed.content);

      const document: LoadedDocument = {
        content: parsed.content,
        metadata: {
          source: 'string',
          sourceType: 'string',
          mimeType: 'text/markdown',
          title,
          ...parsed.metadata,
          ...metadata,
        },
      };

      return [document];
    },

    async *loadLazy(): AsyncGenerator<LoadedDocument> {
      const docs = await this.load();
      for (const doc of docs) {
        yield doc;
      }
    },
  };
}
