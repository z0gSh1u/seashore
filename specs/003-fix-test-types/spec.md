# Feature Specification: 修复单元测试中的类型问题

**Feature Branch**: `003-fix-test-types`  
**Created**: 2025-12-28  
**Status**: Complete  
**Input**: User description: "解决所有单测文件中的类型问题，移除无用导入，导入其他 ts 文件时不要 .js 后缀"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 类型正确的单元测试 (Priority: P1)

开发者在维护 Seashore 框架时，期望所有单元测试文件都能通过 TypeScript 类型检查，不会出现类型错误。这确保了测试代码本身的质量，同时也验证了被测试的源代码接口是否正确。

**Why this priority**: 单元测试的类型错误会导致：1) 测试无法正确运行 2) IDE 智能提示失效 3) 无法检测到源代码接口的变更问题。类型正确是测试可靠运行的前提。

**Independent Test**: 运行 `pnpm typecheck` 命令时，所有 `__tests__` 目录下的 `.test.ts` 文件应零错误通过类型检查。

**Acceptance Scenarios**:

1. **Given** 开发者克隆项目代码, **When** 运行 TypeScript 类型检查, **Then** 所有单测文件通过类型检查，无错误输出
2. **Given** 单测文件中存在类型错误, **When** 修复问题时, **Then** 优先修复根本原因（如修正 mock 类型、完善接口定义），而非使用 `any`、类型断言或非空断言
3. **Given** 类型问题源于源代码接口定义不完整, **When** 确认这是根因问题, **Then** 可以修改源代码以完善类型定义

---

### User Story 2 - 干净的测试文件导入 (Priority: P1)

开发者期望单元测试文件中的导入声明是干净的：没有未使用的导入，导入本地 TypeScript 文件时不使用 `.js` 后缀。

**Why this priority**: 未使用的导入增加代码噪音；使用 `.js` 后缀导入本地 TS 文件不符合项目的模块解析策略（`moduleResolution: bundler`），可能导致 IDE 跳转和类型推断问题。

**Independent Test**: 检查所有 `__tests__` 目录下的文件，确认无未使用导入和无 `.js` 后缀导入。

**Acceptance Scenarios**:

1. **Given** 开发者打开任意单测文件, **When** 查看导入声明, **Then** 所有导入都被实际使用
2. **Given** 单测文件导入本地 TypeScript 文件, **When** 查看导入路径, **Then** 路径不包含 `.js` 后缀（例如 `import { foo } from '../src/bar'` 而非 `import { foo } from '../src/bar.js'`）
3. **Given** 导入包含 `.js` 后缀, **When** 移除后缀, **Then** 模块解析仍能正常工作

---

### User Story 3 - 测试逻辑正确性保障 (Priority: P2)

在修复类型问题时，开发者期望测试的业务逻辑保持正确。如有业务理解偏差，优先保证类型和主流程正确，边缘用例可后续补充。

**Why this priority**: 修复类型问题时可能需要调整测试代码，必须确保这些调整不会破坏测试的有效性。核心流程的正确性比边缘用例更重要。

**Independent Test**: 运行 `pnpm test` 命令，主流程测试应全部通过。

**Acceptance Scenarios**:

1. **Given** 单测用例测试核心功能, **When** 因类型修复而调整测试代码, **Then** 测试仍验证预期的业务行为
2. **Given** 边缘用例与类型修复存在冲突, **When** 无法同时满足时, **Then** 可以标记为 `skip` 或 `todo`，待后续补充
3. **Given** 测试预期与实际业务逻辑存在偏差, **When** 需要调整时, **Then** 以源代码实现为准调整测试预期

---

### Edge Cases

- 当第三方库类型定义不完整时，可以在必要处添加类型断言并添加注释说明原因
- 当 mock 对象无法完全满足接口定义时，可以使用部分 mock 并确保类型安全
- 当源代码接口定义过于严格导致测试困难时，评估是否需要调整源代码

## Requirements *(mandatory)*

### Functional Requirements

**类型修复**

- **FR-001**: 系统 MUST 解决所有单测文件（`__tests__/**/*.test.ts`）中的 TypeScript 编译错误
- **FR-002**: 系统 MUST 优先修复类型问题的根本原因，而非滥用 `any`、类型断言（`as`）或非空断言（`!`）
- **FR-003**: 系统 MAY 在必要时修改源代码以完善类型定义，但应优先专注于修改单测代码
- **FR-004**: 系统 MAY 合理调整 `tsconfig.json` 配置以平衡类型安全和实用性

**导入清理**

- **FR-005**: 系统 MUST 移除所有单测文件中未使用的导入声明
- **FR-006**: 系统 MUST 将所有单测文件中本地 TypeScript 文件导入的 `.js` 后缀移除

**测试逻辑保障**

- **FR-007**: 系统 MUST 确保修复后的单测能够正确运行
- **FR-008**: 系统 SHOULD 保证测试用例的主流程业务逻辑正确
- **FR-009**: 系统 MAY 将边缘用例标记为 skip/todo 待后续补充

### Key Entities

- **Test File**: 位于 `packages/*/__tests__/` 目录下的 `.test.ts` 文件，包含单元测试用例
- **Source File**: 位于 `packages/*/src/` 目录下的 `.ts` 文件，是被测试的源代码
- **Import Statement**: 测试文件中的 import 声明，可能导入源码模块、测试工具或第三方库

## Assumptions

- 项目使用 `moduleResolution: bundler`，导入本地 TS 文件时不需要 `.js` 后缀
- Vitest 测试框架支持直接导入 `.ts` 文件
- 现有的 `tsconfig.json` 配置基本合理，只需微调
- 测试文件应该被包含在类型检查范围内

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 运行 TypeScript 类型检查时，所有单测文件零错误通过
- **SC-002**: 所有单测文件中不存在未使用的导入声明
- **SC-003**: 所有单测文件中不存在带 `.js` 后缀的本地文件导入
- **SC-004**: 运行 `pnpm test` 命令时，主流程测试全部通过
- **SC-005**: 代码中的 `any` 类型使用量不增加，类型断言仅用于必要场景并有注释说明
