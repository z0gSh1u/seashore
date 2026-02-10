import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: ['./src/storage/schema.ts', './src/vectordb/schema.ts'],
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    // User provides their own connection string via environment variable
    url: process.env.DATABASE_URL ?? 'postgresql://localhost:5432/seashore',
  },
})
