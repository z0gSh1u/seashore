# RAG Chatbot Example

A production-ready RAG (Retrieval-Augmented Generation) chatbot that uses PostgreSQL + pgvector for document storage and hybrid search (semantic + keyword).

## Features

- **📚 Document Indexing** - Automatically chunk and index documents
- **🔍 Hybrid Search** - Combines semantic (vector) and keyword (BM25) search with RRF
- **🧠 Smart Retrieval** - Retrieves relevant context before answering
- **💬 Multi-turn Conversations** - Maintains conversation history
- **⚡ Production-Ready** - Proper error handling, connection pooling

## Prerequisites

- Node.js 18+
- PostgreSQL 15+ with pgvector extension
- OpenAI API key

## Setup

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Setup Database

```bash
# Create database
createdb rag_chatbot

# Enable pgvector extension
psql rag_chatbot -c "CREATE EXTENSION IF NOT EXISTS vector;"
```

### 3. Configure Environment

Create `.env`:

```bash
OPENAI_API_KEY=sk-...
DATABASE_URL=postgresql://localhost/rag_chatbot
```

### 4. Initialize Database Schema

```bash
pnpm run setup
```

This creates the necessary tables for vector storage.

### 5. Index Sample Documents

```bash
pnpm run index
```

This indexes sample documents about Seashore framework into the vector database.

## Usage

### Run Chatbot

```bash
pnpm start
```

Try asking:
- "What is Seashore?"
- "How do I create a ReAct agent?"
- "What packages does Seashore have?"
- "How does the RAG pipeline work?"

### How It Works

1. **User asks a question**
2. **RAG retrieves relevant documents** using hybrid search:
   - Vector similarity (semantic understanding)
   - BM25 keyword matching (exact term matching)
   - Reciprocal Rank Fusion (RRF) combines both
3. **Agent receives context** from retrieved documents
4. **LLM generates answer** based on retrieved context
5. **User gets accurate, grounded response**

## Architecture

```
┌─────────────┐
│   User      │
│  Question   │
└──────┬──────┘
       │
       v
┌──────────────────┐
│   Embedding      │  Query → vector
│   Adapter        │
└──────┬───────────┘
       │
       v
┌──────────────────┐
│  VectorDB        │  Hybrid Search:
│  (pgvector)      │  - Vector similarity
│                  │  - BM25 keyword
│                  │  - RRF fusion
└──────┬───────────┘
       │
       v  Retrieved docs
┌──────────────────┐
│  ReAct Agent     │  LLM + Context
└──────┬───────────┘
       │
       v
┌──────────────────┐
│    Answer        │
└──────────────────┘
```

## Customization

### Index Your Own Documents

Edit `index-documents.ts`:

```typescript
const myDocuments = [
  {
    id: 'doc-1',
    content: 'Your document content here...',
    metadata: { source: 'my-source', title: 'My Doc' },
  },
  // ... more documents
];

await rag.indexDocuments(myDocuments);
```

### Tune Search Parameters

In `chat.ts`, adjust `hybridAlpha`:

```typescript
const results = await rag.retrieve({
  query: question,
  topK: 5,              // Number of documents to retrieve
  hybridAlpha: 0.5,     // 0 = pure keyword, 1 = pure semantic, 0.5 = balanced
});
```

**Recommendations:**
- `0.3-0.5`: General Q&A (balanced)
- `0.7-0.9`: Conceptual questions (favor semantic)
- `0.1-0.3`: Specific terms/names (favor keyword)

### Change Chunking Strategy

```typescript
const rag = createRAG({
  embedder,
  vectorDB,
  chunkSize: 512,     // Tokens per chunk (default: 512)
  chunkOverlap: 50,   // Overlap between chunks (default: 50)
});
```

**Recommendations:**
- **Small chunks (256-512)**: Better precision, more specific matches
- **Large chunks (1024-2048)**: Better context, more comprehensive answers
- **Overlap (50-100)**: Prevents losing context at boundaries

## Production Considerations

### 1. Connection Pooling

The example uses proper connection pooling. For production, configure:

```typescript
const vectorDB = await createVectorDBService({
  connectionString: process.env.DATABASE_URL,
  max: 20,        // Max connections
  min: 5,         // Min connections
  idleTimeout: 30000,
});
```

### 2. Document Updates

To re-index documents:
```bash
# Clear old documents
psql rag_chatbot -c "TRUNCATE TABLE embeddings;"

# Re-index
pnpm run index
```

### 3. Monitoring

Add logging to track:
- Query latency
- Retrieved document count
- Search scores
- Failed retrievals

### 4. Scaling

For large document sets:
- Use batch indexing (100-1000 docs per batch)
- Create indexes on metadata fields
- Consider distributed vector databases (Qdrant, Weaviate, Pinecone)

## Files

- `package.json` - Dependencies
- `setup-db.ts` - Initialize database schema
- `index-documents.ts` - Index sample documents
- `chat.ts` - Interactive chatbot
- `README.md` - This file

## Troubleshooting

**"Error: relation 'embeddings' does not exist"**

Run database setup:
```bash
pnpm run setup
```

**"No relevant documents found"**

Make sure you indexed documents:
```bash
pnpm run index
```

**"Cannot connect to PostgreSQL"**

Check DATABASE_URL in `.env`:
```bash
export DATABASE_URL=postgresql://localhost/rag_chatbot
```

**Poor retrieval quality**

Try adjusting:
1. `topK` - Retrieve more documents
2. `hybridAlpha` - Balance semantic vs keyword search
3. `chunkSize` - Larger chunks for more context

## Learn More

- [RAG Guide](../../docs/guides/rag-pipeline.md)
- [VectorDB API](../../docs/api/data.md#vectordb)
- [Seashore Documentation](../../docs/README.md)
