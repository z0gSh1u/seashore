# Implementation Plan: Workflow LLM Node 模型灵活配置与 Security 外部 API 规则支持

**Branch**: `006-workflow-security-enhancements` | **Date**: 2026-01-01 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/006-workflow-security-enhancements/spec.md`

## Summary

本功能包含两个核心增强：

1. **Workflow LLM Node 模型配置增强**: 修改 `@seashore/workflow` 包的 `createLLMNode` 使其支持完整的 `TextAdapter` 对象（如 `openaiText()` 返回的），实现与 `createAgent` 相同的模型配置灵活度（baseURL、apiKey、organization 等）。技术方案是扩展类型定义并实现真实的 `@tanstack/ai` `chat()` 调用。

2. **Security 外部 API 规则支持**: 在 `09-security-guardrails.ts` 示例中添加使用 `createSecurityRule` 调用外部内容安全 API 的示例代码，展示企业用户如何集成自建内容审核系统。

## Technical Context

**Language/Version**: TypeScript ^5.x  
**Primary Dependencies**: `@tanstack/ai`, `@tanstack/ai-openai`, `@tanstack/ai-anthropic`, `@tanstack/ai-gemini`, `zod ^3.x`  
**Storage**: N/A（无持久化需求）  
**Testing**: Vitest ^3.x（单元测试 + 集成测试）  
**Target Platform**: Node.js 18+, ESM Only  
**Project Type**: Monorepo 库包（`@seashore/workflow`、`@seashore/security`）  
**Performance Goals**: LLM 调用延迟由上游 API 决定，无本地性能目标  
**Constraints**: 必须保持向后兼容，现有的简单 `{ provider, model }` 配置仍需工作  
**Scale/Scope**: 修改 2 个包 + 2 个示例文件

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| 原则 | 状态 | 说明 |
|------|------|------|
| I. TanStack AI 优先 | ✅ 通过 | 使用 `@tanstack/ai` 的 `chat()` 函数和适配器 |
| II. 测试即门禁 | ✅ 计划中 | 将添加对应的单元测试 |
| III. 文档先行 | ✅ 已执行 | 已通过 Context7 阅读 @tanstack/ai 文档 |
| VI. ESM Only | ✅ 通过 | 产物仅输出 ESM |
| VII. 验证优于猜测 | ✅ 通过 | 基于实际代码分析，非猜测 |
| VIII. 类型安全优先 | ✅ 计划中 | 将使用 `TextAdapter` 类型定义 |
| XI. 工具链统一 | ✅ 通过 | 使用 pnpm + Nx + Rollup |
| XII. 积极复用 TanStack AI | ✅ 通过 | 直接使用 `chat()` 函数而非自己实现 |
| XIII. 库优先实现 | ✅ 通过 | 外部 API 调用使用标准 `fetch` |

**门禁结果**: ✅ 全部通过，可以进入 Phase 0

## Project Structure

### Documentation (this feature)

```text
specs/006-workflow-security-enhancements/
├── plan.md              # 本文件
├── research.md          # Phase 0 研究输出
├── data-model.md        # Phase 1 数据模型
├── quickstart.md        # Phase 1 快速开始指南
├── contracts/           # Phase 1 接口契约
└── tasks.md             # Phase 2 任务分解（由 /speckit.tasks 生成）
```

### Source Code (repository root)

```text
packages/
├── workflow/
│   ├── src/
│   │   ├── types.ts            # 修改：扩展 LLMNodeConfig.adapter 类型
│   │   └── nodes/
│   │       └── llm-node.ts     # 修改：实现真实 @tanstack/ai 调用
│   └── __tests__/
│       └── llm-node.test.ts    # 新增：LLM Node 单元测试
├── security/
│   └── src/
│       └── rules.ts            # 现有：createSecurityRule 已支持自定义 check
└── llm/
    └── src/
        └── types.ts            # 参考：TextAdapter 类型定义

examples/
└── src/
    ├── 05-workflow-basic.ts    # 修改：使用 openaiText() 完整配置
    └── 09-security-guardrails.ts # 修改：添加外部 API 规则示例
```

**Structure Decision**: 使用现有的 Monorepo 结构。本功能主要修改 `@seashore/workflow` 包和示例代码，无需新增包。

## Complexity Tracking

> 无 Constitution 违规，无需记录

---

## Post-Design Constitution Re-check

*Phase 1 设计完成后的二次验证*

| 原则 | 状态 | 验证说明 |
|------|------|---------|
| I. TanStack AI 优先 | ✅ 确认 | 设计使用 `chat()` 和 `openaiText()` |
| II. 测试即门禁 | ✅ 计划中 | tasks.md 将包含测试任务 |
| III. 文档先行 | ✅ 完成 | 已创建 research.md, contracts/, quickstart.md |
| VI. ESM Only | ✅ 确认 | 无 CommonJS 依赖引入 |
| VII. 验证优于猜测 | ✅ 确认 | 基于 Context7 文档和代码分析 |
| VIII. 类型安全优先 | ✅ 确认 | 设计使用联合类型和类型守卫 |
| XI. 工具链统一 | ✅ 确认 | 无新工具引入 |
| XII. 积极复用 TanStack AI | ✅ 确认 | 直接使用 `chat()` 而非自实现 |
| XIII. 库优先实现 | ✅ 确认 | 外部 API 使用标准 `fetch` |

**二次门禁结果**: ✅ 全部通过

---

## Phase 0 & 1 Artifacts Generated

| 产物 | 路径 | 状态 |
|------|------|------|
| 实施计划 | [plan.md](./plan.md) | ✅ 完成 |
| 研究文档 | [research.md](./research.md) | ✅ 完成 |
| 数据模型 | [data-model.md](./data-model.md) | ✅ 完成 |
| 快速开始 | [quickstart.md](./quickstart.md) | ✅ 完成 |
| LLM Node 契约 | [contracts/workflow-llm-node.md](./contracts/workflow-llm-node.md) | ✅ 完成 |
| Security 规则契约 | [contracts/security-external-api-rule.md](./contracts/security-external-api-rule.md) | ✅ 完成 |
| Agent Context | `.github/agents/copilot-instructions.md` | ✅ 已更新 |
| 任务分解 | tasks.md | ⏳ 待 `/speckit.tasks` 生成 |

---

## Next Steps

计划阶段已完成。执行以下步骤继续：

1. **生成任务**: 运行 `/speckit.tasks` 生成详细的实施任务
2. **开始实现**: 按任务顺序执行代码修改
3. **验证完成**: 运行 `pnpm test` 确保所有测试通过
