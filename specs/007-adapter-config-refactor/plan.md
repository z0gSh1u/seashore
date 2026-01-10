# Implementation Plan: LLM Adapter Configuration Refactor

**Branch**: `007-adapter-config-refactor` | **Date**: 2026-01-10 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/007-adapter-config-refactor/spec.md`

## Summary

重构 seashore 中所有多模态 adapter（Embedding、Image、Video、Transcription、TTS）的配置接口，使其支持可选的 `apiKey` 和 `baseURL` 参数。当前这些 adapter 只接受 model 和 dimensions 参数，API 密钥强制从环境变量获取，且无法自定义 API 端点。

技术方案：扩展现有的 adapter 接口类型定义，在各个 adapter 工厂函数中添加可选配置参数，并在底层 fetch 调用中优先使用传入的配置。此变更完全向后兼容，现有代码无需修改。

## Technical Context

**Language/Version**: TypeScript ^5.x  
**Primary Dependencies**: `@tanstack/ai` (用于 text adapter), 自定义 fetch 实现 (用于多模态)  
**Storage**: N/A  
**Testing**: Vitest ^3.x  
**Target Platform**: Node.js / Browser (ESM Only)  
**Project Type**: Monorepo (Nx + pnpm)  
**Performance Goals**: N/A（配置变更不影响性能）  
**Constraints**: 必须保持 100% 向后兼容  
**Scale/Scope**: 影响 `@seashore/llm` 包中的 5 种 adapter 类型

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| 原则 | 状态 | 说明 |
|-----|------|-----|
| I. TanStack AI 优先 | ✅ 通过 | Text adapter 继续使用 @tanstack/ai；多模态功能(@tanstack/ai 已移除 embedding 等)使用自定义实现 |
| II. 测试即门禁 | ✅ 通过 | 将添加单元测试验证新配置功能 |
| III. 文档先行 | ✅ 通过 | 已通过 Context7 查阅 @tanstack/ai 文档 |
| VI. ESM Only | ✅ 通过 | 仅输出 ESM 格式 |
| VII. 验证优于猜测 | ✅ 通过 | 已验证现有代码结构和 @tanstack/ai API |
| VIII. 类型安全优先 | ✅ 通过 | 将使用联合类型区分不同 provider 的配置能力 |
| X. 架构文档先于实现 | ✅ 通过 | 本计划即为架构文档 |
| XI. 工具链统一 | ✅ 通过 | 使用 pnpm, Nx, Rollup, Vitest |
| XII. 积极复用 TanStack AI | ✅ 通过 | @tanstack/ai 已移除 embedding 等多模态功能，因此自定义实现是必要的 |

## Project Structure

### Documentation (this feature)

```text
specs/007-adapter-config-refactor/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (TypeScript interfaces)
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
packages/llm/
├── src/
│   ├── types.ts         # 修改：扩展 adapter 接口定义
│   ├── embedding.ts     # 修改：openaiEmbed, geminiEmbed 函数签名
│   ├── multimodal.ts    # 修改：openaiImage, geminiImage, openaiVideo, 
│   │                    #       openaiTranscription, openaiTTS, geminiTTS 函数签名
│   └── index.ts         # 导出更新（如需要）
└── __tests__/
    ├── adapters.test.ts # 修改：添加新配置测试
    └── embedding.test.ts # 新增：embedding 配置测试
```

**Structure Decision**: 此功能仅涉及 `packages/llm` 子包，主要修改类型定义和 adapter 工厂函数。

## Complexity Tracking

> 无违规，无需记录复杂性追踪。

## Phase 0 Artifacts

- [research.md](research.md) - 技术研究与决策记录

## Phase 1 Artifacts

- [data-model.md](data-model.md) - 实体数据模型定义
- [contracts/adapter-types.d.ts](contracts/adapter-types.d.ts) - TypeScript 接口契约
- [quickstart.md](quickstart.md) - 快速开始指南

## Constitution Re-Check (Post Design)

| 原则 | 状态 | 说明 |
|-----|------|-----|
| I. TanStack AI 优先 | ✅ 通过 | 设计确认多模态功能使用自定义实现是正确的（@tanstack/ai 已移除 embedding） |
| VIII. 类型安全优先 | ✅ 通过 | 使用联合类型区分 OpenAI/Gemini 配置，保持类型安全 |
| XII. 积极复用 TanStack AI | ✅ 通过 | 研究确认 @tanstack/ai 不提供 embedding，自定义实现是必要的 |

**所有门禁通过，可以进入 Phase 2 任务拆解。**

## Next Steps

运行 `/speckit.tasks` 生成 `tasks.md` 以进入实现阶段。
