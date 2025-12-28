/**
 * Vitest Global Setup for PostgreSQL Integration Tests
 *
 * Uses Testcontainers to automatically manage PostgreSQL container lifecycle.
 * Compatible with CI (skips container startup if DATABASE_URL is already set).
 */

import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';

// Disable Ryuk (Reaper) on Windows - it can cause connection issues
// Container cleanup will be handled manually in teardown
process.env['TESTCONTAINERS_RYUK_DISABLED'] = 'true';

// Increase default timeouts for slow container startup
process.env['TESTCONTAINERS_HOST_PORT_WAIT_TIMEOUT_MS'] = '300000';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let container: StartedPostgreSqlContainer | undefined;

/**
 * Setup function called before all tests
 */
export async function setup(): Promise<void> {
  // If DATABASE_URL is already set (e.g., in CI), skip container startup
  if (process.env['DATABASE_URL']) {
    console.log('✅ Using existing DATABASE_URL, skipping container startup');
    return;
  }

  console.log('🐳 Starting PostgreSQL container with pgvector...');

  // Start PostgreSQL container using pgvector image (same as CI)
  // Use fixed port 5432 to avoid random port binding issues on Windows
  container = await new PostgreSqlContainer('pgvector/pgvector:pg16')
    .withDatabase('seashore_test')
    .withUsername('test')
    .withPassword('test')
    .withExposedPorts({ container: 5432, host: 5432 })
    .start();

  const connectionString = container.getConnectionUri();

  // Set environment variable for tests to use
  process.env['DATABASE_URL'] = connectionString;

  console.log(`✅ PostgreSQL container started: ${connectionString}`);

  // Run database migrations
  await runMigrations(connectionString);
}

/**
 * Teardown function called after all tests
 */
export async function teardown(): Promise<void> {
  if (container) {
    console.log('🐳 Stopping PostgreSQL container...');
    await container.stop();
    console.log('✅ PostgreSQL container stopped');
  }
}

/**
 * Run database migrations using the SQL file directly
 */
async function runMigrations(connectionString: string): Promise<void> {
  console.log('📦 Running database migrations...');

  const client = postgres(connectionString);

  try {
    // Read the initial migration SQL file
    const migrationPath = resolve(__dirname, '../../drizzle/0000_initial.sql');
    const migrationSql = readFileSync(migrationPath, 'utf-8');

    // Execute the migration
    await client.unsafe(migrationSql);

    console.log('✅ Database migrations completed');
  } finally {
    await client.end();
  }
}
