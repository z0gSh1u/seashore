# @seashore/storage

Storage module for Seashore Agent Framework, providing database schemas and repository interfaces for conversation threads and messages.

## Features

- **Drizzle ORM Integration**: Type-safe database access with PostgreSQL
- **Thread Management**: Store and organize conversation threads
- **Message Storage**: Store messages with support for tool calls and streaming
- **Flexible Metadata**: JSON-based metadata storage for extensibility
- **Optimized Indexes**: Efficient queries for common access patterns

## Installation

```bash
npm install @seashore/storage
```

## Database Schema

### Thread Schema

```typescript
{
  id: UUID (primary key)
  title: string | null
  metadata: JSON object
  createdAt: timestamp
  updatedAt: timestamp
}
```

### Message Schema

```typescript
{
  id: UUID (primary key)
  threadId: UUID (foreign key -> threads.id)
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string
  name: string | null
  toolCalls: JSON array | null
  toolCallId: string | null
  metadata: JSON object
  sequence: integer
  createdAt: timestamp
}
```

## Usage

```typescript
import { threads, messages, type Thread, type Message } from '@seashore/storage';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

// Create database connection
const client = postgres(process.env.DATABASE_URL);
const db = drizzle(client);

// Insert a new thread
const newThread = await db.insert(threads).values({
  title: 'Customer Support',
  metadata: { userId: 'user123' }
}).returning();

// Insert a message
const newMessage = await db.insert(messages).values({
  threadId: newThread[0].id,
  role: 'user',
  content: 'Hello, I need help!',
  sequence: 0,
  metadata: {}
}).returning();
```

## Database Migrations

This module provides schema definitions. To create migrations:

```bash
# Install Drizzle Kit
npm install -D drizzle-kit

# Generate migration
npx drizzle-kit generate:pg

# Run migration
npx drizzle-kit push:pg
```

## Type Safety

All schemas include TypeScript type inference:

```typescript
type Thread = typeof threads.$inferSelect;
type NewThread = typeof threads.$inferInsert;
type Message = typeof messages.$inferSelect;
type NewMessage = typeof messages.$inferInsert;
```

## Architecture

This module follows the Seashore Agent Framework constitution:
- ✅ ESM Only (ES Modules)
- ✅ TypeScript strict mode
- ✅ Comprehensive JSDoc documentation
- ✅ PostgreSQL as unified database
- ✅ Drizzle ORM for type-safe queries

## License

ISC
