# Implementation Plan: [FEATURE]

**Branch**: `[###-feature-name]` | **Date**: [DATE] | **Spec**: [link]
**Input**: Feature specification from `/specs/[###-feature-name]/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

This feature aligns the `@seashore/llm` configuration with `@tanstack/ai` by adding support for `baseURL`, `apiKey`, and `headers` in `TextAdapterConfig`. This enables the use of local LLMs (like Ollama), corporate proxies, and dynamic secret management, ensuring full flexibility and parity with the underlying provider libraries.

## Technical Context

**Language/Version**: TypeScript 5.x
**Primary Dependencies**: `@tanstack/ai`, `@tanstack/ai-openai`, `@tanstack/ai-anthropic`, `@tanstack/ai-gemini`
**Storage**: N/A
**Testing**: Vitest
**Target Platform**: Node.js / Edge Runtimes
**Project Type**: Monorepo Package (`packages/llm`)
**Performance Goals**: N/A (Configuration pass-through)
**Constraints**: Must maintain backward compatibility where possible.
**Scale/Scope**: Updates to `TextAdapterConfig` and adapter initialization logic.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **TanStack AI 优先**: The feature explicitly aligns with and exposes `@tanstack/ai` configuration.
- [x] **测试即门禁**: Changes will be verified with Vitest.
- [x] **文档先行**: Will verify `@tanstack/ai` provider configuration interfaces.
- [x] **React 18 前端**: N/A
- [x] **Hono 服务端**: N/A

## Project Structure

### Documentation (this feature)

```text
specs/004-llm-config-baseurl/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
└── tasks.md             # Phase 2 output
```

### Source Code (repository root)

```text
packages/llm/
├── src/
│   ├── types.ts         # Update TextAdapterConfig
│   └── index.ts         # Update adapter creation logic
└── __tests__/
    └── config.test.ts   # New tests for configuration
```

**Structure Decision**: Modifying existing `packages/llm` package.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |
