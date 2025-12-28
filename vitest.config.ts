import { defineConfig } from 'vitest/config';

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
      '@seashore/llm': './packages/llm/src',
      '@seashore/tool': './packages/tool/src',
      '@seashore/agent': './packages/agent/src',
      '@seashore/storage': './packages/storage/src',
      '@seashore/vectordb': './packages/vectordb/src',
      '@seashore/rag': './packages/rag/src',
      '@seashore/workflow': './packages/workflow/src',
      '@seashore/memory': './packages/memory/src',
      '@seashore/mcp': './packages/mcp/src',
      '@seashore/genui': './packages/genui/src',
      '@seashore/observability': './packages/observability/src',
      '@seashore/evaluation': './packages/evaluation/src',
      '@seashore/security': './packages/security/src',
      '@seashore/deploy': './packages/deploy/src',
    },
  },
});
