# Tasks: 修复单元测试中的类型问题

**Input**: Design documents from `/specs/003-fix-test-types/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2)
  - **US1**: 类型正确的单元测试
  - **US2**: 干净的测试文件导入

## Path Conventions

- **Monorepo**: `packages/*/src/` 源码, `packages/*/__tests__/` 测试

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: 准备工作和基础验证

- [x] T001 运行 `pnpm exec tsc --noEmit` 获取当前类型错误基线
- [x] T002 统计所有 `.js` 后缀导入数量以便验证

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 扩展源码类型定义，修复测试类型错误的根因

**⚠️ CRITICAL**: 必须先完成此阶段，才能开始修复测试文件

- [x] T003 扩展 `JsonSchemaType` 类型联合 in packages/tool/src/types.ts
- [x] T004 扩展 `JsonSchema` 接口添加缺失属性 in packages/tool/src/types.ts
- [x] T005 扩展 `JsonSchemaProperty` 接口添加缺失属性 in packages/tool/src/types.ts
- [x] T006 运行 `pnpm exec tsc --noEmit` 验证源码类型修改无破坏

**Checkpoint**: 源码类型定义已完善，可以开始修复测试文件

---

## Phase 3: User Story 1 - 类型正确的单元测试 (Priority: P1) 🎯 MVP

**Goal**: 所有单测文件通过 TypeScript 类型检查，零错误

**Independent Test**: `pnpm exec tsc --noEmit` 在测试文件上运行无错误

### Tool 包 (类型错误最多，优先修复)

- [x] T007 [US1] 修复 packages/tool/__tests__/define-tool.test.ts 类型错误
- [x] T008 [US1] 修复 packages/tool/__tests__/schema.test.ts 类型错误
- [x] T009 [US1] 修复 packages/tool/__tests__/presets.test.ts 类型错误

### Agent 包

- [x] T010 [P] [US1] 修复 packages/agent/__tests__/react-agent.test.ts 类型错误
- [x] T011 [P] [US1] 修复 packages/agent/__tests__/integration.test.ts 类型错误

### LLM 包

- [x] T012 [P] [US1] 修复 packages/llm/__tests__/adapters.test.ts 类型错误
- [x] T013 [P] [US1] 修复 packages/llm/__tests__/integration.test.ts 类型错误

### Storage 包

- [x] T014 [P] [US1] 修复 packages/storage/__tests__/repositories.test.ts 类型错误
- [x] T015 [P] [US1] 修复 packages/storage/__tests__/integration.test.ts 类型错误

### 其他包

- [x] T016 [P] [US1] 修复 packages/deploy/__tests__/server.test.ts 类型错误
- [x] T017 [P] [US1] 修复 packages/evaluation/__tests__/evaluation.test.ts 类型错误
- [x] T018 [P] [US1] 修复 packages/mcp/__tests__/client.test.ts 类型错误
- [x] T019 [P] [US1] 修复 packages/memory/__tests__/memory.test.ts 类型错误
- [x] T020 [P] [US1] 修复 packages/observability/__tests__/tracer.test.ts 类型错误
- [x] T021 [P] [US1] 修复 packages/rag/__tests__/rag.test.ts 类型错误
- [x] T022 [P] [US1] 修复 packages/security/__tests__/security.test.ts 类型错误
- [x] T023 [P] [US1] 修复 packages/vectordb/__tests__/search.test.ts 类型错误
- [x] T024 [P] [US1] 修复 packages/workflow/__tests__/workflow.test.ts 类型错误

### 验证

- [x] T025 [US1] 运行 `pnpm exec tsc --noEmit` 验证所有类型错误已修复

**Checkpoint**: 所有单测文件通过 TypeScript 类型检查

---

## Phase 4: User Story 2 - 干净的测试文件导入 (Priority: P1)

**Goal**: 移除所有未使用导入和 `.js` 后缀导入

**Independent Test**: grep 搜索 `.js` 后缀导入返回零结果

### Agent 包 (8 处 .js 导入)

- [x] T026 [US2] 移除 packages/agent/__tests__/react-agent.test.ts 中的 .js 后缀和未使用导入

### LLM 包 (12 处 .js 导入)

- [x] T027 [P] [US2] 移除 packages/llm/__tests__/adapters.test.ts 中的 .js 后缀和未使用导入
- [x] T028 [P] [US2] 移除 packages/llm/__tests__/integration.test.ts 中的 .js 后缀和未使用导入

### Storage 包 (4 处 .js 导入)

- [x] T029 [P] [US2] 移除 packages/storage/__tests__/repositories.test.ts 中的 .js 后缀和未使用导入
- [x] T030 [P] [US2] 移除 packages/storage/__tests__/integration.test.ts 中的 .js 后缀和未使用导入

### Tool 包 (未使用导入)

- [x] T031 [P] [US2] 移除 packages/tool/__tests__/define-tool.test.ts 中的未使用导入
- [x] T032 [P] [US2] 移除 packages/tool/__tests__/schema.test.ts 中的未使用导入

### 其他包 (检查并清理)

- [x] T033 [P] [US2] 检查并清理 packages/deploy/__tests__/ 中的导入
- [x] T034 [P] [US2] 检查并清理 packages/evaluation/__tests__/ 中的导入
- [x] T035 [P] [US2] 检查并清理 packages/mcp/__tests__/ 中的导入
- [x] T036 [P] [US2] 检查并清理 packages/memory/__tests__/ 中的导入
- [x] T037 [P] [US2] 检查并清理 packages/observability/__tests__/ 中的导入
- [x] T038 [P] [US2] 检查并清理 packages/rag/__tests__/ 中的导入
- [x] T039 [P] [US2] 检查并清理 packages/security/__tests__/ 中的导入
- [x] T040 [P] [US2] 检查并清理 packages/vectordb/__tests__/ 中的导入
- [x] T041 [P] [US2] 检查并清理 packages/workflow/__tests__/ 中的导入

### 验证

- [x] T042 [US2] 验证无 .js 后缀导入残留 (grep 检查)
- [x] T043 [US2] 验证无未使用导入 (TypeScript noUnusedLocals 检查)

**Checkpoint**: 所有测试文件导入干净整洁

---

## Phase 5: Polish & Final Validation

**Purpose**: 最终验证和清理

- [x] T044 运行 `pnpm exec tsc --noEmit` 完整类型检查
- [x] T045 运行 `pnpm test` 验证所有测试通过
- [x] T046 运行 quickstart.md 中的检查清单验证
- [x] T047 更新规约状态为 Complete

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: 无依赖 - 立即开始
- **Phase 2 (Foundational)**: 依赖 Phase 1 - 必须完成后才能开始用户故事
- **Phase 3 (US1)**: 依赖 Phase 2 - 类型定义修复后开始
- **Phase 4 (US2)**: 依赖 Phase 2 - 可与 Phase 3 并行
- **Phase 5 (Polish)**: 依赖 Phase 3 和 Phase 4 完成

### User Story Dependencies

- **US1 (类型修复)**: 依赖 Foundational 阶段的类型定义扩展
- **US2 (导入清理)**: 无强依赖，但建议在 US1 过程中一并处理

### Within Each User Story

- Tool 包优先（类型错误最多）
- 其他包可并行处理
- 每个包完成后验证

### Parallel Opportunities

所有标记 [P] 的任务可以并行执行：
- T010-T024: 不同包的类型修复可并行
- T027-T041: 不同包的导入清理可并行

---

## Parallel Example: Phase 3 类型修复

```bash
# 先完成 Tool 包（依赖关系）
T007 → T008 → T009

