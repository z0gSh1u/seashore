/**
 * @seashore/rag - Markdown Splitter
 *
 * Split markdown documents by structure (headers, code blocks, etc.)
 */

import type {
  DocumentSplitter,
  LoadedDocument,
  DocumentChunk,
  MarkdownSplitterOptions,
} from '../types.js';

/**
 * Markdown section with header info
 */
interface MarkdownSection {
  level: number;
  header: string;
  content: string;
  startLine: number;
  endLine: number;
}

/**
 * Parse markdown into sections by headers
 */
function parseMarkdownSections(
  content: string,
  headerLevels: readonly number[]
): MarkdownSection[] {
  const lines = content.split('\n');
  const sections: MarkdownSection[] = [];

  let currentSection: MarkdownSection | null = null;
  let currentContent: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const headerMatch = line.match(/^(#{1,6})\s+(.+)$/);

    if (headerMatch) {
      const level = headerMatch[1]!.length;

      // Check if this header level should cause a split
      if (headerLevels.includes(level)) {
        // Save previous section
        if (currentSection) {
          currentSection.content = currentContent.join('\n').trim();
          currentSection.endLine = i - 1;
          sections.push(currentSection);
        }

        // Start new section
        currentSection = {
          level,
          header: headerMatch[2]!,
          content: '',
          startLine: i,
          endLine: i,
        };
        currentContent = [];
        continue;
      }
    }

    currentContent.push(line);
  }

  // Save final section
  if (currentSection) {
    currentSection.content = currentContent.join('\n').trim();
    currentSection.endLine = lines.length - 1;
    sections.push(currentSection);
  } else if (currentContent.length > 0) {
    // Content before first header
    sections.unshift({
      level: 0,
      header: '',
      content: currentContent.join('\n').trim(),
      startLine: 0,
      endLine: lines.length - 1,
    });
  }

  return sections;
}

/**
 * Split markdown section into chunks by size
 */
function splitSectionBySize(
  section: MarkdownSection,
  chunkSize: number,
  chunkOverlap: number,
  includeHeader: boolean,
  splitCodeBlocks: boolean
): string[] {
  const { header, content, level } = section;
  const prefix = includeHeader && header ? `${'#'.repeat(level)} ${header}\n\n` : '';
  const fullContent = prefix + content;

  if (fullContent.length <= chunkSize) {
    return [fullContent.trim()];
  }

  const chunks: string[] = [];

  if (splitCodeBlocks) {
    // Split around code blocks
    const codeBlockRegex = /```[\s\S]*?```/g;
    let lastIndex = 0;
    let match;
    const parts: string[] = [];

    while ((match = codeBlockRegex.exec(content)) !== null) {
      if (match.index > lastIndex) {
        parts.push(content.slice(lastIndex, match.index));
      }
      parts.push(match[0]);
      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < content.length) {
      parts.push(content.slice(lastIndex));
    }

    // Process parts
    let currentChunk = prefix;

    for (const part of parts) {
      const isCodeBlock = part.startsWith('```');

      if (isCodeBlock && part.length > chunkSize) {
        // Code block too large - add as its own chunk
        if (currentChunk.trim()) {
          chunks.push(currentChunk.trim());
        }
        chunks.push((prefix + part).trim());
        currentChunk = prefix;
      } else if (currentChunk.length + part.length > chunkSize) {
        // Save current chunk
        if (currentChunk.trim()) {
          chunks.push(currentChunk.trim());
        }

        // Start new chunk with overlap
        const overlapContent = currentChunk.slice(-chunkOverlap);
        currentChunk = prefix + overlapContent + part;
      } else {
        currentChunk += part;
      }
    }

    if (currentChunk.trim() && currentChunk !== prefix) {
      chunks.push(currentChunk.trim());
    }
  } else {
    // Simple paragraph-based splitting
    const paragraphs = content.split(/\n\n+/);
    let currentChunk = prefix;

    for (const para of paragraphs) {
      if (currentChunk.length + para.length + 2 > chunkSize) {
        if (currentChunk.trim() && currentChunk !== prefix) {
          chunks.push(currentChunk.trim());
        }
        currentChunk = prefix + para;
      } else {
        currentChunk += (currentChunk.endsWith('\n') ? '' : '\n\n') + para;
      }
    }

    if (currentChunk.trim() && currentChunk !== prefix) {
      chunks.push(currentChunk.trim());
    }
  }

  return chunks;
}

/**
 * Create a markdown-aware splitter
 */
export function createMarkdownSplitter(options: MarkdownSplitterOptions = {}): DocumentSplitter {
  const {
    chunkSize = 1000,
    chunkOverlap = 200,
    headerLevels = [1, 2, 3],
    includeHeader = true,
    splitCodeBlocks = true,
    stripWhitespace = true,
  } = options;

  return {
    async split(document: LoadedDocument): Promise<readonly DocumentChunk[]> {
      const { content } = document;

      // Parse markdown structure
      const sections = parseMarkdownSections(content, headerLevels);

      const chunks: DocumentChunk[] = [];

      for (const section of sections) {
        const sectionChunks = splitSectionBySize(
          section,
          chunkSize,
          chunkOverlap,
          includeHeader,
          splitCodeBlocks
        );

        for (const chunkContent of sectionChunks) {
          let finalContent = chunkContent;
          if (stripWhitespace) {
            finalContent = finalContent.trim();
          }

          if (finalContent.length === 0) {
            continue;
          }

          chunks.push({
            content: finalContent,
            metadata: {
              ...document.metadata,
              chunkIndex: chunks.length,
              sectionHeader: section.header || undefined,
              sectionLevel: section.level || undefined,
              startLine: section.startLine,
              endLine: section.endLine,
            },
          });
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
 * Create a header-only splitter (no size limits)
 */
export function createHeaderSplitter(headerLevels: readonly number[] = [1, 2]): DocumentSplitter {
  return {
    async split(document: LoadedDocument): Promise<readonly DocumentChunk[]> {
      const { content } = document;
      const sections = parseMarkdownSections(content, headerLevels);

      const chunks: DocumentChunk[] = sections
        .filter((s) => s.content.trim().length > 0)
        .map((section, index) => ({
          content: section.header
            ? `${'#'.repeat(section.level)} ${section.header}\n\n${section.content}`
            : section.content,
          metadata: {
            ...document.metadata,
            chunkIndex: index,
            sectionHeader: section.header || undefined,
            sectionLevel: section.level || undefined,
          },
        }));

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
