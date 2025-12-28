# Data Model: 类型定义修改方案

**Feature**: 003-fix-test-types  
**Date**: 2025-12-28

## 概述

本文档定义了需要修改的类型结构，以支持完整的 JSON Schema 表示。

## 类型修改

### 1. JsonSchema (扩展)

**文件**: `packages/tool/src/types.ts`

**现有定义**:
```typescript
export interface JsonSchema {
  readonly type: 'object';
  readonly properties: Record<string, JsonSchemaProperty>;
  readonly required: readonly string[];
  readonly additionalProperties?: boolean;
}
```

**修改后**:
```typescript
/**
 * JSON Schema representation
 * 
 * 支持 Zod 4 toJSONSchema() 生成的所有标准属性
 */
export interface JsonSchema {
  /** JSON Schema 版本标识 */
  readonly $schema?: string;
  
  /** 类型（支持多种 JSON Schema 类型） */
  readonly type?: JsonSchemaType;
  
  /** 对象属性定义 */
  readonly properties?: Record<string, JsonSchemaProperty>;
  
  /** 必填字段列表 */
  readonly required?: readonly string[];
  
  /** 是否允许额外属性 */
  readonly additionalProperties?: boolean;
  
  /** 数组元素类型 */
  readonly items?: JsonSchemaProperty;
  
  /** 枚举值列表 */
  readonly enum?: readonly unknown[];
  
  /** 常量值（literal types） */
  readonly const?: unknown;
  
  /** 联合类型（oneOf） */
  readonly oneOf?: readonly JsonSchemaProperty[];
  
  /** 联合类型（anyOf） */
  readonly anyOf?: readonly JsonSchemaProperty[];
  
  /** 数值约束 */
  readonly minimum?: number;
  readonly maximum?: number;
  
  /** 字符串约束 */
  readonly minLength?: number;
  readonly maxLength?: number;
  
  /** 数组约束 */
  readonly minItems?: number;
  readonly maxItems?: number;
  
  /** 字符串格式 */
  readonly format?: string;
  
  /** 默认值 */
  readonly default?: unknown;
  
  /** 描述 */
  readonly description?: string;
}

/** JSON Schema 类型枚举 */
export type JsonSchemaType = 
  | 'object' 
  | 'array' 
  | 'string' 
  | 'number' 
  | 'integer' 
  | 'boolean' 
  | 'null';
```

### 2. JsonSchemaProperty (扩展)

**现有定义**:
```typescript
export interface JsonSchemaProperty {
  readonly type: string;
  readonly description?: string;
  readonly enum?: readonly unknown[];
  readonly items?: JsonSchemaProperty;
  readonly properties?: Record<string, JsonSchemaProperty>;
  readonly required?: readonly string[];
}
```

**修改后**:
```typescript
/**
 * JSON Schema 属性定义
 * 
 * 支持嵌套对象、数组、联合类型等复杂结构
 */
export interface JsonSchemaProperty {
  /** 类型 */
  readonly type?: string;
  
  /** 描述 */
  readonly description?: string;
  
  /** 枚举值列表 */
  readonly enum?: readonly unknown[];
  
  /** 常量值（literal types） */
  readonly const?: unknown;
  
  /** 数组元素类型 */
  readonly items?: JsonSchemaProperty;
  
  /** 嵌套对象属性 */
  readonly properties?: Record<string, JsonSchemaProperty>;
  
  /** 嵌套对象必填字段 */
  readonly required?: readonly string[];
  
  /** 联合类型（oneOf） */
  readonly oneOf?: readonly JsonSchemaProperty[];
  
  /** 联合类型（anyOf） */
  readonly anyOf?: readonly JsonSchemaProperty[];
  
  /** 数值约束 */
  readonly minimum?: number;
  readonly maximum?: number;
  
  /** 字符串约束 */
  readonly minLength?: number;
  readonly maxLength?: number;
  
  /** 数组约束 */
  readonly minItems?: number;
  readonly maxItems?: number;
  
  /** 字符串格式（uuid, email, uri 等） */
  readonly format?: string;
  
  /** 默认值 */
  readonly default?: unknown;
  
  /** 是否允许额外属性（嵌套对象） */
  readonly additionalProperties?: boolean;
}
```

## 类型兼容性

### 向后兼容

- 所有现有属性保持不变
- 新增属性均为可选，不影响现有代码
- `type` 从 `'object'` 改为可选的联合类型，支持更多场景

### 影响分析

| 组件 | 影响 | 说明 |
|------|------|------|
| `zodToJsonSchema()` | 无变化 | 返回值类型更宽松 |
| `defineTool()` | 无变化 | 内部类型推断不受影响 |
| `Tool.jsonSchema` | 类型变更 | 从严格类型变为宽松类型 |
| 测试文件 | 修复 | 可以访问之前不存在的属性 |

## 验证方式

1. **类型检查**: `pnpm exec tsc --noEmit` 
2. **单元测试**: `pnpm test`
3. **IDE 验证**: 确保所有测试文件无红色波浪线
