# updatePRD v1.3.1 — 紧急修复：SDK 升级与基础架构修复

> **版本**: v1.3.1（补丁版本）
> **优先级**: P0 — 紧急
> **日期**: 2026-03-23
> **类型**: 修复 + 基建加固

---

## 1. 执行摘要

v1.3.0 发布后发现 `gemini-3.1-pro-preview` 模型无法使用，根本原因是 SDK 版本过旧（1.8.0）且错误处理链存在多个 Bug，导致真实 API 错误被吞掉。

本次修复目标：
1. 升级 SDK 到 1.46.0（已完成）
2. 修复 8 个已识别的代码缺陷
3. 利用 SDK 内置重试替掉从未实现的空重试逻辑
4. 统一 5 个工具的调用模式

**核心原则：只修 Bug，不加功能。**

---

## 1.1 实测验证结果（2026-03-23 用真实 API Key 测试）

| 测试项 | SDK 1.8.0（MCP 老版本） | SDK 1.46.0（本地升级后） |
|--------|------------------------|------------------------|
| `gemini-3.1-pro-preview` 调用 | ❌ "model not supported" | ✅ 正常返回 |
| `gemini-3-flash-preview` 调用 | ✅ 正常 | ✅ 正常 |
| `gemini-3-pro-preview` 调用 | 未测试 | ✅ 仍可用（未完全下线） |
| `gemini-2.5-pro` 调用 | 未测试 | ✅ 正常 |
| SDK 内置重试（全局级别） | 不支持 | ✅ `httpOptions.retryOptions.attempts` |
| SDK 内置重试（请求级别） | 不支持 | ✅ `config.httpOptions.retryOptions` |
| SDK 内置超时 | 不支持 | ✅ `httpOptions.timeout` |
| 错误模型的真实报错 | 被吞掉，显示 "model not supported" | `404: models/xxx is not found for API version v1beta` |

**结论：问题 100% 是 SDK 1.8.0 过旧导致，升级到 1.46.0 后所有模型均正常。**

---

## 2. 问题清单

### 2.1 已识别的 Bug（按严重程度排序）

| # | 严重度 | 文件 | 行号 | 问题描述 |
|---|--------|------|------|----------|
| **Bug1** | 🔴 高 | `error-handler.ts` | L47 | `includes('model')` 和 `includes('not found')` 太宽泛，文件不存在等错误被误判为 MODEL_NOT_SUPPORTED，**这是 3.1 模型报错看不到真实原因的直接原因** |
| **Bug2** | 🔴 高 | `gemini-client.ts` | L99 | `maxRetries=3` 定义并存储但**从未在任何循环中使用**，重试逻辑完全是死代码 |
| **Bug3** | 🔴 高 | `analyze-codebase.ts` | L306→L441 | 函数签名接收 `client: GeminiClient` 参数但**完全忽略它**，直接从 `process.env` 读 apiKey 重建连接 |
| **Bug4** | 🔴 高 | 5 个工具文件 | 各 catch 块 | 参数验证错误（文件不存在、参数缺失）被 `handleAPIError` 处理，全部归为 `API_ERROR (-32000)` 而非 `INVALID_PARAMS (-32602)` |
| **Bug5** | 🟡 中 | `gemini-client.ts` | L94 | 默认模型硬编码为 `'gemini-3-pro-preview'`（已退役），未使用 `getDefaultModel()` |
| **Bug6** | 🟡 中 | `gemini-client.ts` | L98 | `timeout=60000` 存储但无 `AbortController` 实现，超时控制是死代码 |
| **Bug7** | 🟡 中 | 5 个工具文件 | 各 catch 块 | `throw handleAPIError(error)` 抛出的是普通 POJO 对象而非 `Error` 实例，`error.stack` 为 undefined，`instanceof Error` 失败 |
| **Bug8** | 🟢 低 | `error-handler.ts` | L86 | `sanitizeErrorMessage` 只清理 `apiKey=xxx` 格式，URL 中 `?key=AIzaSy...` 和 Bearer Token 不清理 |

### 2.2 架构问题

| 问题 | 现状 | 目标 |
|------|------|------|
| 调用模式不统一 | 3 个工具用 `GeminiClient` 封装，2 个直接用 `GoogleGenAI` | 统一为一种模式 |
| `analyze-codebase.ts` 默认模型 | 硬编码 `'gemini-3.1-pro-preview'` | 从配置读取 |

> **注意**: `search.ts` 默认模型 `'gemini-3-flash-preview'` 是**设计意图**（搜索场景优先速度），不是 bug，保持不变。

### 2.3 模型策略（与 v1.3.0 一致）

| 模型 | 角色 | 说明 |
|------|------|------|
| `gemini-3.1-pro-preview` | **默认模型**（4 个工具） | analyze-content, analyze-codebase, brainstorm, multimodal-query |
| `gemini-3-flash-preview` | **搜索默认**（1 个工具） | search 工具专用，速度优先 |
| `gemini-3-pro-preview` | 废弃映射 | 自动映射到 3.1-pro，实测仍可调用但随时可能下线 |
| `gemini-2.5-pro` | 用户可选 | 保留在枚举中供手动选择，不作为任何工具默认 |

