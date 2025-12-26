/**
 * @seashore/rag - Text Loader
 *
 * Load plain text files
 */

import { readFile, stat } from 'fs/promises';
import { basename, resolve } from 'path';
import type { DocumentLoader, LoadedDocument, TextLoaderOptions } from '../types.js';

/**
 * Create a text file loader
 */
export function createTextLoader(options: TextLoaderOptions): DocumentLoader {
  const { path, encoding = 'utf-8' } = options;
  const absolutePath = resolve(path);

  return {
    async load(): Promise<readonly LoadedDocument[]> {
      const content = await readFile(absolutePath, { encoding });
      const stats = await stat(absolutePath);

      const document: LoadedDocument = {
        content,
        metadata: {
          source: absolutePath,
          sourceType: 'file',
          filename: basename(absolutePath),
          mimeType: 'text/plain',
          fileSize: stats.size,
          createdAt: stats.birthtime,
          modifiedAt: stats.mtime,
          encoding,
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
 * Create a loader from a raw string
 */
export function createStringLoader(
  content: string,
  metadata: Partial<LoadedDocument['metadata']> = {}
): DocumentLoader {
  return {
    async load(): Promise<readonly LoadedDocument[]> {
      const document: LoadedDocument = {
        content,
        metadata: {
          source: 'string',
          sourceType: 'string',
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

/**
 * Create a loader for multiple text files
 */
export function createMultiTextLoader(
  paths: readonly string[],
  encoding: BufferEncoding = 'utf-8'
): DocumentLoader {
  return {
    async load(): Promise<readonly LoadedDocument[]> {
      const loaders = paths.map((path) => createTextLoader({ path, encoding }));
      const results = await Promise.all(loaders.map((loader) => loader.load()));
      return results.flat();
    },

    async *loadLazy(): AsyncGenerator<LoadedDocument> {
      for (const path of paths) {
        const loader = createTextLoader({ path, encoding });
        const docs = await loader.load();
        for (const doc of docs) {
          yield doc;
        }
      }
    },
  };
}

/**
 * Create a loader that reads from glob patterns
 */
export function createGlobLoader(
  patterns: readonly string[],
  options: { encoding?: BufferEncoding; cwd?: string } = {}
): DocumentLoader {
  // Note: In production, use a glob library like 'fast-glob'
  // This is a simplified implementation
  return {
    async load(): Promise<readonly LoadedDocument[]> {
      // For now, treat patterns as literal paths
      // Real implementation would expand globs
      const loader = createMultiTextLoader(patterns as string[], options.encoding);
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
