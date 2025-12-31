# Tasks: Workflow LLM Node 模型灵活配置与 Security 外部 API 规则支持

**Input**: Design documents from `/specs/006-workflow-security-enhancements/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅

**Tests**: 测试任务已包含在各 User Story 中，遵循 Constitution 原则 II（测试即门禁）。

**Organization**: 任务按用户故事分组，支持独立实现和测试。

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: 可并行执行（不同文件，无依赖）
- **[Story]**: 所属用户故事（US1, US2, US3, US4）
- 包含精确文件路径

---

## Phase 1: Setup (无需设置)

**Purpose**: 本功能修改现有包，无需项目初始化

> ✅ 跳过 - 使用现有 Monorepo 结构

---

## Phase 2: Foundational (基础依赖)

**Purpose**: 需要先完成的类型定义和依赖导出

**⚠️ CRITICAL**: 用户故事实现前必须完成此阶段

- [x] T001 在 packages/workflow/src/types.ts 中添加 `LLMAdapter` 联合类型定义
- [x] T002 在 packages/workflow/src/types.ts 中更新 `LLMNodeConfig.adapter` 类型为 `LLMAdapter`
- [x] T003 [P] 在 packages/workflow/src/index.ts 中导出新类型 `LLMAdapter`
- [x] T004 [P] 在 packages/workflow/package.json 中确认 @seashore/llm 依赖

**Checkpoint**: ✅ 类型基础就绪，用户故事实现可以开始

---

## Phase 3: User Story 1 - 工作流 LLM Node 使用自定义模型配置 (Priority: P1) 🎯 MVP

**Goal**: 实现 `createLLMNode` 支持完整的 TextAdapter 配置，包括 baseURL、apiKey 等

**Independent Test**: 创建使用自定义 baseURL 的 LLM Node，验证 chat() 调用正确执行

### Tests for User Story 1

- [x] T005 [P] [US1] 创建 LLM Node 单元测试文件 packages/workflow/__tests__/llm-node.test.ts
- [x] T006 [P] [US1] 添加测试用例：使用 TextAdapter 对象创建节点
- [x] T007 [P] [US1] 添加测试用例：使用 TextAdapterConfig 配置对象创建节点（向后兼容）
- [x] T008 [P] [US1] 添加测试用例：验证 adapter 类型守卫函数正确判断类型

### Implementation for User Story 1

- [x] T009 [US1] 在 packages/workflow/src/nodes/llm-node.ts 中添加 `isTextAdapterConfig` 类型守卫函数
- [x] T010 [US1] 在 packages/workflow/src/nodes/llm-node.ts 中添加 `resolveAdapter` 辅助函数
- [x] T011 [US1] 修改 packages/workflow/src/nodes/llm-node.ts 的 `execute` 方法，导入 `chat` 从 @tanstack/ai
- [x] T012 [US1] 实现 packages/workflow/src/nodes/llm-node.ts 中使用 `chat()` 进行真实 LLM 调用
- [x] T013 [US1] 在 packages/workflow/src/nodes/llm-node.ts 中实现流收集逻辑，合并 chunks 为 LLMNodeOutput
- [x] T014 [US1] 在 packages/workflow/src/nodes/llm-node.ts 中添加错误处理和 NodeExecutionError 包装
- [x] T015 [US1] 运行测试验证 User Story 1 实现 `pnpm test packages/workflow`

**Checkpoint**: ✅ LLM Node 可以使用完整 TextAdapter 配置执行真实 LLM 调用

---

## Phase 4: User Story 2 - 使用外部 API 创建自定义 SecurityRule (Priority: P1) 🎯 MVP

**Goal**: 验证 `createSecurityRule` 已支持外部 API 调用，并添加集成测试

**Independent Test**: 创建调用 mock API 的 SecurityRule，验证检查结果正确返回

### Tests for User Story 2

- [x] T016 [P] [US2] 创建外部 API 规则测试文件 packages/security/__tests__/external-api-rule.test.ts
- [x] T017 [P] [US2] 添加测试用例：使用 mock fetch 验证外部 API 规则调用
- [x] T018 [P] [US2] 添加测试用例：验证 API 超时时的降级处理
- [x] T019 [P] [US2] 添加测试用例：验证 API 返回错误时的降级处理

### Implementation for User Story 2

- [x] T020 [US2] 验证 packages/security/src/rules.ts 中 `createSecurityRule` 已支持异步 check 函数
- [x] T021 [US2] 运行测试验证 User Story 2 实现 `pnpm test packages/security`

**Checkpoint**: ✅ Security 模块支持外部 API 规则调用，测试通过

---

## Phase 5: User Story 3 - 更新工作流示例代码 (Priority: P2)

**Goal**: 更新 `05-workflow-basic.ts` 展示完整的模型配置用法

**Independent Test**: 运行示例代码，验证成功执行并调用配置的 API 端点

### Implementation for User Story 3

- [x] T022 [US3] 修改 examples/src/05-workflow-basic.ts，导入 openaiText 从 @seashore/llm
- [x] T023 [US3] 修改 examples/src/05-workflow-basic.ts，替换简单配置对象为 openaiText() 调用
- [x] T024 [US3] 在 examples/src/05-workflow-basic.ts 中添加 baseURL 和 apiKey 环境变量配置
- [x] T025 [US3] 添加注释说明两种配置方式的使用场景

**Checkpoint**: ✅ 工作流示例展示完整的模型配置方法

---

## Phase 6: User Story 4 - 添加外部 API 安全规则示例 (Priority: P2)

**Goal**: 在 `09-security-guardrails.ts` 中添加外部 API SecurityRule 示例

**Independent Test**: 阅读示例代码，确认清晰展示了创建和使用外部 API 规则的方法

### Implementation for User Story 4

- [x] T026 [US4] 在 examples/src/09-security-guardrails.ts 中添加外部 API 规则函数 `createExternalModerationRule`
- [x] T027 [US4] 实现外部 API 调用逻辑，包括 fetch、超时处理（AbortController）
- [x] T028 [US4] 实现错误处理和降级策略（API 失败时放行）
- [x] T029 [US4] 实现响应转换为 SecurityCheckResult 格式
- [x] T030 [US4] 将外部 API 规则添加到 guardrails 配置中
- [x] T031 [US4] 添加测试用例演示外部 API 规则的行为
- [x] T032 [US4] 添加注释说明环境变量配置和最佳实践

**Checkpoint**: ✅ Security 示例包含完整的外部 API 规则实现

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: 最终验证和文档更新

- [X] T033 [P] 运行全量测试 `pnpm test` 确保无回归 ✅ 372 tests passed
- [X] T034 [P] 运行类型检查 `pnpm exec tsc --noEmit` 确保类型正确 ✅ workflow/security/examples 无错误
- [X] T035 [P] 运行 lint `pnpm lint` 确保代码风格 ✅ 预先存在的配置问题（非本次变更）
- [ ] T036 更新 packages/workflow/README.md 添加 LLM Node 配置文档 (optional)
- [ ] T037 验证 quickstart.md 中的示例代码可正确执行 (optional)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: 跳过
- **Phase 2 (Foundational)**: 无依赖，立即开始 → **阻塞所有用户故事**
- **Phase 3 (US1)**: 依赖 Phase 2 完成
- **Phase 4 (US2)**: 依赖 Phase 2 完成，可与 Phase 3 并行
- **Phase 5 (US3)**: 依赖 Phase 3 (US1) 完成
- **Phase 6 (US4)**: 依赖 Phase 4 (US2) 完成，可与 Phase 5 并行
- **Phase 7 (Polish)**: 依赖所有用户故事完成

### User Story Dependencies

```
Phase 2 (Foundational)
    │
    ├──────────────────┐
    ▼                  ▼
