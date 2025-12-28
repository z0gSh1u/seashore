# seashore Development Guidelines

Auto-generated from all feature plans. Last updated: 2025-12-25

## Active Technologies
- TypeScript 5.x, ESM Only + @tanstack/ai, Zod 4.x, React 18.x, Hono 4.x, Vitest 3.x (002-fix-typescript-quality)
- PostgreSQL with Drizzle ORM (002-fix-typescript-quality)
- TypeScript 5.x + Vitest 3.x, Zod 3.x, @tanstack/ai (003-fix-test-types)
- TypeScript 5.x + `@tanstack/ai`, `@tanstack/ai-openai`, `@tanstack/ai-anthropic`, `@tanstack/ai-gemini` (004-llm-config-baseurl)
- TypeScript 5.x (Node >= 20.0.0) + `@seashore/*` packages, `zod`, `dotenv`, `tsx` (005-add-examples)
- In-memory mocks for examples to avoid DB requirements (005-add-examples)

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
- 005-add-examples: Added TypeScript 5.x (Node >= 20.0.0) + `@seashore/*` packages, `zod`, `dotenv`, `tsx`
- 004-llm-config-baseurl: Added TypeScript 5.x + `@tanstack/ai`, `@tanstack/ai-openai`, `@tanstack/ai-anthropic`, `@tanstack/ai-gemini`
- 003-fix-test-types: Added TypeScript 5.x + Vitest 3.x, Zod 3.x, @tanstack/ai


<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
