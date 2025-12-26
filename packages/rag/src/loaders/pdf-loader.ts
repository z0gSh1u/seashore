/**
 * @seashore/rag - PDF Loader
 *
 * Load PDF documents using pdf-parse
 */

import { readFile, stat } from 'fs/promises';
import { basename, resolve } from 'path';
import type { DocumentLoader, LoadedDocument, PDFLoaderOptions } from '../types.js';

/**
 * PDF parse result type
 */
interface PDFParseResult {
  numpages: number;
  text: string;
  info?: {
    Title?: string;
    Author?: string;
    Creator?: string;
    Producer?: string;
    CreationDate?: string;
    ModDate?: string;
  };
  metadata?: unknown;
}

/**
 * Create a PDF file loader
 */
export function createPDFLoader(options: PDFLoaderOptions): DocumentLoader {
  const { path, splitPages = false } = options;
  const absolutePath = resolve(path);

  return {
    async load(): Promise<readonly LoadedDocument[]> {
      // Dynamic import for pdf-parse
      const pdfParse = (await import('pdf-parse')).default;

      const dataBuffer = await readFile(absolutePath);
      const stats = await stat(absolutePath);

      // Parse options for page-by-page extraction
      const parseOptions = splitPages
        ? {
            pagerender: (pageData: {
              getTextContent: () => Promise<{ items: { str: string }[] }>;
            }) => {
              return pageData.getTextContent().then((textContent) => {
                return textContent.items.map((item) => item.str).join(' ');
              });
            },
          }
        : {};

      const data: PDFParseResult = await pdfParse(dataBuffer, parseOptions);

      const baseMetadata = {
        source: absolutePath,
        sourceType: 'file' as const,
        filename: basename(absolutePath),
        mimeType: 'application/pdf',
        fileSize: stats.size,
        createdAt: stats.birthtime,
        modifiedAt: stats.mtime,
        title: data.info?.Title,
        author: data.info?.Author,
        pageCount: data.numpages,
      };

      if (splitPages && data.numpages > 1) {
        // For page splitting, we'd need a more sophisticated approach
        // This is a simplified version that returns the whole document
        // In production, use pdf-lib or similar for page-by-page extraction
        const document: LoadedDocument = {
          content: data.text,
          metadata: baseMetadata,
        };

        return [document];
      }

      const document: LoadedDocument = {
        content: data.text,
        metadata: baseMetadata,
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
 * Create a loader for multiple PDF files
 */
export function createMultiPDFLoader(paths: readonly string[], splitPages = false): DocumentLoader {
  return {
    async load(): Promise<readonly LoadedDocument[]> {
      const loaders = paths.map((path) => createPDFLoader({ path, splitPages }));
      const results = await Promise.all(loaders.map((loader) => loader.load()));
      return results.flat();
    },

    async *loadLazy(): AsyncGenerator<LoadedDocument> {
      for (const path of paths) {
        const loader = createPDFLoader({ path, splitPages });
        const docs = await loader.load();
        for (const doc of docs) {
          yield doc;
        }
      }
    },
  };
}

/**
 * Create a loader from PDF buffer
 */
export function createPDFBufferLoader(
  buffer: Buffer,
  metadata: Partial<LoadedDocument['metadata']> = {}
): DocumentLoader {
  return {
    async load(): Promise<readonly LoadedDocument[]> {
      const pdfParse = (await import('pdf-parse')).default;
      const data: PDFParseResult = await pdfParse(buffer);

      const document: LoadedDocument = {
        content: data.text,
        metadata: {
          source: 'buffer',
          sourceType: 'string',
          mimeType: 'application/pdf',
          title: data.info?.Title,
          author: data.info?.Author,
          pageCount: data.numpages,
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