**本次不新增、不移除任何模型，仅修复基础架构问题。**

---

## 3. 技术方案

### 3.1 SDK 升级（已完成）

```
@google/genai: 1.8.0 → 1.46.0
```

- 编译已通过，无 TypeScript 错误
- 新 SDK 原生支持 `gemini-3.1-pro-preview`

### 3.2 修复 Bug1：错误处理精确化

**文件**: `src/utils/error-handler.ts`

**当前代码（有 Bug）**:
```typescript
// L47 — 太宽泛，'not found' 会匹配文件不存在等错误
if (error.message?.includes('model') || error.message?.includes('not found')) {
  return createMCPError(ERROR_CODES.MODEL_NOT_SUPPORTED, ...);
}
```

**修复方案**:
```typescript
// 精确匹配 Google API 返回的模型相关错误
if (
  error.message?.includes('models/') ||                    // "models/gemini-xxx is not found"
  error.message?.includes('not supported for model') ||    // "feature not supported for model"
  error.message?.includes('Model not found') ||            // Google API 标准错误
  error.message?.includes('model is not available') ||     // 模型不可用
  error.status === 404                                     // HTTP 404
) {
  return createMCPError(
    ERROR_CODES.MODEL_NOT_SUPPORTED,
    `模型不可用: ${error.message}`,  // 透传原始错误信息
    { originalError: error.message, statusCode: error.status }
  );
}
```

**关键改动**：
- 用精确的错误模式替代模糊的 `includes('model')` 和 `includes('not found')`
- 透传 Google API 原始错误信息到用户端
- 添加 HTTP 状态码检测

### 3.3 修复 Bug2：用 SDK 内置重试替换死代码

**发现**: SDK 1.46.0 内置了两层重试机制：

| 层级 | 接口 | 默认值 | 作用 |
|------|------|--------|------|
| 请求级 | `config.httpOptions.retryOptions.attempts` | 5 | 每个请求的最大尝试次数 |
| 客户端级 | `GoogleGenAI({ httpOptions })` | — | 全局默认配置 |

**方案**:

```typescript
// GoogleGenAI 构造函数中启用内置重试和超时
const ai = new GoogleGenAI({
  apiKey,
  httpOptions: {
    timeout: API_CONFIG.timeout,  // 60000ms
    retryOptions: {
      attempts: API_CONFIG.maxRetries + 1,  // 4 次（首次 + 3 次重试）
    }
  }
});
```

**同时清理 GeminiClient 中的死代码**:
- 移除 `this.config.timeout`（SDK 内置）
- 移除 `this.config.maxRetries`（SDK 内置）
- 移除 `GeminiClientConfig` 中的 `timeout` 和 `maxRetries` 字段

### 3.4 修复 Bug3：统一调用模式

**方案 A（推荐）：让所有工具直接使用 `GoogleGenAI`，废弃 `GeminiClient` 封装**

理由：
- `search.ts` 和 `analyze-codebase.ts` 已经证明直接调用更灵活（需要传 `tools`、`thinkingConfig` 等特殊配置）
- `GeminiClient` 的 `generate()` 和 `generateMultimodal()` 本质上只是薄封装，没有增加实际价值（重试是死代码、超时是死代码）
- SDK 1.46.0 本身已经足够好用，不需要额外封装

具体做法：
1. 创建一个轻量工厂函数 `createGeminiAI(apiKey)`，返回配置好重试和超时的 `GoogleGenAI` 实例
2. 所有 5 个工具统一使用这个工厂函数
3. 废弃 `GeminiClient` 类（或标记 deprecated）

```typescript
// src/utils/gemini-factory.ts（新文件）
import { GoogleGenAI } from '@google/genai';
import { API_CONFIG } from '../config/constants.js';

/**
 * 创建配置好重试和超时的 GoogleGenAI 实例
 */
export function createGeminiAI(apiKey: string): GoogleGenAI {
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      timeout: API_CONFIG.timeout,
      retryOptions: {
        attempts: API_CONFIG.maxRetries + 1,
      }
    }
  });
}
```

**方案 B：修复 `GeminiClient`，让它变得真正有用**

- 给 `generate()` 和 `generateMultimodal()` 加上 `config` 参数（支持 tools、thinkingConfig）
- 内部使用 SDK 重试
- 让 `search.ts` 和 `analyze-codebase.ts` 回归使用 `GeminiClient`

**推荐方案 A**：因为 SDK 本身已经足够好用，额外封装层只会增加维护负担。

### 3.5 修复 Bug4：分离验证错误和 API 错误

**当前问题**：所有工具只有一个 catch 块，参数验证错误和 API 错误混在一起。

**方案**：引入错误类型区分

```typescript
// src/utils/errors.ts（新文件）

/**
 * 参数验证错误（用户输入问题）
 */
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * 安全验证错误（路径遍历等）
 */
export class SecurityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SecurityError';
  }
}
```

在工具的 catch 块中区分处理：

