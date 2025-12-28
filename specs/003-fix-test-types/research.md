# Research: 修复单元测试中的类型问题

**Feature**: 003-fix-test-types  
**Date**: 2025-12-28

## 问题分析

### 1. 类型定义不完整

**问题**: `packages/tool/src/types.ts` 中的 `JsonSchema` 和 `JsonSchemaProperty` 类型定义过于严格，缺少 JSON Schema 的标准属性。

**当前定义**:
```typescript
export interface JsonSchema {
  readonly type: 'object';
  readonly properties: Record<string, JsonSchemaProperty>;
  readonly required: readonly string[];
  readonly additionalProperties?: boolean;
}

export interface JsonSchemaProperty {
  readonly type: string;
  readonly description?: string;
  readonly enum?: readonly unknown[];
  readonly items?: JsonSchemaProperty;
  readonly properties?: Record<string, JsonSchemaProperty>;
  readonly required?: readonly string[];
}
```

**缺少的属性**:
- `minimum`, `maximum` (number constraints)
- `minLength`, `maxLength` (string constraints)
- `minItems`, `maxItems` (array constraints)
- `default` (default values)
- `format` (string formats like 'uuid', 'email')
- `oneOf`, `anyOf` (union types)
- `const` (literal types)
- `$schema` (JSON Schema meta)

**决策**: 扩展 `JsonSchema` 和 `JsonSchemaProperty` 类型以包含这些标准 JSON Schema 属性。

**理由**: 
- Zod 4 的 `toJSONSchema()` 会生成这些标准属性
- 测试需要验证这些属性的正确性
- 扩展类型定义比使用类型断言更类型安全

**替代方案被拒绝**:
- 使用 `any` 或类型断言 → 违反 Constitution 原则 VIII
- 使用第三方 JSON Schema 类型库 → 增加依赖复杂度

### 2. `.js` 后缀导入

**问题**: 27 处动态导入使用了 `.js` 后缀，如 `await import('../src/adapters.js')`

**决策**: 移除所有 `.js` 后缀，改为 `await import('../src/adapters')`

**理由**:
- 项目使用 `moduleResolution: bundler`，不需要 `.js` 后缀
- Vitest 直接处理 `.ts` 文件，不需要编译后的 `.js`
- 保持一致性，所有导入都不使用扩展名

**替代方案被拒绝**:
- 保留 `.js` 后缀 → 与 `moduleResolution: bundler` 不一致
- 改为 `.ts` 后缀 → 非标准做法

### 3. 未使用的导入

**问题**: 测试文件中存在未使用的导入（如 `vi`, `beforeEach`, `afterEach`）

**决策**: 移除所有未使用的导入

**理由**:
- TypeScript 配置启用了 `noUnusedLocals`
- 保持代码整洁

### 4. 可选属性访问

**问题**: 访问嵌套的可选属性时没有进行空值检查，如 `jsonSchema.properties.user.type`

**决策**: 使用可选链 (`?.`) 或在测试前添加断言

**理由**:
- `noUncheckedIndexedAccess: true` 要求检查索引访问的结果
- 测试中应先验证属性存在再访问子属性

## 技术验证

### Zod 4 JSON Schema 输出示例

```typescript
import { z } from 'zod';

const schema = z.object({
  name: z.string().min(1).max(100).default('unnamed'),
  age: z.number().int().min(0).max(150),
  status: z.enum(['active', 'inactive']),
});

const jsonSchema = z.toJSONSchema(schema);
// 输出包含: $schema, type, properties, required
// properties 中包含: type, minLength, maxLength, default, minimum, maximum, enum
```

### tsconfig 配置验证

当前配置 `"exclude": ["**/__tests__/**"]` 排除了测试文件，需要确保测试文件也被类型检查：
- 各包的 `tsconfig.json` 已包含 `"__tests__/**/*.ts"` 在 include 中 ✅
- Vitest 使用根目录的 `tsconfig.json`，但测试文件被排除 ❌

**决策**: 确保各包的 `tsconfig.json` 正确包含测试文件。

## 影响范围

| 包 | 测试文件数 | `.js` 导入数 | 类型错误数 | 预估工作量 |
|---|---|---|---|---|
| tool | 3 | 0 | ~40 | 高 |
| agent | 2 | 8 | ~5 | 中 |
| llm | 2 | 12 | ~3 | 中 |
| storage | 2 | 4 | ~2 | 低 |
| 其他 | 9 | 3 | ~5 | 低 |
| **合计** | **18** | **27** | **~55** | - |

## 修复策略

1. **优先修复源码类型定义** (`packages/tool/src/types.ts`)
   - 扩展 `JsonSchema` 类型支持更多 `type` 值
   - 扩展 `JsonSchemaProperty` 类型支持所有标准属性

2. **按包修复测试文件**
   - 移除 `.js` 后缀
   - 移除未使用导入
   - 修复可选属性访问

3. **验证**
   - 运行 `pnpm exec tsc --noEmit` 验证类型
   - 运行 `pnpm test` 验证测试通过
