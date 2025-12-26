/**
 * @seashore/rag - Recursive Text Splitter
 *
 * Split text recursively using a hierarchy of separators
 */

import type { DocumentSplitter, LoadedDocument, DocumentChunk, SplitterOptions } from '../types.js';

/**
 * Default separators for text splitting
 */
const DEFAULT_SEPARATORS = ['\n\n', '\n', '. ', '! ', '? ', '; ', ', ', ' ', ''];

/**
 * Split text by a separator
 */
function splitOnSeparator(text: string, separator: string, keepSeparator: boolean): string[] {
  if (separator === '') {
    return text.split('');
  }

  const parts = text.split(separator);

  if (!keepSeparator || separator === '') {
    return parts;
  }

  // Re-add separator to each part (except the last)
  return parts.map((part, i) => {
    if (i === parts.length - 1) {
      return part;
    }
    return part + separator;
  });
}

/**
 * Merge small chunks to reach target size
 */
function mergeSplits(
  splits: string[],
  separator: string,
  chunkSize: number,
  chunkOverlap: number,
  lengthFunction: (text: string) => number
): string[] {
  const chunks: string[] = [];
  let currentChunk: string[] = [];
  let currentLength = 0;

  for (const split of splits) {
    const splitLength = lengthFunction(split);

    // If this single split is too large, skip merging (will be handled by recursion)
    if (splitLength > chunkSize) {
      // Add current chunk if not empty
      if (currentChunk.length > 0) {
        chunks.push(currentChunk.join(separator));
      }
      chunks.push(split);
      currentChunk = [];
      currentLength = 0;
      continue;
    }

    // Calculate new length with this split
    const newLength =
      currentLength > 0 ? currentLength + lengthFunction(separator) + splitLength : splitLength;

    if (newLength > chunkSize && currentChunk.length > 0) {
      // Save current chunk
      chunks.push(currentChunk.join(separator));

      // Handle overlap - keep some of the previous content
      while (currentLength > chunkOverlap && currentChunk.length > 1) {
        const removed = currentChunk.shift()!;
        currentLength -= lengthFunction(removed) + lengthFunction(separator);
      }

      // Add new split to the overlapping content
      currentChunk.push(split);
      currentLength = currentChunk
        .map(lengthFunction)
        .reduce((a, b) => a + b + lengthFunction(separator), 0);
    } else {
      // Add to current chunk
      currentChunk.push(split);
      currentLength = newLength;
    }
  }

  // Add final chunk
  if (currentChunk.length > 0) {
    chunks.push(currentChunk.join(separator));
  }

  return chunks;
}

/**
 * Recursively split text using separator hierarchy
 */
function splitTextRecursively(
  text: string,
  separators: readonly string[],
  chunkSize: number,
  chunkOverlap: number,
  keepSeparator: boolean,
  lengthFunction: (text: string) => number
): string[] {
  const chunks: string[] = [];

  // Find the best separator to use
  let separator = separators[separators.length - 1] ?? '';
  let newSeparators: readonly string[] = [];

  for (let i = 0; i < separators.length; i++) {
    const s = separators[i]!;
    if (s === '' || text.includes(s)) {
      separator = s;
      newSeparators = separators.slice(i + 1);
      break;
    }
  }

  // Split on the chosen separator
  const splits = splitOnSeparator(text, separator, keepSeparator);

  // Process each split
  const goodSplits: string[] = [];
  const mergedSeparator = keepSeparator ? '' : separator;

  for (const split of splits) {
    if (lengthFunction(split) <= chunkSize) {
      goodSplits.push(split);
    } else if (newSeparators.length > 0) {
      // Recursively split oversized chunks
      const subChunks = splitTextRecursively(
        split,
        newSeparators,
        chunkSize,
        chunkOverlap,
        keepSeparator,
        lengthFunction
      );
      chunks.push(...subChunks);
    } else {
      // Can't split further, add as-is
      chunks.push(split);
    }
  }

  // Merge small splits
  if (goodSplits.length > 0) {
    const merged = mergeSplits(
      goodSplits,
      mergedSeparator,
      chunkSize,
      chunkOverlap,
      lengthFunction
    );
    chunks.push(...merged);
  }

  return chunks;
}

