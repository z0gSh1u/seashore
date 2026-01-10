# Document Splitting

Large documents need to be split into smaller chunks for effective retrieval. Seashore provides various splitting strategies.

## Recursive Character Splitter

Split by characters while keeping paragraphs together:

```typescript
import { createRecursiveSplitter } from '@seashore/rag'

const splitter = createRecursiveSplitter({
  chunkSize: 1000,          // Max characters per chunk
  chunkOverlap: 200,        // Overlap between chunks
  separators: ['\n\n', '\n', '.', ' ', ''], // Splitting priority
})

const chunks = await splitter.split(document)

console.log(chunks)
// [
//   { content: '...', metadata: { chunkIndex: 0, ... } },
//   { content: '...', metadata: { chunkIndex: 1, ... } },
// ]
```

### How It Works

The recursive splitter tries separators in order:
1. First tries `\n\n` (paragraph breaks)
2. If still too big, tries `\n` (line breaks)
3. Then `.` (sentences)
4. Then ` ` (words)
5. Finally splits by character

## Token Splitter

Split by token count (more accurate for LLMs):

```typescript
import { createTokenSplitter } from '@seashore/rag'

const splitter = createTokenSplitter({
  chunkSize: 500,           // Max tokens per chunk
  chunkOverlap: 50,         // Overlapping tokens
  encoding: 'cl100k_base',  // Token encoding (GPT-4)
})

const chunks = await splitter.split(document)
```

## Markdown Splitter

Preserve Markdown structure:

```typescript
import { createMarkdownSplitter } from '@seashore/rag'

const splitter = createMarkdownSplitter({
  chunkSize: 2000,
  chunkOverlap: 200,
  splitBy: ['header', 'code', 'list'], // What to split on
})

const chunks = await splitter.split(markdownDoc)

// Each chunk preserves complete Markdown elements
```

### Markdown-Aware Splitting

```typescript
const splitter = createMarkdownSplitter({
  headers: true,     // Split at headers
  codeBlocks: true,  // Split at code blocks
  lists: true,       // Split at lists
  tables: false,     // Keep tables intact
})
```

## Splitting Multiple Documents

```typescript
async function splitDocuments(documents: Document[]) {
  const splitter = createRecursiveSplitter({
    chunkSize: 1000,
    chunkOverlap: 200,
  })

  const allChunks: DocumentChunk[] = []

  for (const doc of documents) {
    const chunks = await splitter.split(doc)
    allChunks.push(...chunks)
  }

  return allChunks
}

const chunks = await splitDocuments(documents)
```

## Chunk Metadata

Chunks preserve and extend document metadata:

```typescript
const chunk = {
  content: 'Text content...',
  metadata: {
    // Original document metadata
    source: 'doc.txt',
    author: 'John',

    // Chunk metadata
    chunkIndex: 0,
    chunkCount: 5,
    startPosition: 0,
    endPosition: 1000,
  },
}
```

## Custom Splitting

Create custom splitting logic:

```typescript
import { defineSplitter } from '@seashore/rag'

const customSplitter = defineSplitter({
  split: async (doc) => {
    const lines = doc.content.split('\n')
    const chunks: DocumentChunk[] = []

    let currentChunk = ''
    let chunkIndex = 0

    for (const line of lines) {
      if (currentChunk.length + line.length > 1000) {
        chunks.push({
          content: currentChunk,
          metadata: {
            ...doc.metadata,
            chunkIndex,
          },
        })
        currentChunk = ''
        chunkIndex++
      }
      currentChunk += line + '\n'
    }

    return chunks
  },
})
```

## Splitting Strategies

### Fixed Size

```typescript
const splitter = createRecursiveSplitter({
  chunkSize: 1000,
  chunkOverlap: 0,
})
```

### Overlapping Chunks

```typescript
const splitter = createRecursiveSplitter({
  chunkSize: 1000,
  chunkOverlap: 200, // Provides context between chunks
})
```

### Semantic Chunks

Split by semantic meaning (experimental):

```typescript
// Use embeddings to find natural break points
const semanticSplitter = createSemanticSplitter({
  maxChunkSize: 1000,
  similarityThreshold: 0.7,
})
```

## Best Practices

1. **Chunk Size** — 500-1500 characters works well for most cases
2. **Overlap** — 10-20% overlap provides better context
3. **Preserve Structure** — Use specialized splitters for Markdown, code, etc.
4. **Keep Context** — Overlap helps maintain context between chunks
5. **Metadata** — Track chunk indices for debugging

## Next Steps

- [Retrieval](./retrieval.md) — Search and retrieve chunks
- [Complete Pipeline](./pipeline.md) — Build end-to-end RAG
