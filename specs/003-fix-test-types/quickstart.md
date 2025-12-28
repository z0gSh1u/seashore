# Quickstart: 修复单元测试类型问题

**Feature**: 003-fix-test-types  
**Date**: 2025-12-28

## 快速开始

### 1. 验证当前状态

```bash
# 检查类型错误
pnpm exec tsc --noEmit

# 运行测试（预期会有类型相关警告）
pnpm test
```

### 2. 修复流程

#### Step 1: 扩展类型定义

修改 `packages/tool/src/types.ts`，扩展 `JsonSchema` 和 `JsonSchemaProperty` 类型以支持完整的 JSON Schema 属性。

#### Step 2: 修复测试文件

按包顺序修复：

1. **tool 包** (优先级最高 - 类型错误最多)
   - `__tests__/define-tool.test.ts`
   - `__tests__/schema.test.ts`
   - `__tests__/presets.test.ts`

2. **agent 包**
   - `__tests__/react-agent.test.ts`
   - `__tests__/integration.test.ts`

3. **llm 包**
   - `__tests__/adapters.test.ts`
   - `__tests__/integration.test.ts`

4. **其他包**
   - 按字母顺序处理

#### Step 3: 验证修复

```bash
# 再次检查类型
pnpm exec tsc --noEmit

# 运行所有测试
pnpm test
```

### 3. 修复模式

#### 移除 .js 后缀

```typescript
// Before
const { createAgent } = await import('../src/create-agent.js');

// After
const { createAgent } = await import('../src/create-agent');
```

#### 移除未使用导入

```typescript
// Before
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// After (如果 vi, beforeEach, afterEach 未使用)
import { describe, it, expect } from 'vitest';
```

#### 处理可选属性访问

```typescript
// Before (类型错误: 对象可能为未定义)
expect(jsonSchema.properties['name'].type).toBe('string');

// After (使用可选链或先断言存在)
const nameProp = jsonSchema.properties?.['name'];
expect(nameProp).toBeDefined();
expect(nameProp?.type).toBe('string');
```

## 检查清单

- [ ] `packages/tool/src/types.ts` 类型已扩展
- [ ] 所有 `.js` 后缀已移除 (27 处)
- [ ] 所有未使用导入已移除
- [ ] 所有可选属性访问已修复
- [ ] `pnpm exec tsc --noEmit` 通过
- [ ] `pnpm test` 通过