/**
 * Create a recursive text splitter
 */
export function createRecursiveSplitter(options: SplitterOptions = {}): DocumentSplitter {
  const {
    chunkSize = 1000,
    chunkOverlap = 200,
    separators = DEFAULT_SEPARATORS,
    keepSeparator = false,
    stripWhitespace = true,
    lengthFunction = (text: string) => text.length,
  } = options;

  return {
    async split(document: LoadedDocument): Promise<readonly DocumentChunk[]> {
      let { content } = document;

      // Optionally strip whitespace
      if (stripWhitespace) {
        content = content.trim();
      }

      const textChunks = splitTextRecursively(
        content,
        separators,
        chunkSize,
        chunkOverlap,
        keepSeparator,
        lengthFunction
      );

      // Convert to DocumentChunks
      let position = 0;
      const chunks: DocumentChunk[] = [];

      for (let i = 0; i < textChunks.length; i++) {
        let chunkContent = textChunks[i]!;

        if (stripWhitespace) {
          chunkContent = chunkContent.trim();
        }

        if (chunkContent.length === 0) {
          continue;
        }

        const startPosition = content.indexOf(chunkContent, position);
        const endPosition = startPosition + chunkContent.length;

        chunks.push({
          content: chunkContent,
          metadata: {
            ...document.metadata,
            chunkIndex: chunks.length,
            startPosition: startPosition >= 0 ? startPosition : undefined,
            endPosition: startPosition >= 0 ? endPosition : undefined,
          },
        });

        if (startPosition >= 0) {
          position = startPosition + 1;
        }
      }

      // Update chunk count
      for (const chunk of chunks) {
        chunk.metadata.chunkCount = chunks.length;
      }

      return chunks;
    },

    async splitDocuments(documents: readonly LoadedDocument[]): Promise<readonly DocumentChunk[]> {
      const allChunks: DocumentChunk[] = [];

      for (const document of documents) {
        const chunks = await this.split(document);
        allChunks.push(...chunks);
      }

      return allChunks;
    },
  };
}

/**
 * Create a character-based splitter (simpler, no recursive splitting)
 */
export function createCharacterSplitter(options: SplitterOptions = {}): DocumentSplitter {
  const {
    chunkSize = 1000,
    chunkOverlap = 200,
    separators = ['\n\n', '\n', ' '],
    stripWhitespace = true,
  } = options;

  const separator = separators[0] ?? '\n\n';

  return {
    async split(document: LoadedDocument): Promise<readonly DocumentChunk[]> {
      let { content } = document;

      if (stripWhitespace) {
        content = content.trim();
      }

      const splits = content.split(separator);
      const chunks: DocumentChunk[] = [];
      let currentChunk = '';

      for (const split of splits) {
        const testChunk = currentChunk ? currentChunk + separator + split : split;

        if (testChunk.length > chunkSize && currentChunk) {
          chunks.push({
            content: stripWhitespace ? currentChunk.trim() : currentChunk,
            metadata: {
              ...document.metadata,
              chunkIndex: chunks.length,
            },
          });

          // Start new chunk with overlap
          const overlapStart = Math.max(0, currentChunk.length - chunkOverlap);
          currentChunk = currentChunk.slice(overlapStart) + separator + split;
        } else {
          currentChunk = testChunk;
        }
      }

      // Add final chunk
      if (currentChunk) {
        chunks.push({
          content: stripWhitespace ? currentChunk.trim() : currentChunk,
          metadata: {
            ...document.metadata,
            chunkIndex: chunks.length,
          },
        });
      }

      // Update chunk count
      for (const chunk of chunks) {
        chunk.metadata.chunkCount = chunks.length;
      }

      return chunks;
    },

    async splitDocuments(documents: readonly LoadedDocument[]): Promise<readonly DocumentChunk[]> {
      const allChunks: DocumentChunk[] = [];

      for (const document of documents) {
        const chunks = await this.split(document);
        allChunks.push(...chunks);
      }

      return allChunks;
    },
  };
}
