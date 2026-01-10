# Document Loading

The first step in RAG is loading documents. Seashore supports loading from strings, files, URLs, and more.

## String Loader

Load text from strings:

```typescript
import { createStringLoader } from '@seashore/rag'

const loader = createStringLoader(`
  # TypeScript Guide

  TypeScript is a typed superset of JavaScript.
  It adds static type checking and other features.
`)

const documents = await loader.load()

console.log(documents)
// [{ content: '...', metadata: { source: 'string' } }]
```

## Text File Loader

Load plain text files:

```typescript
import { createTextLoader } from '@seashore/rag'

const loader = createTextLoader('path/to/file.txt')

const documents = await loader.load()

// With metadata
const loaderWithMeta = createTextLoader('path/to/file.txt', {
  metadata: { category: 'documentation', version: '1.0' },
})
```

## Markdown Loader

Load and parse Markdown files:

```typescript
import { createMarkdownLoader } from '@seashore/rag'

const loader = createMarkdownLoader('docs/guide.md')

const documents = await loader.load()

// Preserves Markdown structure
console.log(documents[0].metadata)
// { source: 'docs/guide.md', type: 'markdown', ... }
```

## PDF Loader

Load content from PDF files:

```typescript
import { createPDFLoader } from '@seashore/rag'

const loader = createPDFLoader('documents/report.pdf')

const documents = await loader.load()

// Each page becomes a document
console.log(documents.length) // Number of pages
console.log(documents[0].metadata.page) // Page number
```

### PDF Options

```typescript
const loader = createPDFLoader('document.pdf', {
  splitPages: true,      // Split by page
  extractImages: false,   // Extract text only
  metadata: {
    category: 'reports',
    year: 2024,
  },
})
```

## Web Loader

Load content from URLs:

```typescript
import { createWebLoader } from '@seashore/rag'

const loader = createWebLoader('https://example.com/article')

const documents = await loader.load()

console.log(documents[0].metadata)
// { source: 'https://example.com/article', title: '...', ... }
```

### Web Loader Options

```typescript
const loader = createWebLoader(url, {
  waitFor: 1000,           // Wait for JS execution
  selector: 'main article', // Extract specific element
  removeSelectors: ['nav', 'footer'], // Remove elements
})
```

## Directory Loader

Load multiple files from a directory:

```typescript
import fs from 'fs'
import path from 'path'

async function loadDirectory(dirPath: string) {
  const files = fs.readdirSync(dirPath)
  const documents = []

  for (const file of files) {
    const fullPath = path.join(dirPath, file)

    if (file.endsWith('.txt')) {
      const loader = createTextLoader(fullPath)
      documents.push(...await loader.load())
    } else if (file.endsWith('.md')) {
      const loader = createMarkdownLoader(fullPath)
      documents.push(...await loader.load())
    } else if (file.endsWith('.pdf')) {
      const loader = createPDFLoader(fullPath)
      documents.push(...await loader.load())
    }
  }

  return documents
}

const docs = await loadDirectory('./documents')
```

## Document Structure

All loaders return documents with this structure:

```typescript
interface Document {
  content: string
  metadata: Record<string, unknown>
}
```

### Adding Metadata

```typescript
const loader = createStringLoader(content, {
  metadata: {
    source: 'internal-docs',
    author: 'John Doe',
    date: new Date().toISOString(),
    tags: ['typescript', 'programming'],
  },
})
```

## Best Practices

1. **Organize by Source** — Track where documents came from
2. **Add Metadata** — Include categories, dates, tags
3. **Clean Content** — Remove headers/footers, navigation
4. **Handle Errors** — Some files may be corrupted
5. **Batch Loading** — Load in parallel for speed

## Next Steps

- [Document Splitting](./splitting.md) — Split documents into chunks
- [Retrieval](./retrieval.md) — Search and retrieve content