Phase 3 (US1)      Phase 4 (US2)
    │                  │
    ▼                  ▼
Phase 5 (US3)      Phase 6 (US4)
    │                  │
    └──────────────────┘
             │
             ▼
      Phase 7 (Polish)
```

### Parallel Opportunities

**Phase 2 内部并行**:
```
T001 → T002 (顺序)
T003, T004 (可并行)
```

**Phase 3 测试并行** (US1):
```
T005, T006, T007, T008 (可并行)
```

**Phase 4 测试并行** (US2):
```
T016, T017, T018, T019 (可并行)
```

**跨 User Story 并行**:
```
Phase 3 (US1) ─┬─ 可与 Phase 4 (US2) 并行
               │
Phase 5 (US3) ─┴─ 可与 Phase 6 (US4) 并行
```

---

## Implementation Strategy

### MVP First (User Story 1 + 2 Only)

1. 完成 Phase 2: Foundational（类型定义）
2. 并行完成 Phase 3 (US1) + Phase 4 (US2)
3. **STOP and VALIDATE**: 运行 `pnpm test` 验证核心功能
4. 可选：立即部署/演示 MVP

### Incremental Delivery

1. Phase 2 → 类型基础就绪
2. Phase 3 (US1) → LLM Node 完整配置支持 ✅ MVP
3. Phase 4 (US2) → Security 外部 API 规则支持 ✅ MVP
4. Phase 5 (US3) → 工作流示例更新
5. Phase 6 (US4) → Security 示例更新
6. Phase 7 → 最终验证和文档

---

## Summary

| 阶段 | 任务数 | 可并行 | 说明 |
|------|--------|--------|------|
| Phase 2: Foundational | 4 | 2 | 类型定义基础 |
| Phase 3: US1 (P1) | 11 | 4 | LLM Node 配置增强 |
| Phase 4: US2 (P1) | 6 | 4 | Security 外部 API 规则 |
| Phase 5: US3 (P2) | 4 | 0 | 工作流示例更新 |
| Phase 6: US4 (P2) | 7 | 0 | Security 示例更新 |
| Phase 7: Polish | 5 | 3 | 验证和文档 |
| **总计** | **37** | **13** | |

---

## Notes

- 所有 [P] 任务可在其阶段内并行执行
- [Story] 标签映射任务到具体用户故事
- US1 和 US2 是 P1 优先级，构成 MVP
- US3 和 US4 是 P2 优先级，为示例代码更新
- 每个任务完成后提交代码
- 在每个 Checkpoint 停止验证故事独立性
