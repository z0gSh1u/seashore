/**
 * @seashore/rag - Token Splitter
 *
 * Split text by token count using tiktoken-compatible encoding
 */

import type {
  DocumentSplitter,
  LoadedDocument,
  DocumentChunk,
  TokenSplitterOptions,
} from '../types.js';

/**
 * Simple token approximation when tiktoken is not available
 * Uses a rough estimate of ~4 characters per token for English
 */
function approximateTokenCount(text: string): number {
  // Average ~4 characters per token for English text
  // This is a rough approximation
  return Math.ceil(text.length / 4);
}

/**
 * Split text into tokens (approximation)
 */
function approximateTokenize(text: string): string[] {
  // Simple word-based tokenization as approximation
  return text.split(/(\s+|[.,!?;:'"()\[\]{}])/g).filter((t) => t.length > 0);
}

/**
 * Decode tokens back to text (approximation)
 */
function approximateDecode(tokens: string[]): string {
  return tokens.join('');
}

/**
 * Create a token-based splitter
 *
 * Note: For accurate token counting, integrate with tiktoken or similar.
 * This implementation uses character-based approximation.
 */
export function createTokenSplitter(options: TokenSplitterOptions = {}): DocumentSplitter {
  const {
    chunkSize = 500, // tokens
    chunkOverlap = 50, // tokens
    model = 'gpt-4',
    stripWhitespace = true,
  } = options;

  // Token functions - using approximation
  // In production, replace with tiktoken
  const countTokens = approximateTokenCount;
  const tokenize = approximateTokenize;
  const decode = approximateDecode;

  return {
    async split(document: LoadedDocument): Promise<readonly DocumentChunk[]> {
      let { content } = document;

      if (stripWhitespace) {
        content = content.trim();
      }

      const tokens = tokenize(content);
      const chunks: DocumentChunk[] = [];

      let startIdx = 0;

      while (startIdx < tokens.length) {
        // Calculate end index for this chunk
        let endIdx = startIdx + chunkSize;

        if (endIdx >= tokens.length) {
          endIdx = tokens.length;
        } else {
          // Try to find a good break point (whitespace)
          let breakIdx = endIdx;
          while (breakIdx > startIdx + chunkSize / 2 && tokens[breakIdx]?.match(/^\s+$/) === null) {
            breakIdx--;
          }
          if (breakIdx > startIdx + chunkSize / 2) {
            endIdx = breakIdx + 1;
          }
        }

        // Extract chunk tokens and decode
        const chunkTokens = tokens.slice(startIdx, endIdx);
        let chunkContent = decode(chunkTokens);

        if (stripWhitespace) {
          chunkContent = chunkContent.trim();
        }

        if (chunkContent.length > 0) {
          chunks.push({
            content: chunkContent,
            metadata: {
              ...document.metadata,
              chunkIndex: chunks.length,
              tokenCount: chunkTokens.length,
            },
          });
        }

        // Move to next chunk with overlap
        startIdx = endIdx - chunkOverlap;
        if (startIdx <= (chunks.length > 0 ? endIdx - chunkOverlap : 0)) {
          startIdx = endIdx;
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
 * Create a splitter with custom tokenizer
 */
export function createCustomTokenSplitter(
  tokenizer: {
    encode: (text: string) => number[];
    decode: (tokens: number[]) => string;
  },
  options: Omit<TokenSplitterOptions, 'model' | 'encoding'> = {}
): DocumentSplitter {
  const { chunkSize = 500, chunkOverlap = 50, stripWhitespace = true } = options;

  return {
    async split(document: LoadedDocument): Promise<readonly DocumentChunk[]> {
      let { content } = document;

      if (stripWhitespace) {
        content = content.trim();
      }

      const tokens = tokenizer.encode(content);
      const chunks: DocumentChunk[] = [];

      let startIdx = 0;

      while (startIdx < tokens.length) {
        const endIdx = Math.min(startIdx + chunkSize, tokens.length);
        const chunkTokens = tokens.slice(startIdx, endIdx);
        let chunkContent = tokenizer.decode(chunkTokens);

        if (stripWhitespace) {
          chunkContent = chunkContent.trim();
        }

        if (chunkContent.length > 0) {
          chunks.push({
            content: chunkContent,
            metadata: {
              ...document.metadata,
              chunkIndex: chunks.length,
              tokenCount: chunkTokens.length,
            },
          });
        }

        startIdx = endIdx - chunkOverlap;
        if (startIdx <= 0 && chunks.length > 0) {
          startIdx = endIdx;
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
 * Estimate token count for text
 */
export function estimateTokens(text: string, model = 'gpt-4'): number {
  // Using approximation
  // For accurate counting, use tiktoken
  return approximateTokenCount(text);
}