# 然后其他包可并行
T010, T011, T012, T013, T014, T015, T016, T017, T018, T019, T020, T021, T022, T023, T024 (并行)

# 最后验证
T025
```

---

## Implementation Strategy

### MVP First (仅 US1)

1. 完成 Phase 1: Setup
2. 完成 Phase 2: Foundational（扩展类型定义）
3. 完成 Phase 3: US1（修复类型错误）
4. **验证**: `pnpm exec tsc --noEmit` 通过
5. 可以停在此处提交

### Full Scope

1. 完成 Setup + Foundational
2. 并行完成 US1 + US2
3. 运行 Polish 阶段验证
4. 提交完整修复

---

## Notes

- [P] = 不同文件，可并行
- [US1] = 类型修复任务
- [US2] = 导入清理任务
- 修复类型时顺便清理导入更高效
- 每个包完成后运行局部 tsc 验证
- 禁止使用 `any`、类型断言、非空断言除非必要并添加注释

---

## Summary

| 统计项 | 数量 |
|--------|------|
| 总任务数 | 47 |
| Phase 1 (Setup) | 2 |
| Phase 2 (Foundational) | 4 |
| Phase 3 (US1 - 类型修复) | 19 |
| Phase 4 (US2 - 导入清理) | 18 |
| Phase 5 (Polish) | 4 |
| 可并行任务 | 32 |
| MVP 最小任务数 | 25 (Phase 1-3) |
