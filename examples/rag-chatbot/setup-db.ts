/**
 * Database Setup Script
 *
 * Initializes the database schema for RAG chatbot
 */

import 'dotenv/config'
import { createVectorDBService } from '@seashore/data'

const DATABASE_URL = process.env.DATABASE_URL!

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL not set')
  process.exit(1)
}

async function setup() {
  console.log('🔧 Setting up database...\n')

  try {
    const vectorDB = await createVectorDBService({
      connectionString: DATABASE_URL,
    })

    console.log('✅ Database schema created successfully!')
    console.log('\nTables created:')
    console.log('  - embeddings (for document vectors)')
    console.log('\nNext steps:')
    console.log('  1. Run: pnpm run index')
    console.log('  2. Run: pnpm start')

    process.exit(0)
  } catch (error) {
    console.error('❌ Setup failed:', error)
    process.exit(1)
  }
}

setup()
