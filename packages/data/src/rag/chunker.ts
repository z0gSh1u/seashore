/**
 * Chunker configuration
 */
export interface ChunkerConfig {
  strategy: 'fixed' | 'recursive'
  chunkSize: number
  overlap: number
}

/**
 * Text chunker interface
 */
export interface Chunker {
  chunk(text: string): string[]
}

/**
 * Creates a text chunker for splitting documents into manageable chunks.
 *
 * Supports two strategies:
 * - Fixed: Simple character-based chunking with overlap
 * - Recursive: Intelligent chunking that preserves paragraphs, sentences, and words
 *
 * @param config - Chunker configuration
 * @returns Chunker instance
 *
 * @example
 * ```typescript
 * import { createChunker } from '@seashore/data'
 *
 * // Fixed-size chunks with overlap
 * const chunker = createChunker({
 *   strategy: 'fixed',
 *   chunkSize: 1000,
 *   overlap: 100
 * })
 *
 * // Recursive chunking (preserves structure)
 * const smartChunker = createChunker({
 *   strategy: 'recursive',
 *   chunkSize: 1000,
 *   overlap: 100
 * })
 *
 * const chunks = smartChunker.chunk(longDocument)
 * ```
 */
export function createChunker(config: ChunkerConfig): Chunker {
  return {
    chunk(text: string): string[] {
      switch (config.strategy) {
        case 'fixed':
          return chunkFixed(text, config.chunkSize, config.overlap)
        case 'recursive':
          return chunkRecursive(text, config.chunkSize, config.overlap)
        default: {
          const _exhaustive: never = config.strategy
          throw new Error(`Unknown chunking strategy: ${String(_exhaustive)}`)
        }
      }
    },
  }
}

/**
 * Fixed-size chunking with overlap
 */
function chunkFixed(text: string, size: number, overlap: number): string[] {
  if (text.length <= size) return [text]

  const chunks: string[] = []
  let start = 0
  while (start < text.length) {
    chunks.push(text.slice(start, start + size))
    start += size - overlap
    if (start + overlap >= text.length && start < text.length) {
      // Don't create tiny trailing chunks
      break
    }
  }
  return chunks
}

/**
 * Recursive chunking that preserves document structure
 * Tries to split on paragraphs first, then sentences, then words, then characters
 */
function chunkRecursive(text: string, size: number, overlap: number): string[] {
  // Split by paragraph first, then by sentence, then by fixed size
  const separators = ['\n\n', '\n', '. ', ' ']

  function split(input: string, sepIdx: number): string[] {
    if (input.length <= size) return [input]
    if (sepIdx >= separators.length) {
      return chunkFixed(input, size, overlap)
    }

    const sep = separators[sepIdx]!
    const parts = input.split(sep)
    const result: string[] = []
    let current = ''

    for (const part of parts) {
      const candidate = current ? current + sep + part : part
      if (candidate.length <= size) {
        current = candidate
      } else {
        if (current) result.push(current)
        if (part.length > size) {
          result.push(...split(part, sepIdx + 1))
          current = ''
        } else {
          current = part
        }
      }
    }
    if (current) result.push(current)
    return result
  }

  return split(text, 0)
}