```typescript
} catch (error: any) {
  logError('toolName', error);
  if (error instanceof ValidationError || error instanceof SecurityError) {
    throw handleValidationError(error.message);  // 返回 INVALID_PARAMS (-32602)
  }
  throw handleAPIError(error);  // 只处理真正的 API 错误
}
```

### 3.6 修复 Bug5：默认模型统一从配置读取

```typescript
// gemini-client.ts L94，修改前：
this.modelId = config.model || 'gemini-3-pro-preview';

// 修改后：
import { getDefaultModel } from '../config/models.js';
this.modelId = config.model || getDefaultModel().id;
```

### 3.7 修复 Bug7：MCPError 继承 Error

```typescript
// 修改 MCPError 为 Error 子类
export class MCPError extends Error {
  code: number;
  data?: any;

  constructor(code: number, message: string, data?: any) {
    super(message);
    this.name = 'MCPError';
    this.code = code;
    this.data = data;
  }
}
```

### 3.8 修复 Bug8：增强敏感信息清理

```typescript
export function sanitizeErrorMessage(error: any): string {
  const msg = typeof error === 'string' ? error : error?.message || 'Unknown error';
  return msg
    .replace(/apiKey\s*=\s*[^\s]+/gi, 'apiKey=***')
    .replace(/[?&]key=[A-Za-z0-9_-]+/gi, '?key=***')       // URL query 中的 key
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer ***')    // Bearer Token
    .replace(/AIzaSy[A-Za-z0-9_-]{33}/g, 'AIza***');        // Google API Key 格式
}
```

---

## 4. 文件变更清单

| # | 文件 | 变更类型 | 说明 |
|---|------|----------|------|
| 1 | `package.json` | 修改 | SDK 版本 `^1.8.0` → `^1.46.0`（已完成），版本号 → `1.3.1` |
| 2 | `src/utils/gemini-factory.ts` | **新增** | 统一的 GoogleGenAI 工厂函数（含重试+超时配置） |
| 3 | `src/utils/errors.ts` | **新增** | ValidationError / SecurityError 错误类 |
| 4 | `src/utils/error-handler.ts` | 重写 | 精确化错误匹配，MCPError 改为 Error 子类，增强敏感信息清理 |
| 5 | `src/utils/gemini-client.ts` | 重构 | 使用工厂函数，移除死代码（maxRetries/timeout），默认模型从配置读取 |
| 6 | `src/tools/search.ts` | 修改 | 使用 `createGeminiAI()` 替代直接 `new GoogleGenAI()`，分离 catch 逻辑 |
| 7 | `src/tools/analyze-codebase.ts` | 修改 | 使用 `createGeminiAI()` 替代直接 `new GoogleGenAI()`，修复忽略 client 参数的问题 |
| 8 | `src/tools/analyze-content.ts` | 修改 | 分离验证错误和 API 错误的 catch 逻辑 |
| 9 | `src/tools/multimodal-query.ts` | 修改 | 分离验证错误和 API 错误的 catch 逻辑 |
| 10 | `src/tools/brainstorm.ts` | 修改 | 分离验证错误和 API 错误的 catch 逻辑 |
| 11 | `src/types.ts` | 修改 | MCPError 改为 class（继承 Error） |
| 12 | `src/config/constants.ts` | 修改 | 版本号更新 |
| 13 | `CHANGELOG.md` | 修改 | 添加 v1.3.1 条目 |

**预计变更量**: ~13 个文件，约 200-250 行代码

---

## 5. 验收标准

### 5.1 功能验收

- [ ] `gemini-3.1-pro-preview` 模型可正常调用（所有 4 个工具）
- [ ] `gemini-3-flash-preview` 模型可正常调用（搜索工具）
- [ ] 指定已退役的 `gemini-3-pro-preview` 时，自动映射到 3.1 并显示警告
- [ ] API 错误信息透传到用户端（不再被吞掉）
- [ ] 参数错误返回 `-32602`，API 错误返回 `-32000`，模型错误返回 `-32003`

### 5.2 质量验收

- [ ] TypeScript 编译无错误
- [ ] MCP 服务器启动正常，显示 v1.3.1
- [ ] 5 个工具全部连接成功
- [ ] 网络断开时 SDK 自动重试（最多 4 次）

### 5.3 回归验收

- [ ] 搜索工具 Google Search Grounding 正常
- [ ] 多模态工具图片分析正常
- [ ] 代码库分析工具大文件正常
- [ ] 创意生成工具 JSON 输出格式正常

---

## 6. 风险评估

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|----------|
| SDK 1.46.0 有 API 不兼容 | 低 | 高 | 已编译通过，核心 API `generateContent` 未变 |
| 废弃 GeminiClient 影响外部使用者 | 低 | 低 | 该类未被导出/文档化，仅内部使用 |
| 重试机制导致 API 费用增加 | 低 | 低 | 只在网络错误/5XX 时重试，正常调用不重试 |

---

## 7. 不在本次范围内

以下内容属于 v2.0.0 范围，本次**不涉及**：
- 新增工具（代码执行、图片生成）
- File API 集成
- ThinkingLevel 扩展
- Interactions API
- 任何新功能
