import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

const rootDir = resolve(__dirname);

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['packages/**/__tests__/**/*.test.ts', 'packages/**/*.spec.ts'],
    exclude: ['node_modules', 'dist', '**/node_modules/**'],
    globalSetup: ['./packages/storage/__tests__/setup/global-setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['packages/**/src/**/*.ts'],
      exclude: ['**/__tests__/**', '**/*.d.ts', '**/index.ts'],
      thresholds: {
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80,
      },
    },
    testTimeout: 30000,
    hookTimeout: 120000,
    typecheck: {
      enabled: true,
      tsconfig: './tsconfig.json',
    },
  },
  resolve: {
    alias: {
      '@seashore/llm': resolve(rootDir, 'packages/llm/src'),
      '@seashore/tool': resolve(rootDir, 'packages/tool/src'),
      '@seashore/agent': resolve(rootDir, 'packages/agent/src'),
      '@seashore/storage': resolve(rootDir, 'packages/storage/src'),
      '@seashore/vectordb': resolve(rootDir, 'packages/vectordb/src'),
      '@seashore/rag': resolve(rootDir, 'packages/rag/src'),
      '@seashore/workflow': resolve(rootDir, 'packages/workflow/src'),
      '@seashore/memory': resolve(rootDir, 'packages/memory/src'),
      '@seashore/mcp': resolve(rootDir, 'packages/mcp/src'),
      '@seashore/genui': resolve(rootDir, 'packages/genui/src'),
      '@seashore/observability': resolve(rootDir, 'packages/observability/src'),
      '@seashore/evaluation': resolve(rootDir, 'packages/evaluation/src'),
      '@seashore/security': resolve(rootDir, 'packages/security/src'),
      '@seashore/deploy': resolve(rootDir, 'packages/deploy/src'),
    },
  },
});
