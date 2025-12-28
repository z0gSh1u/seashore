# Implementation Plan: 修复单元测试中的类型问题

**Branch**: `003-fix-test-types` | **Date**: 2025-12-28 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/003-fix-test-types/spec.md`

## Summary

修复 Seashore 框架所有单测文件中的 TypeScript 类型问题，移除未使用导入，并移除导入本地 TS 文件时的 `.js` 后缀。主要问题包括：
1. `JsonSchema` 和 `JsonSchemaProperty` 类型定义过于严格，缺少 JSON Schema 的标准属性
2. 测试文件中存在未使用的导入
3. 动态导入使用 `.js` 后缀（不符合 `moduleResolution: bundler` 配置）

## Technical Context

**Language/Version**: TypeScript 5.x  
**Primary Dependencies**: Vitest 3.x, Zod 3.x, @tanstack/ai  
**Storage**: N/A  
**Testing**: Vitest  
**Target Platform**: Node.js (ESM Only)  
**Project Type**: Monorepo (pnpm + Nx)  
**Performance Goals**: N/A (代码质量任务)  
**Constraints**: 禁止滥用 `any`、类型断言、非空断言  
**Scale/Scope**: 18 个测试文件，约 27 处 `.js` 后缀导入，多处类型错误

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| 原则 | 状态 | 说明 |
|------|------|------|
| I. TanStack AI 优先 | ✅ 通过 | 不涉及 AI SDK 变更 |
| II. 测试即门禁 | ✅ 目标 | 本任务的目标就是确保测试通过 |
| III. 文档先行 | ✅ 通过 | 已阅读项目文档和规约 |
| VI. ESM Only | ✅ 通过 | 移除 `.js` 后缀符合 ESM 规范 |
| VII. 验证优于猜测 | ✅ 计划中 | 将运行 tsc 和 vitest 验证修复 |
| VIII. 类型安全优先 | ✅ 目标 | 本任务的核心目标，禁止滥用 `any` |
| XI. 工具链统一 | ✅ 通过 | 使用 pnpm 和 Vitest |

**结论**: 所有门禁通过，可以继续。

## Project Structure

### Documentation (this feature)

```text
specs/003-fix-test-types/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output (类型定义修改方案)
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (N/A for this task)
└── tasks.md             # Phase 2 output
```

### Source Code (repository root)

```text
packages/
├── agent/__tests__/          # 2 个测试文件
├── deploy/__tests__/         # 1 个测试文件
├── evaluation/__tests__/     # 1 个测试文件
├── llm/__tests__/            # 2 个测试文件
├── mcp/__tests__/            # 1 个测试文件
├── memory/__tests__/         # 1 个测试文件
├── observability/__tests__/  # 1 个测试文件
├── rag/__tests__/            # 1 个测试文件
├── security/__tests__/       # 1 个测试文件
├── storage/__tests__/        # 2 个测试文件
├── tool/__tests__/           # 3 个测试文件 (类型问题最多)
├── vectordb/__tests__/       # 1 个测试文件
└── workflow/__tests__/       # 1 个测试文件

# 可能需要修改的源文件
packages/tool/src/types.ts    # JsonSchema 和 JsonSchemaProperty 类型定义
```

**Structure Decision**: 这是一个 Monorepo 项目，测试文件位于各包的 `__tests__/` 目录下。主要修改集中在测试文件，可能需要扩展 `packages/tool/src/types.ts` 中的类型定义。

## Complexity Tracking

> 无 Constitution 违规需要记录。

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |
