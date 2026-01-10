# seashore Development Guidelines

Auto-generated from all feature plans. Last updated: 2025-12-25

## Active Technologies
- TypeScript 5.x, ESM Only + @tanstack/ai, Zod 4.x, React 18.x, Hono 4.x, Vitest 3.x (002-fix-typescript-quality)
- PostgreSQL with Drizzle ORM (002-fix-typescript-quality)
- TypeScript 5.x + Vitest 3.x, Zod 3.x, @tanstack/ai (003-fix-test-types)
- TypeScript 5.x + `@tanstack/ai`, `@tanstack/ai-openai`, `@tanstack/ai-anthropic`, `@tanstack/ai-gemini` (004-llm-config-baseurl)
- TypeScript 5.x, Node.js >= 20.0.0 + @seashore/* (workspace packages), @tanstack/ai-openai, zod (master)
- N/A (示例中使用内存存储) (master)
- TypeScript ^5.x + `@tanstack/ai`, `@tanstack/ai-openai`, `@tanstack/ai-anthropic`, `@tanstack/ai-gemini`, `zod ^3.x` (006-workflow-security-enhancements)
- N/A（无持久化需求） (006-workflow-security-enhancements)
- TypeScript ^5.x + `@tanstack/ai` (用于 text adapter), 自定义 fetch 实现 (用于多模态) (007-adapter-config-refactor)

- TypeScript 5.x, Node.js 20+ + `@tanstack/ai`, `@tanstack/ai-openai`, `@tanstack/ai-anthropic`, `@tanstack/ai-gemini`, `hono`, `drizzle-orm`, `zod` (001-agent-framework)

## Project Structure

```text
src/
tests/
```

## Commands

npm test; npm run lint

## Code Style

TypeScript 5.x, Node.js 20+: Follow standard conventions

## Recent Changes
- 007-adapter-config-refactor: Added TypeScript ^5.x + `@tanstack/ai` (用于 text adapter), 自定义 fetch 实现 (用于多模态)
- 006-workflow-security-enhancements: Added TypeScript ^5.x + `@tanstack/ai`, `@tanstack/ai-openai`, `@tanstack/ai-anthropic`, `@tanstack/ai-gemini`, `zod ^3.x`
- 005-add-examples: Added examples for basic agent, agent with tools, etc


<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
